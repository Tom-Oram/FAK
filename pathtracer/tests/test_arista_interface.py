"""Tests for Arista EOS interface detail parsing."""

import pytest
from pathtracer.parsers.arista_parser import AristaParser
from pathtracer.models import InterfaceDetail


class TestAristaInterfaceDetail:
    def test_parse_up_interface(self):
        output = """Ethernet1 is up, line protocol is up (connected)
  Hardware is Ethernet, address is 0050.5689.0001
  Description: Uplink to core
  Internet address is 10.1.1.1/24
  Broadcast address is 255.255.255.255
  MTU 9214 bytes, BW 10000000 Kbit/sec
  Full-duplex, 10Gb/s, auto negotiation: off, uni-link: n/a
  Up 30 days, 12 hours, 45 minutes
  5 minute input rate 2.50 Gbps, 200000 packets/sec
  5 minute output rate 5.00 Gbps, 400000 packets/sec
     1000000 packets input, 640000000 bytes
     10 input errors, 5 CRC, 0 alignment, 0 symbol
     2000000 packets output, 1280000000 bytes
     2 output errors, 0 collisions
     0 unknown protocol drops
     0 input queue drops, 3 output drops"""
        detail = AristaParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "Ethernet1"
        assert detail.description == "Uplink to core"
        assert detail.status == "up"
        assert detail.speed == "10Gb/s"
        assert detail.utilisation_in_pct == pytest.approx(25.0, abs=1.0)
        assert detail.utilisation_out_pct == pytest.approx(50.0, abs=1.0)
        assert detail.errors_in == 10
        assert detail.errors_out == 2
        assert detail.discards_in == 0
        assert detail.discards_out == 3

    def test_parse_down_interface(self):
        output = """Ethernet2 is up, line protocol is down (notconnect)
  Hardware is Ethernet, address is 0050.5689.0002
  MTU 9214 bytes, BW 10000000 Kbit/sec
  Full-duplex, 10Gb/s, auto negotiation: off
  5 minute input rate 0 bps, 0 packets/sec
  5 minute output rate 0 bps, 0 packets/sec
     0 input errors, 0 CRC, 0 alignment, 0 symbol
     0 output errors, 0 collisions"""
        detail = AristaParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.status == "down"

    def test_parse_empty_output(self):
        detail = AristaParser.parse_interface_detail("")
        assert detail is None
