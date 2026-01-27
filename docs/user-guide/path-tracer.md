# Path Tracer

Layer 3 hop-by-hop path discovery with infrastructure integration.

## Features

- **Traceroute**: ICMP TTL-based path discovery
- **RTT Analysis**: Color-coded latency indicators
- **NetBox Integration**: Device information lookup
- **Scanopy Integration**: Discovered topology data

## Requirements

- Backend API must be running
- For NetBox: Configure `NETBOX_URL` and `NETBOX_TOKEN`
- For Scanopy: Configure `SCANOPY_URL`

## Usage

1. Navigate to Path Tracer from the sidebar
2. Enter a destination IP or hostname
3. Click "Trace" to start path discovery
4. Review hops with device information
