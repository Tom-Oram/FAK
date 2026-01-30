"""Integration tests verifying Phase 2 components work together."""

import pytest
from pathtracer.models import (
    NetworkDevice, RouteEntry, InterfaceDetail,
    PolicyResult, NatResult, NatTranslation,
    HopQueryResult, PathHop, TracePath, PathStatus,
    DeviceVendor,
)
from pathtracer.orchestrator import PathTracer, FIREWALL_VENDORS


class TestAllNewModelsImportable:
    def test_imports(self):
        """All new models are importable from pathtracer.models."""
        from pathtracer.models import (
            PolicyResult, NatTranslation, NatResult,
            InterfaceDetail, HopQueryResult,
        )


class TestAllNewDriversImportable:
    def test_imports(self):
        """All new drivers are importable from pathtracer.drivers."""
        from pathtracer.drivers import (
            CiscoASADriver, JuniperSRXDriver, CiscoFTDDriver,
        )


class TestAllNewParsersImportable:
    def test_imports(self):
        """All new parsers are importable from pathtracer.parsers."""
        from pathtracer.parsers import (
            CiscoASAParser, JuniperSRXParser,
        )


class TestPathHopEnrichment:
    def test_enriched_hop_creation(self):
        """Can create a fully enriched PathHop."""
        device = NetworkDevice(
            hostname="fw-01", management_ip="10.0.0.1",
            vendor="paloalto", device_type="firewall",
        )
        route = RouteEntry(
            destination="0.0.0.0/0", next_hop="10.0.0.2",
            next_hop_type="ip", protocol="static",
            outgoing_interface="ethernet1/2",
        )
        hop = PathHop(
            sequence=1,
            device=device,
            egress_interface="ethernet1/2",
            logical_context="default",
            route_used=route,
            lookup_time_ms=125.5,
            resolve_status="resolved",
            egress_detail=InterfaceDetail(name="ethernet1/2", status="up", speed="10G"),
            policy_result=PolicyResult(
                rule_name="Allow-Web", rule_position=15, action="permit",
                source_zone="trust", dest_zone="untrust",
                source_addresses=["10.0.0.0/8"], dest_addresses=["any"],
                services=["tcp/443"], logging=True,
            ),
            nat_result=NatResult(
                snat=NatTranslation(
                    original_ip="10.1.1.100", original_port="54321",
                    translated_ip="203.0.113.5", translated_port="54321",
                ),
            ),
        )

        assert hop.policy_result.action == "permit"
        assert hop.nat_result.snat.translated_ip == "203.0.113.5"
        assert hop.egress_detail.speed == "10G"
