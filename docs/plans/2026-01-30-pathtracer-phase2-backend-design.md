# PathTracer Phase 2 Backend: Firewall Inspection & Interface Details

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend PathTracer's device-based tracing with firewall policy/NAT inspection and interface operational detail collection across all supported platforms.

**Architecture:** Add new data models for security policy, NAT translations, and interface details. Extend the base driver with optional methods that firewall drivers implement. Create three new drivers (Cisco ASA, Juniper SRX, Cisco FTD stub). Update the orchestrator to collect enriched data at each hop and track post-NAT destination changes. Extend the API to serialize and accept flow parameters.

**Tech Stack:** Python (netmiko for SSH, platform-specific CLI parsing)

---

## Data Model Changes

### New dataclasses in `pathtracer/models.py`

#### PolicyResult

Represents a matched firewall security rule:

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
```

#### NatTranslation and NatResult

Represent NAT transformations with explicit SNAT/DNAT distinction:

```python
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
```

#### InterfaceDetail

Operational interface data:

```python
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
```

Utilisation is calculated from the device's native rate counters (e.g., "5 minute input rate" on IOS) divided by interface speed. No SNMP required.

### Extended PathHop

```python
@dataclass
class PathHop:
    sequence: int
    device: NetworkDevice
    ingress_interface: Optional[str] = None
    egress_interface: Optional[str] = None
    logical_context: str = "global"
    route_used: Optional[RouteEntry] = None
    lookup_time_ms: float = 0.0
    notes: str = ""
    # Phase 2 additions
    resolve_status: Optional[str] = None    # resolved, resolved_by_site, user_selected
    ingress_detail: Optional[InterfaceDetail] = None
    egress_detail: Optional[InterfaceDetail] = None
    policy_result: Optional[PolicyResult] = None
    nat_result: Optional[NatResult] = None
```

All new fields default to None so existing code is unaffected.

### New DeviceVendor values

```python
class DeviceVendor(Enum):
    CISCO_IOS = "cisco_ios"
    CISCO_NXOS = "cisco_nxos"
    ARISTA_EOS = "arista_eos"
    JUNIPER_JUNOS = "juniper_junos"
    PALO_ALTO = "paloalto"
    ARUBA = "aruba"
    FORTINET = "fortinet"
    # New
    CISCO_ASA = "cisco_asa"
    CISCO_FTD = "cisco_ftd"
    JUNIPER_SRX = "juniper_srx"
```

### Vendor-to-DeviceType inference

When `device_type` is not explicitly set in inventory, infer from vendor:

```python
FIREWALL_VENDORS = {"paloalto", "cisco_asa", "cisco_ftd", "juniper_srx", "fortinet"}
```

Used by the orchestrator to decide whether to query security policy/NAT.

---

## Base Driver Changes

### New methods on `NetworkDriver` (base.py)

Four new methods with default implementations returning None. Existing drivers don't need changes unless they want to provide the data.

```python
def get_interface_detail(self, interface_name: str) -> Optional[InterfaceDetail]:
    """Get operational detail for an interface. Override in subclass."""
    return None

def get_zone_for_interface(self, interface_name: str) -> Optional[str]:
    """Get security zone for an interface. Firewall drivers override this."""
    return None

def lookup_security_policy(
    self, source_ip: str, dest_ip: str,
    protocol: str, port: int,
    source_zone: str, dest_zone: str
) -> Optional[PolicyResult]:
    """Find matching firewall rule. Firewall drivers override this."""
    return None

def lookup_nat(
    self, source_ip: str, dest_ip: str,
    protocol: str, port: int
) -> Optional[NatResult]:
    """Find NAT translations. Firewall drivers override this."""
    return None
