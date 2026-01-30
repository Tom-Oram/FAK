# PathTracer: Ambiguous IP Resolution & Visual Path Diagram

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Handle ambiguous and duplicate IP addressing in PathTracer (VXLAN underlay, missing inventory) and add a polished visual path diagram with rich hop detail including firewall rule/NAT inspection.

**Architecture:** Two-phase enhancement. Phase 1 adds site-aware disambiguation to the discovery and orchestrator layers. Phase 2 adds a vertical swimlane path diagram with selectable hop detail panels and new firewall driver capabilities.

**Tech Stack:** Python (backend drivers, orchestrator), React, TypeScript, Tailwind CSS (frontend diagram)

---

## Problem Statement

PathTracer's device-based tracing currently fails or silently picks the wrong device when:

1. **Source IP is a host** (server, workstation) not present in the device inventory
2. **Source IP exists but inventory is incomplete** - the device isn't registered
3. **Hop IPs appear on multiple devices** - common in VXLAN underlays where identical loopback/transit addressing is reused across sites

The current code does a linear scan and returns the first match. There is no duplicate detection, no longest-prefix matching (despite the utility function existing), and no user-facing resolution when ambiguity occurs.

Additionally, the trace results are displayed as a flat table of hops. Troubleshooting engineers need a visual path representation with detailed per-hop information including routing, interfaces, and firewall policy/NAT data.

---

## Phase 1: Ambiguous IP Resolution

### Data Model Changes

#### NetworkDevice gets a `site` field

```python
@dataclass
class NetworkDevice:
    hostname: str
    management_ip: str
    site: Optional[str] = None        # New field
    vendor: str = ""
    device_type: str = "unknown"
    credentials_ref: str = "default"
    logical_contexts: List[str] = field(default_factory=lambda: ["global"])
    subnets: List[str] = field(default_factory=list)
    default_context: str = "global"
    metadata: Dict = field(default_factory=dict)
```

Inventory YAML example:

```yaml
devices:
  - hostname: spine-01
    management_ip: 10.255.0.1
    site: dc-east
    vendor: arista_eos
    subnets:
      - 10.255.0.0/24
  - hostname: spine-01
    management_ip: 10.255.0.1
    site: dc-west
    vendor: arista_eos
    subnets:
      - 10.255.0.0/24
```

If NetBox is configured and returns a site for the device, that takes precedence over the inventory value. The inventory value works as a fallback when NetBox isn't available.

### Discovery Layer Changes

#### Lookup methods return all candidates

`find_device_by_ip(ip)` returns `List[NetworkDevice]` instead of `Optional[NetworkDevice]`:

```python
def find_device_by_ip(self, ip: str) -> List[NetworkDevice]:
    return [d for d in self.devices if d.management_ip == ip]
```

`find_device_for_subnet(ip)` returns all matching devices with longest-prefix-match ordering:

```python
def find_device_for_subnet(self, ip: str) -> List[NetworkDevice]:
    matches = []
    for subnet, device in self.subnet_map.items():
        if ip_in_network(ip, subnet):
            prefix_len = int(subnet.split('/')[1])
            matches.append((prefix_len, device))
    # Sort by prefix length descending (longest match first)
    matches.sort(key=lambda x: x[0], reverse=True)
    longest = matches[0][0] if matches else None
    # Return all devices at the longest prefix length
    return [d for plen, d in matches if plen == longest]
```

#### Duplicate detection on inventory load

