"""Parser for Aruba/HPE AOS-CX and AOS-Switch output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType, InterfaceDetail


class ArubaParser:
    """Parser for Aruba AOS-CX/AOS-Switch routing output."""

    @staticmethod
    def parse_route_entry(output: str, destination: str, context: str = "default") -> Optional[RouteEntry]:
        """
        Parse 'show ip route <destination> vrf <vrf>' output.

        Aruba output is similar to Cisco/Arista.

        Expected formats:
        Codes: C - connected, S - static, R - RIP, O - OSPF, B - BGP

        S    192.168.1.0/24 [1/0] via 10.1.1.2, vlan10
        C    10.0.0.0/8 is directly connected, vlan100

        Args:
            output: Raw command output
            destination: Destination IP queried
            context: VRF name

        Returns:
            RouteEntry or None if no route found
        """
        if not output or "no such route" in output.lower():
            return None

        lines = output.strip().split('\n')

        for line in lines:
            line = line.strip()

            # Skip code legend and empty lines
            if not line or line.startswith('Codes:') or line.startswith('Gateway'):
                continue

            # Parse route line
            # C    10.1.1.0/24 is directly connected, vlan10
            # S    192.168.1.0/24 [1/0] via 10.1.1.2, vlan20
            # O    10.2.0.0/16 [110/20] via 10.1.1.3, vlan30
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
                    'R': 'rip',
                    'O': 'ospf',
                    'B': 'bgp',
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
                    'L': 'local',
                    'S': 'static',
                    'R': 'rip',
                    'O': 'ospf',
                    'B': 'bgp',
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
            # VRF Name                    VRF ID    State
            # default                     1         Up
            # management                  2         Up

            # Skip headers
            if 'VRF Name' in line or '---' in line:
                continue

            parts = line.strip().split()
            if parts:
                vrf_name = parts[0]
                if vrf_name:
                    vrfs.append(vrf_name)

        # Ensure default is included
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
            if 'Interface' in line or 'IP Address' in line or '---' in line:
                continue

            # vlan10           10.1.1.1        up       up
            parts = line.strip().split()
            if len(parts) >= 2:
                interface = parts[0]
                ip = parts[1]

                if ip and ip != 'unassigned' and '.' in ip:
                    # Remove mask if present
                    if '/' in ip:
                        ip = ip.split('/')[0]
                    interfaces[interface] = ip

        return interfaces

    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """
        Parse 'show interface <name>' output for Aruba AOS-CX.

        Expected format:
            Interface 1/1/1 is up
             Admin state is up
             Description: Uplink
             Hardware: Ethernet, MAC Address: 00:50:56:89:00:01
             MTU 1500
             Speed 1000 Mb/s
             Full-duplex
             Input flow-control is off, output flow-control is off
             RX
                 1000 input packets 640000 bytes
                 5 input errors
                 2 drops
             TX
                 2000 output packets 1280000 bytes
                 1 output errors
                 0 drops

        Args:
            output: Raw command output

        Returns:
            InterfaceDetail or None if output cannot be parsed
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split('\n')

        # First line: Interface name and link status
        first_line_match = re.match(r'^Interface\s+(\S+)\s+is\s+(\S+)', lines[0])
        if not first_line_match:
            return None

        name = first_line_match.group(1)
        link_status = first_line_match.group(2).lower()

        # Defaults
        admin_state = "up"
        description = ""
        speed = ""
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        # Track which section (RX or TX) we are in
        section = None

        for line in lines[1:]:
            stripped = line.strip()

            # Admin state
            admin_match = re.match(r'^Admin state is\s+(\S+)', stripped)
            if admin_match:
                admin_state = admin_match.group(1).lower()
                continue

            # Description
            desc_match = re.match(r'^Description:\s+(.+)$', stripped)
            if desc_match:
                description = desc_match.group(1)
                continue

            # Speed
            speed_match = re.match(r'^Speed\s+(.+)$', stripped)
            if speed_match:
                speed = speed_match.group(1)
                continue

            # Section markers
            if stripped == 'RX':
                section = 'rx'
                continue
            elif stripped == 'TX':
                section = 'tx'
                continue

            # Counters within RX/TX sections
            if section == 'rx':
                err_match = re.match(r'^(\d+)\s+input errors', stripped)
                if err_match:
                    errors_in = int(err_match.group(1))
                    continue
                drop_match = re.match(r'^(\d+)\s+drops', stripped)
                if drop_match:
                    discards_in = int(drop_match.group(1))
                    continue

            elif section == 'tx':
                err_match = re.match(r'^(\d+)\s+output errors', stripped)
                if err_match:
                    errors_out = int(err_match.group(1))
                    continue
                drop_match = re.match(r'^(\d+)\s+drops', stripped)
                if drop_match:
                    discards_out = int(drop_match.group(1))
                    continue

        # Determine status: admin_down takes precedence, then link status
        if admin_state == "down":
            status = "admin_down"
        elif link_status == "down":
            status = "down"
        else:
            status = "up"

        return InterfaceDetail(
            name=name,
            description=description,
            status=status,
            speed=speed,
            utilisation_in_pct=None,
            utilisation_out_pct=None,
            errors_in=errors_in,
            errors_out=errors_out,
            discards_in=discards_in,
            discards_out=discards_out,
        )
