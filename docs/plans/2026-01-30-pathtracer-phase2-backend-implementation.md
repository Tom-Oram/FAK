# PathTracer Phase 2 Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add firewall policy/NAT inspection, interface detail collection, and three new drivers (Cisco ASA, Juniper SRX, Cisco FTD stub) to PathTracer's backend.

**Architecture:** Bottom-up: models first, then parsers, then drivers, then orchestrator, then API. Each layer tested before building the next. Firewall drivers follow the same netmiko pattern as existing drivers.

**Tech Stack:** Python, netmiko, pytest

---

## Task 1: Add new data models

**Files:**
- Modify: `pathtracer/models.py`
- Test: `pathtracer/tests/test_models.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_models.py`:

```python
"""Tests for Phase 2 data models."""

import pytest
from pathtracer.models import (
    PolicyResult, NatTranslation, NatResult, InterfaceDetail,
    HopQueryResult, DeviceVendor, PathHop, NetworkDevice, RouteEntry,
)


class TestPolicyResult:
    def test_create_with_required_fields(self):
        p = PolicyResult(
            rule_name="Allow-Web",
            rule_position=15,
            action="permit",
            source_zone="trust",
            dest_zone="untrust",
            source_addresses=["10.0.0.0/8"],
            dest_addresses=["any"],
            services=["tcp/443"],
            logging=True,
        )
        assert p.rule_name == "Allow-Web"
        assert p.action == "permit"
        assert p.raw_output == ""

    def test_raw_output_default(self):
        p = PolicyResult(
            rule_name="r", rule_position=1, action="deny",
            source_zone="a", dest_zone="b",
            source_addresses=[], dest_addresses=[], services=[], logging=False,
        )
        assert p.raw_output == ""


class TestNatTranslation:
    def test_create(self):
        n = NatTranslation(
            original_ip="10.1.1.100",
            original_port="54321",
            translated_ip="203.0.113.5",
            translated_port="54321",
        )
        assert n.original_ip == "10.1.1.100"
        assert n.nat_rule_name == ""

    def test_optional_ports(self):
        n = NatTranslation(
            original_ip="10.0.0.1", original_port=None,
            translated_ip="1.2.3.4", translated_port=None,
        )
        assert n.original_port is None


class TestNatResult:
    def test_snat_only(self):
        snat = NatTranslation(
            original_ip="10.0.0.1", original_port=None,
            translated_ip="1.2.3.4", translated_port=None,
        )
        r = NatResult(snat=snat)
        assert r.snat is not None
        assert r.dnat is None

    def test_both(self):
        snat = NatTranslation(original_ip="a", original_port=None, translated_ip="b", translated_port=None)
        dnat = NatTranslation(original_ip="c", original_port="80", translated_ip="d", translated_port="8080")
        r = NatResult(snat=snat, dnat=dnat)
        assert r.snat is not None
        assert r.dnat is not None


class TestInterfaceDetail:
    def test_defaults(self):
        d = InterfaceDetail(name="eth0")
        assert d.description == ""
        assert d.status == "unknown"
        assert d.speed == ""
        assert d.utilisation_in_pct is None
        assert d.errors_in == 0
        assert d.discards_out == 0

    def test_full(self):
        d = InterfaceDetail(
            name="GigabitEthernet0/1", description="Uplink",
            status="up", speed="1G",
            utilisation_in_pct=45.2, utilisation_out_pct=32.1,
            errors_in=5, errors_out=0, discards_in=0, discards_out=0,
        )
        assert d.speed == "1G"
        assert d.utilisation_in_pct == 45.2


class TestHopQueryResult:
    def test_route_only(self):
        route = RouteEntry(
            destination="10.0.0.0/8", next_hop="10.1.1.1",
            next_hop_type="ip", protocol="ospf",
        )
        r = HopQueryResult(route=route)
        assert r.route is not None
        assert r.egress_detail is None
        assert r.policy_result is None
        assert r.nat_result is None


class TestDeviceVendorNew:
    def test_cisco_asa(self):
        assert DeviceVendor.CISCO_ASA.value == "cisco_asa"

    def test_cisco_ftd(self):
        assert DeviceVendor.CISCO_FTD.value == "cisco_ftd"

    def test_juniper_srx(self):
        assert DeviceVendor.JUNIPER_SRX.value == "juniper_srx"


class TestPathHopExtended:
    def test_new_fields_default_none(self):
        device = NetworkDevice(hostname="r1", management_ip="10.0.0.1", vendor="cisco_ios")
        hop = PathHop(sequence=1, device=device)
        assert hop.resolve_status is None
        assert hop.ingress_detail is None
        assert hop.egress_detail is None
        assert hop.policy_result is None
        assert hop.nat_result is None
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_models.py -v`
Expected: FAIL (ImportError — classes don't exist yet)

**Step 3: Implement models**

Add to `pathtracer/models.py` after the `ResolveResult` dataclass:

```python
@dataclass
class PolicyResult:
    """Matched firewall security policy/rule."""
    rule_name: str
    rule_position: int
    action: str                    # permit, deny, drop
    source_zone: str
    dest_zone: str
    source_addresses: List[str]
    dest_addresses: List[str]
    services: List[str]
    logging: bool
    raw_output: str = ""


@dataclass
class NatTranslation:
    """One direction of NAT translation."""
    original_ip: str
    original_port: Optional[str]
    translated_ip: str
    translated_port: Optional[str]
    nat_rule_name: str = ""


@dataclass
class NatResult:
    """NAT lookup result with separate SNAT and DNAT."""
    snat: Optional[NatTranslation] = None
    dnat: Optional[NatTranslation] = None


@dataclass
class InterfaceDetail:
    """Interface operational detail."""
    name: str
    description: str = ""
    status: str = "unknown"             # up, down, admin_down
    speed: str = ""                     # 1G, 10G, 100G, etc.
    utilisation_in_pct: Optional[float] = None
    utilisation_out_pct: Optional[float] = None
    errors_in: int = 0
    errors_out: int = 0
    discards_in: int = 0
    discards_out: int = 0


@dataclass
class HopQueryResult:
    """Result of querying a device for a single hop."""
    route: Optional[RouteEntry]
    egress_detail: Optional[InterfaceDetail] = None
    ingress_detail: Optional[InterfaceDetail] = None
    policy_result: Optional[PolicyResult] = None
    nat_result: Optional[NatResult] = None
```

Add to `DeviceVendor` enum:

```python
    CISCO_ASA = "cisco_asa"
    CISCO_FTD = "cisco_ftd"
    JUNIPER_SRX = "juniper_srx"
```

Add to `PathHop` dataclass (after `notes` field):

```python
    # Phase 2: enrichment fields
    resolve_status: Optional[str] = None
    ingress_detail: Optional['InterfaceDetail'] = None
    egress_detail: Optional['InterfaceDetail'] = None
    policy_result: Optional['PolicyResult'] = None
    nat_result: Optional['NatResult'] = None
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_models.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/models.py pathtracer/tests/test_models.py
git commit -m "feat(pathtracer): add Phase 2 data models

Add PolicyResult, NatTranslation, NatResult, InterfaceDetail,
HopQueryResult dataclasses. Extend PathHop with optional enrichment
fields. Add CISCO_ASA, CISCO_FTD, JUNIPER_SRX vendor values."
```

---

## Task 2: Add base driver methods

**Files:**
- Modify: `pathtracer/drivers/base.py`
- Test: `pathtracer/tests/test_base_driver.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_base_driver.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_base_driver.py -v`
Expected: FAIL (AttributeError — methods don't exist)

**Step 3: Implement base driver methods**

Add imports to `pathtracer/drivers/base.py`:

```python
from ..models import RouteEntry, NetworkDevice, CredentialSet, InterfaceDetail, PolicyResult, NatResult
```

Add four methods to `NetworkDriver` class (before `is_connected`):

```python
    def get_interface_detail(self, interface_name: str) -> Optional['InterfaceDetail']:
        """Get operational detail for an interface. Override in subclass."""
        return None

    def get_zone_for_interface(self, interface_name: str) -> Optional[str]:
        """Get security zone for an interface. Firewall drivers override this."""
        return None

    def lookup_security_policy(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int,
        source_zone: str, dest_zone: str
    ) -> Optional['PolicyResult']:
        """Find matching firewall rule. Firewall drivers override this."""
        return None

    def lookup_nat(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int
    ) -> Optional['NatResult']:
        """Find NAT translations. Firewall drivers override this."""
        return None
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_base_driver.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/drivers/base.py pathtracer/tests/test_base_driver.py
git commit -m "feat(pathtracer): add Phase 2 methods to base driver

Add get_interface_detail, get_zone_for_interface, lookup_security_policy,
lookup_nat with default None returns."
```

---

## Task 3: Cisco IOS interface detail parser and driver method

**Files:**
- Modify: `pathtracer/parsers/cisco_ios_parser.py`
- Modify: `pathtracer/drivers/cisco_ios.py`
- Test: `pathtracer/tests/test_cisco_ios_interface.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_cisco_ios_interface.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_ios_interface.py -v`
Expected: FAIL (AttributeError — parse_interface_detail doesn't exist)

**Step 3: Implement parser method**

Add import to `pathtracer/parsers/cisco_ios_parser.py`:

```python
from ..models import RouteEntry, NextHopType, InterfaceDetail
```

Add `parse_interface_detail` static method to `CiscoIOSParser`:

```python
    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """
        Parse 'show interfaces <name>' output.

        Args:
            output: Raw command output

        Returns:
            InterfaceDetail or None
        """
        if not output or not output.strip():
            return None

        lines = output.strip().split('\n')

        # Parse interface name and status from first line
        # GigabitEthernet0/1 is up, line protocol is up
        # GigabitEthernet0/2 is administratively down, line protocol is down
        first_line = lines[0]
        name_match = re.match(r'^(\S+)\s+is\s+(.+?),\s+line protocol is\s+(\S+)', first_line)
        if not name_match:
            return None

        name = name_match.group(1)
        admin_status = name_match.group(2).strip()
        line_status = name_match.group(3).strip()

        if "administratively down" in admin_status:
            status = "admin_down"
        elif line_status == "up":
            status = "up"
        else:
            status = "down"

        description = ""
        speed = ""
        bandwidth_kbps = 0
        input_rate_bps = 0
        output_rate_bps = 0
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines:
            line_stripped = line.strip()

            # Description
            desc_match = re.match(r'Description:\s+(.+)', line_stripped)
            if desc_match:
                description = desc_match.group(1).strip()

            # Bandwidth (BW 1000000 Kbit/sec)
            bw_match = re.search(r'BW\s+(\d+)\s+Kbit', line_stripped)
            if bw_match:
                bandwidth_kbps = int(bw_match.group(1))

            # Speed (Full-duplex, 1000Mb/s)
            speed_match = re.search(r'(\d+(?:Mb|Gb|Tb)/s)', line_stripped)
            if speed_match:
                speed = speed_match.group(1)

            # Input rate
            in_rate_match = re.search(r'5 minute input rate\s+(\d+)\s+bits/sec', line_stripped)
            if in_rate_match:
                input_rate_bps = int(in_rate_match.group(1))

            # Output rate
            out_rate_match = re.search(r'5 minute output rate\s+(\d+)\s+bits/sec', line_stripped)
            if out_rate_match:
                output_rate_bps = int(out_rate_match.group(1))

            # Input errors
            in_err_match = re.search(r'(\d+)\s+input errors', line_stripped)
            if in_err_match:
                errors_in = int(in_err_match.group(1))

            # Output errors
            out_err_match = re.search(r'(\d+)\s+output errors', line_stripped)
            if out_err_match:
                errors_out = int(out_err_match.group(1))

            # Input queue drops
            in_drop_match = re.search(r'(\d+)\s+input queue drops', line_stripped)
            if in_drop_match:
                discards_in = int(in_drop_match.group(1))

            # Output drops
            out_drop_match = re.search(r'(\d+)\s+output drops', line_stripped)
            if out_drop_match:
                discards_out = int(out_drop_match.group(1))

        # Calculate utilisation
        bandwidth_bps = bandwidth_kbps * 1000
        util_in = (input_rate_bps / bandwidth_bps * 100) if bandwidth_bps > 0 else None
        util_out = (output_rate_bps / bandwidth_bps * 100) if bandwidth_bps > 0 else None

        return InterfaceDetail(
            name=name,
            description=description,
            status=status,
            speed=speed,
            utilisation_in_pct=util_in,
            utilisation_out_pct=util_out,
            errors_in=errors_in,
            errors_out=errors_out,
            discards_in=discards_in,
            discards_out=discards_out,
        )
```

**Step 4: Add driver method**

Add to `CiscoIOSDriver` in `pathtracer/drivers/cisco_ios.py`, import `InterfaceDetail` from models, add method:

```python
    def get_interface_detail(self, interface_name: str) -> Optional[InterfaceDetail]:
        """Get operational detail for an interface."""
        if not self._connected:
            raise DeviceConnectionError(f"Not connected to {self.device.hostname}")

        try:
            command = f"show interfaces {interface_name}"
            logger.debug(f"Executing: {command}")
            output = self.connection.send_command(command)
            return self.parser.parse_interface_detail(output)
        except Exception as e:
            logger.warning(f"Failed to get interface detail for {interface_name}: {e}")
            return None
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_ios_interface.py -v`
Expected: All PASS

**Step 6: Commit**

```bash
git add pathtracer/parsers/cisco_ios_parser.py pathtracer/drivers/cisco_ios.py pathtracer/tests/test_cisco_ios_interface.py
git commit -m "feat(pathtracer): add Cisco IOS interface detail parsing

Parse show interfaces output for status, speed, utilisation, errors,
and discards. Add get_interface_detail to CiscoIOSDriver."
```

---

## Task 4: Arista EOS interface detail parser and driver method

**Files:**
- Modify: `pathtracer/parsers/arista_parser.py`
- Modify: `pathtracer/drivers/arista_eos.py`
- Test: `pathtracer/tests/test_arista_interface.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_arista_interface.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_arista_interface.py -v`
Expected: FAIL

**Step 3: Implement parser method**

Add import of `InterfaceDetail` to `pathtracer/parsers/arista_parser.py`. Add `parse_interface_detail` static method following the same pattern as Cisco IOS (Arista output is very similar). Key differences:
- Rate may be shown as "2.50 Gbps" instead of "2500000000 bits/sec" — parse both formats
- Error line format: `10 input errors, 5 CRC, 0 alignment, 0 symbol`

```python
    @staticmethod
    def parse_interface_detail(output: str) -> Optional[InterfaceDetail]:
        """Parse 'show interfaces <name>' output."""
        if not output or not output.strip():
            return None

        lines = output.strip().split('\n')
        first_line = lines[0]
        name_match = re.match(r'^(\S+)\s+is\s+(.+?),\s+line protocol is\s+(\S+)', first_line)
        if not name_match:
            return None

        name = name_match.group(1)
        admin_status = name_match.group(2).strip()
        line_status = name_match.group(3).strip()

        if "administratively down" in admin_status:
            status = "admin_down"
        elif line_status == "up":
            status = "up"
        else:
            status = "down"

        description = ""
        speed = ""
        bandwidth_kbps = 0
        input_rate_bps = 0
        output_rate_bps = 0
        errors_in = 0
        errors_out = 0
        discards_in = 0
        discards_out = 0

        for line in lines:
            ls = line.strip()

            desc_match = re.match(r'Description:\s+(.+)', ls)
            if desc_match:
                description = desc_match.group(1).strip()

            bw_match = re.search(r'BW\s+(\d+)\s+Kbit', ls)
            if bw_match:
                bandwidth_kbps = int(bw_match.group(1))

            speed_match = re.search(r'(\d+(?:Mb|Gb|Tb)/s)', ls)
            if speed_match:
                speed = speed_match.group(1)

            # Rate in bps format
            in_rate_match = re.search(r'5 minute input rate\s+([\d.]+)\s+(bps|Kbps|Mbps|Gbps|bits/sec)', ls)
            if in_rate_match:
                input_rate_bps = AristaParser._parse_rate(in_rate_match.group(1), in_rate_match.group(2))

            out_rate_match = re.search(r'5 minute output rate\s+([\d.]+)\s+(bps|Kbps|Mbps|Gbps|bits/sec)', ls)
            if out_rate_match:
                output_rate_bps = AristaParser._parse_rate(out_rate_match.group(1), out_rate_match.group(2))

            in_err_match = re.search(r'(\d+)\s+input errors', ls)
            if in_err_match:
                errors_in = int(in_err_match.group(1))

            out_err_match = re.search(r'(\d+)\s+output errors', ls)
            if out_err_match:
                errors_out = int(out_err_match.group(1))

            in_drop_match = re.search(r'(\d+)\s+input queue drops', ls)
            if in_drop_match:
                discards_in = int(in_drop_match.group(1))

            out_drop_match = re.search(r'(\d+)\s+output drops', ls)
            if out_drop_match:
                discards_out = int(out_drop_match.group(1))

        bandwidth_bps = bandwidth_kbps * 1000
        util_in = (input_rate_bps / bandwidth_bps * 100) if bandwidth_bps > 0 else None
        util_out = (output_rate_bps / bandwidth_bps * 100) if bandwidth_bps > 0 else None

        return InterfaceDetail(
            name=name, description=description, status=status, speed=speed,
            utilisation_in_pct=util_in, utilisation_out_pct=util_out,
            errors_in=errors_in, errors_out=errors_out,
            discards_in=discards_in, discards_out=discards_out,
        )

    @staticmethod
    def _parse_rate(value: str, unit: str) -> int:
        """Convert rate value+unit to bits per second."""
        v = float(value)
        multipliers = {'bps': 1, 'bits/sec': 1, 'Kbps': 1000, 'Mbps': 1_000_000, 'Gbps': 1_000_000_000}
        return int(v * multipliers.get(unit, 1))
```

Add `get_interface_detail` to `AristaEOSDriver` (same pattern as Cisco IOS driver method).

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_arista_interface.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/arista_parser.py pathtracer/drivers/arista_eos.py pathtracer/tests/test_arista_interface.py
git commit -m "feat(pathtracer): add Arista EOS interface detail parsing"
```

---

## Task 5: Aruba interface detail parser and driver method

**Files:**
- Modify: `pathtracer/parsers/aruba_parser.py`
- Modify: `pathtracer/drivers/aruba.py`
- Test: `pathtracer/tests/test_aruba_interface.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_aruba_interface.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_aruba_interface.py -v`
Expected: FAIL

**Step 3: Implement parser and driver**

Add `parse_interface_detail` to `ArubaParser`. Aruba AOS-CX output differs from IOS — uses "Interface X is up/down", "Admin state is up/down", RX/TX sections. Parse accordingly.

Add `get_interface_detail` to `ArubaDriver`.

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_aruba_interface.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/aruba_parser.py pathtracer/drivers/aruba.py pathtracer/tests/test_aruba_interface.py
git commit -m "feat(pathtracer): add Aruba interface detail parsing"
```

---

## Task 6: Palo Alto interface detail + zone parser and driver methods

**Files:**
- Modify: `pathtracer/parsers/paloalto_parser.py`
- Modify: `pathtracer/drivers/paloalto.py`
- Test: `pathtracer/tests/test_paloalto_interface.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_paloalto_interface.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_paloalto_interface.py -v`
Expected: FAIL

**Step 3: Implement parser methods**

Add `parse_interface_detail` and `parse_zone_from_interface` to `PaloAltoParser`.

Add `get_interface_detail` and `get_zone_for_interface` to `PaloAltoDriver`. Both use `show interface <name>`.

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_paloalto_interface.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/paloalto_parser.py pathtracer/drivers/paloalto.py pathtracer/tests/test_paloalto_interface.py
git commit -m "feat(pathtracer): add Palo Alto interface detail and zone parsing"
```

---

## Task 7: Palo Alto security policy and NAT parser and driver methods

**Files:**
- Modify: `pathtracer/parsers/paloalto_parser.py`
- Modify: `pathtracer/drivers/paloalto.py`
- Test: `pathtracer/tests/test_paloalto_firewall.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_paloalto_firewall.py`:

```python
"""Tests for Palo Alto security policy and NAT parsing."""

import pytest
from pathtracer.parsers.paloalto_parser import PaloAltoParser
from pathtracer.models import PolicyResult, NatResult


class TestPaloAltoSecurityPolicyMatch:
    def test_parse_permit_rule(self):
        output = """"Allow-Web" {
        from trust;
        source 10.0.0.0/8;
        source-region none;
        to untrust;
        destination any;
        destination-region none;
        category any;
        application/service any/tcp/any/443;
        action allow;
        icmp-unreachable: no
        terminal yes;
}"""
        result = PaloAltoParser.parse_security_policy_match(output)

        assert result is not None
        assert result.rule_name == "Allow-Web"
        assert result.action == "permit"
        assert result.source_zone == "trust"
        assert result.dest_zone == "untrust"
        assert "10.0.0.0/8" in result.source_addresses
        assert "any" in result.dest_addresses

    def test_parse_deny_rule(self):
        output = """"Block-All" {
        from any;
        source any;
        to any;
        destination any;
        application/service any/any/any/any;
        action deny;
        terminal yes;
}"""
        result = PaloAltoParser.parse_security_policy_match(output)

        assert result is not None
        assert result.rule_name == "Block-All"
        assert result.action == "deny"

    def test_parse_no_match(self):
        result = PaloAltoParser.parse_security_policy_match("")
        assert result is None


class TestPaloAltoNatMatch:
    def test_parse_snat(self):
        output = """Matched NAT rule: "Internet-SNAT"
  Source translation: 10.1.1.100 ==> 203.0.113.5
  Destination translation: none"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is not None
        assert result.snat.original_ip == "10.1.1.100"
        assert result.snat.translated_ip == "203.0.113.5"
        assert result.snat.nat_rule_name == "Internet-SNAT"
        assert result.dnat is None

    def test_parse_dnat(self):
        output = """Matched NAT rule: "Web-DNAT"
  Source translation: none
  Destination translation: 203.0.113.10 ==> 10.1.1.50"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is None
        assert result.dnat is not None
        assert result.dnat.original_ip == "203.0.113.10"
        assert result.dnat.translated_ip == "10.1.1.50"

    def test_parse_both(self):
        output = """Matched NAT rule: "Both-NAT"
  Source translation: 10.1.1.100 ==> 203.0.113.5
  Destination translation: 203.0.113.10 ==> 10.1.1.50"""
        result = PaloAltoParser.parse_nat_policy_match(output)

        assert result is not None
        assert result.snat is not None
        assert result.dnat is not None

    def test_parse_no_nat(self):
        result = PaloAltoParser.parse_nat_policy_match("")
        assert result is None
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_paloalto_firewall.py -v`
Expected: FAIL

**Step 3: Implement parser methods**

Add `parse_security_policy_match` and `parse_nat_policy_match` to `PaloAltoParser`.

Add `lookup_security_policy` and `lookup_nat` to `PaloAltoDriver`:
- `lookup_security_policy`: runs `test security-policy-match source <src> destination <dst> protocol <proto> destination-port <port> from <src_zone> to <dst_zone>`
- `lookup_nat`: runs `test nat-policy-match source <src> destination <dst> protocol <proto> destination-port <port> from <src_zone> to <dst_zone>` (zones determined internally)

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_paloalto_firewall.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/paloalto_parser.py pathtracer/drivers/paloalto.py pathtracer/tests/test_paloalto_firewall.py
git commit -m "feat(pathtracer): add Palo Alto security policy and NAT lookup

Implement test security-policy-match and test nat-policy-match
command parsing. Add lookup_security_policy and lookup_nat to driver."
```

---

## Task 8: Cisco ASA parser

**Files:**
- Create: `pathtracer/parsers/cisco_asa_parser.py`
- Test: `pathtracer/tests/test_cisco_asa_parser.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_cisco_asa_parser.py`:

```python
"""Tests for Cisco ASA parser."""

import pytest
from pathtracer.parsers.cisco_asa_parser import CiscoASAParser
from pathtracer.models import InterfaceDetail, PolicyResult, NatResult


class TestCiscoASARouteEntry:
    def test_parse_static_route(self):
        output = """Routing entry for 0.0.0.0 0.0.0.0
  Known via "static", distance 1, metric 0, candidate default path
  Routing Descriptor Blocks:
  * 10.0.0.1, via outside
      Route metric is 0, traffic share count is 1"""
        route = CiscoASAParser.parse_route_entry(output, "0.0.0.0")

        assert route is not None
        assert route.next_hop == "10.0.0.1"
        assert route.protocol == "static"
        assert route.outgoing_interface == "outside"

    def test_parse_connected_route(self):
        output = """Routing entry for 10.1.1.0 255.255.255.0
  Known via "connected", distance 0, metric 0
  Routing Descriptor Blocks:
  * directly connected, via inside
      Route metric is 0, traffic share count is 1"""
        route = CiscoASAParser.parse_route_entry(output, "10.1.1.1")

        assert route is not None
        assert route.next_hop_type == "connected"

    def test_parse_no_route(self):
        route = CiscoASAParser.parse_route_entry("", "1.1.1.1")
        assert route is None


class TestCiscoASAInterfaceDetail:
    def test_parse_interface(self):
        output = """Interface GigabitEthernet0/0 "outside", is up, line protocol is up
  Hardware is i82546GB rev03, BW 1000 Mbps, DLY 10 usec
  Description: Internet uplink
     Input flow control is unsupported, output flow control is off
     MAC address 0050.5689.0001, MTU 1500
     IP address 203.0.113.1, subnet mask 255.255.255.0
  Traffic Statistics for "outside":
     1000000 packets input, 640000000 bytes
     2000000 packets output, 1280000000 bytes
     5 input errors, 1 output errors
     2 drops, 0 output drops
  5 minute input rate 250000000 bits/sec, 150000 pkts/sec
  5 minute output rate 500000000 bits/sec, 300000 pkts/sec"""
        detail = CiscoASAParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "GigabitEthernet0/0"
        assert detail.description == "Internet uplink"
        assert detail.status == "up"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2


class TestCiscoASANameif:
    def test_parse_nameif(self):
        output = """Interface                  Name                     Security
GigabitEthernet0/0         outside                       0
GigabitEthernet0/1         inside                      100
GigabitEthernet0/2         dmz                          50"""
        mapping = CiscoASAParser.parse_nameif_mapping(output)

        assert mapping["GigabitEthernet0/0"] == "outside"
        assert mapping["GigabitEthernet0/1"] == "inside"
        assert mapping["GigabitEthernet0/2"] == "dmz"


class TestCiscoASAPacketTracer:
    def test_parse_permit(self):
        output = """Phase: 1
Type: ACCESS-LIST
Subtype: log
Result: ALLOW
Config:
access-group outside_in in interface outside
access-list outside_in extended permit tcp any host 203.0.113.10 eq https
Additional Information:

Phase: 2
Type: UN-NAT
Subtype: static
Result: ALLOW
Config:
nat (inside,outside) source static inside-servers outside-servers destination static any any
Additional Information:
NAT divert to egress interface inside
Untranslate 203.0.113.10/443 to 10.1.1.50/443

Phase: 3
Type: NAT
Subtype:
Result: ALLOW
Config:
nat (inside,outside) source dynamic inside-net interface
Additional Information:
Dynamic translate 192.168.1.100/54321 to 203.0.113.1/54321

Result:
input-interface: outside
input-status: up
input-line-status: up
output-interface: inside
output-status: up
output-line-status: up
Action: allow"""
        policy, nat = CiscoASAParser.parse_packet_tracer(output)

        assert policy is not None
        assert policy.action == "permit"
        assert "outside_in" in policy.rule_name

        assert nat is not None
        assert nat.dnat is not None
        assert nat.dnat.translated_ip == "10.1.1.50"
        assert nat.snat is not None
        assert nat.snat.translated_ip == "203.0.113.1"

    def test_parse_deny(self):
        output = """Phase: 1
Type: ACCESS-LIST
Subtype: log
Result: DROP
Config:
access-group outside_in in interface outside
access-list outside_in extended deny ip any any

Result:
input-interface: outside
input-status: up
Action: drop"""
        policy, nat = CiscoASAParser.parse_packet_tracer(output)

        assert policy is not None
        assert policy.action == "deny"
        assert nat is None
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_asa_parser.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement Cisco ASA parser**

Create `pathtracer/parsers/cisco_asa_parser.py` with methods:
- `parse_route_entry(output, destination, context)` — similar to IOS but ASA uses "via <nameif>" instead of interface name
- `parse_routing_table(output, context)` — similar to IOS
- `parse_interface_detail(output)` — ASA format: `Interface GigabitEthernet0/0 "outside", is up, line protocol is up`
- `parse_nameif_mapping(output)` — parse `show nameif` output
- `parse_packet_tracer(output)` — parse phases, extract ACCESS-LIST result + NAT translations

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_asa_parser.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/cisco_asa_parser.py pathtracer/tests/test_cisco_asa_parser.py
git commit -m "feat(pathtracer): add Cisco ASA parser

Parse routes, interface detail, nameif mapping, and packet-tracer
output for combined policy/NAT results."
```

---

## Task 9: Cisco ASA driver

**Files:**
- Create: `pathtracer/drivers/cisco_asa.py`
- Modify: `pathtracer/drivers/__init__.py`
- Modify: `pathtracer/parsers/__init__.py`
- Test: `pathtracer/tests/test_cisco_asa_driver.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_cisco_asa_driver.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_asa_driver.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement Cisco ASA driver**

Create `pathtracer/drivers/cisco_asa.py` following the same pattern as `paloalto.py`:
- Constructor: `device_type = 'cisco_asa'`, `parser = CiscoASAParser()`
- `connect/disconnect`: same netmiko pattern, add `self.credentials.secret` as `secret` param
- `get_route`: `show route <destination>`
- `get_routing_table`: `show route`
- `list_logical_contexts`: `show context` (multi-context) or return `["system"]`
- `get_interface_to_context_mapping`: `show nameif` for interfaces
- `detect_device_info`: `show version`
- `get_interface_detail`: `show interface <name>`
- `get_zone_for_interface`: uses nameif — `show nameif` and looks up interface. ASA nameif = zone.
- `lookup_security_policy`: uses `packet-tracer input <iface> <proto> <src> <sport> <dst> <dport> detailed`, extracts policy from parsed result
- `lookup_nat`: uses same `packet-tracer` output, extracts NAT from parsed result

Update `pathtracer/drivers/__init__.py` — add `CiscoASADriver`.
Update `pathtracer/parsers/__init__.py` — add `CiscoASAParser`.

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_asa_driver.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/drivers/cisco_asa.py pathtracer/drivers/__init__.py pathtracer/parsers/__init__.py pathtracer/tests/test_cisco_asa_driver.py
git commit -m "feat(pathtracer): add Cisco ASA driver

Full ASA driver with routing, interface detail, nameif-based zone
lookup, and packet-tracer for combined policy/NAT queries."
```

---

## Task 10: Juniper SRX parser

**Files:**
- Create: `pathtracer/parsers/juniper_srx_parser.py`
- Test: `pathtracer/tests/test_juniper_srx_parser.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_juniper_srx_parser.py`:

```python
"""Tests for Juniper SRX parser."""

import pytest
from pathtracer.parsers.juniper_srx_parser import JuniperSRXParser
from pathtracer.models import InterfaceDetail, PolicyResult, NatResult


class TestJuniperSRXRouteEntry:
    def test_parse_static_route(self):
        output = """inet.0: 15 destinations, 15 routes (15 active, 0 holddown, 0 hidden)
+ = Active Route, - = Last Active, * = Both

0.0.0.0/0          *[Static/5] 30d 12:45:00
                    >  to 10.0.0.1 via ge-0/0/0.0"""
        route = JuniperSRXParser.parse_route_entry(output, "0.0.0.0")

        assert route is not None
        assert route.destination == "0.0.0.0/0"
        assert route.next_hop == "10.0.0.1"
        assert route.protocol == "static"
        assert route.outgoing_interface == "ge-0/0/0.0"

    def test_parse_ospf_route(self):
        output = """inet.0: 15 destinations, 15 routes (15 active, 0 holddown, 0 hidden)
+ = Active Route, - = Last Active, * = Both

192.168.1.0/24     *[OSPF/10] 5d 03:22:10, metric 20
                    >  to 10.1.1.2 via ge-0/0/1.0"""
        route = JuniperSRXParser.parse_route_entry(output, "192.168.1.1")

        assert route is not None
        assert route.protocol == "ospf"
        assert route.preference == 10
        assert route.metric == 20

    def test_parse_no_route(self):
        route = JuniperSRXParser.parse_route_entry("", "1.1.1.1")
        assert route is None


class TestJuniperSRXInterfaceDetail:
    def test_parse_interface(self):
        output = """Physical interface: ge-0/0/0, Enabled, Physical link is Up
  Interface index: 148, SNMP ifIndex: 526
  Description: Outside uplink
  Link-level type: Ethernet, MTU: 1514, Speed: 1000mbps
  Input rate     : 250000000 bps (150000 pps)
  Output rate    : 500000000 bps (300000 pps)
  Input errors: 5, Output errors: 1
  Input drops: 2, Output drops: 0"""
        detail = JuniperSRXParser.parse_interface_detail(output)

        assert detail is not None
        assert detail.name == "ge-0/0/0"
        assert detail.description == "Outside uplink"
        assert detail.status == "up"
        assert detail.speed == "1000mbps"
        assert detail.errors_in == 5
        assert detail.errors_out == 1
        assert detail.discards_in == 2
        assert detail.discards_out == 0


class TestJuniperSRXSecurityZones:
    def test_parse_zones(self):
        output = """Security zone: trust
  Send reset for non-SYN session TCP packets: Off
  Interfaces bound: 2
    ge-0/0/1.0
    ge-0/0/2.0

Security zone: untrust
  Send reset for non-SYN session TCP packets: Off
  Interfaces bound: 1
    ge-0/0/0.0"""
        zones = JuniperSRXParser.parse_security_zones(output)

        assert zones["ge-0/0/1.0"] == "trust"
        assert zones["ge-0/0/2.0"] == "trust"
        assert zones["ge-0/0/0.0"] == "untrust"


class TestJuniperSRXPolicyMatch:
    def test_parse_permit(self):
        output = """Policy: Allow-Web, State: enabled, Index: 5, Scope Policy: 0, Sequence number: 1
  Source zone: trust, Destination zone: untrust
  Source addresses: 10.0.0.0/8
  Destination addresses: any
  Applications: junos-https
  Action: permit, log"""
        result = JuniperSRXParser.parse_security_policy_match(output)

        assert result is not None
        assert result.rule_name == "Allow-Web"
        assert result.action == "permit"
        assert result.source_zone == "trust"
        assert result.dest_zone == "untrust"

    def test_parse_deny(self):
        output = """Policy: default-deny, State: enabled, Index: 65534, Scope Policy: 0, Sequence number: 100
  Source zone: any, Destination zone: any
  Source addresses: any
  Destination addresses: any
  Applications: any
  Action: deny"""
        result = JuniperSRXParser.parse_security_policy_match(output)

        assert result is not None
        assert result.action == "deny"

    def test_parse_no_match(self):
        result = JuniperSRXParser.parse_security_policy_match("")
        assert result is None


class TestJuniperSRXNatRules:
    def test_parse_source_nat(self):
        source_output = """source NAT rule: Internet-SNAT
  Rule-set: nat-out
  From zone: trust, To zone: untrust
  Match: source-address 10.0.0.0/8
  Then: translated address: 203.0.113.5"""
        dest_output = ""
        result = JuniperSRXParser.parse_nat_rules(
            source_output, dest_output, "10.1.1.100", "8.8.8.8", "tcp", 443
        )

        assert result is not None
        assert result.snat is not None
        assert result.snat.translated_ip == "203.0.113.5"
        assert result.dnat is None

    def test_no_nat(self):
        result = JuniperSRXParser.parse_nat_rules("", "", "10.0.0.1", "10.0.0.2", "tcp", 80)
        assert result is None
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_juniper_srx_parser.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement Juniper SRX parser**

Create `pathtracer/parsers/juniper_srx_parser.py` with methods:
- `parse_route_entry` — Junos format: `0.0.0.0/0 *[Static/5] ... > to 10.0.0.1 via ge-0/0/0.0`
- `parse_routing_table` — full Junos routing table
- `parse_interface_detail` — Junos `show interfaces extensive` format
- `parse_security_zones` — `show security zones` to build interface→zone mapping
- `parse_security_policy_match` — `show security match-policies` output
- `parse_nat_rules` — parse source and destination NAT rules, match against flow params

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_juniper_srx_parser.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/parsers/juniper_srx_parser.py pathtracer/tests/test_juniper_srx_parser.py
git commit -m "feat(pathtracer): add Juniper SRX parser

Parse Junos routing, interface detail, security zones, security
policy match, and NAT rules."
```

---

## Task 11: Juniper SRX driver

**Files:**
- Create: `pathtracer/drivers/juniper_srx.py`
- Modify: `pathtracer/drivers/__init__.py`
- Modify: `pathtracer/parsers/__init__.py`
- Test: `pathtracer/tests/test_juniper_srx_driver.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_juniper_srx_driver.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_juniper_srx_driver.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement Juniper SRX driver**

Create `pathtracer/drivers/juniper_srx.py` following the existing driver pattern:
- `device_type = 'juniper_junos'`, `parser = JuniperSRXParser()`
- `connect/disconnect`: standard netmiko
- `get_route`: `show route <destination>`
- `get_routing_table`: `show route`
- `list_logical_contexts`: `show routing-instances`
- `get_interface_to_context_mapping`: parse routing instances
- `detect_device_info`: `show version`
- `get_interface_detail`: `show interfaces <name> extensive`
- `get_zone_for_interface`: `show security zones`, use parser to build zone map, lookup interface
- `lookup_security_policy`: `show security match-policies from-zone <z> to-zone <z> source-ip <s> destination-ip <d> source-port <sp> destination-port <dp> protocol <p>`
- `lookup_nat`: `show security nat source rule all` + `show security nat destination rule all`, pass to parser

Update `pathtracer/drivers/__init__.py` — add `JuniperSRXDriver`.
Update `pathtracer/parsers/__init__.py` — add `JuniperSRXParser`.

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_juniper_srx_driver.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/drivers/juniper_srx.py pathtracer/drivers/__init__.py pathtracer/parsers/__init__.py pathtracer/tests/test_juniper_srx_driver.py
git commit -m "feat(pathtracer): add Juniper SRX driver

Full SRX driver with Junos routing, interface detail, zone-based
security policy lookup, and NAT rule matching."
```

---

## Task 12: Cisco FTD stub driver

**Files:**
- Create: `pathtracer/drivers/cisco_ftd.py`
- Modify: `pathtracer/drivers/__init__.py`
- Test: `pathtracer/tests/test_cisco_ftd_driver.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_cisco_ftd_driver.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_ftd_driver.py -v`
Expected: FAIL (ImportError)

**Step 3: Implement stub driver**

Create `pathtracer/drivers/cisco_ftd.py`:

```python
"""Cisco FTD driver stub. Full implementation requires FMC REST API integration."""

from typing import List, Dict, Optional
from .base import NetworkDriver
from ..models import RouteEntry, NetworkDevice, CredentialSet

NOT_IMPLEMENTED_MSG = "Cisco FTD requires FMC API integration (not yet implemented)"


class CiscoFTDDriver(NetworkDriver):
    """Cisco FTD driver stub."""

    def connect(self) -> None:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def disconnect(self) -> None:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_route(self, destination: str, context: str = None) -> Optional[RouteEntry]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_routing_table(self, context: str = None) -> List[RouteEntry]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def list_logical_contexts(self) -> List[str]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def detect_device_info(self) -> Dict:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)
```

Update `pathtracer/drivers/__init__.py` — add `CiscoFTDDriver`.

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_cisco_ftd_driver.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add pathtracer/drivers/cisco_ftd.py pathtracer/drivers/__init__.py pathtracer/tests/test_cisco_ftd_driver.py
git commit -m "feat(pathtracer): add Cisco FTD stub driver

All methods raise NotImplementedError indicating FMC API integration
is required for full implementation."
```

---

## Task 13: Update orchestrator with enriched hop collection

**Files:**
- Modify: `pathtracer/orchestrator.py`
- Test: `pathtracer/tests/test_orchestrator_phase2.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_orchestrator_phase2.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_orchestrator_phase2.py -v`
Expected: FAIL

**Step 3: Implement orchestrator changes**

Update `pathtracer/orchestrator.py`:

1. Add imports for new models and drivers
2. Add `FIREWALL_VENDORS` constant
3. Add `_is_firewall` method
4. Update `trace_path` signature to accept `protocol="tcp"` and `destination_port=443`
5. Update `_query_device` to accept and use `ingress_interface`, `protocol`, `destination_port`, and `source_ip` parameters; return `HopQueryResult` instead of `RouteEntry`
6. Update main loop to:
   - Track `working_destination` (starts as `destination_ip`, changes on DNAT)
   - Pass `ingress_interface` from previous hop's egress
   - Build `PathHop` with new fields from `HopQueryResult`
   - Update `working_destination` on DNAT
7. Update `_get_driver` vendor map with new drivers

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_orchestrator_phase2.py -v`
Expected: All PASS

**Step 5: Run all tests**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/ -v`
Expected: All PASS (no regressions)

**Step 6: Commit**

```bash
git add pathtracer/orchestrator.py pathtracer/tests/test_orchestrator_phase2.py
git commit -m "feat(pathtracer): update orchestrator for Phase 2

Add enriched hop collection with interface detail, firewall policy/NAT
queries. Track post-NAT destination. Accept protocol/port parameters.
Add firewall detection and new driver mappings."
```

---

## Task 14: Update API serialization

**Files:**
- Modify: `api/traceroute.py`
- Test: `pathtracer/tests/test_api_serialization.py`

**Step 1: Write failing tests**

Create `pathtracer/tests/test_api_serialization.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_api_serialization.py -v`
Expected: FAIL (`_serialize_hop` doesn't exist)

**Step 3: Implement API changes**

Update `api/traceroute.py`:

1. Extract hop serialization to a `_serialize_hop(hop)` function
2. Add serialization for new fields: `ingress_detail`, `egress_detail`, `policy_result`, `nat_result`, `resolve_status`
3. Each dataclass serializes to a dict (None fields serialize as JSON null)
4. Add `protocol` and `destinationPort` to request parameter parsing in `device_based_traceroute`
5. Pass them through to `perform_device_trace` and then to `tracer.trace_path`

Helper serialization functions:

```python
def _serialize_interface_detail(detail):
    if detail is None:
        return None
    return {
        'name': detail.name,
        'description': detail.description,
        'status': detail.status,
        'speed': detail.speed,
        'utilisation_in_pct': detail.utilisation_in_pct,
        'utilisation_out_pct': detail.utilisation_out_pct,
        'errors_in': detail.errors_in,
        'errors_out': detail.errors_out,
        'discards_in': detail.discards_in,
        'discards_out': detail.discards_out,
    }

def _serialize_policy_result(policy):
    if policy is None:
        return None
    return {
        'rule_name': policy.rule_name,
        'rule_position': policy.rule_position,
        'action': policy.action,
        'source_zone': policy.source_zone,
        'dest_zone': policy.dest_zone,
        'source_addresses': policy.source_addresses,
        'dest_addresses': policy.dest_addresses,
        'services': policy.services,
        'logging': policy.logging,
        'raw_output': policy.raw_output,
    }

def _serialize_nat_translation(t):
    if t is None:
        return None
    return {
        'original_ip': t.original_ip,
        'original_port': t.original_port,
        'translated_ip': t.translated_ip,
        'translated_port': t.translated_port,
        'nat_rule_name': t.nat_rule_name,
    }

def _serialize_nat_result(nat):
    if nat is None:
        return None
    return {
        'snat': _serialize_nat_translation(nat.snat),
        'dnat': _serialize_nat_translation(nat.dnat),
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/test_api_serialization.py -v`
Expected: All PASS

**Step 5: Run all tests**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/ -v`
Expected: All PASS

**Step 6: Commit**

```bash
git add api/traceroute.py pathtracer/tests/test_api_serialization.py
git commit -m "feat(pathtracer): update API for Phase 2 serialization

Serialize interface detail, policy result, and NAT result in hop
response data. Accept protocol and destinationPort request parameters."
```

---

## Task 15: Final integration test

**Files:**
- Test: `pathtracer/tests/test_integration_phase2.py`

**Step 1: Write integration test**

Create `pathtracer/tests/test_integration_phase2.py`:

```python
"""Integration tests verifying Phase 2 components work together."""

import pytest
from pathtracer.models import (
    NetworkDevice, RouteEntry, InterfaceDetail,
    PolicyResult, NatResult, NatTranslation,
    HopQueryResult, PathHop, TracePath, PathStatus,
    DeviceVendor,
)
from pathtracer.orchestrator import PathTracer, FIREWALL_VENDORS


class TestAllNewModelsImportable:
    def test_imports(self):
        """All new models are importable from pathtracer.models."""
        from pathtracer.models import (
            PolicyResult, NatTranslation, NatResult,
            InterfaceDetail, HopQueryResult,
        )


class TestAllNewDriversImportable:
    def test_imports(self):
        """All new drivers are importable from pathtracer.drivers."""
        from pathtracer.drivers import (
            CiscoASADriver, JuniperSRXDriver, CiscoFTDDriver,
        )


class TestAllNewParsersImportable:
    def test_imports(self):
        """All new parsers are importable from pathtracer.parsers."""
        from pathtracer.parsers import (
            CiscoASAParser, JuniperSRXParser,
        )


class TestPathHopEnrichment:
    def test_enriched_hop_creation(self):
        """Can create a fully enriched PathHop."""
        device = NetworkDevice(
            hostname="fw-01", management_ip="10.0.0.1",
            vendor="paloalto", device_type="firewall",
        )
        route = RouteEntry(
            destination="0.0.0.0/0", next_hop="10.0.0.2",
            next_hop_type="ip", protocol="static",
            outgoing_interface="ethernet1/2",
        )
        hop = PathHop(
            sequence=1,
            device=device,
            egress_interface="ethernet1/2",
            logical_context="default",
            route_used=route,
            lookup_time_ms=125.5,
            resolve_status="resolved",
            egress_detail=InterfaceDetail(name="ethernet1/2", status="up", speed="10G"),
            policy_result=PolicyResult(
                rule_name="Allow-Web", rule_position=15, action="permit",
                source_zone="trust", dest_zone="untrust",
                source_addresses=["10.0.0.0/8"], dest_addresses=["any"],
                services=["tcp/443"], logging=True,
            ),
            nat_result=NatResult(
                snat=NatTranslation(
                    original_ip="10.1.1.100", original_port="54321",
                    translated_ip="203.0.113.5", translated_port="54321",
                ),
            ),
        )

        assert hop.policy_result.action == "permit"
        assert hop.nat_result.snat.translated_ip == "203.0.113.5"
        assert hop.egress_detail.speed == "10G"
```

**Step 2: Run all tests**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && python -m pytest pathtracer/tests/ -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add pathtracer/tests/test_integration_phase2.py
git commit -m "test(pathtracer): add Phase 2 integration tests

Verify all new models, drivers, parsers, and enriched hop creation
work together."
```

---

## Summary

| Task | Component | Files | Tests |
|------|-----------|-------|-------|
| 1 | Data models | `models.py` | `test_models.py` |
| 2 | Base driver methods | `base.py` | `test_base_driver.py` |
| 3 | Cisco IOS interface detail | `cisco_ios_parser.py`, `cisco_ios.py` | `test_cisco_ios_interface.py` |
| 4 | Arista EOS interface detail | `arista_parser.py`, `arista_eos.py` | `test_arista_interface.py` |
| 5 | Aruba interface detail | `aruba_parser.py`, `aruba.py` | `test_aruba_interface.py` |
| 6 | Palo Alto interface + zone | `paloalto_parser.py`, `paloalto.py` | `test_paloalto_interface.py` |
| 7 | Palo Alto policy + NAT | `paloalto_parser.py`, `paloalto.py` | `test_paloalto_firewall.py` |
| 8 | Cisco ASA parser | `cisco_asa_parser.py` | `test_cisco_asa_parser.py` |
| 9 | Cisco ASA driver | `cisco_asa.py` | `test_cisco_asa_driver.py` |
| 10 | Juniper SRX parser | `juniper_srx_parser.py` | `test_juniper_srx_parser.py` |
| 11 | Juniper SRX driver | `juniper_srx.py` | `test_juniper_srx_driver.py` |
| 12 | Cisco FTD stub | `cisco_ftd.py` | `test_cisco_ftd_driver.py` |
| 13 | Orchestrator enrichment | `orchestrator.py` | `test_orchestrator_phase2.py` |
| 14 | API serialization | `traceroute.py` | `test_api_serialization.py` |
| 15 | Integration tests | — | `test_integration_phase2.py` |
