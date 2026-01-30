"""Main path tracing orchestrator."""

import time
import logging
from typing import Optional, Set, Tuple

from .models import (
    NetworkDevice, PathHop, TracePath,
    PathStatus, HopQueryResult,
    DeviceNotFoundError, RoutingLoopDetected, MaxHopsExceeded,
    ResolveResult, ResolveStatus,
)
from .discovery import DeviceInventory
from .credentials import CredentialManager
from .drivers.cisco_ios import CiscoIOSDriver


logger = logging.getLogger(__name__)

FIREWALL_VENDORS = {"paloalto", "paloalto_panos", "cisco_asa", "cisco_ftd", "juniper_srx", "fortinet"}


class PathTracer:
    """Main orchestrator for network path tracing."""

    def __init__(self, inventory: DeviceInventory, credentials: CredentialManager, config: dict = None):
        """
        Initialize path tracer.

        Args:
            inventory: DeviceInventory instance
            credentials: CredentialManager instance
            config: Optional configuration dictionary
        """
        self.inventory = inventory
        self.credentials = credentials
        self.config = config or {}
        self.max_hops = self.config.get('max_hops', 30)

    def _is_firewall(self, device: NetworkDevice) -> bool:
        """Check if a device is a firewall based on vendor or device_type."""
        return device.vendor in FIREWALL_VENDORS or device.device_type == "firewall"

    def trace_path(self, source_ip: str, destination_ip: str,
                   initial_context: str = None, start_device: str = None,
                   protocol: str = "tcp", destination_port: int = 443) -> TracePath:
        """
        Trace network path from source to destination.

        Args:
            source_ip: Source IP address
            destination_ip: Destination IP address
            initial_context: Optional VRF/context to start in
            start_device: Optional hostname to start from
            protocol: Protocol for firewall policy lookups (default: tcp)
            destination_port: Destination port for firewall lookups (default: 443)

        Returns:
            TracePath object with results
        """
        start_time = time.time()
        path = TracePath(source_ip=source_ip, destination_ip=destination_ip)

        try:
            # Find starting device
            if start_device:
                current_device = self.inventory.find_device_by_hostname(start_device)
                if not current_device:
                    raise DeviceNotFoundError(
                        f"Start device '{start_device}' not found in inventory"
                    )
            else:
                result = self._resolve_device(source_ip)
                if result.status == ResolveStatus.NOT_FOUND:
                    path.status = PathStatus.NEEDS_INPUT
                    path.error_message = "Source IP not found in inventory. Please specify a starting device."
                    path.metadata['candidates'] = []
                    path.total_time_ms = (time.time() - start_time) * 1000
                    return path
                elif result.status == ResolveStatus.AMBIGUOUS:
                    path.status = PathStatus.NEEDS_INPUT
                    path.error_message = f"Source IP {source_ip} matches multiple devices. Please select a starting device."
                    path.metadata['candidates'] = self._serialize_candidates(result.candidates)
                    path.total_time_ms = (time.time() - start_time) * 1000
                    return path
                else:
                    current_device = result.device

            logger.info(f"Starting trace from {source_ip} to {destination_ip}")
            logger.info(f"Initial device: {current_device.hostname}")

            # Determine starting context
            current_context = initial_context or current_device.default_context

            # Track visited devices to detect loops
            visited: Set[Tuple[str, str]] = set()
            hop_sequence = 1

            # working_destination tracks post-NAT destination (changes on DNAT)
            working_destination = destination_ip
            # Track previous hop's egress interface for ingress on next hop
            previous_egress_interface = None

            # Main tracing loop
            while True:
                # Check for loops
                device_context_key = (current_device.management_ip, current_context)
                if device_context_key in visited:
                    path.status = PathStatus.LOOP_DETECTED
                    path.error_message = f"Routing loop detected at {current_device.hostname} in context {current_context}"
                    logger.error(path.error_message)
                    break

                visited.add(device_context_key)

                # Check hop limit
                if hop_sequence > self.max_hops:
                    path.status = PathStatus.MAX_HOPS_EXCEEDED
                    path.error_message = f"Maximum hops ({self.max_hops}) exceeded"
                    logger.error(path.error_message)
                    break

                # Query routing table on current device
                logger.info(f"Hop {hop_sequence}: Querying {current_device.hostname} (context: {current_context})")

                hop_start_time = time.time()
                result = self._query_device(
                    current_device, working_destination, current_context,
                    ingress_interface=previous_egress_interface,
                    protocol=protocol,
                    destination_port=destination_port,
                    source_ip=source_ip,
                )
                hop_time_ms = (time.time() - hop_start_time) * 1000

                route = result.route if result else None

                if not route:
                    # No route found
                    hop = PathHop(
                        sequence=hop_sequence,
                        device=current_device,
                        ingress_interface=previous_egress_interface,
                        logical_context=current_context,
                        lookup_time_ms=hop_time_ms,
                        notes="No route to destination"
                    )
                    path.add_hop(hop)
                    path.status = PathStatus.INCOMPLETE
                    path.error_message = f"No route to {working_destination} on {current_device.hostname}"
                    logger.warning(path.error_message)
                    break

                # Create hop record with enrichment from HopQueryResult
                hop = PathHop(
                    sequence=hop_sequence,
                    device=current_device,
                    ingress_interface=previous_egress_interface,
                    egress_interface=route.outgoing_interface,
                    logical_context=current_context,
                    route_used=route,
                    lookup_time_ms=hop_time_ms,
                    ingress_detail=result.ingress_detail,
                    egress_detail=result.egress_detail,
                    policy_result=result.policy_result,
                    nat_result=result.nat_result,
                )
                path.add_hop(hop)

                logger.info(f"  Route: {route.destination} via {route.next_hop} ({route.protocol})")

                # Track egress interface for next hop's ingress
                previous_egress_interface = route.outgoing_interface

                # Update working_destination on DNAT
                if result.nat_result and result.nat_result.dnat:
                    new_dest = result.nat_result.dnat.translated_ip
                    logger.info(f"  DNAT detected: {working_destination} -> {new_dest}")
                    working_destination = new_dest

                # Check if destination reached
                if route.is_destination_reached(working_destination):
                    path.status = PathStatus.COMPLETE
                    logger.info(f"Destination reached at {current_device.hostname}")
                    break

                # Check for black hole
                if route.next_hop_type in ["null", "reject"]:
                    path.status = PathStatus.BLACKHOLED
                    path.error_message = f"Traffic black-holed at {current_device.hostname}"
                    logger.warning(path.error_message)
                    break

                # Find next hop device (hop was just added above, so hops is non-empty)
                previous_hop = path.hops[-1]
                resolve_result = self._resolve_device(route.next_hop, previous_hop=previous_hop)

                if resolve_result.status == ResolveStatus.NOT_FOUND:
                    path.status = PathStatus.INCOMPLETE
                    path.error_message = f"Next hop device not found for {route.next_hop}"
                    logger.warning(path.error_message)
                    break
                elif resolve_result.status == ResolveStatus.AMBIGUOUS:
                    path.status = PathStatus.AMBIGUOUS_HOP
                    path.error_message = f"Next hop {route.next_hop} matches multiple devices. Please select one to continue."
                    path.metadata['ambiguous_hop_sequence'] = hop_sequence + 1
                    path.metadata['candidates'] = self._serialize_candidates(resolve_result.candidates)
                    logger.warning(path.error_message)
                    break
                else:
                    next_device = resolve_result.device
                    if resolve_result.status == ResolveStatus.RESOLVED_BY_SITE:
                        logger.info(f"Resolved {route.next_hop} to {next_device.hostname} via site affinity ({next_device.site})")

                # Determine context for next hop (simplified - assumes same context)
                # In production, this would handle VRF transitions
                next_context = self._determine_next_context(
                    current_device, current_context,
                    next_device, route
                )

                # Move to next device
                current_device = next_device
                current_context = next_context
                hop_sequence += 1

        except Exception as e:
            path.status = PathStatus.ERROR
            path.error_message = str(e)
            logger.error(f"Path trace failed: {e}", exc_info=True)

        finally:
            path.total_time_ms = (time.time() - start_time) * 1000
            logger.info(f"Path trace completed in {path.total_time_ms:.2f}ms")
            logger.info(f"Status: {path.status.value}, Hops: {path.hop_count()}")

        return path

    def _query_device(self, device: NetworkDevice, destination: str, context: str,
                      ingress_interface: str = None, protocol: str = "tcp",
                      destination_port: int = 443, source_ip: str = None) -> HopQueryResult:
        """
        Query device for route to destination and collect enrichment data.

        Args:
            device: Device to query
            destination: Destination IP
            context: Routing context
            ingress_interface: Ingress interface name from previous hop's egress
            protocol: Protocol for firewall policy lookups
            destination_port: Destination port for firewall lookups
            source_ip: Source IP for firewall policy lookups

        Returns:
            HopQueryResult with route and optional enrichment data
        """
        # Get credentials
        creds = self.credentials.get_credentials(device.credentials_ref)
        if not creds:
            raise ValueError(f"No credentials found for {device.credentials_ref}")

        # Get appropriate driver
        driver = self._get_driver(device, creds)

        try:
            with driver:
                route = driver.get_route(destination, context)

                if not route:
                    return HopQueryResult(route=None)

                # Collect enrichment data — each sub-query is wrapped
                # individually so failures set the field to None rather
                # than aborting the entire trace.
                egress_detail = None
                ingress_detail = None
                policy_result = None
                nat_result = None

                # Get interface details
                if route.outgoing_interface:
                    try:
                        egress_detail = driver.get_interface_detail(route.outgoing_interface)
                    except Exception as e:
                        logger.warning(f"Failed to get egress interface detail for {route.outgoing_interface}: {e}")
                if ingress_interface:
                    try:
                        ingress_detail = driver.get_interface_detail(ingress_interface)
                    except Exception as e:
                        logger.warning(f"Failed to get ingress interface detail for {ingress_interface}: {e}")

                # Firewall-specific enrichment
                if self._is_firewall(device):
                    # Get zones for interfaces
                    ingress_zone = None
                    egress_zone = None
                    if ingress_interface:
                        try:
                            ingress_zone = driver.get_zone_for_interface(ingress_interface)
                        except Exception as e:
                            logger.warning(f"Failed to get ingress zone for {ingress_interface}: {e}")
                    if route.outgoing_interface:
                        try:
                            egress_zone = driver.get_zone_for_interface(route.outgoing_interface)
                        except Exception as e:
                            logger.warning(f"Failed to get egress zone for {route.outgoing_interface}: {e}")

                    # Security policy lookup
                    if ingress_zone and egress_zone and source_ip:
                        try:
                            policy_result = driver.lookup_security_policy(
                                source_ip, destination,
                                protocol, destination_port,
                                ingress_zone, egress_zone,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to lookup security policy on {device.hostname}: {e}")

                    # NAT lookup
                    if source_ip:
                        try:
                            nat_result = driver.lookup_nat(
                                source_ip, destination,
                                protocol, destination_port,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to lookup NAT on {device.hostname}: {e}")

                return HopQueryResult(
                    route=route,
                    egress_detail=egress_detail,
                    ingress_detail=ingress_detail,
                    policy_result=policy_result,
                    nat_result=nat_result,
                )
        except Exception as e:
            logger.error(f"Failed to query {device.hostname}: {e}")
            raise

    def _get_driver(self, device: NetworkDevice, credentials):
        """Get appropriate driver for device vendor."""
        from .drivers.arista_eos import AristaEOSDriver
        from .drivers.paloalto import PaloAltoDriver
        from .drivers.aruba import ArubaDriver
        from .drivers.cisco_asa import CiscoASADriver
        from .drivers.cisco_ftd import CiscoFTDDriver
        from .drivers.juniper_srx import JuniperSRXDriver

        vendor_drivers = {
            'cisco_ios': CiscoIOSDriver,
            'cisco_iosxe': CiscoIOSDriver,
            'cisco_nxos': CiscoIOSDriver,
            'arista_eos': AristaEOSDriver,
            'paloalto': PaloAltoDriver,
            'paloalto_panos': PaloAltoDriver,
            'aruba': ArubaDriver,
            'aruba_os': ArubaDriver,
            'cisco_asa': CiscoASADriver,
            'cisco_ftd': CiscoFTDDriver,
            'juniper_srx': JuniperSRXDriver,
            'juniper_junos': JuniperSRXDriver,
        }

        driver_class = vendor_drivers.get(device.vendor)
        if not driver_class:
            raise ValueError(f"Unsupported vendor: {device.vendor}. Supported: {', '.join(vendor_drivers.keys())}")

        return driver_class(device, credentials, self.config.get('connection', {}))

    def _resolve_device(self, ip: str, previous_hop: Optional[PathHop] = None) -> ResolveResult:
        """Resolve an IP to a device, with site-affinity disambiguation."""
        # Stage 1: Find candidates by management IP
        candidates = self.inventory.find_device_by_ip(ip)

        # Stage 2: Fall back to subnet match
        if not candidates:
            candidates = self.inventory.find_device_for_subnet(ip)

        # Stage 3: Evaluate
        if len(candidates) == 0:
            return ResolveResult(device=None, status=ResolveStatus.NOT_FOUND, candidates=[])

        if len(candidates) == 1:
            return ResolveResult(device=candidates[0], status=ResolveStatus.RESOLVED, candidates=candidates)

        # Stage 4: Disambiguate by site affinity
        if previous_hop and previous_hop.device.site:
            same_site = [c for c in candidates if c.site == previous_hop.device.site]
            if len(same_site) == 1:
                return ResolveResult(device=same_site[0], status=ResolveStatus.RESOLVED_BY_SITE, candidates=candidates)
            if len(same_site) > 1:
                return ResolveResult(device=None, status=ResolveStatus.AMBIGUOUS, candidates=same_site)
            # No devices at the same site - return all as ambiguous
            return ResolveResult(device=None, status=ResolveStatus.AMBIGUOUS, candidates=candidates)

        # No previous hop context (source IP case) - ambiguous
        return ResolveResult(device=None, status=ResolveStatus.AMBIGUOUS, candidates=candidates)

    def _serialize_candidates(self, candidates: list) -> list:
        """Serialize candidate devices for API response."""
        return [
            {'hostname': c.hostname, 'management_ip': c.management_ip, 'site': c.site, 'vendor': c.vendor}
            for c in candidates
        ]

    def _determine_next_context(self, current_device: NetworkDevice, current_context: str,
                                next_device: NetworkDevice, route) -> str:
        """
        Determine routing context for next device.

        This is a simplified version. Production would handle:
        - VRF-to-VRF transitions
        - Firewall zone crossings
        - MPLS VPN transitions

        Args:
            current_device: Current device
            current_context: Current context
            next_device: Next device
            route: Route being followed

        Returns:
            Context name for next device
        """
        # For MVP, assume same context or default
        if current_context in next_device.logical_contexts:
            return current_context
        return next_device.default_context
