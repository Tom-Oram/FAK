"""IP address utilities."""

import ipaddress
from typing import Optional


def is_valid_ip(ip: str) -> bool:
    """Check if string is a valid IP address."""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_valid_network(network: str) -> bool:
    """Check if string is a valid network in CIDR notation."""
    try:
        ipaddress.ip_network(network, strict=False)
        return True
    except ValueError:
        return False


def ip_in_network(ip: str, network: str) -> bool:
    """Check if IP address is in network."""
    try:
        ip_obj = ipaddress.ip_address(ip)
        net_obj = ipaddress.ip_network(network, strict=False)
        return ip_obj in net_obj
    except ValueError:
        return False


def normalize_ip(ip: str) -> str:
    """Normalize IP address format."""
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError:
        return ip.strip()


def get_prefix_length(network: str) -> int:
    """Get prefix length from CIDR network."""
    try:
        net = ipaddress.ip_network(network, strict=False)
        return net.prefixlen
    except ValueError:
        return 0


def longest_prefix_match(ip: str, networks: list) -> Optional[str]:
    """
    Find longest prefix match for IP in list of networks.

    Args:
        ip: IP address to match
        networks: List of network strings in CIDR notation

    Returns:
        Best matching network or None
    """
    try:
        ip_obj = ipaddress.ip_address(ip)
        best_match = None
        best_prefix_len = -1

        for network in networks:
            try:
                net_obj = ipaddress.ip_network(network, strict=False)
                if ip_obj in net_obj:
                    if net_obj.prefixlen > best_prefix_len:
                        best_match = network
                        best_prefix_len = net_obj.prefixlen
            except ValueError:
                continue

        return best_match
    except ValueError:
        return None
