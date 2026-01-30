"""Parser for Juniper SRX (Junos) output."""

import re
from typing import Dict, List, Optional
from ..models import (
    InterfaceDetail,
    NatResult,
    NatTranslation,
    NextHopType,
    PolicyResult,
    RouteEntry,
)


class JuniperSRXParser:
    """Parser for Juniper SRX / Junos show command output."""

    @staticmethod
    def parse_route_entry(
        output: str, destination: str, context: str = "global"
    ) -> Optional[RouteEntry]:
        """Parse Junos 'show route <destination>' output.

        Expected format:
            inet.0: 15 destinations, 15 routes (15 active, 0 holddown, 0 hidden)
            + = Active Route, - = Last Active, * = Both

            0.0.0.0/0          *[Static/5] 30d 12:45:00
                                >  to 10.0.0.1 via ge-0/0/0.0

        Args:
            output: Raw command output
            destination: Destination IP that was queried
            context: Routing instance name

        Returns:
            RouteEntry or None if no route found
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split("\n")

        destination_network = None
        protocol = "unknown"
        preference = 0
        metric = 0
        next_hop = None
        interface = None

        for i, line in enumerate(lines):
            # Match route line: "0.0.0.0/0          *[Static/5] 30d 12:45:00"
            # or "0.0.0.0/0          *[Static/5] 30d 12:45:00, metric 20"
            route_match = re.match(
                r"^\s*(\S+/\d+)\s+\*\[(\w+)/(\d+)\]\s+(.+)$", line
            )
            if route_match:
                destination_network = route_match.group(1)
                protocol = route_match.group(2).lower()
                preference = int(route_match.group(3))

                # Check for metric in the rest of the line
                rest = route_match.group(4)
                metric_match = re.search(r"metric\s+(\d+)", rest)
                if metric_match:
                    metric = int(metric_match.group(1))

                # Look at the next line(s) for next hop and interface
                for j in range(i + 1, len(lines)):
                    hop_line = lines[j]
                    # "> to 10.0.0.1 via ge-0/0/0.0"
                    hop_match = re.search(
                        r">\s+to\s+(\S+)\s+via\s+(\S+)", hop_line
                    )
                    if hop_match:
                        next_hop = hop_match.group(1)
                        interface = hop_match.group(2)
                        break
                    # Stop if we hit another route entry
                    if re.match(r"^\s*\S+/\d+\s+", hop_line):
                        break

                break  # Only parse the first matching route

        if not destination_network:
            return None

        # Determine next hop type
        next_hop_type = NextHopType.IP.value
        if protocol == "direct":
            next_hop_type = NextHopType.CONNECTED.value
        elif protocol == "local":
            next_hop_type = NextHopType.LOCAL.value

        return RouteEntry(
            destination=destination_network,
            next_hop=next_hop or interface or "",
            next_hop_type=next_hop_type,
            outgoing_interface=interface,
            protocol=protocol,
            logical_context=context,
            metric=metric,
            preference=preference,
            raw_output=output,
        )

    @staticmethod
    def parse_routing_table(
        output: str, context: str = "global"
    ) -> List[RouteEntry]:
        """Parse full Junos routing table from 'show route' output.

        Args:
            output: Raw command output
            context: Routing instance name

        Returns:
            List of RouteEntry objects
        """
        routes: List[RouteEntry] = []
        if not output or not output.strip():
            return routes

        lines = output.strip().split("\n")

        i = 0
        while i < len(lines):
            line = lines[i]

            # Match route line: "prefix/len *[Protocol/pref] age, metric N"
            route_match = re.match(
                r"^\s*(\S+/\d+)\s+\*\[(\w+)/(\d+)\]\s+(.+)$", line
            )
            if route_match:
                destination_network = route_match.group(1)
                protocol = route_match.group(2).lower()
                preference = int(route_match.group(3))

                rest = route_match.group(4)
                metric = 0
                metric_match = re.search(r"metric\s+(\d+)", rest)
                if metric_match:
                    metric = int(metric_match.group(1))

                # Look for next hop on subsequent lines
                next_hop = None
                interface = None
                for j in range(i + 1, len(lines)):
                    hop_line = lines[j]
                    hop_match = re.search(
                        r">\s+to\s+(\S+)\s+via\s+(\S+)", hop_line
                    )
                    if hop_match:
                        next_hop = hop_match.group(1)
                        interface = hop_match.group(2)
                        break
                    if re.match(r"^\s*\S+/\d+\s+", hop_line):
                        break

                # Determine next hop type
                next_hop_type = NextHopType.IP.value
                if protocol == "direct":
                    next_hop_type = NextHopType.CONNECTED.value
                elif protocol == "local":
                    next_hop_type = NextHopType.LOCAL.value

                routes.append(
                    RouteEntry(
                        destination=destination_network,
                        next_hop=next_hop or interface or "",
                        next_hop_type=next_hop_type,
                        outgoing_interface=interface,
                        protocol=protocol,
                        logical_context=context,
                        metric=metric,
                        preference=preference,
                        raw_output=line,
                    )
                )

            i += 1

        return routes

    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """Parse Junos 'show interfaces <name> extensive' output.

        Expected format:
            Physical interface: ge-0/0/0, Enabled, Physical link is Up
              Interface index: 148, SNMP ifIndex: 526
              Description: Outside uplink
              Link-level type: Ethernet, MTU: 1514, Speed: 1000mbps
              Input rate     : 250000000 bps (150000 pps)
              Output rate    : 500000000 bps (300000 pps)
              Input errors: 5, Output errors: 1
              Input drops: 2, Output drops: 0

        Args:
            output: Raw command output

        Returns:
            InterfaceDetail or None if parsing fails
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split("\n")

        # Parse first line: "Physical interface: ge-0/0/0, Enabled, Physical link is Up"
        first_match = re.match(
            r"^Physical interface:\s+(\S+),\s+\S+,\s+Physical link is\s+(\S+)",
            lines[0],
        )
        if not first_match:
            return None

        name = first_match.group(1).rstrip(",")
        link_state = first_match.group(2).lower()

        if link_state == "up":
            status = "up"
        else:
            status = "down"

        description = ""
        speed = ""
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines[1:]:
            stripped = line.strip()

            # Description: Outside uplink
            desc_match = re.match(r"^Description:\s+(.+)$", stripped)
            if desc_match:
                description = desc_match.group(1).strip()
                continue

            # Speed: 1000mbps (from Link-level type line)
            speed_match = re.search(r"Speed:\s+(\S+)", stripped)
            if speed_match:
                speed = speed_match.group(1)
                continue

            # Input errors: 5, Output errors: 1
            errors_match = re.search(
                r"Input errors:\s+(\d+),\s+Output errors:\s+(\d+)", stripped
            )
            if errors_match:
                errors_in = int(errors_match.group(1))
                errors_out = int(errors_match.group(2))
                continue

            # Input drops: 2, Output drops: 0
            drops_match = re.search(
                r"Input drops:\s+(\d+),\s+Output drops:\s+(\d+)", stripped
            )
            if drops_match:
                discards_in = int(drops_match.group(1))
                discards_out = int(drops_match.group(2))
                continue

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
    def parse_security_zones(output: str) -> Dict[str, str]:
        """Parse 'show security zones' output to build interface-to-zone mapping.

        Expected format:
            Security zone: trust
              Send reset for non-SYN session TCP packets: Off
              Interfaces bound: 2
                ge-0/0/1.0
                ge-0/0/2.0

            Security zone: untrust
              Send reset for non-SYN session TCP packets: Off
              Interfaces bound: 1
                ge-0/0/0.0

        Args:
            output: Raw command output

        Returns:
            Dict mapping interface name to zone name
        """
        zones: Dict[str, str] = {}
        if not output or not output.strip():
            return zones

        current_zone = None
        in_interfaces = False

        for line in output.strip().split("\n"):
            stripped = line.strip()

            # Security zone: <name>
            zone_match = re.match(r"^Security zone:\s+(\S+)", stripped)
            if zone_match:
                current_zone = zone_match.group(1)
                in_interfaces = False
                continue

            # Interfaces bound: <count>
            if re.match(r"^Interfaces bound:", stripped):
                in_interfaces = True
                continue

            # Interface names are indented lines after "Interfaces bound:"
            # They look like interface names (e.g., ge-0/0/1.0)
            if current_zone and in_interfaces and stripped:
                # Check if this looks like an interface name
                if re.match(r"^[a-zA-Z]", stripped) and "/" in stripped:
                    zones[stripped] = current_zone
                elif re.match(r"^(Security zone|Send reset)", stripped):
                    # We've moved past the interface list
                    in_interfaces = False

        return zones

    @staticmethod
    def parse_security_policy_match(output: str) -> Optional[PolicyResult]:
        """Parse 'show security match-policies' output from Junos.

        Expected format:
            Policy: Allow-Web, State: enabled, Index: 5, Scope Policy: 0, Sequence number: 1
              Source zone: trust, Destination zone: untrust
              Source addresses: 10.0.0.0/8
              Destination addresses: any
              Applications: junos-https
              Action: permit, log

        Args:
            output: Raw command output

        Returns:
            PolicyResult or None if no match found
        """
        if not output or not output.strip():
            return None

        # Extract policy name: "Policy: <name>,"
        name_match = re.search(r"Policy:\s+(\S+?),", output)
        if not name_match:
            return None
        rule_name = name_match.group(1)

        # Extract sequence number for rule position
        seq_match = re.search(r"Sequence number:\s+(\d+)", output)
        rule_position = int(seq_match.group(1)) if seq_match else 0

        # Extract source and destination zones
        source_zone = ""
        dest_zone = ""
        zone_match = re.search(
            r"Source zone:\s+(\S+?),\s+Destination zone:\s+(\S+)", output
        )
        if zone_match:
            source_zone = zone_match.group(1)
            dest_zone = zone_match.group(2)

        # Extract source addresses
        source_addresses: List[str] = []
        src_match = re.search(r"Source addresses:\s+(.+)", output)
        if src_match:
            source_addresses = [
                s.strip() for s in src_match.group(1).split(",") if s.strip()
            ]

        # Extract destination addresses
        dest_addresses: List[str] = []
        dst_match = re.search(r"Destination addresses:\s+(.+)", output)
        if dst_match:
            dest_addresses = [
                s.strip() for s in dst_match.group(1).split(",") if s.strip()
            ]

        # Extract services/applications
        services: List[str] = []
        app_match = re.search(r"Applications:\s+(.+)", output)
        if app_match:
            services = [
                s.strip() for s in app_match.group(1).split(",") if s.strip()
            ]

        # Extract action
        action_match = re.search(r"Action:\s+(\S+)", output)
        if not action_match:
            return None
        action = action_match.group(1).rstrip(",").lower()

        # Check for logging
        logging_enabled = "log" in output.lower().split("action:")[-1]

        return PolicyResult(
            rule_name=rule_name,
            rule_position=rule_position,
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
    def parse_nat_rules(
        source_output: str,
        dest_output: str,
        source_ip: str,
        dest_ip: str,
        protocol: str,
        port: int,
    ) -> Optional[NatResult]:
        """Parse Junos source and destination NAT rule output.

        Source NAT format:
            source NAT rule: Internet-SNAT
              Rule-set: nat-out
              From zone: trust, To zone: untrust
              Match: source-address 10.0.0.0/8
              Then: translated address: 203.0.113.5

        Destination NAT format:
            destination NAT rule: Web-DNAT
              Rule-set: nat-in
              From zone: untrust
              Match: destination-address 203.0.113.10
              Then: translated address: 10.1.1.100, translated port: 8080

        Args:
            source_output: Raw output from source NAT lookup
            dest_output: Raw output from destination NAT lookup
            source_ip: Source IP of the flow
            dest_ip: Destination IP of the flow
            protocol: Protocol (tcp, udp, etc.)
            port: Destination port

        Returns:
            NatResult or None if no NAT is applied
        """
        snat = None
        dnat = None

        # Parse source NAT
        if source_output and source_output.strip():
            rule_match = re.search(
                r"source NAT rule:\s+(\S+)", source_output
            )
            translated_match = re.search(
                r"translated address:\s+(\S+)", source_output
            )
            if rule_match and translated_match:
                translated_ip = translated_match.group(1).rstrip(",")
                snat = NatTranslation(
                    original_ip=source_ip,
                    original_port=str(port),
                    translated_ip=translated_ip,
                    translated_port=None,
                    nat_rule_name=rule_match.group(1),
                )

        # Parse destination NAT
        if dest_output and dest_output.strip():
            rule_match = re.search(
                r"destination NAT rule:\s+(\S+)", dest_output
            )
            translated_match = re.search(
                r"translated address:\s+(\S+)", dest_output
            )
            if rule_match and translated_match:
                translated_ip = translated_match.group(1).rstrip(",")

                # Check for translated port
                port_match = re.search(
                    r"translated port:\s+(\d+)", dest_output
                )
                translated_port = (
                    port_match.group(1) if port_match else None
                )

                dnat = NatTranslation(
                    original_ip=dest_ip,
                    original_port=str(port),
                    translated_ip=translated_ip,
                    translated_port=translated_port,
                    nat_rule_name=rule_match.group(1),
                )

        if snat is None and dnat is None:
            return None

        return NatResult(snat=snat, dnat=dnat)