```

Imports needed in base.py: `InterfaceDetail`, `PolicyResult`, `NatResult` from models.

---

## Existing Driver Updates

All four existing drivers get `get_interface_detail` implementations.

### Cisco IOS/IOS-XE (`cisco_ios.py`)

Command: `show interfaces <name>`

Parse from output:
- Status: "up/up", "down/down", "administratively down"
- Speed: "1000Mb/s", "10Gb/s" etc.
- Input/output rate: "5 minute input rate X bits/sec" -> calculate utilisation as rate / speed
- Errors: "input errors", "output errors"
- Discards: "input queue drops", "output drops"

### Arista EOS (`arista_eos.py`)

Command: `show interfaces <name>`

Very similar to IOS output format. Same fields, similar parsing.

### Palo Alto PAN-OS (`paloalto.py`)

Command: `show interface <name>`

Parse:
- State: "state is up/down"
- Speed: from "speed" field
- Counters: "bytes received/transmitted", "errors received"

Also gets the three firewall methods (see dedicated section below).

### Aruba (`aruba.py`)

Command: `show interface <name>` (AOS-CX) or `show interfaces <name>` (AOS-Switch)

Parse status, speed, and counters from the appropriate output format.

---

## New Firewall Drivers

### Palo Alto PAN-OS firewall methods (added to existing `paloalto.py`)

**Zone lookup:**
```
show interface <name>
```
Parse the `zone` field from the output.

**Policy lookup:**
```
test security-policy-match source <src> destination <dst> protocol <proto> destination-port <port> from <src_zone> to <dst_zone>
```
Returns matched rule name and action. Follow up with `show running security-policy` to get full rule details (addresses, services, logging).

**NAT lookup:**
```
test nat-policy-match source <src> destination <dst> protocol <proto> destination-port <port> from <src_zone> to <dst_zone>
```
Returns original and translated addresses for both source and destination NAT.

Parser: Extend `pathtracer/parsers/paloalto_parser.py` with methods:
- `parse_interface_detail(output) -> InterfaceDetail`
- `parse_zone_from_interface(output) -> Optional[str]`
- `parse_security_policy_match(output) -> Optional[PolicyResult]`
- `parse_nat_policy_match(output) -> Optional[NatResult]`

### Cisco ASA (`pathtracer/drivers/cisco_asa.py`)

New driver using netmiko device_type `cisco_asa`.

**Routing:** `show route <destination>` for route lookup. `show route` for full table.

**Contexts:** `show context` for security contexts (multi-context ASA). Single-context uses "system".

**Interface detail:** `show interface <name>`

**Zone lookup:** `show nameif` maps interfaces to nameif names. ASA uses nameif as the zone equivalent.

**Policy + NAT (combined):**
```
packet-tracer input <ingress_iface> <protocol> <src_ip> <src_port> <dst_ip> <dst_port> detailed
```
This single command traces a packet through the ASA and returns:
- Matched access-list/ACL (the policy)
- NAT translations applied (SNAT and DNAT)
- Final action (allow/drop)

This is more efficient than separate policy and NAT queries since ASA provides it all in one command.

Parser: New `pathtracer/parsers/cisco_asa_parser.py` with methods:
- `parse_route_entry(output, destination, context) -> Optional[RouteEntry]`
- `parse_routing_table(output, context) -> List[RouteEntry]`
- `parse_interface_detail(output) -> Optional[InterfaceDetail]`
- `parse_nameif_mapping(output) -> Dict[str, str]` (interface -> nameif)
- `parse_packet_tracer(output) -> Tuple[Optional[PolicyResult], Optional[NatResult]]`

### Juniper SRX (`pathtracer/drivers/juniper_srx.py`)

New driver using netmiko device_type `juniper_junos`.

**Routing:** `show route <destination>` for route lookup. Standard Junos routing commands.

**Contexts:** `show routing-instances` for routing instances.

**Interface detail:** `show interfaces <name> extensive`

**Zone lookup:** `show security zones` to map interfaces to zones.

**Policy lookup:**
```
show security match-policies from-zone <zone> to-zone <zone> source-ip <src> destination-ip <dst> source-port <sport> destination-port <dport> protocol <proto>
```

**NAT lookup:**
```
show security nat source rule all
show security nat destination rule all
```
Match the rules against the flow parameters to find applicable translations.

Parser: New `pathtracer/parsers/juniper_srx_parser.py` with methods:
- `parse_route_entry(output, destination, context) -> Optional[RouteEntry]`
- `parse_routing_table(output, context) -> List[RouteEntry]`
- `parse_interface_detail(output) -> Optional[InterfaceDetail]`
- `parse_security_zones(output) -> Dict[str, str]` (interface -> zone)
- `parse_security_policy_match(output) -> Optional[PolicyResult]`
- `parse_nat_rules(source_output, dest_output, src_ip, dst_ip, protocol, port) -> Optional[NatResult]`

### Cisco FTD (`pathtracer/drivers/cisco_ftd.py`)

Stub driver. All methods raise `NotImplementedError` with a message indicating FMC API integration is planned.

```python
class CiscoFTDDriver(NetworkDriver):
    """Cisco FTD driver stub. Full implementation requires FMC REST API integration."""

    def connect(self):
        raise NotImplementedError("Cisco FTD requires FMC API integration (not yet implemented)")

    # ... all other methods raise NotImplementedError
