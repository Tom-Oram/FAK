"""Tests for Palo Alto interface detail and zone parsing."""

import pytest
from pathtracer.parsers.paloalto_parser import PaloAltoParser
from pathtracer.models import InterfaceDetail


class TestPaloAltoInterfaceDetail:
    def test_parse_interface_detail(self):
        output = """-------------------------------------------------------------------------------
Name: ethernet1/1
  Link speed:          1000
  Link duplex:         full
  Link state:          up
  MAC address:         00:50:56:89:00:01
  Description:         Outside uplink
  Zone:                untrust
  Vsys:                vsys1
  Bytes received:      640000000
  Bytes transmitted:   1280000000
  Packets received:    1000000
  Packets transmitted: 2000000
  Errors received:     5
  Drops received:      2
  Errors transmitted:  1
  Drops transmitted:   0
-------------------------------------------------------------------------------"""
        detail = PaloAltoParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "ethernet1/1"
        assert detail.description == "Outside uplink"
        assert detail.status == "up"
        assert detail.speed == "1000Mb/s"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2
        assert detail.discards_out == 0


class TestPaloAltoZoneParsing:
    def test_parse_zone_from_interface(self):
        output = """-------------------------------------------------------------------------------
Name: ethernet1/1
  Link speed:          1000
  Link state:          up
  Zone:                untrust
  Vsys:                vsys1
-------------------------------------------------------------------------------"""
        zone = PaloAltoParser.parse_zone_from_interface(output)
        assert zone == "untrust"

    def test_parse_zone_not_found(self):
        output = """-------------------------------------------------------------------------------
Name: loopback.1
  Link state:          up
-------------------------------------------------------------------------------"""
        zone = PaloAltoParser.parse_zone_from_interface(output)
        assert zone is None
