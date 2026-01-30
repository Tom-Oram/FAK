"""Juniper SRX (Junos) driver implementation."""

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
from ..parsers.juniper_srx_parser import JuniperSRXParser


logger = logging.getLogger(__name__)


class JuniperSRXDriver(NetworkDriver):
    """Driver for Juniper SRX firewalls running Junos."""

    def __init__(self, device: NetworkDevice, credentials: CredentialSet, config: Dict = None):
        super().__init__(device, credentials, config)
        self.parser = JuniperSRXParser()
        self.device_type = 'juniper_junos'

    def connect(self) -> None:
        """Establish SSH connection to Juniper SRX device."""
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
            context: Routing instance name (optional)

        Returns:
            RouteEntry for the destination, or None if no route found
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            start_time = time.time()

            ctx = context if context and context != "global" else self.device.default_context
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
            context: Routing instance name (optional)

        Returns:
            List of RouteEntry objects
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            ctx = context if context and context != "global" else self.device.default_context
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
        List all routing instances.

        Returns:
            List of routing instance names
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            output = self.connection.send_command("show routing-instances")

            instances = []
            if output and output.strip():
                lines = output.strip().split("\n")
                for line in lines:
                    stripped = line.strip()
                    # Skip headers, separator lines, and empty lines
                    if not stripped or stripped.startswith("Instance") or stripped.startswith("---"):
                        continue
                    parts = stripped.split()
                    if parts:
                        instances.append(parts[0])

            # Always include global (master)
            if "global" not in instances:
                instances.insert(0, "global")

            logger.debug(f"Found routing instances: {instances}")
            return instances

        except Exception as e:
            logger.warning(f"Failed to list routing instances: {e}")
            return ["global"]

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        """
        Map interfaces to their routing instances.

        Parses 'show routing-instances' to determine which interfaces
        belong to which routing instances.

        Returns:
            Dictionary mapping interface name to routing instance name
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            output = self.connection.send_command("show routing-instances")

            mapping = {}
            current_instance = None
            if output and output.strip():
                lines = output.strip().split("\n")
                for line in lines:
                    stripped = line.strip()
                    if not stripped or stripped.startswith("Instance") or stripped.startswith("---"):
                        continue
                    parts = stripped.split()
                    if parts:
                        # Lines starting with a non-space character are instance names
                        if not line.startswith(" ") and not line.startswith("\t"):
                            current_instance = parts[0]
                        # Look for interface names in the output
                        if current_instance:
                            for part in parts:
                                # Interface names typically contain '/' or start with known prefixes
                                if "/" in part and any(part.startswith(p) for p in
                                                       ["ge-", "xe-", "et-", "ae", "lo", "irb", "reth"]):
                                    mapping[part] = current_instance

            return mapping

        except Exception as e:
            logger.warning(f"Failed to get interface routing-instance mapping: {e}")
            return {}

    def detect_device_info(self) -> Dict:
        """
        Return device hostname, version, model.

        Uses 'show version' on Junos.

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

                # Hostname: srx-01
                if lower.startswith('hostname:'):
                    info['hostname'] = line.split(':', 1)[1].strip()

                # Junos: 21.4R3-S5.4
                elif lower.startswith('junos:'):
                    info['version'] = line.split(':', 1)[1].strip()

                # Model: srx340
                elif lower.startswith('model:'):
                    info['model'] = line.split(':', 1)[1].strip()

                # JUNOS Software Release [21.4R3-S5.4] (alternative version format)
                elif 'junos software release' in lower and not info['version']:
                    import re
                    ver_match = re.search(r'\[(.+?)\]', line)
                    if ver_match:
                        info['version'] = ver_match.group(1)

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

        Uses 'show interfaces <name> extensive'.

        Args:
            interface_name: Interface name (e.g. 'ge-0/0/0.0')

        Returns:
            InterfaceDetail or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            command = f"show interfaces {interface_name} extensive"
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_interface_detail(output)
        except Exception as e:
            logger.warning(f"Failed to get interface detail for {interface_name}: {e}")
            return None

    def get_zone_for_interface(self, interface_name: str) -> Optional[str]:
        """
        Get the security zone assigned to an interface.

        Queries 'show security zones' and builds an interface-to-zone
        mapping, then looks up the given interface.

        Args:
            interface_name: Interface name (e.g. 'ge-0/0/0.0')

        Returns:
            Zone name string, or None if not found or on error
        """
        if not self._connected:
            return None

        try:
            output = self.connection.send_command("show security zones")
            zone_map = self.parser.parse_security_zones(output)

            zone = zone_map.get(interface_name)
            if zone:
                logger.debug(f"Interface {interface_name} is in zone '{zone}'")
            else:
                logger.debug(f"No zone found for interface {interface_name}")
            return zone
        except Exception as e:
            logger.warning(f"Failed to get zone for interface {interface_name}: {e}")
            return None

    def lookup_security_policy(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int,
        source_zone: str, dest_zone: str
    ) -> Optional[PolicyResult]:
        """
        Find matching security policy rule for the given traffic parameters.

        Uses 'show security match-policies' Junos command.

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
            command = (
                f"show security match-policies"
                f" from-zone {source_zone}"
                f" to-zone {dest_zone}"
                f" source-ip {source_ip}"
                f" destination-ip {dest_ip}"
                f" source-port {port}"
                f" destination-port {port}"
                f" protocol {protocol}"
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

        Queries both source and destination NAT rule tables, then
        passes the output to the parser for matching.

        Args:
            source_ip: Source IP address
            dest_ip: Destination IP address
            protocol: Protocol name (tcp, udp, icmp)
            port: Destination port number

        Returns:
            NatResult or None if no NAT found or on error
        """
        if not self._connected:
            return None

        try:
            # Get source NAT rules
            source_command = "show security nat source rule all"
            logger.debug(f"Executing: {source_command}")
            source_output = self.connection.send_command(source_command)

            # Get destination NAT rules
            dest_command = "show security nat destination rule all"
            logger.debug(f"Executing: {dest_command}")
            dest_output = self.connection.send_command(dest_command)

            return self.parser.parse_nat_rules(
                source_output, dest_output,
                source_ip, dest_ip,
                protocol, port
            )
        except Exception as e:
            logger.warning(f"Failed to lookup NAT rules: {e}")
            return None
