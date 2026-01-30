"""Tests for Palo Alto security policy and NAT parsing."""

import pytest
from pathtracer.parsers.paloalto_parser import PaloAltoParser
from pathtracer.models import PolicyResult, NatResult


class TestPaloAltoSecurityPolicyMatch:
    def test_parse_permit_rule(self):
        output = """"Allow-Web" {
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
}"""
        result = PaloAltoParser.parse_security_policy_match(output)

        assert result is not None
        assert result.rule_name == "Allow-Web"
        assert result.action == "permit"
        assert result.source_zone == "trust"
        assert result.dest_zone == "untrust"
        assert "10.0.0.0/8" in result.source_addresses
        assert "any" in result.dest_addresses

    def test_parse_deny_rule(self):
        output = """"Block-All" {
        from any;
        source any;
        to any;
        destination any;
        application/service any/any/any/any;
        action deny;
        terminal yes;
}"""
        result = PaloAltoParser.parse_security_policy_match(output)

        assert result is not None
        assert result.rule_name == "Block-All"
        assert result.action == "deny"

    def test_parse_no_match(self):
        result = PaloAltoParser.parse_security_policy_match("")
        assert result is None


class TestPaloAltoNatMatch:
    def test_parse_snat(self):
        output = """Matched NAT rule: "Internet-SNAT"
  Source translation: 10.1.1.100 ==> 203.0.113.5
  Destination translation: none"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is not None
        assert result.snat.original_ip == "10.1.1.100"
        assert result.snat.translated_ip == "203.0.113.5"
        assert result.snat.nat_rule_name == "Internet-SNAT"
        assert result.dnat is None

    def test_parse_dnat(self):
        output = """Matched NAT rule: "Web-DNAT"
  Source translation: none
  Destination translation: 203.0.113.10 ==> 10.1.1.50"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is None
        assert result.dnat is not None
        assert result.dnat.original_ip == "203.0.113.10"
        assert result.dnat.translated_ip == "10.1.1.50"

    def test_parse_both(self):
        output = """Matched NAT rule: "Both-NAT"
  Source translation: 10.1.1.100 ==> 203.0.113.5
  Destination translation: 203.0.113.10 ==> 10.1.1.50"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is not None
        assert result.dnat is not None

    def test_parse_no_nat(self):
        result = PaloAltoParser.parse_nat_policy_match("")
        assert result is None
