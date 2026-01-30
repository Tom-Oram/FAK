"""Tests for Cisco IOS parser."""

import pytest
from pathtracer.parsers.cisco_ios_parser import CiscoIOSParser
from pathtracer.models import NextHopType


class TestCiscoIOSParser:
    """Test Cisco IOS output parsing."""

    def test_parse_connected_route(self):
        """Test parsing of directly connected route."""
        output = """
Routing entry for 10.1.1.0/24
  Known via "connected", distance 0, metric 0 (connected, via interface)
  Routing Descriptor Blocks:
  * directly connected, via GigabitEthernet0/0
      Route metric is 0, traffic share count is 1
"""
        route = CiscoIOSParser.parse_route_entry(output, "10.1.1.1")

        assert route is not None
        assert route.destination == "10.1.1.0/24"
        assert route.protocol == "connected"
        assert route.next_hop_type == NextHopType.CONNECTED.value
        assert route.outgoing_interface == "GigabitEthernet0/0"
        assert route.preference == 0

    def test_parse_ospf_route(self):
        """Test parsing of OSPF route."""
        output = """
Routing entry for 192.168.1.0/24
  Known via "ospf 1", distance 110, metric 20, type intra area
  Last update from 10.1.1.2 on GigabitEthernet0/1, 00:05:23 ago
  Routing Descriptor Blocks:
  * 10.1.1.2, from 10.2.2.2, 00:05:23 ago, via GigabitEthernet0/1
      Route metric is 20, traffic share count is 1
"""
        route = CiscoIOSParser.parse_route_entry(output, "192.168.1.1")

        assert route is not None
        assert route.destination == "192.168.1.0/24"
        assert route.protocol == "ospf 1"
        assert route.next_hop == "10.1.1.2"
        assert route.outgoing_interface == "GigabitEthernet0/1"
        assert route.preference == 110
        assert route.metric == 20

    def test_parse_no_route(self):
        """Test parsing when no route exists."""
        output = """
% Network not in table
"""
        route = CiscoIOSParser.parse_route_entry(output, "1.1.1.1")

        assert route is None

    def test_parse_routing_table(self):
        """Test parsing full routing table."""
        output = """
Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP
       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area

Gateway of last resort is 10.0.0.1 to network 0.0.0.0

S*    0.0.0.0/0 [1/0] via 10.0.0.1
      10.0.0.0/8 is variably subnetted, 3 subnets, 2 masks
C        10.1.1.0/24 is directly connected, GigabitEthernet0/0
L        10.1.1.1/32 is directly connected, GigabitEthernet0/0
O        10.2.2.0/24 [110/20] via 10.1.1.2, 00:05:23, GigabitEthernet0/1
"""
        routes = CiscoIOSParser.parse_routing_table(output)

        assert len(routes) >= 3

        # Find specific routes
        default_route = next((r for r in routes if r.destination == "0.0.0.0/0"), None)
        assert default_route is not None
        assert default_route.protocol == "static"
        assert default_route.next_hop == "10.0.0.1"

        connected_route = next((r for r in routes if r.destination == "10.1.1.0/24"), None)
        assert connected_route is not None
        assert connected_route.protocol == "connected"
        assert connected_route.next_hop_type == NextHopType.CONNECTED.value

    def test_parse_vrf_list(self):
        """Test parsing VRF list."""
        output = """
  Name                             Default RD            Interfaces
  CORP                             100:1                 Gi0/1
                                                         Gi0/2
  GUEST                            100:2                 Gi0/3
"""
        vrfs = CiscoIOSParser.parse_vrf_list(output)

        assert "CORP" in vrfs
        assert "GUEST" in vrfs
        assert len(vrfs) >= 2