```

No parser needed for the stub.

---

## Orchestrator Changes

### Updated `_query_device` method

Currently `_query_device` opens a driver connection, queries a route, and returns. It needs to be extended to also collect interface details and firewall data while the connection is open (avoiding multiple SSH sessions to the same device).

The method returns a richer result -- not just `RouteEntry`, but a bundle of route + interface details + policy + NAT.

```python
@dataclass
class HopQueryResult:
    """Result of querying a device for a single hop."""
    route: Optional[RouteEntry]
    egress_detail: Optional[InterfaceDetail] = None
    ingress_detail: Optional[InterfaceDetail] = None
    policy_result: Optional[PolicyResult] = None
    nat_result: Optional[NatResult] = None
```

Updated flow in `_query_device`:
1. Connect to device via driver
2. Query route (existing)
3. If route found and route has `outgoing_interface`, query `get_interface_detail` for it
4. If `ingress_interface` is known (passed as parameter), query `get_interface_detail` for it
5. If device is a firewall:
   a. Get zones for ingress and egress interfaces via `get_zone_for_interface`
   b. Call `lookup_security_policy` with flow 5-tuple + zones
   c. Call `lookup_nat` with flow 4-tuple
6. Return `HopQueryResult` with all collected data
7. All sub-queries are wrapped in try/except -- failures set the field to None and log a warning, they don't abort the trace

### Updated main loop in `trace_path`

New parameters: `protocol: str = "tcp"` and `destination_port: int = 443`.

At each hop:
1. Determine `ingress_interface` from previous hop's `egress_interface` (or None for first hop)
2. Call updated `_query_device` passing `ingress_interface`, `protocol`, `destination_port`, `destination_ip` (the working destination, which may change after DNAT)
3. Build `PathHop` with all new fields populated from `HopQueryResult`
4. If `nat_result` has DNAT, update the working destination IP to the translated address for subsequent hops

### Post-NAT destination tracking

```python
working_destination = destination_ip  # The IP we're actually tracing toward

# ... in loop, after collecting NAT result:
if hop_query_result.nat_result and hop_query_result.nat_result.dnat:
    working_destination = hop_query_result.nat_result.dnat.translated_ip
    logger.info(f"DNAT detected: destination changed to {working_destination}")
```

### Firewall detection

```python
FIREWALL_VENDORS = {"paloalto", "cisco_asa", "cisco_ftd", "juniper_srx", "fortinet"}

def _is_firewall(self, device: NetworkDevice) -> bool:
    """Check if a device is a firewall."""
    if device.device_type == "firewall":
        return True
    return device.vendor in FIREWALL_VENDORS
