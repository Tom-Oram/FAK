"""Tests for API serialization of Phase 2 fields."""

import pytest
from pathtracer.models import (
    PathHop, NetworkDevice, RouteEntry, InterfaceDetail,
    PolicyResult, NatResult, NatTranslation,
)


def serialize_hop(hop):
    """Replicate the serialization logic from api/traceroute.py."""
    from api.traceroute import _serialize_hop
    return _serialize_hop(hop)


class TestHopSerialization:
    def test_serialize_interface_detail(self):
        detail = InterfaceDetail(
            name="eth0", description="Uplink", status="up", speed="10G",
            utilisation_in_pct=45.2, utilisation_out_pct=32.1,
            errors_in=5, errors_out=0, discards_in=0, discards_out=0,
        )
        device = NetworkDevice(hostname="r1", management_ip="10.0.0.1", vendor="cisco_ios")
        hop = PathHop(sequence=1, device=device, egress_detail=detail)

        data = serialize_hop(hop)
        assert data['egress_detail'] is not None
        assert data['egress_detail']['name'] == "eth0"
        assert data['egress_detail']['utilisation_in_pct'] == 45.2

    def test_serialize_policy_result(self):
        policy = PolicyResult(
            rule_name="Allow-Web", rule_position=15, action="permit",
            source_zone="trust", dest_zone="untrust",
            source_addresses=["10.0.0.0/8"], dest_addresses=["any"],
            services=["tcp/443"], logging=True,
        )
        device = NetworkDevice(hostname="fw1", management_ip="10.0.0.1", vendor="paloalto")
        hop = PathHop(sequence=1, device=device, policy_result=policy)

        data = serialize_hop(hop)
        assert data['policy_result'] is not None
        assert data['policy_result']['rule_name'] == "Allow-Web"

    def test_serialize_nat_result(self):
        nat = NatResult(
            snat=NatTranslation(
                original_ip="10.1.1.100", original_port="54321",
                translated_ip="203.0.113.5", translated_port="54321",
                nat_rule_name="Internet-SNAT",
            ),
        )
        device = NetworkDevice(hostname="fw1", management_ip="10.0.0.1", vendor="paloalto")
        hop = PathHop(sequence=1, device=device, nat_result=nat)

        data = serialize_hop(hop)
        assert data['nat_result'] is not None
        assert data['nat_result']['snat']['original_ip'] == "10.1.1.100"
        assert data['nat_result']['dnat'] is None

    def test_serialize_none_fields(self):
        device = NetworkDevice(hostname="r1", management_ip="10.0.0.1", vendor="cisco_ios")
        hop = PathHop(sequence=1, device=device)

        data = serialize_hop(hop)
        assert data['ingress_detail'] is None
        assert data['egress_detail'] is None
        assert data['policy_result'] is None
        assert data['nat_result'] is None
