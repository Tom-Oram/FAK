# Path Tracer API

Python backend API for performing layer 3 traceroute with NetBox device lookup integration.

## Requirements

- Python 3.8+
- Root/sudo privileges (required for raw socket access by Scapy)
- NetBox instance (optional, for device lookup)

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the API

```bash
# Run with sudo (required for Scapy raw sockets)
sudo venv/bin/python traceroute.py

# API will be available at http://localhost:5000
```

## API Endpoints

### POST /api/traceroute

Perform a traceroute from source to destination IP.

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
  "hops": [
    {
      "ttl": 1,
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "rtt": 1.23,
      "device": {
        "name": "core-router-01",
        "site": "datacenter-1",
        "role": "Core Router",
        "platform": "Cisco IOS",
        "status": "Active"
      }
    }
  ],
  "startTime": "2024-01-14T10:00:00Z",
  "endTime": "2024-01-14T10:00:05Z",
  "hopCount": 10
}
```

### GET /health

Health check endpoint.

## NetBox Integration

The API can look up device information from NetBox for each hop:

1. Searches for the hop's IP address in NetBox IPAM
2. If found and assigned to a device, retrieves device details
3. Returns device name, site, role, platform, and status

**Required NetBox Permissions:**
- Read access to IPAM (IP addresses)
- Read access to DCIM (devices)

## Docker Deployment

```dockerfile
FROM python:3.11-slim

# Install libpcap for Scapy
RUN apt-get update && apt-get install -y libpcap-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY traceroute.py .

# Run as root (required for raw sockets)
CMD ["python", "traceroute.py"]
```

## Security Considerations

- This API requires root privileges due to raw socket usage
- Run in an isolated environment
- Use firewall rules to restrict access
- Validate and sanitize all inputs
- Consider rate limiting to prevent abuse
- Use HTTPS in production
- Store NetBox tokens securely (never in frontend code)

## Troubleshooting

**"Operation not permitted" errors:**
- Ensure running with sudo/root privileges
- On Linux, you can set capabilities: `sudo setcap cap_net_raw=eip $(which python3)`

**Timeouts or no responses:**
- Check firewall rules (ICMP must be allowed)
- Some routers may filter/deprioritize ICMP
- Increase timeout value if needed

**NetBox lookup failures:**
- Verify NetBox URL and token
- Check API token has required permissions
- Ensure IP addresses are documented in NetBox IPAM