```

### Updated `_get_driver` vendor map

```python
vendor_drivers = {
    'cisco_ios': CiscoIOSDriver,
    'cisco_iosxe': CiscoIOSDriver,
    'cisco_nxos': CiscoIOSDriver,
    'arista_eos': AristaEOSDriver,
    'paloalto': PaloAltoDriver,
    'paloalto_panos': PaloAltoDriver,
    'aruba': ArubaDriver,
    'aruba_os': ArubaDriver,
    'cisco_asa': CiscoASADriver,
    'cisco_ftd': CiscoFTDDriver,
    'juniper_srx': JuniperSRXDriver,
    'juniper_junos': JuniperSRXDriver,  # SRX uses same Junos base
}
```

---

## API Changes

### Request parameters

Add to `POST /api/traceroute/device-based` request body:

```json
{
  "source": "192.168.1.1",
  "destination": "10.0.0.1",
  "protocol": "tcp",           // NEW - default "tcp"
  "destinationPort": 443,      // NEW - default 443
  "startDevice": "core-rtr-01",
  "sourceContext": "VRF_CORP",
  "inventoryFile": "inventory.yaml",
  "netboxUrl": "...",
  "netboxToken": "..."
}
```

### Response hop data

Each hop gains new nullable fields:

```json
{
  "sequence": 1,
  "device": { "hostname": "...", "management_ip": "...", "vendor": "...", "device_type": "...", "site": "..." },
  "ingress_interface": "ethernet1/1",
  "egress_interface": "ethernet1/2",
  "logical_context": "default",
  "lookup_time_ms": 125.5,
  "route": { "destination": "...", "next_hop": "...", "protocol": "bgp", "metric": 0, "preference": 20 },
  "resolve_status": "resolved",
  "ingress_detail": {
    "name": "ethernet1/1",
    "description": "Uplink to spine",
    "status": "up",
    "speed": "10G",
    "utilisation_in_pct": 45.2,
    "utilisation_out_pct": 32.1,
    "errors_in": 0,
    "errors_out": 0,
    "discards_in": 0,
    "discards_out": 0
  },
  "egress_detail": { "...same shape..." },
  "policy_result": {
    "rule_name": "Allow-Web",
    "rule_position": 15,
    "action": "permit",
    "source_zone": "trust",
    "dest_zone": "untrust",
    "source_addresses": ["10.0.0.0/8"],
    "dest_addresses": ["any"],
    "services": ["tcp/443"],
    "logging": true,
    "raw_output": "..."
  },
  "nat_result": {
    "snat": {
      "original_ip": "10.1.1.100",
      "original_port": "54321",
      "translated_ip": "203.0.113.5",
      "translated_port": "54321",
      "nat_rule_name": "Internet-SNAT"
    },
    "dnat": null
  }
}
```

### Serialization

Each dataclass maps 1:1 to a JSON dict. The `perform_device_trace` function's hop construction loop adds the new fields. None values serialize as JSON null.

---

## Files Changed

| File | Change |
|------|--------|
| `pathtracer/models.py` | Add PolicyResult, NatTranslation, NatResult, InterfaceDetail, HopQueryResult. Extend PathHop. Add vendor values. |
| `pathtracer/drivers/base.py` | Add four new methods with default None returns. |
| `pathtracer/drivers/cisco_ios.py` | Add get_interface_detail. |
| `pathtracer/drivers/arista_eos.py` | Add get_interface_detail. |
| `pathtracer/drivers/paloalto.py` | Add get_interface_detail, get_zone_for_interface, lookup_security_policy, lookup_nat. |
| `pathtracer/drivers/aruba.py` | Add get_interface_detail. |
| `pathtracer/drivers/cisco_asa.py` | **New** -- Full ASA driver with routing + firewall methods. |
| `pathtracer/drivers/juniper_srx.py` | **New** -- Full SRX driver with routing + firewall methods. |
| `pathtracer/drivers/cisco_ftd.py` | **New** -- Stub driver (NotImplementedError). |
| `pathtracer/parsers/cisco_ios_parser.py` | Add parse_interface_detail. |
| `pathtracer/parsers/arista_parser.py` | Add parse_interface_detail. |
| `pathtracer/parsers/paloalto_parser.py` | Add parse_interface_detail, parse_zone_from_interface, parse_security_policy_match, parse_nat_policy_match. |
| `pathtracer/parsers/aruba_parser.py` | Add parse_interface_detail. |
| `pathtracer/parsers/cisco_asa_parser.py` | **New** -- ASA output parsing (routes, interfaces, packet-tracer). |
| `pathtracer/parsers/juniper_srx_parser.py` | **New** -- SRX output parsing (routes, interfaces, zones, policies, NAT). |
| `pathtracer/orchestrator.py` | Updated _query_device, firewall detection, post-NAT tracking, protocol/port parameters. |
| `api/traceroute.py` | Serialize new fields, accept protocol/port params. |
| `pathtracer/drivers/__init__.py` | Export new drivers. |
| `pathtracer/parsers/__init__.py` | Export new parsers. |

---

## Scope

### In scope
- New dataclasses: PolicyResult, NatTranslation, NatResult, InterfaceDetail, HopQueryResult
- Extended PathHop with optional enrichment fields
- New DeviceVendor values: CISCO_ASA, CISCO_FTD, JUNIPER_SRX
- Base driver: four new methods with default None
- Interface detail collection on all six drivers (IOS, EOS, PAN-OS, Aruba, ASA, SRX)
- Firewall policy/NAT lookup on three platforms (PAN-OS, ASA, SRX)
- Cisco FTD stub driver
- Orchestrator: enriched hop collection, firewall detection, post-NAT destination tracking
- API: flow parameters (protocol, port), serialized enrichment data
- All new parsers for new drivers

### Out of scope (deferred)
- Frontend diagram components (separate phase)
- Cisco FTD FMC API integration
- Fortinet driver implementation
- SNMP-based utilisation polling
- ACL/prefix-list detail expansion
- Historical path storage
