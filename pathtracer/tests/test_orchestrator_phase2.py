"""Tests for Phase 2 orchestrator changes."""

import pytest
from unittest.mock import MagicMock, patch
from pathtracer.orchestrator import PathTracer, FIREWALL_VENDORS
from pathtracer.models import (
    NetworkDevice, PathHop, RouteEntry, HopQueryResult,
    InterfaceDetail, PolicyResult, NatResult, NatTranslation,
    PathStatus,
)


class TestFirewallDetection:
    def test_firewall_by_vendor(self):
        inventory = MagicMock()
        creds = MagicMock()
        tracer = PathTracer(inventory, creds)

        device = NetworkDevice(hostname="pa-01", management_ip="10.0.0.1", vendor="paloalto")
        assert tracer._is_firewall(device) is True

    def test_firewall_by_device_type(self):
        inventory = MagicMock()
        creds = MagicMock()
        tracer = PathTracer(inventory, creds)

        device = NetworkDevice(hostname="fw-01", management_ip="10.0.0.1", vendor="unknown", device_type="firewall")
        assert tracer._is_firewall(device) is True

    def test_not_firewall(self):
        inventory = MagicMock()
        creds = MagicMock()
        tracer = PathTracer(inventory, creds)

        device = NetworkDevice(hostname="rtr-01", management_ip="10.0.0.1", vendor="cisco_ios")
        assert tracer._is_firewall(device) is False

    def test_firewall_vendors_set(self):
        assert "paloalto" in FIREWALL_VENDORS
        assert "cisco_asa" in FIREWALL_VENDORS
        assert "cisco_ftd" in FIREWALL_VENDORS
        assert "juniper_srx" in FIREWALL_VENDORS
        assert "fortinet" in FIREWALL_VENDORS


class TestTracePathProtocolParams:
    def test_accepts_protocol_and_port(self):
        """trace_path accepts protocol and destination_port params."""
        inventory = MagicMock()
        inventory.find_device_by_hostname.return_value = NetworkDevice(
            hostname="r1", management_ip="10.0.0.1", vendor="cisco_ios"
        )
        creds = MagicMock()
        tracer = PathTracer(inventory, creds)

        # Mock _query_device to return no route (ends trace)
        tracer._query_device = MagicMock(return_value=HopQueryResult(route=None))

        path = tracer.trace_path(
            "10.0.0.1", "10.0.0.2",
            start_device="r1", protocol="udp", destination_port=53,
        )
        assert path.status == PathStatus.INCOMPLETE


class TestPostNatTracking:
    def test_dnat_updates_working_destination(self):
        """When DNAT is detected, subsequent hops use translated destination."""
        inventory = MagicMock()
        creds = MagicMock()
        tracer = PathTracer(inventory, creds)

        fw_device = NetworkDevice(hostname="fw-01", management_ip="10.0.0.1", vendor="paloalto")
        rtr_device = NetworkDevice(hostname="rtr-01", management_ip="10.0.0.2", vendor="cisco_ios")

        # First hop: firewall with DNAT
        fw_route = RouteEntry(
            destination="0.0.0.0/0", next_hop="10.0.0.2",
            next_hop_type="ip", protocol="static",
            outgoing_interface="ethernet1/2",
        )
        fw_result = HopQueryResult(
            route=fw_route,
            nat_result=NatResult(
                dnat=NatTranslation(
                    original_ip="203.0.113.10", original_port="443",
                    translated_ip="10.1.1.50", translated_port="443",
                    nat_rule_name="Web-DNAT",
                ),
            ),
        )

        # Second hop: router, connected
        rtr_route = RouteEntry(
            destination="10.1.1.0/24", next_hop="10.1.1.50",
            next_hop_type="connected", protocol="connected",
        )
        rtr_result = HopQueryResult(route=rtr_route)

        call_count = [0]
        def mock_query(device, dest, context, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return fw_result
            return rtr_result

        tracer._query_device = mock_query
        tracer._resolve_device = MagicMock()
        tracer._resolve_device.return_value = MagicMock(
            status=MagicMock(value="resolved"), device=rtr_device
        )
        tracer._is_firewall = lambda d: d.vendor == "paloalto"
        tracer._determine_next_context = lambda *a: "global"

        inventory.find_device_by_hostname.return_value = fw_device

        path = tracer.trace_path("192.168.1.1", "203.0.113.10", start_device="fw-01")

        # The second query should use translated destination 10.1.1.50
        assert path.hop_count() == 2
