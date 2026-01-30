"""Palo Alto PAN-OS driver implementation."""

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
from ..parsers.paloalto_parser import PaloAltoParser


logger = logging.getLogger(__name__)


class PaloAltoDriver(NetworkDriver):
    """Driver for Palo Alto PAN-OS firewalls."""

    def __init__(self, device: NetworkDevice, credentials: CredentialSet, config: Dict = None):
        super().__init__(device, credentials, config)
        self.parser = PaloAltoParser()
        self.device_type = 'paloalto_panos'

    def connect(self) -> None:
        """Establish SSH connection to Palo Alto device."""
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
            context: Virtual router name (optional)

        Returns:
            RouteEntry for the destination, or None if no route found
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            start_time = time.time()

            # Build command
            vr = context if context and context != "default" else self.device.default_context
            command = f"show routing route destination {destination} virtual-router {vr}"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            elapsed_ms = (time.time() - start_time) * 1000

            logger.debug(f"Command completed in {elapsed_ms:.2f}ms")

            # Parse output
            route = self.parser.parse_route_entry(output, destination, vr)

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
            context: Virtual router name (optional)

        Returns:
            List of RouteEntry objects
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            # Build command
            vr = context if context and context != "default" else self.device.default_context
            command = f"show routing route virtual-router {vr}"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command, read_timeout=90)

            # Parse output
            routes = self.parser.parse_routing_table(output, vr)
            logger.debug(f"Parsed {len(routes)} routes from routing table")

            return routes

        except Exception as e:
            raise CommandError(f"Failed to get routing table: {e}")

    def list_logical_contexts(self) -> List[str]:
        """
        List all virtual routers.

        Returns:
            List of virtual router names
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            output = self.connection.send_command("show routing virtual-router")
            vrs = self.parser.parse_virtual_router_list(output)

            # Always include default
            if "default" not in vrs:
                vrs.insert(0, "default")

            logger.debug(f"Found virtual routers: {vrs}")
            return vrs

        except Exception as e:
            logger.warning(f"Failed to list virtual routers: {e}")
            return ["default"]

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        """
        Map interfaces to their virtual routers.

        Returns:
            Dictionary mapping interface name to virtual router name
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            # Get interface list
            output = self.connection.send_command("show interface all")
            interfaces = self.parser.parse_interface_list(output)

            # For Palo Alto, we'd need to check virtual router configuration
            # For MVP, return all interfaces in default VR
            mapping = {intf: self.device.default_context for intf in interfaces.keys()}

            return mapping

        except Exception as e:
            logger.warning(f"Failed to get interface VR mapping: {e}")
            return {}

    def detect_device_info(self) -> Dict:
        """
        Return device hostname, version, model.

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

            # Get system info
            output = self.connection.send_command("show system info")
            lines = output.split('\n')

            for line in lines:
                if 'hostname:' in line.lower():
                    info['hostname'] = line.split(':', 1)[1].strip()
                elif 'sw-version:' in line.lower():
                    info['version'] = line.split(':', 1)[1].strip()
                elif 'model:' in line.lower():
                    info['model'] = line.split(':', 1)[1].strip()
                elif 'serial:' in line.lower():
                    info['serial'] = line.split(':', 1)[1].strip()

            return info

        except Exception as e:
            logger.warning(f"Failed to detect device info: {e}")
            return {'hostname': self.device.hostname, 'version': '', 'model': '', 'serial': ''}

    def get_interface_detail(self, interface_name: str) -> Optional[InterfaceDetail]:
        """
        Get operational detail for a specific interface.

        Args:
            interface_name: Interface name (e.g. 'ethernet1/1')

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
        Get the security zone assigned to an interface.

        Args:
            interface_name: Interface name (e.g. 'ethernet1/1')

        Returns:
            Zone name string, or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            command = f"show interface {interface_name}"
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_zone_from_interface(output)
        except Exception as e:
            logger.warning(f"Failed to get zone for interface {interface_name}: {e}")
            return None

    @staticmethod
    def _protocol_number(protocol: str) -> str:
        """
        Map protocol name to IANA protocol number string.

        Args:
            protocol: Protocol name (e.g. 'tcp', 'udp', 'icmp')

        Returns:
            Protocol number as string, or the original value if not mapped
        """
        protocol_map = {
            "tcp": "6",
            "udp": "17",
            "icmp": "1",
        }
        return protocol_map.get(protocol.lower(), protocol)

    def lookup_security_policy(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int,
        source_zone: str, dest_zone: str
    ) -> Optional[PolicyResult]:
        """
        Find matching security policy rule for the given traffic parameters.

        Uses 'test security-policy-match' PAN-OS command.

        Args:
            source_ip: Source IP address
            dest_ip: Destination IP address
            protocol: Protocol name (tcp, udp, icmp)
            port: Destination port number
            source_zone: Source security zone
            dest_zone: Destination security zone

        Returns:
            PolicyResult or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            proto_num = self._protocol_number(protocol)
            command = (
                f"test security-policy-match"
                f" source {source_ip}"
                f" destination {dest_ip}"
                f" protocol {proto_num}"
                f" destination-port {port}"
                f" from {source_zone}"
                f" to {dest_zone}"
            )
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_security_policy_match(output)
        except Exception as e:
            logger.warning(f"Failed to lookup security policy: {e}")
            return None

    def lookup_nat(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int
    ) -> Optional[NatResult]:
        """
        Find NAT translations for the given traffic parameters.

        Uses 'test nat-policy-match' PAN-OS command.

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
            proto_num = self._protocol_number(protocol)
            command = (
                f"test nat-policy-match"
                f" source {source_ip}"
                f" destination {dest_ip}"
                f" protocol {proto_num}"
                f" destination-port {port}"
            )
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_nat_policy_match(output)
        except Exception as e:
            logger.warning(f"Failed to lookup NAT policy: {e}")
            return None
