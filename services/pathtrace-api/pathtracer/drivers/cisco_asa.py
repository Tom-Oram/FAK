"""Cisco ASA driver implementation."""

import time
import logging
from typing import List, Dict, Optional

from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException

from .base import NetworkDriver
from ..models import (
    RouteEntry, NetworkDevice, CredentialSet, InterfaceDetail,
    PolicyResult, NatResult,
    DeviceConnectionError, AuthenticationError, CommandError
)
from ..parsers.cisco_asa_parser import CiscoASAParser


logger = logging.getLogger(__name__)


class CiscoASADriver(NetworkDriver):
    """Driver for Cisco ASA firewalls."""

    def __init__(self, device: NetworkDevice, credentials: CredentialSet, config: Dict = None):
        super().__init__(device, credentials, config)
        self.parser = CiscoASAParser()
        self.device_type = 'cisco_asa'

    def connect(self) -> None:
        """Establish SSH connection to Cisco ASA device."""
        try:
            connection_params = {
                'device_type': self.device_type,
                'host': self.device.management_ip,
                'username': self.credentials.username,
                'timeout': self.config.get('ssh_timeout', 30),
                'session_timeout': self.config.get('command_timeout', 60),
            }

            # Add authentication method
            if self.credentials.has_key():
                connection_params['use_keys'] = True
                connection_params['key_file'] = self.credentials.ssh_key_file
            elif self.credentials.has_password():
                connection_params['password'] = self.credentials.password
            else:
                raise AuthenticationError("No valid authentication method provided")

            # ASA enable password (secret)
            if self.credentials.secret:
                connection_params['secret'] = self.credentials.secret

            logger.debug(f"Connecting to {self.device.hostname} ({self.device.management_ip})")
            self.connection = ConnectHandler(**connection_params)

            self._connected = True
            logger.info(f"Successfully connected to {self.device.hostname}")

        except NetmikoAuthenticationException as e:
            raise AuthenticationError(f"Authentication failed for {self.device.hostname}: {e}")
        except NetmikoTimeoutException as e:
            raise DeviceConnectionError(f"Connection timeout for {self.device.hostname}: {e}")
        except Exception as e:
            raise DeviceConnectionError(f"Failed to connect to {self.device.hostname}: {e}")

    def disconnect(self) -> None:
        """Close SSH connection."""
        if self.connection:
            try:
                self.connection.disconnect()
                logger.debug(f"Disconnected from {self.device.hostname}")
            except Exception as e:
                logger.warning(f"Error disconnecting from {self.device.hostname}: {e}")
            finally:
                self._connected = False
                self.connection = None

    def get_route(self, destination: str, context: str = None) -> Optional[RouteEntry]:
        """
        Query routing table for specific destination.

        Args:
            destination: Destination IP address
            context: Security context name (optional)

        Returns:
            RouteEntry for the destination, or None if no route found
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            start_time = time.time()

            ctx = context if context and context != "system" else "system"
            command = f"show route {destination}"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            elapsed_ms = (time.time() - start_time) * 1000

            logger.debug(f"Command completed in {elapsed_ms:.2f}ms")

            route = self.parser.parse_route_entry(output, destination, ctx)

            if route:
                logger.debug(f"Found route: {route.destination} via {route.next_hop}")
            else:
                logger.debug(f"No route found for {destination}")

            return route

        except Exception as e:
            raise CommandError(f"Failed to get route for {destination}: {e}")

    def get_routing_table(self, context: str = None) -> List[RouteEntry]:
        """
        Get full routing table.

        Args:
            context: Security context name (optional)

        Returns:
            List of RouteEntry objects
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            ctx = context if context and context != "system" else "system"
            command = "show route"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command, read_timeout=90)

            routes = self.parser.parse_routing_table(output, ctx)
            logger.debug(f"Parsed {len(routes)} routes from routing table")

            return routes

        except Exception as e:
            raise CommandError(f"Failed to get routing table: {e}")

    def list_logical_contexts(self) -> List[str]:
        """
        List all security contexts (multi-context mode) or return ["system"].

        Returns:
            List of security context names
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            output = self.connection.send_command("show context")

            # If the command returns meaningful output, parse context names
            contexts = []
            if output and output.strip():
                lines = output.strip().split("\n")
                for line in lines:
                    stripped = line.strip()
                    # Skip headers, separator lines, and empty lines
                    if not stripped or stripped.startswith("Context") or stripped.startswith("---") or stripped.startswith("*"):
                        continue
                    # Skip lines that look like error messages
                    if "not supported" in stripped.lower() or "not available" in stripped.lower():
                        return ["system"]
                    parts = stripped.split()
                    if parts:
                        contexts.append(parts[0])

            if not contexts:
                contexts = ["system"]

            # Always include system
            if "system" not in contexts:
                contexts.insert(0, "system")

            logger.debug(f"Found security contexts: {contexts}")
            return contexts

        except Exception as e:
            logger.warning(f"Failed to list security contexts: {e}")
            return ["system"]

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        """
        Map interfaces to their nameif names.

        Uses 'show nameif' to get the physical-to-nameif mapping.

        Returns:
            Dictionary mapping physical interface name to nameif name
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            output = self.connection.send_command("show nameif")
            mapping = self.parser.parse_nameif_mapping(output)
            logger.debug(f"Found nameif mapping: {mapping}")
            return mapping

        except Exception as e:
            logger.warning(f"Failed to get nameif mapping: {e}")
            return {}

    def detect_device_info(self) -> Dict:
        """
        Return device hostname, version, model.

        Uses 'show version' on ASA.

        Returns:
            Dictionary with keys: hostname, version, model, serial
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            info = {
                'hostname': '',
                'version': '',
                'model': '',
                'serial': ''
            }

            output = self.connection.send_command("show version")
            lines = output.split('\n')

            for line in lines:
                lower = line.lower().strip()

                # Cisco Adaptive Security Appliance Software Version 9.16(3)
                if 'software version' in lower:
                    version_match = line.split('Version')
                    if len(version_match) > 1:
                        info['version'] = version_match[-1].strip()

                # Hardware:   ASA5525, 8192 MB RAM
                elif lower.startswith('hardware:'):
                    parts = line.split(':', 1)[1].strip().split(',')
                    if parts:
                        info['model'] = parts[0].strip()

                # Serial Number: ABC12345678
                elif 'serial number:' in lower:
                    info['serial'] = line.split(':', 1)[1].strip()

                # hostname
                elif line.strip().endswith('up'):
                    # "<hostname> up 10 days 5 hours"
                    hostname_match = line.strip().split()
                    if hostname_match:
                        info['hostname'] = hostname_match[0]

            # Fallback hostname from device object
            if not info['hostname']:
                info['hostname'] = self.device.hostname

            return info

        except Exception as e:
            logger.warning(f"Failed to detect device info: {e}")
            return {'hostname': self.device.hostname, 'version': '', 'model': '', 'serial': ''}

    def get_interface_detail(self, interface_name: str) -> Optional[InterfaceDetail]:
        """
        Get operational detail for a specific interface.

        Args:
            interface_name: Interface name (e.g. 'GigabitEthernet0/0')

        Returns:
            InterfaceDetail or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            command = f"show interface {interface_name}"
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_interface_detail(output)
        except Exception as e:
            logger.warning(f"Failed to get interface detail for {interface_name}: {e}")
            return None

    def get_zone_for_interface(self, interface_name: str) -> Optional[str]:
        """
        Get the nameif (security zone equivalent) for an interface.

        ASA uses nameif as the zone concept. This method looks up the
        nameif name for a given physical interface using 'show nameif'.

        Args:
            interface_name: Physical interface name (e.g. 'GigabitEthernet0/0')

        Returns:
            Nameif name string, or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            output = self.connection.send_command("show nameif")
            mapping = self.parser.parse_nameif_mapping(output)

            # Look up the nameif for the given physical interface
            nameif = mapping.get(interface_name)
            if nameif:
                logger.debug(f"Interface {interface_name} has nameif '{nameif}'")
            else:
                logger.debug(f"No nameif found for interface {interface_name}")
            return nameif
        except Exception as e:
            logger.warning(f"Failed to get zone for interface {interface_name}: {e}")
            return None

    def lookup_security_policy(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int,
        source_zone: str, dest_zone: str
    ) -> Optional[PolicyResult]:
        """
        Find matching security policy rule using packet-tracer.

        The source_zone parameter maps to the ASA nameif (the interface
        to use as the input interface for packet-tracer).

        Args:
            source_ip: Source IP address
            dest_ip: Destination IP address
            protocol: Protocol name (tcp, udp, icmp)
            port: Destination port number
            source_zone: Source nameif (used as packet-tracer input interface)
            dest_zone: Destination nameif (not used directly by ASA packet-tracer)

        Returns:
            PolicyResult or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            proto = protocol.lower()
            command = (
                f"packet-tracer input {source_zone}"
                f" {proto}"
                f" {source_ip} {port}"
                f" {dest_ip} {port}"
                f" detailed"
            )
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command, read_timeout=60)

            policy_result, _nat_result = self.parser.parse_packet_tracer(output)
            return policy_result
        except Exception as e:
            logger.warning(f"Failed to lookup security policy: {e}")
            return None

    def lookup_nat(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int
    ) -> Optional[NatResult]:
        """
        Find NAT translations using packet-tracer.

        Note: packet-tracer requires an input interface (nameif). Since
        lookup_nat doesn't receive zone info, we attempt to determine
        the source interface from the routing table. If unavailable, we
        fall back to a generic approach.

        Args:
            source_ip: Source IP address
            dest_ip: Destination IP address
            protocol: Protocol name (tcp, udp, icmp)
            port: Destination port number

        Returns:
            NatResult or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            # We need an input interface for packet-tracer.
            # Try to determine it from the route to the source.
            # Fall back to first available nameif if route lookup fails.
            input_iface = self._resolve_input_interface(source_ip)
            if not input_iface:
                logger.warning("Could not determine input interface for NAT lookup")
                return None

            proto = protocol.lower()
            command = (
                f"packet-tracer input {input_iface}"
                f" {proto}"
                f" {source_ip} {port}"
                f" {dest_ip} {port}"
                f" detailed"
            )
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command, read_timeout=60)

            _policy_result, nat_result = self.parser.parse_packet_tracer(output)
            return nat_result
        except Exception as e:
            logger.warning(f"Failed to lookup NAT policy: {e}")
            return None

    def _resolve_input_interface(self, source_ip: str) -> Optional[str]:
        """
        Resolve the input nameif for a given source IP using the routing table.

        Looks up the route for source_ip and maps the outgoing interface
        (which on ASA is already a nameif name) to use as packet-tracer input.

        Args:
            source_ip: Source IP address

        Returns:
            Nameif name string, or None if unable to resolve
        """
        try:
            output = self.connection.send_command(f"show route {source_ip}")
            route = self.parser.parse_route_entry(output, source_ip, "system")
            if route and route.outgoing_interface:
                return route.outgoing_interface
        except Exception as e:
            logger.debug(f"Failed to resolve input interface for {source_ip}: {e}")

        # Fallback: try to get first nameif
        try:
            output = self.connection.send_command("show nameif")
            mapping = self.parser.parse_nameif_mapping(output)
            if mapping:
                return next(iter(mapping.values()))
        except Exception as e:
            logger.debug(f"Failed to get fallback nameif: {e}")

        return None
