"""Parser for Arista EOS output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType, InterfaceDetail


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

    @staticmethod
    def _parse_rate(value: str, unit: str) -> int:
        """
        Convert a rate value and unit string to bits per second.

        Args:
            value: Numeric rate value (e.g. "2.50", "0")
            unit: Unit string (e.g. "Gbps", "Mbps", "bps", "bits/sec", "Kbps")

        Returns:
            Rate in bits per second
        """
        multipliers = {
            'bps': 1,
            'bits/sec': 1,
            'Kbps': 1000,
            'Mbps': 1_000_000,
            'Gbps': 1_000_000_000,
        }
        multiplier = multipliers.get(unit, 1)
        return int(float(value) * multiplier)

    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """
        Parse 'show interfaces <name>' output for Arista EOS.

        Arista EOS output is similar to Cisco IOS but with differences:
        - Rate may be "2.50 Gbps" or "0 bps" instead of "bits/sec"
        - Error line: "10 input errors, 5 CRC, 0 alignment, 0 symbol"
        - Output: "2 output errors, 0 collisions"
        - Drops: "0 input queue drops, 3 output drops"
        - First line may have parenthetical: "Ethernet1 is up, line protocol is up (connected)"
        - Speed: "10Gb/s" from duplex line

        Args:
            output: Raw command output from 'show interfaces <name>'

        Returns:
            InterfaceDetail or None if output is empty or doesn't match
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split('\n')

        # Parse first line: interface name and status
        # e.g. "Ethernet1 is up, line protocol is up (connected)"
        # e.g. "Ethernet2 is up, line protocol is down (notconnect)"
        # Strip anything in parentheses from line protocol status
        first_line_match = re.match(
            r'^(\S+)\s+is\s+(.+?),\s+line protocol is\s+(\S+)', lines[0]
        )
        if not first_line_match:
            return None

        name = first_line_match.group(1)
        interface_status = first_line_match.group(2).strip()
        line_protocol = first_line_match.group(3).strip()

        # Determine status
        if "administratively down" in interface_status:
            status = "admin_down"
        elif line_protocol == "up":
            status = "up"
        else:
            status = "down"

        # Parse remaining fields from the output
        description = ""
        bandwidth = 0  # in Kbit/sec
        speed = ""
        input_rate = 0  # bits/sec
        output_rate = 0  # bits/sec
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines[1:]:
            stripped = line.strip()

            # Description: Uplink to core
            desc_match = re.match(r'^Description:\s+(.+)$', stripped)
            if desc_match:
                description = desc_match.group(1).strip()
                continue

            # BW 10000000 Kbit/sec
            bw_match = re.search(r'BW\s+(\d+)\s+Kbit/sec', stripped)
            if bw_match:
                bandwidth = int(bw_match.group(1))
                continue

            # Full-duplex, 10Gb/s, auto negotiation: off, uni-link: n/a
            speed_match = re.search(r'duplex,\s+(\S+),', stripped)
            if speed_match:
                speed = speed_match.group(1)
                continue

            # 5 minute input rate 2.50 Gbps, 200000 packets/sec
            # 5 minute input rate 0 bps, 0 packets/sec
            input_rate_match = re.search(
                r'5 minute input rate\s+([\d.]+)\s+(\w+(?:/\w+)?)', stripped
            )
            if input_rate_match:
                input_rate = AristaParser._parse_rate(
                    input_rate_match.group(1), input_rate_match.group(2)
                )
                continue

            # 5 minute output rate 5.00 Gbps, 400000 packets/sec
            output_rate_match = re.search(
                r'5 minute output rate\s+([\d.]+)\s+(\w+(?:/\w+)?)', stripped
            )
            if output_rate_match:
                output_rate = AristaParser._parse_rate(
                    output_rate_match.group(1), output_rate_match.group(2)
                )
                continue

            # 10 input errors, 5 CRC, 0 alignment, 0 symbol
            input_errors_match = re.search(r'(\d+)\s+input errors', stripped)
            if input_errors_match:
                errors_in = int(input_errors_match.group(1))
                continue

            # 2 output errors, 0 collisions
            output_errors_match = re.search(r'(\d+)\s+output errors', stripped)
            if output_errors_match:
                errors_out = int(output_errors_match.group(1))
                continue

            # 0 input queue drops, 3 output drops
            input_drops_match = re.search(r'(\d+)\s+input queue drops', stripped)
            if input_drops_match:
                discards_in = int(input_drops_match.group(1))

            output_drops_match = re.search(r'(\d+)\s+output drops', stripped)
            if output_drops_match:
                discards_out = int(output_drops_match.group(1))

        # Calculate utilisation: rate / (bandwidth * 1000) * 100
        # bandwidth is in Kbit/sec, rate is in bits/sec
        # bandwidth * 1000 converts Kbit to bits
        utilisation_in = 0.0
        utilisation_out = 0.0
        if bandwidth > 0:
            bandwidth_bps = bandwidth * 1000
            utilisation_in = (input_rate / bandwidth_bps) * 100
            utilisation_out = (output_rate / bandwidth_bps) * 100

        return InterfaceDetail(
            name=name,
            description=description,
            status=status,
            speed=speed,
            utilisation_in_pct=utilisation_in,
            utilisation_out_pct=utilisation_out,
            errors_in=errors_in,
            errors_out=errors_out,
            discards_in=discards_in,
            discards_out=discards_out,
        )
