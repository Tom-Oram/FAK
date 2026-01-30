"""Tests for Cisco FTD stub driver."""

import pytest
from pathtracer.drivers.cisco_ftd import CiscoFTDDriver
from pathtracer.models import NetworkDevice, CredentialSet


class TestCiscoFTDDriver:
    def test_instantiation(self):
        device = NetworkDevice(hostname="ftd-01", management_ip="10.0.0.1", vendor="cisco_ftd")
        creds = CredentialSet(username="admin", password="pass")
        driver = CiscoFTDDriver(device, creds)
        assert driver is not None

    def test_connect_raises(self):
        device = NetworkDevice(hostname="ftd-01", management_ip="10.0.0.1", vendor="cisco_ftd")
        creds = CredentialSet(username="admin", password="pass")
        driver = CiscoFTDDriver(device, creds)

        with pytest.raises(NotImplementedError, match="FMC API"):
            driver.connect()

    def test_all_methods_raise(self):
        device = NetworkDevice(hostname="ftd-01", management_ip="10.0.0.1", vendor="cisco_ftd")
        creds = CredentialSet(username="admin", password="pass")
        driver = CiscoFTDDriver(device, creds)

        with pytest.raises(NotImplementedError):
            driver.disconnect()
        with pytest.raises(NotImplementedError):
            driver.get_route("10.0.0.1")
        with pytest.raises(NotImplementedError):
            driver.get_routing_table()
        with pytest.raises(NotImplementedError):
            driver.list_logical_contexts()
        with pytest.raises(NotImplementedError):
            driver.get_interface_to_context_mapping()
        with pytest.raises(NotImplementedError):
            driver.detect_device_info()

    def test_exported_from_package(self):
        from pathtracer.drivers import CiscoFTDDriver as Exported
        assert Exported is CiscoFTDDriver
