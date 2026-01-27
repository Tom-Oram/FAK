"""Parser for Palo Alto PAN-OS output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType


class PaloAltoParser:
    """Parser for Palo Alto PAN-OS routing output."""

    @staticmethod
    def parse_route_entry(output: str, destination: str, context: str = "default") -> Optional[RouteEntry]:
        """
        Parse 'show routing route destination <ip> virtual-router <vr>' output.

        Expected format:
        destination        nexthop              metric       flags   age          interface    tag
        ---------------   -------------------  -----  ----------  --------  ---------------  ----
        0.0.0.0/0         10.1.1.1             0      A S         1234567   ethernet1/1      0
        10.0.0.0/8        10.2.2.1             20     A O         123456    ethernet1/2      0

        Flags: A - active, ? - loose, S - static, C - connect, O - OSPF, B - BGP, R - RIP

        Args:
            output: Raw command output
            destination: Destination IP queried
            context: Virtual router name

        Returns:
            RouteEntry or None if no route found
        """
        if not output or "destination not found" in output.lower():
            return None

        lines = output.strip().split('\n')

        # Skip header lines
        data_lines = []
        found_header = False
        for line in lines:
            if '---' in line:
                found_header = True
                continue
            if found_header and line.strip():
                data_lines.append(line)

        if not data_lines:
            return None

        # Parse first matching route
        for line in data_lines:
            parts = line.split()
            if len(parts) < 6:
                continue

            network = parts[0]
            next_hop = parts[1]
            metric = int(parts[2]) if parts[2].isdigit() else 0
            flags = parts[3]
            interface = parts[5] if len(parts) > 5 else None

            # Determine protocol from flags
            protocol = "unknown"
            if 'S' in flags:
                protocol = "static"
            elif 'C' in flags:
                protocol = "connected"
            elif 'O' in flags:
                protocol = "ospf"
            elif 'B' in flags:
                protocol = "bgp"
            elif 'R' in flags:
                protocol = "rip"

            # Determine next hop type
            next_hop_type = NextHopType.IP.value
            if protocol == "connected":
                next_hop_type = NextHopType.CONNECTED.value
            elif next_hop == "discard":
                next_hop_type = NextHopType.NULL.value

            return RouteEntry(
                destination=network,
                next_hop=next_hop,
                next_hop_type=next_hop_type,
                outgoing_interface=interface,
                protocol=protocol,
                logical_context=context,
                metric=metric,
                preference=0,  # PAN-OS doesn't show AD in this output
                raw_output=line
            )

        return None

    @staticmethod
    def parse_routing_table(output: str, context: str = "default") -> List[RouteEntry]:
        """
        Parse full routing table from 'show routing route virtual-router <vr>' output.

        Args:
            output: Raw command output
            context: Virtual router name

        Returns:
            List of RouteEntry objects
        """
        routes = []
        lines = output.strip().split('\n')

        # Skip header
        data_lines = []
        found_header = False
        for line in lines:
            if '---' in line:
                found_header = True
                continue
            if found_header and line.strip():
                data_lines.append(line)

        for line in data_lines:
            parts = line.split()
            if len(parts) < 6:
                continue

            network = parts[0]
            next_hop = parts[1]
            metric = int(parts[2]) if parts[2].isdigit() else 0
            flags = parts[3]
            interface = parts[5] if len(parts) > 5 else None

            # Determine protocol
            protocol = "unknown"
            if 'S' in flags:
                protocol = "static"
            elif 'C' in flags:
                protocol = "connected"
            elif 'O' in flags:
                protocol = "ospf"
            elif 'B' in flags:
                protocol = "bgp"

            # Determine next hop type
            next_hop_type = NextHopType.IP.value
            if protocol == "connected":
                next_hop_type = NextHopType.CONNECTED.value
            elif next_hop == "discard":
                next_hop_type = NextHopType.NULL.value

            routes.append(RouteEntry(
                destination=network,
                next_hop=next_hop,
                next_hop_type=next_hop_type,
                outgoing_interface=interface,
                protocol=protocol,
                logical_context=context,
                metric=metric,
                preference=0,
                raw_output=line
            ))

        return routes

    @staticmethod
    def parse_virtual_router_list(output: str) -> List[str]:
        """
        Parse 'show routing virtual-router' output.

        Args:
            output: Raw command output

        Returns:
            List of virtual router names
        """
        vrs = []
        lines = output.strip().split('\n')

        for line in lines:
            # Look for virtual router names
            match = re.search(r'Virtual Router:\s+(\S+)', line)
            if match:
                vr_name = match.group(1)
                if vr_name not in vrs:
                    vrs.append(vr_name)

        return vrs

    @staticmethod
    def parse_interface_list(output: str) -> dict:
        """
        Parse 'show interface all' output.

        Args:
            output: Raw command output

        Returns:
            Dictionary mapping interface name to IP address
        """
        interfaces = {}
        lines = output.strip().split('\n')

        current_interface = None
        for line in lines:
            # Interface name line
            if line.startswith('ethernet') or line.startswith('vlan'):
                parts = line.split()
                if parts:
                    current_interface = parts[0]

            # IP address line
            if current_interface and 'ip:' in line.lower():
                match = re.search(r'(\d+\.\d+\.\d+\.\d+)', line)
                if match:
                    interfaces[current_interface] = match.group(1)
                    current_interface = None

        return interfaces
