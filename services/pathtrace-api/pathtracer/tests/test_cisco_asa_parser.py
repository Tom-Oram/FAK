"""Tests for Cisco ASA parser."""

import pytest
from pathtracer.parsers.cisco_asa_parser import CiscoASAParser
from pathtracer.models import InterfaceDetail, PolicyResult, NatResult


class TestCiscoASARouteEntry:
    def test_parse_static_route(self):
        output = """Routing entry for 0.0.0.0 0.0.0.0
  Known via "static", distance 1, metric 0, candidate default path
  Routing Descriptor Blocks:
  * 10.0.0.1, via outside
      Route metric is 0, traffic share count is 1"""
        route = CiscoASAParser.parse_route_entry(output, "0.0.0.0")
        assert route is not None
        assert route.next_hop == "10.0.0.1"
        assert route.protocol == "static"
        assert route.outgoing_interface == "outside"

    def test_parse_connected_route(self):
        output = """Routing entry for 10.1.1.0 255.255.255.0
  Known via "connected", distance 0, metric 0
  Routing Descriptor Blocks:
  * directly connected, via inside
      Route metric is 0, traffic share count is 1"""
        route = CiscoASAParser.parse_route_entry(output, "10.1.1.1")
        assert route is not None
        assert route.next_hop_type == "connected"

    def test_parse_no_route(self):
        route = CiscoASAParser.parse_route_entry("", "1.1.1.1")
        assert route is None


class TestCiscoASAInterfaceDetail:
    def test_parse_interface(self):
        output = """Interface GigabitEthernet0/0 "outside", is up, line protocol is up
  Hardware is i82546GB rev03, BW 1000 Mbps, DLY 10 usec
  Description: Internet uplink
     Input flow control is unsupported, output flow control is off
     MAC address 0050.5689.0001, MTU 1500
     IP address 203.0.113.1, subnet mask 255.255.255.0
  Traffic Statistics for "outside":
     1000000 packets input, 640000000 bytes
     2000000 packets output, 1280000000 bytes
     5 input errors, 1 output errors
     2 drops, 0 output drops
  5 minute input rate 250000000 bits/sec, 150000 pkts/sec
  5 minute output rate 500000000 bits/sec, 300000 pkts/sec"""
        detail = CiscoASAParser.parse_interface_detail(output)
        assert detail is not None
        assert detail.name == "GigabitEthernet0/0"
        assert detail.description == "Internet uplink"
        assert detail.status == "up"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2


class TestCiscoASANameif:
    def test_parse_nameif(self):
        output = """Interface                  Name                     Security
GigabitEthernet0/0         outside                       0
GigabitEthernet0/1         inside                      100
GigabitEthernet0/2         dmz                          50"""
        mapping = CiscoASAParser.parse_nameif_mapping(output)
        assert mapping["GigabitEthernet0/0"] == "outside"
        assert mapping["GigabitEthernet0/1"] == "inside"
        assert mapping["GigabitEthernet0/2"] == "dmz"


class TestCiscoASAPacketTracer:
    def test_parse_permit(self):
        output = """Phase: 1
Type: ACCESS-LIST
Subtype: log
Result: ALLOW
Config:
access-group outside_in in interface outside
access-list outside_in extended permit tcp any host 203.0.113.10 eq https
Additional Information:

Phase: 2
Type: UN-NAT
Subtype: static
Result: ALLOW
Config:
nat (inside,outside) source static inside-servers outside-servers destination static any any
Additional Information:
NAT divert to egress interface inside
Untranslate 203.0.113.10/443 to 10.1.1.50/443

Phase: 3
Type: NAT
Subtype:
Result: ALLOW
Config:
nat (inside,outside) source dynamic inside-net interface
Additional Information:
Dynamic translate 192.168.1.100/54321 to 203.0.113.1/54321

Result:
input-interface: outside
input-status: up
input-line-status: up
output-interface: inside
output-status: up
output-line-status: up
Action: allow"""
        policy, nat = CiscoASAParser.parse_packet_tracer(output)

        assert policy is not None
        assert policy.action == "permit"
        assert "outside_in" in policy.rule_name

        assert nat is not None
        assert nat.dnat is not None
        assert nat.dnat.translated_ip == "10.1.1.50"
        assert nat.snat is not None
        assert nat.snat.translated_ip == "203.0.113.1"

    def test_parse_deny(self):
        output = """Phase: 1
Type: ACCESS-LIST
Subtype: log
Result: DROP
Config:
access-group outside_in in interface outside
access-list outside_in extended deny ip any any

Result:
input-interface: outside
input-status: up
Action: drop"""
        policy, nat = CiscoASAParser.parse_packet_tracer(output)

        assert policy is not None
        assert policy.action == "deny"
        assert nat is None
