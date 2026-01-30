"""Tests for base driver new methods."""

import pytest
from pathtracer.drivers.base import NetworkDriver
from pathtracer.models import NetworkDevice, CredentialSet


class ConcreteDriver(NetworkDriver):
    """Minimal concrete driver for testing base class defaults."""
    def connect(self): pass
    def disconnect(self): pass
    def get_route(self, destination, context=None): return None
    def get_routing_table(self, context=None): return []
    def list_logical_contexts(self): return ["global"]
    def get_interface_to_context_mapping(self): return {}
    def detect_device_info(self): return {}


@pytest.fixture
def driver():
    device = NetworkDevice(hostname="test", management_ip="10.0.0.1", vendor="cisco_ios")
    creds = CredentialSet(username="admin", password="pass")
    return ConcreteDriver(device, creds)


class TestBaseDriverDefaults:
    def test_get_interface_detail_returns_none(self, driver):
        assert driver.get_interface_detail("GigabitEthernet0/0") is None

    def test_get_zone_for_interface_returns_none(self, driver):
        assert driver.get_zone_for_interface("ethernet1/1") is None

    def test_lookup_security_policy_returns_none(self, driver):
        result = driver.lookup_security_policy(
            source_ip="10.0.0.1", dest_ip="10.0.0.2",
            protocol="tcp", port=443,
            source_zone="trust", dest_zone="untrust",
        )
        assert result is None

    def test_lookup_nat_returns_none(self, driver):
        result = driver.lookup_nat(
            source_ip="10.0.0.1", dest_ip="10.0.0.2",
            protocol="tcp", port=443,
        )
        assert result is None
