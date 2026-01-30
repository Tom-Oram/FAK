"""Tests for Juniper SRX parser."""

import pytest
from pathtracer.parsers.juniper_srx_parser import JuniperSRXParser
from pathtracer.models import InterfaceDetail, PolicyResult, NatResult


class TestJuniperSRXRouteEntry:
    def test_parse_static_route(self):
        output = """inet.0: 15 destinations, 15 routes (15 active, 0 holddown, 0 hidden)
+ = Active Route, - = Last Active, * = Both

0.0.0.0/0          *[Static/5] 30d 12:45:00
                    >  to 10.0.0.1 via ge-0/0/0.0"""
        route = JuniperSRXParser.parse_route_entry(output, "0.0.0.0")
        assert route is not None
        assert route.destination == "0.0.0.0/0"
        assert route.next_hop == "10.0.0.1"
        assert route.protocol == "static"
        assert route.outgoing_interface == "ge-0/0/0.0"

    def test_parse_ospf_route(self):
        output = """inet.0: 15 destinations, 15 routes (15 active, 0 holddown, 0 hidden)
+ = Active Route, - = Last Active, * = Both

192.168.1.0/24     *[OSPF/10] 5d 03:22:10, metric 20
                    >  to 10.1.1.2 via ge-0/0/1.0"""
        route = JuniperSRXParser.parse_route_entry(output, "192.168.1.1")
        assert route is not None
        assert route.protocol == "ospf"
        assert route.preference == 10
        assert route.metric == 20

    def test_parse_no_route(self):
        route = JuniperSRXParser.parse_route_entry("", "1.1.1.1")
        assert route is None


class TestJuniperSRXInterfaceDetail:
    def test_parse_interface(self):
        output = """Physical interface: ge-0/0/0, Enabled, Physical link is Up
  Interface index: 148, SNMP ifIndex: 526
  Description: Outside uplink
  Link-level type: Ethernet, MTU: 1514, Speed: 1000mbps
  Input rate     : 250000000 bps (150000 pps)
  Output rate    : 500000000 bps (300000 pps)
  Input errors: 5, Output errors: 1
  Input drops: 2, Output drops: 0"""
        detail = JuniperSRXParser.parse_interface_detail(output)
        assert detail is not None
        assert detail.name == "ge-0/0/0"
        assert detail.description == "Outside uplink"
        assert detail.status == "up"
        assert detail.speed == "1000mbps"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2
        assert detail.discards_out == 0


class TestJuniperSRXSecurityZones:
    def test_parse_zones(self):
        output = """Security zone: trust
  Send reset for non-SYN session TCP packets: Off
  Interfaces bound: 2
    ge-0/0/1.0
    ge-0/0/2.0

Security zone: untrust
  Send reset for non-SYN session TCP packets: Off
  Interfaces bound: 1
    ge-0/0/0.0"""
        zones = JuniperSRXParser.parse_security_zones(output)
        assert zones["ge-0/0/1.0"] == "trust"
        assert zones["ge-0/0/2.0"] == "trust"
        assert zones["ge-0/0/0.0"] == "untrust"


class TestJuniperSRXPolicyMatch:
    def test_parse_permit(self):
        output = """Policy: Allow-Web, State: enabled, Index: 5, Scope Policy: 0, Sequence number: 1
  Source zone: trust, Destination zone: untrust
  Source addresses: 10.0.0.0/8
  Destination addresses: any
  Applications: junos-https
  Action: permit, log"""
        result = JuniperSRXParser.parse_security_policy_match(output)
        assert result is not None
        assert result.rule_name == "Allow-Web"
        assert result.action == "permit"
        assert result.source_zone == "trust"
        assert result.dest_zone == "untrust"

    def test_parse_deny(self):
        output = """Policy: default-deny, State: enabled, Index: 65534, Scope Policy: 0, Sequence number: 100
  Source zone: any, Destination zone: any
  Source addresses: any
  Destination addresses: any
  Applications: any
  Action: deny"""
        result = JuniperSRXParser.parse_security_policy_match(output)
        assert result is not None
        assert result.action == "deny"

    def test_parse_no_match(self):
        result = JuniperSRXParser.parse_security_policy_match("")
        assert result is None


class TestJuniperSRXNatRules:
    def test_parse_source_nat(self):
        source_output = """source NAT rule: Internet-SNAT
  Rule-set: nat-out
  From zone: trust, To zone: untrust
  Match: source-address 10.0.0.0/8
  Then: translated address: 203.0.113.5"""
        dest_output = ""
        result = JuniperSRXParser.parse_nat_rules(
            source_output, dest_output, "10.1.1.100", "8.8.8.8", "tcp", 443
        )
        assert result is not None
        assert result.snat is not None
        assert result.snat.translated_ip == "203.0.113.5"
        assert result.dnat is None

    def test_no_nat(self):
        result = JuniperSRXParser.parse_nat_rules("", "", "10.0.0.1", "10.0.0.2", "tcp", 80)
        assert result is None
