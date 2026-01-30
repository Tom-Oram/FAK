"""Tests for Cisco ASA driver instantiation and method signatures."""

import pytest
from pathtracer.drivers.cisco_asa import CiscoASADriver
from pathtracer.models import NetworkDevice, CredentialSet


class TestCiscoASADriver:
    def test_instantiation(self):
        device = NetworkDevice(hostname="asa-01", management_ip="10.0.0.1", vendor="cisco_asa")
        creds = CredentialSet(username="admin", password="pass")
        driver = CiscoASADriver(device, creds)

        assert driver.device_type == "cisco_asa"
        assert driver.parser is not None

    def test_has_firewall_methods(self):
        device = NetworkDevice(hostname="asa-01", management_ip="10.0.0.1", vendor="cisco_asa")
        creds = CredentialSet(username="admin", password="pass")
        driver = CiscoASADriver(device, creds)

        assert hasattr(driver, 'get_interface_detail')
        assert hasattr(driver, 'get_zone_for_interface')
        assert hasattr(driver, 'lookup_security_policy')
        assert hasattr(driver, 'lookup_nat')

    def test_exported_from_package(self):
        from pathtracer.drivers import CiscoASADriver as Exported
        assert Exported is CiscoASADriver
