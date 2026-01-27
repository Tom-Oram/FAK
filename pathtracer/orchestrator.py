"""Main path tracing orchestrator."""

import time
import logging
from typing import Optional, Set, Tuple

from .models import (
    TracePath, PathHop, PathStatus, NetworkDevice,
    RoutingLoopDetected, MaxHopsExceeded, DeviceNotFoundError
)
from .discovery import DeviceInventory
from .credentials import CredentialManager
from .drivers.cisco_ios import CiscoIOSDriver


logger = logging.getLogger(__name__)


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

    def trace_path(self, source_ip: str, destination_ip: str,
                   initial_context: str = None, start_device: str = None) -> TracePath:
        """
        Trace network path from source to destination.

        Args:
            source_ip: Source IP address
            destination_ip: Destination IP address
            initial_context: Optional VRF/context to start in
            start_device: Optional hostname to start from

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
                    raise DeviceNotFoundError(f"Start device not found: {start_device}")
            else:
                current_device = self.inventory.find_device_for_subnet(source_ip)
                if not current_device:
                    raise DeviceNotFoundError(
                        f"No device found for source IP {source_ip}. "
                        "Provide a start device or update inventory."
                    )

            logger.info(f"Starting trace from {source_ip} to {destination_ip}")
            logger.info(f"Initial device: {current_device.hostname}")

            # Determine starting context
            current_context = initial_context or current_device.default_context

            # Track visited devices to detect loops
            visited: Set[Tuple[str, str]] = set()
            hop_sequence = 1

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
                route = self._query_device(current_device, destination_ip, current_context)
                hop_time_ms = (time.time() - hop_start_time) * 1000

                if not route:
                    # No route found
                    hop = PathHop(
                        sequence=hop_sequence,
                        device=current_device,
                        logical_context=current_context,
                        lookup_time_ms=hop_time_ms,
                        notes="No route to destination"
                    )
                    path.add_hop(hop)
                    path.status = PathStatus.INCOMPLETE
                    path.error_message = f"No route to {destination_ip} on {current_device.hostname}"
                    logger.warning(path.error_message)
                    break

                # Create hop record
                hop = PathHop(
                    sequence=hop_sequence,
                    device=current_device,
                    egress_interface=route.outgoing_interface,
                    logical_context=current_context,
                    route_used=route,
                    lookup_time_ms=hop_time_ms
                )
                path.add_hop(hop)

                logger.info(f"  Route: {route.destination} via {route.next_hop} ({route.protocol})")

                # Check if destination reached
                if route.is_destination_reached(destination_ip):
                    path.status = PathStatus.COMPLETE
                    logger.info(f"Destination reached at {current_device.hostname}")
                    break

                # Check for black hole
                if route.next_hop_type in ["null", "reject"]:
                    path.status = PathStatus.BLACKHOLED
                    path.error_message = f"Traffic black-holed at {current_device.hostname}"
                    logger.warning(path.error_message)
                    break

                # Find next hop device
                next_device = self._find_next_device(route.next_hop)
                if not next_device:
                    path.status = PathStatus.INCOMPLETE
                    path.error_message = f"Next hop device not found for {route.next_hop}"
                    logger.warning(path.error_message)
                    break

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

    def _query_device(self, device: NetworkDevice, destination: str, context: str):
        """
        Query device for route to destination.

        Args:
            device: Device to query
            destination: Destination IP
            context: Routing context

        Returns:
            RouteEntry or None
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
                return route
        except Exception as e:
            logger.error(f"Failed to query {device.hostname}: {e}")
            raise

    def _get_driver(self, device: NetworkDevice, credentials):
        """Get appropriate driver for device vendor."""
        from .drivers.arista_eos import AristaEOSDriver
        from .drivers.paloalto import PaloAltoDriver
        from .drivers.aruba import ArubaDriver

        vendor_drivers = {
            'cisco_ios': CiscoIOSDriver,
            'cisco_iosxe': CiscoIOSDriver,
            'cisco_nxos': CiscoIOSDriver,
            'arista_eos': AristaEOSDriver,
            'paloalto': PaloAltoDriver,
            'paloalto_panos': PaloAltoDriver,
            'aruba': ArubaDriver,
            'aruba_os': ArubaDriver,
        }

        driver_class = vendor_drivers.get(device.vendor)
        if not driver_class:
            raise ValueError(f"Unsupported vendor: {device.vendor}. Supported: {', '.join(vendor_drivers.keys())}")

        return driver_class(device, credentials, self.config.get('connection', {}))

    def _find_next_device(self, next_hop_ip: str) -> Optional[NetworkDevice]:
        """
        Find device for next hop IP.

        Args:
            next_hop_ip: Next hop IP address

        Returns:
            NetworkDevice or None
        """
        # Try exact match on management IP first
        device = self.inventory.find_device_by_ip(next_hop_ip)
        if device:
            return device

        # Try subnet match
        device = self.inventory.find_device_for_subnet(next_hop_ip)
        return device

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
