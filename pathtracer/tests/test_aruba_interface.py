"""Tests for Aruba interface detail parsing."""

import pytest
from pathtracer.parsers.aruba_parser import ArubaParser
from pathtracer.models import InterfaceDetail


class TestArubaInterfaceDetail:
    def test_parse_aoscx_interface(self):
        output = """Interface 1/1/1 is up
 Admin state is up
 Description: Uplink
 Hardware: Ethernet, MAC Address: 00:50:56:89:00:01
 MTU 1500
 Speed 1000 Mb/s
 Full-duplex
 Input flow-control is off, output flow-control is off
 RX
     1000 input packets 640000 bytes
     5 input errors
     2 drops
 TX
     2000 output packets 1280000 bytes
     1 output errors
     0 drops"""
        detail = ArubaParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "1/1/1"
        assert detail.description == "Uplink"
        assert detail.status == "up"
        assert detail.speed == "1000 Mb/s"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2
        assert detail.discards_out == 0

    def test_parse_down_interface(self):
        output = """Interface 1/1/2 is down
 Admin state is down
 Hardware: Ethernet, MAC Address: 00:50:56:89:00:02
 MTU 1500
 Speed 0 Mb/s"""
        detail = ArubaParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.status == "admin_down"

    def test_parse_empty(self):
        detail = ArubaParser.parse_interface_detail("")
        assert detail is None
