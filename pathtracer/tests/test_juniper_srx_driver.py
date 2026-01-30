"""Tests for Juniper SRX driver instantiation."""

import pytest
from pathtracer.drivers.juniper_srx import JuniperSRXDriver
from pathtracer.models import NetworkDevice, CredentialSet


class TestJuniperSRXDriver:
    def test_instantiation(self):
        device = NetworkDevice(hostname="srx-01", management_ip="10.0.0.1", vendor="juniper_srx")
        creds = CredentialSet(username="admin", password="pass")
        driver = JuniperSRXDriver(device, creds)

        assert driver.device_type == "juniper_junos"
        assert driver.parser is not None

    def test_has_firewall_methods(self):
        device = NetworkDevice(hostname="srx-01", management_ip="10.0.0.1", vendor="juniper_srx")
        creds = CredentialSet(username="admin", password="pass")
        driver = JuniperSRXDriver(device, creds)

        assert hasattr(driver, 'get_interface_detail')
        assert hasattr(driver, 'get_zone_for_interface')
        assert hasattr(driver, 'lookup_security_policy')
        assert hasattr(driver, 'lookup_nat')

    def test_exported_from_package(self):
        from pathtracer.drivers import JuniperSRXDriver as Exported
        assert Exported is JuniperSRXDriver
