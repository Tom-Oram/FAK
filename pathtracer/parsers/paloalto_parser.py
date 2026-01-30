"""Parser for Palo Alto PAN-OS output."""

import re
from typing import List, Optional
from ..models import RouteEntry, NextHopType, InterfaceDetail, PolicyResult, NatResult, NatTranslation


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

    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """
        Parse 'show interface <name>' output from PAN-OS.

        Expected format:
        -------------------------------------------------------------------------------
        Name: ethernet1/1
          Link speed:          1000
          Link duplex:         full
          Link state:          up
          MAC address:         00:50:56:89:00:01
          Description:         Outside uplink
          Zone:                untrust
          Vsys:                vsys1
          Bytes received:      640000000
          Bytes transmitted:   1280000000
          Packets received:    1000000
          Packets transmitted: 2000000
          Errors received:     5
          Drops received:      2
          Errors transmitted:  1
          Drops transmitted:   0
        -------------------------------------------------------------------------------

        Args:
            output: Raw command output

        Returns:
            InterfaceDetail or None if parsing fails
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split('\n')

        name = None
        description = ""
        status = "unknown"
        speed = ""
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines:
            stripped = line.strip()

            # Name
            match = re.match(r'^Name:\s+(.+)$', stripped)
            if match:
                name = match.group(1).strip()
                continue

            # Description
            match = re.match(r'^Description:\s+(.+)$', stripped)
            if match:
                description = match.group(1).strip()
                continue

            # Link state
            match = re.match(r'^Link state:\s+(\S+)', stripped)
            if match:
                state = match.group(1).lower()
                if state == "up":
                    status = "up"
                elif state == "down":
                    status = "down"
                else:
                    status = state
                continue

            # Link speed
            match = re.match(r'^Link speed:\s+(\d+)', stripped)
            if match:
                speed = f"{match.group(1)}Mb/s"
                continue

            # Errors received
            match = re.match(r'^Errors received:\s+(\d+)', stripped)
            if match:
                errors_in = int(match.group(1))
                continue

            # Errors transmitted
            match = re.match(r'^Errors transmitted:\s+(\d+)', stripped)
            if match:
                errors_out = int(match.group(1))
                continue

            # Drops received
            match = re.match(r'^Drops received:\s+(\d+)', stripped)
            if match:
                discards_in = int(match.group(1))
                continue

            # Drops transmitted
            match = re.match(r'^Drops transmitted:\s+(\d+)', stripped)
            if match:
                discards_out = int(match.group(1))
                continue

        if name is None:
            return None

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

    @staticmethod
    def parse_zone_from_interface(output: str) -> Optional[str]:
        """
        Parse the zone name from 'show interface <name>' output.

        Looks for the 'Zone:' line in the output.

        Args:
            output: Raw command output from 'show interface <name>'

        Returns:
            Zone name string, or None if not found
        """
        if not output or not output.strip():
            return None

        for line in output.strip().split('\n'):
            match = re.match(r'^\s*Zone:\s+(\S+)', line)
            if match:
                return match.group(1).strip()

        return None

    @staticmethod
    def parse_security_policy_match(output: str) -> Optional[PolicyResult]:
        """
        Parse 'test security-policy-match' output from PAN-OS.

        Expected format:
        "Allow-Web" {
                from trust;
                source 10.0.0.0/8;
                source-region none;
                to untrust;
                destination any;
                destination-region none;
                category any;
                application/service any/tcp/any/443;
                action allow;
                icmp-unreachable: no
                terminal yes;
        }

        Args:
            output: Raw command output

        Returns:
            PolicyResult or None if no match found
        """
        if not output or not output.strip():
            return None

        # Extract rule name from the quoted string on the first line
        rule_match = re.search(r'"([^"]+)"', output)
        if not rule_match:
            return None

        rule_name = rule_match.group(1)

        # Extract source zone (from <zone>;)
        source_zone = ""
        from_match = re.search(r'^\s*from\s+(\S+?);', output, re.MULTILINE)
        if from_match:
            source_zone = from_match.group(1)

        # Extract dest zone (to <zone>;)
        dest_zone = ""
        to_match = re.search(r'^\s*to\s+(\S+?);', output, re.MULTILINE)
        if to_match:
            dest_zone = to_match.group(1)

        # Extract source addresses (source <addr>;) - skip source-region
        source_addresses = []
        source_match = re.search(r'^\s*source\s+(.+?);', output, re.MULTILINE)
        if source_match:
            source_addresses = [s.strip() for s in source_match.group(1).split() if s.strip()]

        # Extract destination addresses (destination <addr>;) - skip destination-region
        dest_addresses = []
        dest_match = re.search(r'^\s*destination\s+(.+?);', output, re.MULTILINE)
        if dest_match:
            dest_addresses = [s.strip() for s in dest_match.group(1).split() if s.strip()]

        # Extract services (application/service <value>;)
        services = []
        svc_match = re.search(r'application/service\s+(.+?);', output)
        if svc_match:
            services = [svc_match.group(1).strip()]

        # Extract action and map
        action = "deny"
        action_match = re.search(r'^\s*action\s+(\S+?);', output, re.MULTILINE)
        if action_match:
            raw_action = action_match.group(1).lower()
            action_map = {"allow": "permit", "deny": "deny", "drop": "drop"}
            action = action_map.get(raw_action, raw_action)

        # Check for logging
        logging_enabled = "log" in output.lower()

        return PolicyResult(
            rule_name=rule_name,
            rule_position=0,
            action=action,
            source_zone=source_zone,
            dest_zone=dest_zone,
            source_addresses=source_addresses,
            dest_addresses=dest_addresses,
            services=services,
            logging=logging_enabled,
            raw_output=output,
        )

    @staticmethod
    def parse_nat_policy_match(output: str) -> Optional[NatResult]:
        """
        Parse 'test nat-policy-match' output from PAN-OS.

        Expected format:
        Matched NAT rule: "Internet-SNAT"
          Source translation: 10.1.1.100 ==> 203.0.113.5
          Destination translation: none

        Or with port:
          Source translation: 10.1.1.100:8080 ==> 203.0.113.5:80

        Args:
            output: Raw command output

        Returns:
            NatResult or None if no match found
        """
        if not output or not output.strip():
            return None

        # Extract rule name
        rule_match = re.search(r'Matched NAT rule:\s*"([^"]+)"', output)
        if not rule_match:
            return None

        rule_name = rule_match.group(1)

        def parse_translation(line_value: str) -> Optional[NatTranslation]:
            """Parse a translation line value like '10.1.1.100 ==> 203.0.113.5'."""
            if not line_value or line_value.strip().lower() == "none":
                return None

            parts = re.match(r'(\S+)\s*==>\s*(\S+)', line_value.strip())
            if not parts:
                return None

            original = parts.group(1)
            translated = parts.group(2)

            # Parse ip:port format
            original_ip, original_port = _split_ip_port(original)
            translated_ip, translated_port = _split_ip_port(translated)

            return NatTranslation(
                original_ip=original_ip,
                original_port=original_port,
                translated_ip=translated_ip,
                translated_port=translated_port,
                nat_rule_name=rule_name,
            )

        def _split_ip_port(value: str):
            """Split 'ip:port' into (ip, port) or (ip, None)."""
            if ':' in value:
                parts = value.rsplit(':', 1)
                return parts[0], parts[1]
            return value, None

        # Extract source translation
        snat = None
        src_match = re.search(r'Source translation:\s*(.+)', output)
        if src_match:
            snat = parse_translation(src_match.group(1))

        # Extract destination translation
        dnat = None
        dst_match = re.search(r'Destination translation:\s*(.+)', output)
        if dst_match:
            dnat = parse_translation(dst_match.group(1))

        return NatResult(snat=snat, dnat=dnat)