When loading inventory, warn (but don't error) if:

- Two devices share the same management IP
- Two devices at the same site claim overlapping subnets

Warnings are logged and returned to the frontend for display.

### Orchestrator Disambiguation Logic

New `_resolve_device` method replaces direct calls to discovery lookups:

```python
def _resolve_device(
    self, ip: str, previous_hop: Optional[PathHop] = None
) -> ResolveResult:
    # Stage 1: Find candidates
    candidates = self.inventory.find_device_by_ip(ip)
    if not candidates:
        candidates = self.inventory.find_device_for_subnet(ip)

    # Stage 2: Evaluate
    if len(candidates) == 0:
        return ResolveResult(device=None, status="not_found", candidates=[])
    if len(candidates) == 1:
        return ResolveResult(device=candidates[0], status="resolved", candidates=candidates)

    # Stage 3: Disambiguate by site affinity
    if previous_hop and previous_hop.device.site:
        same_site = [c for c in candidates if c.site == previous_hop.device.site]
        if len(same_site) == 1:
            return ResolveResult(device=same_site[0], status="resolved_by_site", candidates=candidates)
        if len(same_site) > 1:
            return ResolveResult(device=None, status="ambiguous", candidates=same_site)

    # Still ambiguous
    return ResolveResult(device=None, status="ambiguous", candidates=candidates)
```

```python
@dataclass
class ResolveResult:
    device: Optional[NetworkDevice]
    status: str  # resolved, resolved_by_site, not_found, ambiguous
    candidates: List[NetworkDevice]
```

### Trace Behaviour on Ambiguity

**Source IP ambiguity or not found:**

- Trace returns immediately with status `NEEDS_INPUT`
- Response includes candidate list (may be empty if not found at all)
- Frontend prompts user to select a device or type a hostname

**Mid-path ambiguity:**

- Trace stops at the ambiguous hop
- Status set to `INCOMPLETE` with reason `ambiguous_hop`
- Partial path returned with candidate list on the last hop
- User selects a device, frontend sends a continuation request with that device as start and the original destination
- Frontend stitches partial paths together for display

### Frontend Changes (Phase 1)

**Source IP resolution UI:**

- When trace returns `NEEDS_INPUT`, show the candidate devices as selectable cards (hostname, site, management IP)
- If no candidates, show the start device input prominently with the message: "Source IP not found in inventory - specify the starting device"

**Mid-path resolution UI:**

- Show partial path traced so far
- Last hop shows candidate devices as selectable cards
- "Continue trace" button after selection
- Stitched paths display seamlessly

### New PathStatus values

Add to the existing `PathStatus` enum:

```python
class PathStatus(Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    ERROR = "error"
    LOOP_DETECTED = "loop_detected"
    BLACKHOLED = "blackholed"
    MAX_HOPS_EXCEEDED = "max_hops_exceeded"
    NEEDS_INPUT = "needs_input"          # New
    AMBIGUOUS_HOP = "ambiguous_hop"      # New
```

---

## Phase 2: Visual Path Diagram

### Layout

Vertical swimlane with two columns:

- **Left column** - Path view: connected node cards showing the trace path top to bottom
- **Right column** - Detail panel: rich information for the selected hop

### Left Column: Path View

Each hop is a node card showing at a glance:

| Element | Description |
|---------|-------------|
| Device type icon | Distinct silhouettes: router, switch, firewall, load balancer |
| Hostname | Primary label |
| Site badge | Small colored pill with site name |
| VRF indicator | Shown if not "global" |

**Connecting lines between nodes:**

- Interface labels sit on the line (egress above, ingress below), like a network diagram
- Color coding:
  - Green: normal forwarding
  - Amber: high lookup latency
  - Red: policy deny, blackhole, or error
  - Dashed: hop was ambiguous and user-resolved
- NAT indicators on the line:
  - **S** badge: source NAT at this hop
  - **D** badge: destination NAT at this hop
  - **SD** badge: both source and destination NAT
- Firewall nodes get a small shield icon overlay on the node card

### Right Column: Detail Panel

When a hop is selected, the detail panel shows collapsible sections. Sections only appear when data is available (a plain router won't show Security).

#### 1. Device Section

- Hostname, management IP, vendor, platform
- Site, role
- Status indicator (up/down from NetBox if available)
- Device type icon (large)

#### 2. Forwarding Section

- Matched route displayed as a compact table row:
  - Destination prefix
  - Next-hop IP or interface
  - Protocol (BGP, OSPF, static, connected)
  - Metric and administrative distance
- VRF/routing context
- Egress interface name

#### 3. Interfaces Section

- Ingress and egress interface details:
  - Interface name and description
  - Operational status (up/down indicator)
  - Speed
  - Utilisation: horizontal bar chart (communicates load faster than a percentage number)
  - Error counters if non-zero: small red badge with count

#### 4. Security Section (firewalls only)

- **Matched rule:**
  - Rule name and position in rulebase
  - Action (permit/deny) with colour indicator
  - Source and destination zones
  - Source and destination address objects
  - Service/port objects
  - Log setting

- **NAT transformations** displayed as separate blocks depending on what's translated:

  - **Source NAT (SNAT):** Two-column card. Left: original source IP:port (muted style). Right: translated source IP:port (accent colour). Arrow between them.
  - **Destination NAT (DNAT):** Same layout for destination.
  - **Both (SNAT + DNAT):** Both blocks stacked, making double NAT immediately obvious.
  - Fields that aren't translated are greyed out so the eye is drawn to what changed.
  - When no NAT is happening at a firewall hop, the NAT subsection doesn't appear.

#### 5. Timing Section

- Lookup latency for this hop
- Cumulative path latency
- Small horizontal bar showing this hop's contribution to total path time (visual proportion rather than just a number)

### Backend Requirements for Phase 2

#### New driver capabilities

Firewall drivers (Palo Alto, ASA, Fortinet) need new methods:

```python
class FirewallDriver(BaseDriver):
    def lookup_policy(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int,
        source_zone: str, dest_zone: str
    ) -> Optional[PolicyResult]:
        """Find the matching firewall rule for a given flow."""
        ...

    def lookup_nat(
        self, source_ip: str, dest_ip: str,
        protocol: str, port: int
    ) -> Optional[NatResult]:
        """Find NAT transformations for a given flow."""
        ...
```

```python
@dataclass
class PolicyResult:
    rule_name: str
    rule_position: int
    action: str                    # permit, deny, drop
    source_zone: str
    dest_zone: str
    source_addresses: List[str]
    dest_addresses: List[str]
    services: List[str]
    logging: bool
    raw_output: str

@dataclass
class NatResult:
    snat: Optional[NatTranslation]
    dnat: Optional[NatTranslation]

@dataclass
class NatTranslation:
    original_ip: str
    original_port: Optional[str]
    translated_ip: str
    translated_port: Optional[str]
    nat_rule_name: str
```

#### Interface detail collection

All drivers need an interface detail method:

```python
def get_interface_detail(self, interface_name: str) -> InterfaceDetail:
    """Get operational detail for an interface."""
    ...

@dataclass
class InterfaceDetail:
    name: str
    description: str
    status: str                     # up, down, admin_down
    speed: str                      # 1G, 10G, 100G
    utilisation_in_pct: Optional[float]
    utilisation_out_pct: Optional[float]
    errors_in: int
    errors_out: int
    discards_in: int
    discards_out: int
```

#### Extended PathHop model

```python
@dataclass
class PathHop:
    sequence: int
    device: NetworkDevice
    ingress_interface: Optional[str]
    egress_interface: Optional[str]
    logical_context: str
    route_used: Optional[RouteEntry]
    lookup_time_ms: float
    notes: str
    # New fields
    resolve_status: str             # resolved, resolved_by_site, user_selected
    ingress_detail: Optional[InterfaceDetail]
    egress_detail: Optional[InterfaceDetail]
    policy_result: Optional[PolicyResult]
    nat_result: Optional[NatResult]
```

### Frontend Components (Phase 2)

```
src/components/tools/PathTracer/
├── diagram/
│   ├── PathDiagram.tsx          # Main diagram container (left + right columns)
│   ├── PathNode.tsx             # Individual hop node card
│   ├── PathConnector.tsx        # Connecting line between nodes with labels
│   ├── HopDetailPanel.tsx       # Right-side detail panel container
│   ├── DeviceSection.tsx        # Device info section
│   ├── ForwardingSection.tsx    # Route/VRF detail section
│   ├── InterfacesSection.tsx    # Interface detail with utilisation bars
│   ├── SecuritySection.tsx      # Firewall rule + NAT section
│   ├── NatBlock.tsx             # SNAT/DNAT transformation display
│   ├── TimingSection.tsx        # Latency detail section
│   └── icons.tsx                # Device type SVG icons (router, switch, firewall, LB)
```

---

## Scope

### Phase 1 (Ambiguous IP Resolution)

- `site` field on `NetworkDevice` (inventory YAML + NetBox enrichment)
- Lookup methods return all candidates
- Longest-prefix-match for subnet lookups
- Site-affinity disambiguation in orchestrator
- `NEEDS_INPUT` and `AMBIGUOUS_HOP` path statuses
- Duplicate detection warnings on inventory load
- Frontend: candidate selection UI for source and mid-path ambiguity
- Frontend: trace continuation (stitch partial paths)

### Phase 2 (Visual Path Diagram)

- Vertical swimlane diagram component
- Node cards with device type icons, site badges, VRF indicators
- Connecting lines with interface labels, NAT indicators, health coloring
- Selectable hops with detail panel
- Detail sections: Device, Forwarding, Interfaces, Security, Timing
- NAT display with separate SNAT/DNAT/both blocks
- Interface utilisation bar charts
- Firewall driver methods: policy lookup, NAT lookup
- All driver methods: interface detail collection
- Extended PathHop model with new fields

### Deferred

- Drag-and-drop path editing (manually override hops)
- Path comparison (side-by-side two traces)
- Animated packet flow visualisation
- Historical path storage and diffing
- ACL/prefix-list detail expansion within security section
