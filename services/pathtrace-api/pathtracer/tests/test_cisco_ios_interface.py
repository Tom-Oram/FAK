"""Tests for Cisco IOS interface detail parsing."""

import pytest
from pathtracer.parsers.cisco_ios_parser import CiscoIOSParser
from pathtracer.models import InterfaceDetail


class TestCiscoIOSInterfaceDetail:
    def test_parse_up_interface(self):
        output = """GigabitEthernet0/1 is up, line protocol is up
  Hardware is iGbE, address is 0050.5689.0001 (bia 0050.5689.0001)
  Description: Uplink to spine
  Internet address is 10.1.1.1/24
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 116/255, rxload 58/255
  Encapsulation ARPA, loopback not set
  Full-duplex, 1000Mb/s, media type is RJ45
  5 minute input rate 230000000 bits/sec, 150000 packets/sec
  5 minute output rate 460000000 bits/sec, 300000 packets/sec
     1000 packets input, 64000 bytes
     5 input errors, 3 CRC, 0 frame, 0 overrun, 2 ignored
     2000 packets output, 128000 bytes, 0 underruns
     1 output errors, 0 collisions, 0 interface resets
     0 unknown protocol drops
     0 output buffer failures, 0 output buffers swapped out
     10 input queue drops, 5 output drops"""
        detail = CiscoIOSParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "GigabitEthernet0/1"
        assert detail.description == "Uplink to spine"
        assert detail.status == "up"
        assert detail.speed == "1000Mb/s"
        assert detail.utilisation_in_pct == pytest.approx(23.0, abs=1.0)
        assert detail.utilisation_out_pct == pytest.approx(46.0, abs=1.0)
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 10
        assert detail.discards_out == 5

    def test_parse_down_interface(self):
        output = """GigabitEthernet0/2 is administratively down, line protocol is down
  Hardware is iGbE, address is 0050.5689.0002 (bia 0050.5689.0002)
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 0/255, rxload 0/255
  Full-duplex, 1000Mb/s, media type is RJ45
  5 minute input rate 0 bits/sec, 0 packets/sec
  5 minute output rate 0 bits/sec, 0 packets/sec
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     0 output errors, 0 collisions, 0 interface resets"""
        detail = CiscoIOSParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.status == "admin_down"
        assert detail.utilisation_in_pct == pytest.approx(0.0, abs=0.1)

    def test_parse_empty_output(self):
        detail = CiscoIOSParser.parse_interface_detail("")
        assert detail is None

    def test_parse_no_description(self):
        output = """GigabitEthernet0/3 is up, line protocol is up
  Hardware is iGbE, address is 0050.5689.0003 (bia 0050.5689.0003)
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 1/255, rxload 1/255
  Full-duplex, 1000Mb/s, media type is RJ45
  5 minute input rate 1000 bits/sec, 1 packets/sec
  5 minute output rate 2000 bits/sec, 1 packets/sec
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     0 output errors, 0 collisions, 0 interface resets"""
        detail = CiscoIOSParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.description == ""
