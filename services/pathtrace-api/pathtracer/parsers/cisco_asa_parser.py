"""Parser for Cisco ASA output."""

import re
import ipaddress
from typing import Dict, List, Optional, Tuple
from ..models import (
    InterfaceDetail,
    NatResult,
    NatTranslation,
    NextHopType,
    PolicyResult,
    RouteEntry,
)


def _subnet_mask_to_prefix_length(mask: str) -> int:
    """Convert a dotted-decimal subnet mask to CIDR prefix length.

    Args:
        mask: Subnet mask in dotted-decimal notation, e.g. "255.255.255.0"

    Returns:
        Prefix length as integer, e.g. 24
    """
    try:
        return ipaddress.IPv4Network(f"0.0.0.0/{mask}").prefixlen
    except (ValueError, TypeError):
        return 0


def _mask_to_cidr(network: str, mask: str) -> str:
    """Convert network + subnet mask to CIDR notation.

    Args:
        network: Network address, e.g. "10.1.1.0"
        mask: Subnet mask, e.g. "255.255.255.0"

    Returns:
        CIDR notation string, e.g. "10.1.1.0/24"
    """
    prefix_len = _subnet_mask_to_prefix_length(mask)
    return f"{network}/{prefix_len}"


class CiscoASAParser:
    """Parser for Cisco ASA show command output."""

    @staticmethod
    def parse_route_entry(
        output: str, destination: str, context: str = "system"
    ) -> Optional[RouteEntry]:
        """Parse 'show route <destination>' output from ASA.

        ASA uses nameif names (outside, inside) instead of physical interface
        names and shows subnet mask instead of CIDR notation.

        Args:
            output: Raw command output
            destination: Destination IP that was queried
            context: Security context name

        Returns:
            RouteEntry or None if no route found
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split("\n")

        # Parse destination network from "Routing entry for <network> <mask>"
        destination_network = None
        for line in lines:
            # ASA format: "Routing entry for 10.1.1.0 255.255.255.0"
            # or "Routing entry for 0.0.0.0 0.0.0.0"
            match = re.search(
                r"Routing entry for\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)",
                line,
            )
            if match:
                network = match.group(1)
                mask = match.group(2)
                destination_network = _mask_to_cidr(network, mask)
                break

        if not destination_network:
            return None

        # Parse protocol and metrics from "Known via" line
        protocol = "unknown"
        preference = 0
        metric = 0
        for line in lines:
            match = re.search(
                r'Known via\s+"([^"]+)",\s+distance\s+(\d+),\s+metric\s+(\d+)', line
            )
            if match:
                protocol = match.group(1)
                preference = int(match.group(2))
                metric = int(match.group(3))
                break

        # Parse next hop and interface from descriptor block lines
        # "* 10.0.0.1, via outside" or "* directly connected, via inside"
        next_hop = None
        interface = None
        for line in lines:
            # Match "* <ip>, via <nameif>"
            hop_match = re.search(
                r"\*\s+(\d+\.\d+\.\d+\.\d+),\s+via\s+(\S+)", line
            )
            if hop_match:
                next_hop = hop_match.group(1)
                interface = hop_match.group(2)
                break

            # Match "* directly connected, via <nameif>"
            connected_match = re.search(
                r"\*\s+directly connected,\s+via\s+(\S+)", line
            )
            if connected_match:
                interface = connected_match.group(1)
                break

        # Determine next hop type
        next_hop_type = NextHopType.IP.value
        if protocol == "connected":
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
        output: str, context: str = "system"
    ) -> List[RouteEntry]:
        """Parse full 'show route' output from ASA.

        ASA format uses subnet masks instead of CIDR notation:
            S    0.0.0.0 0.0.0.0 [1/0] via 10.0.0.1, outside
            C    10.1.1.0 255.255.255.0 is directly connected, inside

        Args:
            output: Raw command output
            context: Security context name

        Returns:
            List of RouteEntry objects
        """
        routes = []
        if not output or not output.strip():
            return routes

        lines = output.strip().split("\n")

        # Protocol code mapping
        protocol_map = {
            "C": "connected",
            "L": "local",
            "S": "static",
            "O": "ospf",
            "B": "bgp",
            "D": "eigrp",
            "R": "rip",
            "i": "isis",
        }

        for line in lines:
            stripped = line.strip()

            # Skip empty lines, headers, and code legend lines
            if not stripped or stripped.startswith("Codes:") or stripped.startswith("Gateway"):
                continue

            # Match connected routes:
            # "C    10.1.1.0 255.255.255.0 is directly connected, inside"
            connected_match = re.match(
                r"^([A-Z\*]+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)"
                r"\s+is directly connected,\s+(\S+)",
                stripped,
            )
            if connected_match:
                code = connected_match.group(1).strip().replace("*", "")
                network = connected_match.group(2)
                mask = connected_match.group(3)
                iface = connected_match.group(4)
                protocol = protocol_map.get(code, "unknown")
                dest = _mask_to_cidr(network, mask)

                next_hop_type = NextHopType.CONNECTED.value
                if protocol == "local":
                    next_hop_type = NextHopType.LOCAL.value

                routes.append(
                    RouteEntry(
                        destination=dest,
                        next_hop=iface,
                        next_hop_type=next_hop_type,
                        outgoing_interface=iface,
                        protocol=protocol,
                        logical_context=context,
                        metric=0,
                        preference=0,
                        raw_output=line,
                    )
                )
                continue

            # Match routes with next hop:
            # "S    0.0.0.0 0.0.0.0 [1/0] via 10.0.0.1, outside"
            via_match = re.match(
                r"^([A-Z\*]+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)"
                r"\s+\[(\d+)/(\d+)\]\s+via\s+(\S+?)(?:,\s+(\S+))?$",
                stripped,
            )
            if via_match:
                code = via_match.group(1).strip().replace("*", "")
                network = via_match.group(2)
                mask = via_match.group(3)
                pref = int(via_match.group(4))
                met = int(via_match.group(5))
                hop = via_match.group(6)
                iface = via_match.group(7)
                protocol = protocol_map.get(code, "unknown")
                dest = _mask_to_cidr(network, mask)

                routes.append(
                    RouteEntry(
                        destination=dest,
                        next_hop=hop,
                        next_hop_type=NextHopType.IP.value,
                        outgoing_interface=iface,
                        protocol=protocol,
                        logical_context=context,
                        metric=met,
                        preference=pref,
                        raw_output=line,
                    )
                )
                continue

        return routes

    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """Parse 'show interface <name>' output from ASA.

        ASA interface output format:
            Interface GigabitEthernet0/0 "outside", is up, line protocol is up
            ...

        The physical interface name appears before the quoted nameif.

        Args:
            output: Raw command output

        Returns:
            InterfaceDetail or None if parsing fails
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split("\n")

        # Parse first line:
        # Interface GigabitEthernet0/0 "outside", is up, line protocol is up
        first_match = re.match(
            r'^Interface\s+(\S+)\s+"[^"]*",\s+is\s+(.+?),\s+line protocol is\s+(\S+)',
            lines[0],
        )
        if not first_match:
            return None

        name = first_match.group(1)
        interface_status = first_match.group(2).strip()
        line_protocol = first_match.group(3).strip()

        # Determine status
        if "administratively down" in interface_status:
            status = "admin_down"
        elif line_protocol == "up":
            status = "up"
        else:
            status = "down"

        description = ""
        bandwidth_mbps = 0
        input_rate = 0
        output_rate = 0
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines[1:]:
            stripped = line.strip()

            # Description: Internet uplink
            desc_match = re.match(r"^Description:\s+(.+)$", stripped)
            if desc_match:
                description = desc_match.group(1).strip()
                continue

            # BW 1000 Mbps
            bw_match = re.search(r"BW\s+(\d+)\s+Mbps", stripped)
            if bw_match:
                bandwidth_mbps = int(bw_match.group(1))
                continue

            # 5 minute input rate 250000000 bits/sec, 150000 pkts/sec
            input_rate_match = re.search(
                r"5 minute input rate\s+(\d+)\s+bits/sec", stripped
            )
            if input_rate_match:
                input_rate = int(input_rate_match.group(1))
                continue

            # 5 minute output rate 500000000 bits/sec, 300000 pkts/sec
            output_rate_match = re.search(
                r"5 minute output rate\s+(\d+)\s+bits/sec", stripped
            )
            if output_rate_match:
                output_rate = int(output_rate_match.group(1))
                continue

            # 5 input errors, 1 output errors
            errors_match = re.search(
                r"(\d+)\s+input errors,\s+(\d+)\s+output errors", stripped
            )
            if errors_match:
                errors_in = int(errors_match.group(1))
                errors_out = int(errors_match.group(2))
                continue

            # 2 drops, 0 output drops
            drops_match = re.search(
                r"(\d+)\s+drops,\s+(\d+)\s+output drops", stripped
            )
            if drops_match:
                discards_in = int(drops_match.group(1))
                discards_out = int(drops_match.group(2))
                continue

        # Calculate utilisation: rate / (bandwidth_mbps * 1_000_000) * 100
        utilisation_in = None
        utilisation_out = None
        if bandwidth_mbps > 0:
            bandwidth_bps = bandwidth_mbps * 1_000_000
            utilisation_in = (input_rate / bandwidth_bps) * 100
            utilisation_out = (output_rate / bandwidth_bps) * 100

        # Determine speed string from BW
        speed = ""
        if bandwidth_mbps >= 1000:
            speed = f"{bandwidth_mbps // 1000}Gb/s"
        elif bandwidth_mbps > 0:
            speed = f"{bandwidth_mbps}Mb/s"

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

    @staticmethod
    def parse_nameif_mapping(output: str) -> Dict[str, str]:
        """Parse 'show nameif' output from ASA.

        Expected format:
            Interface                  Name                     Security
            GigabitEthernet0/0         outside                       0
            GigabitEthernet0/1         inside                      100

        Args:
            output: Raw command output

        Returns:
            Dict mapping physical interface name to nameif name
        """
        mapping: Dict[str, str] = {}
        if not output or not output.strip():
            return mapping

        lines = output.strip().split("\n")

        for line in lines:
            # Skip header line
            if "Interface" in line and "Name" in line and "Security" in line:
                continue
            if not line.strip():
                continue

            # Parse: "GigabitEthernet0/0         outside                       0"
            parts = line.split()
            if len(parts) >= 2:
                interface = parts[0]
                nameif = parts[1]
                # Skip if the first part doesn't look like an interface name
                if re.match(r"^[A-Za-z]", interface):
                    mapping[interface] = nameif

        return mapping

    @staticmethod
    def parse_packet_tracer(
        output: str,
    ) -> Tuple[Optional[PolicyResult], Optional[NatResult]]:
        """Parse 'packet-tracer' output from ASA.

        Splits output into phases and extracts:
        - ACCESS-LIST phase for PolicyResult
        - UN-NAT phase for DNAT (destination NAT / untranslate)
        - NAT phase for SNAT (source NAT / translate)
        - Final Action from the Result section

        Args:
            output: Raw packet-tracer command output

        Returns:
            Tuple of (PolicyResult or None, NatResult or None)
        """
        if not output or not output.strip():
            return (None, None)

        # Parse the final action from "Action: allow/drop"
        final_action = "deny"
        action_match = re.search(r"Action:\s+(\S+)", output)
        if action_match:
            raw_action = action_match.group(1).lower()
            action_map = {"allow": "permit", "drop": "deny"}
            final_action = action_map.get(raw_action, raw_action)

        # Split into phases using "Phase:" as delimiter
        # The last section after all phases is the Result block
        phase_sections = re.split(r"(?=Phase:\s+\d+)", output)

        policy_result = None
        dnat_translation = None
        snat_translation = None

        for section in phase_sections:
            section = section.strip()
            if not section:
                continue

            # Determine phase type
            type_match = re.search(r"Type:\s+(.+)", section)
            if not type_match:
                continue
            phase_type = type_match.group(1).strip()

            # Parse result for this phase
            result_match = re.search(r"Result:\s+(\S+)", section)
            phase_result = result_match.group(1).upper() if result_match else ""

            if phase_type == "ACCESS-LIST":
                # Extract access-list or access-group name
                rule_name = ""
                acl_match = re.search(r"access-list\s+(\S+)", section)
                if acl_match:
                    rule_name = acl_match.group(1)
                elif not acl_match:
                    acg_match = re.search(r"access-group\s+(\S+)", section)
                    if acg_match:
                        rule_name = acg_match.group(1)

                # Map phase result to action, but use final_action for the overall result
                policy_result = PolicyResult(
                    rule_name=rule_name,
                    rule_position=0,
                    action=final_action,
                    source_zone="",
                    dest_zone="",
                    source_addresses=[],
                    dest_addresses=[],
                    services=[],
                    logging="log" in section.lower(),
                    raw_output=section,
                )

            elif phase_type == "UN-NAT":
                # Destination NAT: "Untranslate <orig_ip>/<port> to <xlated_ip>/<port>"
                unnat_match = re.search(
                    r"Untranslate\s+(\S+?)/(\S+)\s+to\s+(\S+?)/(\S+)", section
                )
                if unnat_match:
                    # Extract NAT rule name from config line
                    nat_rule = ""
                    nat_config_match = re.search(r"^(nat\s+.+)$", section, re.MULTILINE)
                    if nat_config_match:
                        nat_rule = nat_config_match.group(1).strip()

                    dnat_translation = NatTranslation(
                        original_ip=unnat_match.group(1),
                        original_port=unnat_match.group(2),
                        translated_ip=unnat_match.group(3),
                        translated_port=unnat_match.group(4),
                        nat_rule_name=nat_rule,
                    )

            elif phase_type == "NAT":
                # Source NAT: "Dynamic translate <orig_ip>/<port> to <xlated_ip>/<port>"
                snat_match = re.search(
                    r"(?:Dynamic |Static )?translate\s+(\S+?)/(\S+)\s+to\s+(\S+?)/(\S+)",
                    section,
                    re.IGNORECASE,
                )
                if snat_match:
                    nat_rule = ""
                    nat_config_match = re.search(r"^(nat\s+.+)$", section, re.MULTILINE)
                    if nat_config_match:
                        nat_rule = nat_config_match.group(1).strip()

                    snat_translation = NatTranslation(
                        original_ip=snat_match.group(1),
                        original_port=snat_match.group(2),
                        translated_ip=snat_match.group(3),
                        translated_port=snat_match.group(4),
                        nat_rule_name=nat_rule,
                    )

        # Build NatResult only if we have at least one translation
        nat_result = None
        if dnat_translation or snat_translation:
            nat_result = NatResult(
                snat=snat_translation,
                dnat=dnat_translation,
            )

        return (policy_result, nat_result)
