# Path Tracer

Network path discovery with two trace modes and visual hop-by-hop diagram.

## Features

- **Two Trace Modes**: ICMP traceroute and device-based SSH path tracing
- **Visual Path Diagram**: Interactive left-column path view with detailed right-column panels
- **Device-Based Tracing**: Queries actual routing tables via SSH — works through firewalls, VRF-aware
- **Multi-Vendor Support**: Cisco IOS/IOS-XE/NX-OS, Arista EOS, Palo Alto PAN-OS, Aruba AOS-CX, Cisco FTD
- **NetBox Integration**: Device enrichment with site, role, platform, status
- **Firewall Inspection**: Security policy match and NAT translation display
- **Interface Health**: Utilisation bars, error/discard counters, speed and status

## Trace Modes

### ICMP Traceroute

- Fast, works from any source
- Uses ICMP packets with incrementing TTL
- No device credentials needed
- Best for: external paths, quick checks, validating actual traffic flow

### Device-Based Path Tracing

- SSH into network devices to query routing tables
- Shows actual forwarding path, routing protocol, metric, admin distance
- VRF/virtual router aware
- Works when ICMP is blocked
- Shows firewall policy matches and NAT translations
- Best for: internal troubleshooting, VRF environments, detailed analysis

## Requirements

- Backend API running (Docker Compose handles this)
- For device-based: device inventory file and SSH credentials
- For NetBox enrichment: `NETBOX_URL` and `NETBOX_TOKEN` in `.env`

## Usage

1. Navigate to Path Tracer from the sidebar
2. Select trace mode (ICMP or Device-Based)
3. Enter source and destination IP addresses
4. Optionally configure: start device, VRF/context, protocol, destination port
5. Click **Start Trace**
6. For device-based traces: click hops in the path diagram to view detailed panels

## Visual Path Diagram (Device-Based)

Device-based traces display an interactive two-column layout:

- **Left column**: Vertical path of device nodes with connectors showing interfaces, latency, and NAT badges
- **Right column**: Sticky detail panel with collapsible sections for the selected hop:
  - **Device**: Hostname, management IP, vendor, type, site, NetBox enrichment
  - **Forwarding**: Route destination, next hop, protocol badge, metric, admin distance, VRF
  - **Interfaces**: Ingress/egress interface health — status, speed, utilisation bars, error counters
  - **Security**: Firewall policy match (rule name, action, zones, addresses) and NAT translations
  - **Timing**: Hop latency, cumulative latency, proportional timing bar

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NETBOX_URL` | NetBox instance URL for device enrichment |
| `NETBOX_TOKEN` | NetBox API token |
| `PATHTRACE_USER` | SSH username for device-based tracing |
| `PATHTRACE_PASS` | SSH password |
| `PATHTRACE_SECRET` | Enable secret (Cisco devices) |
| `PATHTRACE_INVENTORY` | Path to inventory YAML file |

### Device Inventory

Create `services/pathtrace-api/pathtracer/inventory.yaml` with your network devices:

```yaml
devices:
  - hostname: core-rtr-01
    management_ip: 10.1.1.1
    vendor: cisco_ios
    subnets:
      - 10.10.0.0/16
    logical_contexts:
      - global
      - VRF_CORP
```

See `services/pathtrace-api/pathtracer/README.md` for full inventory format and vendor configuration.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pathtrace/api/traceroute` | POST | ICMP traceroute |
| `/pathtrace/api/traceroute/device-based` | POST | Device-based path trace |
| `/health` | GET | Health check |

See `services/pathtrace-api/README.md` for full request/response documentation.

## When to Use Each Mode

| Scenario | Recommended Mode |
|----------|-----------------|
| Quick check from workstation | ICMP |
| External/internet paths | ICMP |
| ICMP blocked in network | Device-Based |
| Need routing protocol details | Device-Based |
| VRF/multi-tenant networks | Device-Based |
| Firewall policy inspection | Device-Based |
| Path documentation/audit | Device-Based |
| Validating live traffic flow | ICMP |
