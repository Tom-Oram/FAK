# Integrating Path Tracer with First Aid Kit

## Overview

The path tracer can be integrated into the First Aid Kit backend API to provide device-based path tracing alongside the existing ICMP traceroute.

## Integration Approaches

### Option 1: Replace Existing Traceroute API

Completely replace the Scapy-based traceroute with the device-based path tracer.

**Pros:**
- More accurate (shows actual forwarding path, not ICMP path)
- Provides detailed per-hop information (device names, VRFs, protocols)
- No need for privileged mode

**Cons:**
- Requires device access credentials
- Requires device inventory
- Won't work across untrusted boundaries

### Option 2: Add Parallel API Endpoint

Keep both implementations and add a new `/api/pathtrace` endpoint.

**Pros:**
- Best of both worlds
- ICMP traceroute for external/untrusted paths
- Device traceroute for internal network paths
- User can choose based on use case

**Cons:**
- More code to maintain
- More complex UI

## Implementation Steps

### 1. Add to Backend Dependencies

Update `api/requirements.txt`:
```txt
netmiko>=4.0.0
paramiko>=3.0.0
pyyaml>=6.0
```

### 2. Copy Path Tracer Module

```bash
cp -r pathtracer/ api/
```

### 3. Create New API Endpoint

Add to `api/traceroute.py`:

```python
from pathtracer import PathTracer, DeviceInventory, CredentialManager
from pathtracer.models import PathStatus

# Initialize at startup
inventory = DeviceInventory(os.getenv('PATHTRACE_INVENTORY', './inventory.yaml'))
credentials = CredentialManager()
path_tracer = PathTracer(inventory, credentials)

@app.route('/api/pathtrace', methods=['POST'])
def pathtrace():
    """Device-based path trace endpoint."""
    try:
        data = request.get_json()
        
        source_ip = data.get('source')
        destination_ip = data.get('destination')
        start_device = data.get('startDevice')  # Optional
        source_context = data.get('sourceContext')  # Optional
        
        if not source_ip or not destination_ip:
            return jsonify({'error': 'Source and destination IPs required'}), 400
        
        # Perform trace
        path = path_tracer.trace_path(
            source_ip=source_ip,
            destination_ip=destination_ip,
            initial_context=source_context,
            start_device=start_device
        )
        
        # Convert to JSON
        result = {
            'source_ip': path.source_ip,
            'destination_ip': path.destination_ip,
            'status': path.status.value,
            'error_message': path.error_message,
            'total_time_ms': path.total_time_ms,
            'hop_count': path.hop_count(),
            'hops': [
                {
                    'sequence': hop.sequence,
                    'device': {
                        'hostname': hop.device.hostname,
                        'management_ip': hop.device.management_ip,
                        'vendor': hop.device.vendor,
                    },
                    'logical_context': hop.logical_context,
                    'egress_interface': hop.egress_interface,
                    'route': {
                        'destination': hop.route_used.destination if hop.route_used else None,
                        'next_hop': hop.route_used.next_hop if hop.route_used else None,
                        'protocol': hop.route_used.protocol if hop.route_used else None,
                        'metric': hop.route_used.metric if hop.route_used else None,
                    } if hop.route_used else None,
                    'lookup_time_ms': hop.lookup_time_ms,
                }
                for hop in path.hops
            ]
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 4. Update Environment Variables

Add to `.env`:
```bash
# Path Tracer Configuration
PATHTRACE_INVENTORY=/app/inventory.yaml
PATHTRACE_USER=network_admin
PATHTRACE_PASS=your_password
PATHTRACE_SECRET=enable_secret
```

### 5. Update Frontend

Add new fields to PathTracer.tsx:

```typescript
interface PathTraceMode {
  icmp: boolean;  // ICMP-based (Scapy)
  device: boolean;  // Device-based (SSH)
}

// Add mode selector in UI
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">Trace Mode</label>
  <select onChange={(e) => setTraceMode(e.target.value)}>
    <option value="icmp">ICMP Traceroute (External)</option>
    <option value="device">Device Traceroute (Internal)</option>
  </select>
</div>

// Call appropriate endpoint based on mode
const endpoint = traceMode === 'device' ? '/api/pathtrace' : '/api/traceroute';
```

### 6. Mount Inventory in Docker

Update `docker-compose.yml`:

```yaml
backend:
  volumes:
    - ./inventory.yaml:/app/inventory.yaml:ro
  environment:
    PATHTRACE_INVENTORY: /app/inventory.yaml
    PATHTRACE_USER: ${PATHTRACE_USER}
    PATHTRACE_PASS: ${PATHTRACE_PASS}
```

## Example Response

```json
{
  "source_ip": "10.10.5.100",
  "destination_ip": "192.168.100.50",
  "status": "complete",
  "total_time_ms": 4230,
  "hop_count": 5,
  "hops": [
    {
      "sequence": 1,
      "device": {
        "hostname": "access-sw-01",
        "management_ip": "10.1.1.3",
        "vendor": "cisco_ios"
      },
      "logical_context": "global",
      "egress_interface": "Vlan100",
      "route": {
        "destination": "10.10.0.0/16",
        "next_hop": "10.10.0.1",
        "protocol": "connected",
        "metric": 0
      },
      "lookup_time_ms": 842
    }
  ]
}
```

## Benefits Over ICMP Traceroute

1. **Accurate Path**: Shows actual forwarding path, not ICMP response path
2. **VRF Awareness**: Traces through VRFs correctly
3. **Device Context**: Know exactly which device is routing
4. **Protocol Info**: See routing protocol (OSPF, BGP, static)
5. **No Firewall Issues**: Works even if ICMP is blocked

## Limitations

1. **Requires Credentials**: Need SSH access to all devices
2. **Inventory Dependency**: Must maintain device inventory
3. **Internal Only**: Won't work for external/Internet paths
4. **Vendor Support**: Currently only Cisco IOS (MVP)

## Recommended Deployment

Use **both** modes:
- ICMP traceroute for external destinations and quick checks
- Device traceroute for internal network troubleshooting

Let users select mode based on their needs.
