"""Tests for new Phase 2 data models."""

import pytest

from pathtracer.models import (
    DeviceVendor,
    InterfaceDetail,
    HopQueryResult,
    NatResult,
    NatTranslation,
    NetworkDevice,
    PathHop,
    PolicyResult,
    RouteEntry,
)


# ---------------------------------------------------------------------------
# TestPolicyResult
# ---------------------------------------------------------------------------
class TestPolicyResult:
    """Tests for the PolicyResult dataclass."""

    def test_creation_with_required_fields(self):
        pr = PolicyResult(
            rule_name="allow-web",
            rule_position=10,
            action="permit",
            source_zone="trust",
            dest_zone="untrust",
            source_addresses=["10.0.0.0/8"],
            dest_addresses=["0.0.0.0/0"],
            services=["tcp/80", "tcp/443"],
            logging=True,
        )
        assert pr.rule_name == "allow-web"
        assert pr.rule_position == 10
        assert pr.action == "permit"
        assert pr.source_zone == "trust"
        assert pr.dest_zone == "untrust"
        assert pr.source_addresses == ["10.0.0.0/8"]
        assert pr.dest_addresses == ["0.0.0.0/0"]
        assert pr.services == ["tcp/80", "tcp/443"]
        assert pr.logging is True

    def test_raw_output_default(self):
        pr = PolicyResult(
            rule_name="deny-all",
            rule_position=999,
            action="deny",
            source_zone="any",
            dest_zone="any",
            source_addresses=["any"],
            dest_addresses=["any"],
            services=["any"],
            logging=False,
        )
        assert pr.raw_output == ""


# ---------------------------------------------------------------------------
# TestNatTranslation
# ---------------------------------------------------------------------------
class TestNatTranslation:
    """Tests for the NatTranslation dataclass."""

    def test_creation(self):
        nt = NatTranslation(
            original_ip="192.168.1.10",
            original_port="12345",
            translated_ip="203.0.113.5",
            translated_port="443",
            nat_rule_name="snat-outbound",
        )
        assert nt.original_ip == "192.168.1.10"
        assert nt.original_port == "12345"
        assert nt.translated_ip == "203.0.113.5"
        assert nt.translated_port == "443"
        assert nt.nat_rule_name == "snat-outbound"

    def test_optional_ports(self):
        nt = NatTranslation(
            original_ip="10.1.1.1",
            original_port=None,
            translated_ip="172.16.0.1",
            translated_port=None,
        )
        assert nt.original_port is None
        assert nt.translated_port is None
        assert nt.nat_rule_name == ""


# ---------------------------------------------------------------------------
# TestNatResult
# ---------------------------------------------------------------------------
class TestNatResult:
    """Tests for the NatResult dataclass."""

    def test_snat_only(self):
        snat = NatTranslation(
            original_ip="10.0.0.1",
            original_port=None,
            translated_ip="203.0.113.1",
            translated_port=None,
        )
        nr = NatResult(snat=snat)
        assert nr.snat is snat
        assert nr.dnat is None

    def test_both(self):
        snat = NatTranslation(
            original_ip="10.0.0.1",
            original_port=None,
            translated_ip="203.0.113.1",
            translated_port=None,
        )
        dnat = NatTranslation(
            original_ip="203.0.113.50",
            original_port="443",
            translated_ip="10.0.0.50",
            translated_port="8443",
        )
        nr = NatResult(snat=snat, dnat=dnat)
        assert nr.snat is snat
        assert nr.dnat is dnat


# ---------------------------------------------------------------------------
# TestInterfaceDetail
# ---------------------------------------------------------------------------
class TestInterfaceDetail:
    """Tests for the InterfaceDetail dataclass."""

    def test_defaults(self):
        iface = InterfaceDetail(name="ge-0/0/0")
        assert iface.name == "ge-0/0/0"
        assert iface.description == ""
        assert iface.status == "unknown"
        assert iface.speed == ""
        assert iface.utilisation_in_pct is None
        assert iface.utilisation_out_pct is None
        assert iface.errors_in == 0
        assert iface.errors_out == 0
        assert iface.discards_in == 0
        assert iface.discards_out == 0

    def test_full_creation(self):
        iface = InterfaceDetail(
            name="Ethernet1/1",
            description="Uplink to spine",
            status="up",
            speed="100G",
            utilisation_in_pct=45.2,
            utilisation_out_pct=62.8,
            errors_in=3,
            errors_out=1,
            discards_in=12,
            discards_out=0,
        )
        assert iface.name == "Ethernet1/1"
        assert iface.description == "Uplink to spine"
        assert iface.status == "up"
        assert iface.speed == "100G"
        assert iface.utilisation_in_pct == pytest.approx(45.2)
        assert iface.utilisation_out_pct == pytest.approx(62.8)
        assert iface.errors_in == 3
        assert iface.errors_out == 1
        assert iface.discards_in == 12
        assert iface.discards_out == 0


# ---------------------------------------------------------------------------
# TestHopQueryResult
# ---------------------------------------------------------------------------
class TestHopQueryResult:
    """Tests for the HopQueryResult dataclass."""

    def test_route_only(self):
        route = RouteEntry(
            destination="10.0.0.0/8",
            next_hop="192.168.1.1",
            next_hop_type="ip",
            outgoing_interface="ge-0/0/0",
            protocol="ospf",
        )
        hqr = HopQueryResult(route=route)
        assert hqr.route is route
        assert hqr.egress_detail is None
        assert hqr.ingress_detail is None
        assert hqr.policy_result is None
        assert hqr.nat_result is None


# ---------------------------------------------------------------------------
# TestDeviceVendorNew
# ---------------------------------------------------------------------------
class TestDeviceVendorNew:
    """Tests for the new DeviceVendor enum values."""

    def test_cisco_asa(self):
        assert DeviceVendor.CISCO_ASA.value == "cisco_asa"

    def test_cisco_ftd(self):
        assert DeviceVendor.CISCO_FTD.value == "cisco_ftd"

    def test_juniper_srx(self):
        assert DeviceVendor.JUNIPER_SRX.value == "juniper_srx"


# ---------------------------------------------------------------------------
# TestPathHopExtended
# ---------------------------------------------------------------------------
class TestPathHopExtended:
    """Tests for the new enrichment fields on PathHop."""

    def test_new_fields_default_to_none(self):
        device = NetworkDevice(
            hostname="router1",
            management_ip="10.0.0.1",
            vendor="cisco_ios",
        )
        hop = PathHop(sequence=1, device=device)
        assert hop.resolve_status is None
        assert hop.ingress_detail is None
        assert hop.egress_detail is None
        assert hop.policy_result is None
        assert hop.nat_result is None
