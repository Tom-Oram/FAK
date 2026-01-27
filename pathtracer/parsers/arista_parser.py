"""Parser for Arista EOS output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType


class AristaParser:
    """Parser for Arista EOS routing output."""

    @staticmethod
    def parse_route_entry(output: str, destination: str, context: str = "default") -> Optional[RouteEntry]:
        """
        Parse 'show ip route <destination> vrf <vrf>' output.

        Arista EOS output is very similar to Cisco IOS.

        Expected formats:
        Codes: C - connected, S - static, K - kernel, O - OSPF, B - BGP

         S        192.168.1.0/24 [1/0] via 10.1.1.2, Ethernet1
         C        10.0.0.0/8 is directly connected, Vlan100

        Args:
            output: Raw command output
            destination: Destination IP queried
            context: VRF name

        Returns:
            RouteEntry or None if no route found
        """
        if not output or "% no matching routes" in output.lower():
            return None

        lines = output.strip().split('\n')

        # Look for the route entry
        for line in lines:
            line = line.strip()

            # Skip code legend and empty lines
            if not line or line.startswith('Codes:') or line.startswith('Gateway'):
                continue

            # Parse route line
            # C        10.1.1.0/24 is directly connected, Ethernet1
            # S        192.168.1.0/24 [1/0] via 10.1.1.2, Ethernet1
            # O        10.2.0.0/16 [110/20] via 10.1.1.3, Ethernet2
            match = re.match(r'^([A-Z\*\s]+)\s+(\S+)\s+(.+)$', line)
            if match:
                protocol_code = match.group(1).strip()
                network = match.group(2)
                rest = match.group(3)

                # Map protocol codes
                protocol_map = {
                    'C': 'connected',
                    'S': 'static',
                    'S*': 'static',
                    'O': 'ospf',
                    'O*': 'ospf',
                    'B': 'bgp',
                    'B*': 'bgp',
                    'K': 'kernel',
                    'i': 'isis',
                }

                protocol = protocol_map.get(protocol_code.replace('*', ''), 'unknown')

                # Parse connected routes
                if 'directly connected' in rest:
                    match_int = re.search(r'directly connected,\s+(\S+)', rest)
                    interface = match_int.group(1) if match_int else None

                    return RouteEntry(
                        destination=network,
                        next_hop=interface or "",
                        next_hop_type=NextHopType.CONNECTED.value,
                        outgoing_interface=interface,
                        protocol=protocol,
                        logical_context=context,
                        metric=0,
                        preference=0,
                        raw_output=line
                    )

                # Parse routes with next hop
                # [110/20] via 10.1.1.2, Ethernet1
                match_via = re.search(r'\[(\d+)/(\d+)\]\s+via\s+(\S+)(?:,\s+(\S+))?', rest)
                if match_via:
                    preference = int(match_via.group(1))
                    metric = int(match_via.group(2))
                    next_hop = match_via.group(3)
                    interface = match_via.group(4)

                    return RouteEntry(
                        destination=network,
                        next_hop=next_hop,
                        next_hop_type=NextHopType.IP.value,
                        outgoing_interface=interface,
                        protocol=protocol,
                        logical_context=context,
                        metric=metric,
                        preference=preference,
                        raw_output=line
                    )

        return None

    @staticmethod
    def parse_routing_table(output: str, context: str = "default") -> List[RouteEntry]:
        """
        Parse full routing table from 'show ip route vrf <vrf>' output.

        Args:
            output: Raw command output
            context: VRF name

        Returns:
            List of RouteEntry objects
        """
        routes = []
        lines = output.strip().split('\n')

        for line in lines:
            line = line.strip()

            # Skip headers and empty lines
            if not line or line.startswith('Codes:') or line.startswith('Gateway'):
                continue

            # Parse route entry
            match = re.match(r'^([A-Z\*\s]+)\s+(\S+)\s+(.+)$', line)
            if match:
                protocol_code = match.group(1).strip()
                network = match.group(2)
                rest = match.group(3)

                protocol_map = {
                    'C': 'connected',
                    'S': 'static',
                    'O': 'ospf',
                    'B': 'bgp',
                    'K': 'kernel',
                }

                protocol = protocol_map.get(protocol_code.replace('*', ''), 'unknown')

                # Connected routes
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

                # Routes with next hop
                else:
                    match_via = re.search(r'\[(\d+)/(\d+)\]\s+via\s+(\S+)(?:,\s+(\S+))?', rest)
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
        Parse 'show vrf' output.

        Args:
            output: Raw command output

        Returns:
            List of VRF names
        """
        vrfs = []
        lines = output.strip().split('\n')

        for line in lines:
            # Skip headers
            if 'VRF' in line and 'RD' in line:
                continue

            parts = line.strip().split()
            if parts and not parts[0].startswith('-'):
                vrf_name = parts[0]
                if vrf_name and vrf_name != 'default':
                    vrfs.append(vrf_name)

        # Always include default
        if 'default' not in vrfs:
            vrfs.insert(0, 'default')

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
            if 'Interface' in line or 'Address' in line:
                continue

            # Ethernet1         10.1.1.1/24     up             up
            parts = line.strip().split()
            if len(parts) >= 2:
                interface = parts[0]
                ip_with_mask = parts[1]

                # Extract IP without mask
                if '/' in ip_with_mask:
                    ip = ip_with_mask.split('/')[0]
                    if ip != 'unassigned':
                        interfaces[interface] = ip

        return interfaces
