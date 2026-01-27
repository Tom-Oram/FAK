"""Cisco IOS/IOS-XE driver implementation."""

import time
import logging
from typing import List, Dict, Optional
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException

from .base import NetworkDriver
from ..models import (
    RouteEntry, NetworkDevice, CredentialSet,
    DeviceConnectionError, AuthenticationError, CommandError, ParseError
)
from ..parsers.cisco_ios_parser import CiscoIOSParser


logger = logging.getLogger(__name__)


class CiscoIOSDriver(NetworkDriver):
    """Driver for Cisco IOS and IOS-XE devices."""

    def __init__(self, device: NetworkDevice, credentials: CredentialSet, config: Dict = None):
        super().__init__(device, credentials, config)
        self.parser = CiscoIOSParser()
        self.device_type = 'cisco_ios'

    def connect(self) -> None:
        """Establish SSH connection to Cisco IOS device."""
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

            # Add enable secret if provided
            if self.credentials.secret:
                connection_params['secret'] = self.credentials.secret

            logger.debug(f"Connecting to {self.device.hostname} ({self.device.management_ip})")
            self.connection = ConnectHandler(**connection_params)

            # Enter enable mode if secret provided
            if self.credentials.secret and not self.connection.check_enable_mode():
                self.connection.enable()

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
            context: VRF name (optional)

        Returns:
            RouteEntry for the destination, or None if no route found
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            start_time = time.time()

            # Build command
            if context and context != "global":
                command = f"show ip route vrf {context} {destination}"
            else:
                command = f"show ip route {destination}"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            elapsed_ms = (time.time() - start_time) * 1000

            logger.debug(f"Command completed in {elapsed_ms:.2f}ms")

            # Parse output
            route = self.parser.parse_route_entry(output, destination, context or "global")

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
            context: VRF name (optional)

        Returns:
            List of RouteEntry objects
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            # Build command
            if context and context != "global":
                command = f"show ip route vrf {context}"
            else:
                command = "show ip route"

            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command, read_timeout=90)

            # Parse output
            routes = self.parser.parse_routing_table(output, context or "global")
            logger.debug(f"Parsed {len(routes)} routes from routing table")

            return routes

        except Exception as e:
            raise CommandError(f"Failed to get routing table: {e}")

    def list_logical_contexts(self) -> List[str]:
        """
        List all VRFs.

        Returns:
            List of VRF names
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            # Try 'show vrf' first (IOS-XE)
            try:
                output = self.connection.send_command("show vrf")
            except:
                # Fall back to 'show ip vrf' (IOS)
                output = self.connection.send_command("show ip vrf")

            vrfs = self.parser.parse_vrf_list(output)

            # Always include global VRF
            if "global" not in vrfs:
                vrfs.insert(0, "global")

            logger.debug(f"Found VRFs: {vrfs}")
            return vrfs

        except Exception as e:
            logger.warning(f"Failed to list VRFs: {e}")
            return ["global"]

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        """
        Map interfaces to their VRFs.

        Returns:
            Dictionary mapping interface name to VRF name
        """
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            # Get interface list
            output = self.connection.send_command("show ip interface brief")
            interfaces = self.parser.parse_interfaces(output)

            # For each interface, check its VRF
            mapping = {}
            for interface in interfaces.keys():
                try:
                    vrf_output = self.connection.send_command(f"show run interface {interface} | include vrf")
                    if "ip vrf forwarding" in vrf_output:
                        vrf_name = vrf_output.split("ip vrf forwarding")[1].strip().split()[0]
                        mapping[interface] = vrf_name
                    else:
                        mapping[interface] = "global"
                except:
                    mapping[interface] = "global"

            return mapping

        except Exception as e:
            logger.warning(f"Failed to get interface VRF mapping: {e}")
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

            # Get hostname
            hostname_output = self.connection.send_command("show run | include hostname")
            if "hostname" in hostname_output:
                info['hostname'] = hostname_output.split("hostname")[1].strip().split()[0]

            # Get version
            version_output = self.connection.send_command("show version | include Version")
            if version_output:
                info['version'] = version_output.strip().split('\n')[0]

            # Get model and serial
            inventory_output = self.connection.send_command("show inventory")
            lines = inventory_output.split('\n')
            for line in lines:
                if 'PID:' in line:
                    parts = line.split(',')
                    for part in parts:
                        if 'PID:' in part:
                            info['model'] = part.split(':')[1].strip()
                        if 'SN:' in part:
                            info['serial'] = part.split(':')[1].strip()
                    break

            return info

        except Exception as e:
            logger.warning(f"Failed to detect device info: {e}")
            return {'hostname': self.device.hostname, 'version': '', 'model': '', 'serial': ''}
