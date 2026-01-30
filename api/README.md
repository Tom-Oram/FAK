# Path Tracer API

Python Flask backend providing ICMP traceroute and device-based path tracing with optional NetBox enrichment.

## Requirements

- Python 3.8+
- System packages: `libpcap-dev`, `tcpdump`, `openssh-client`
- For ICMP: `NET_RAW` capability (handled by Docker Compose)
- For device-based: device inventory and SSH credentials

## API Endpoints

### POST /api/traceroute

ICMP traceroute using Scapy.

**Request:**
```json
{
  "source": "192.168.1.1",
  "destination": "8.8.8.8",
  "netboxUrl": "https://netbox.example.com",
  "netboxToken": "your-api-token"
}
```

**Response:**
```json
{
  "mode": "icmp",
  "hops": [
    {
      "ttl": 1,
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "rtt": 1.23,
      "timeout": false,
      "device": {
        "name": "core-router-01",
        "site": "datacenter-1",
        "role": "Core Router"
      }
    }
  ],
  "startTime": "2026-01-30T10:00:00Z",
  "endTime": "2026-01-30T10:00:05Z",
  "hopCount": 10
}
```

### POST /api/traceroute/device-based

Device-based path tracing via SSH to network devices.

**Request:**
```json
{
  "source": "10.10.5.100",
  "destination": "192.168.100.50",
  "startDevice": "core-rtr-01",
  "sourceContext": "VRF_CORP",
  "protocol": "tcp",
  "destinationPort": 443,
  "netboxUrl": "https://netbox.example.com",
  "netboxToken": "your-api-token"
}
```

All fields except `source` and `destination` are optional.

**Response:**
```json
{
  "mode": "device-based",
  "source_ip": "10.10.5.100",
  "destination_ip": "192.168.100.50",
  "status": "complete",
  "hop_count": 3,
  "total_time_ms": 4230,
  "hops": [
    {
      "sequence": 1,
      "device": {
        "hostname": "core-rtr-01",
        "management_ip": "10.1.1.1",
        "vendor": "cisco_ios",
        "device_type": "router",
        "site": "dc-1"
      },
      "ingress_interface": null,
      "egress_interface": "GigabitEthernet0/1",
      "logical_context": "global",
      "lookup_time_ms": 1420,
      "route": {
        "destination": "192.168.100.0/24",
        "next_hop": "10.1.1.5",
        "protocol": "ospf",
        "metric": 20,
        "preference": 110
      },
      "ingress_detail": null,
      "egress_detail": null,
      "policy_result": null,
      "nat_result": null
    }
  ]
}
```

### GET /health

Returns `{"status": "ok", "service": "traceroute-api"}`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLASK_ENV` | `production` or `development` |
| `FLASK_DEBUG` | Set to `true` to enable debug mode (default: `false`) |
| `NETBOX_URL` | NetBox instance URL |
| `NETBOX_TOKEN` | NetBox API token |
| `PATHTRACE_USER` | SSH username for device tracing |
| `PATHTRACE_PASS` | SSH password |
| `PATHTRACE_SECRET` | Enable secret (Cisco) |
| `PATHTRACE_INVENTORY` | Path to inventory YAML file |

## Docker Deployment

The API is deployed as the `backend` service in `docker-compose.yml`. It runs with `NET_RAW` and `NET_ADMIN` capabilities for ICMP raw socket access.

## Local Development

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r ../pathtracer/requirements.txt  # device-based tracing deps
FLASK_DEBUG=true python traceroute.py
```
