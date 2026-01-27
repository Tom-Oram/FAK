"""Parser for Cisco IOS routing table output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType


class CiscoIOSParser:
    """Parser for Cisco IOS show ip route output."""

    @staticmethod
    def parse_route_entry(output: str, destination: str, context: str = "global") -> Optional[RouteEntry]:
        """
        Parse 'show ip route <destination>' output.

        Expected formats:
        - Routing entry for 192.168.1.0/24
        - Known via "ospf 1", distance 110, metric 20
        - Last update from 10.1.1.2 on GigabitEthernet0/1, 00:05:23 ago

        Or for connected:
        - Routing entry for 10.10.0.0/16
        - Known via "connected", distance 0, metric 0 (connected, via interface)

        Args:
            output: Raw command output
            destination: Destination IP that was queried
            context: VRF or routing context

        Returns:
            RouteEntry or None if no route found
        """
        if not output or "not in table" in output.lower() or "% subnet not in table" in output.lower():
            return None

        lines = output.strip().split('\n')

        # Parse routing entry
        destination_network = None
        protocol = "unknown"
        preference = 0
        metric = 0
        next_hop = None
        interface = None

        # Find destination network
        for line in lines:
            match = re.search(r'Routing entry for\s+(\S+)', line)
            if match:
                destination_network = match.group(1)
                break

        if not destination_network:
            return None

        # Parse protocol and metrics
        for line in lines:
            # Known via "ospf 1", distance 110, metric 20
            match = re.search(r'Known via\s+"([^"]+)",\s+distance\s+(\d+),\s+metric\s+(\d+)', line)
            if match:
                protocol = match.group(1)
                preference = int(match.group(2))
                metric = int(match.group(3))

        # Parse next hop and interface
        for line in lines:
            # Last update from 10.1.1.2 on GigabitEthernet0/1
            match = re.search(r'(?:Last update from|via)\s+(\S+)(?:\s+on\s+(\S+))?', line)
            if match:
                next_hop = match.group(1)
                if match.group(2):
                    interface = match.group(2).rstrip(',')
                break

        # Determine next hop type
        next_hop_type = NextHopType.IP.value
        if protocol == "connected":
            next_hop_type = NextHopType.CONNECTED.value
        elif protocol == "local":
            next_hop_type = NextHopType.LOCAL.value
        elif "Null" in (interface or ""):
            next_hop_type = NextHopType.NULL.value

        return RouteEntry(
            destination=destination_network,
            next_hop=next_hop or interface or "",
            next_hop_type=next_hop_type,
            outgoing_interface=interface,
            protocol=protocol,
            logical_context=context,
            metric=metric,
            preference=preference,
            raw_output=output
        )

    @staticmethod
    def parse_routing_table(output: str, context: str = "global") -> List[RouteEntry]:
        """
        Parse full routing table from 'show ip route' output.

        Args:
            output: Raw command output
            context: VRF or routing context

        Returns:
            List of RouteEntry objects
        """
        routes = []
        lines = output.strip().split('\n')

        current_network = None
        current_protocol = None

        for line in lines:
            line = line.strip()

            # Skip empty lines and headers
            if not line or line.startswith('Codes:') or line.startswith('Gateway'):
                continue

            # Parse route entry
            # C        10.1.1.0/24 is directly connected, GigabitEthernet0/0
            # O        192.168.1.0/24 [110/20] via 10.1.1.2, 00:05:23, GigabitEthernet0/1
            # S*       0.0.0.0/0 [1/0] via 10.0.0.1

            match = re.match(r'^([A-Z\*\s]+)\s+(\S+)\s+(.+)$', line)
            if match:
                protocol_code = match.group(1).strip()
                network = match.group(2)
                rest = match.group(3)

                # Map protocol codes
                protocol_map = {
                    'C': 'connected',
                    'L': 'local',
                    'S': 'static',
                    'S*': 'static',
                    'O': 'ospf',
                    'B': 'bgp',
                    'D': 'eigrp',
                    'R': 'rip',
                    'i': 'isis',
                }

                protocol = protocol_map.get(protocol_code.replace('*', ''), 'unknown')

                # Parse connected routes
                if 'directly connected' in rest:
                    match_int = re.search(r'directly connected,\s+(\S+)', rest)
                    interface = match_int.group(1) if match_int else None

                    routes.append(RouteEntry(
                        destination=network,
                        next_hop=interface or "",
                        next_hop_type=NextHopType.CONNECTED.value,
                        outgoing_interface=interface,
                        protocol=protocol,
                        logical_context=context,
                        metric=0,
                        preference=0,
                        raw_output=line
                    ))

                # Parse routes with next hop
                else:
                    # [110/20] via 10.1.1.2, 00:05:23, GigabitEthernet0/1
                    match_via = re.search(r'\[(\d+)/(\d+)\]\s+via\s+(\S+)(?:,\s+[\d:]+,\s+(\S+))?', rest)
                    if match_via:
                        preference = int(match_via.group(1))
                        metric = int(match_via.group(2))
                        next_hop = match_via.group(3)
                        interface = match_via.group(4)

                        routes.append(RouteEntry(
                            destination=network,
                            next_hop=next_hop,
                            next_hop_type=NextHopType.IP.value,
                            outgoing_interface=interface,
                            protocol=protocol,
                            logical_context=context,
                            metric=metric,
                            preference=preference,
                            raw_output=line
                        ))

        return routes

    @staticmethod
    def parse_vrf_list(output: str) -> List[str]:
        """
        Parse 'show vrf' or 'show ip vrf' output.

        Args:
            output: Raw command output

        Returns:
            List of VRF names
        """
        vrfs = []
        lines = output.strip().split('\n')

        for line in lines:
            # Skip headers
            if 'Name' in line or '---' in line:
                continue

            # VRF name is usually first column
            parts = line.strip().split()
            if parts:
                vrf_name = parts[0]
                if vrf_name and not vrf_name.startswith('%'):
                    vrfs.append(vrf_name)

        return vrfs

    @staticmethod
    def parse_interfaces(output: str) -> dict:
        """
        Parse 'show ip interface brief' output.

        Args:
            output: Raw command output

        Returns:
            Dictionary mapping interface name to IP address
        """
        interfaces = {}
        lines = output.strip().split('\n')

        for line in lines:
            # Skip headers
            if 'Interface' in line or '---' in line:
                continue

            # GigabitEthernet0/0    10.1.1.1        YES manual up                    up
            match = re.match(r'^(\S+)\s+(\S+)\s+', line)
            if match:
                interface = match.group(1)
                ip = match.group(2)
                if ip != 'unassigned':
                    interfaces[interface] = ip

        return interfaces
