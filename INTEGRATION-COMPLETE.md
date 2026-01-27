# First Aid Kit - Device-Based Path Tracer Integration

## Integration Complete ✅

The device-based path tracer has been successfully integrated into First Aid Kit, providing both ICMP and device-based path tracing capabilities side-by-side.

---

## What Was Integrated

### Backend Changes ([api/traceroute.py](api/traceroute.py))

1. **Added PathTracer Module Import**
   - Dynamically imports pathtracer modules
   - Gracefully handles missing dependencies
   - Sets `DEVICE_TRACER_AVAILABLE` flag

2. **New Function: `perform_device_trace()`**
   - Loads device inventory from YAML file
   - Loads credentials from environment variables or file
   - Creates PathTracer instance
   - Executes device-based trace
   - Converts results to API response format
   - Optionally enriches with NetBox data

3. **New API Endpoint: `/api/traceroute/device-based`**
   - POST endpoint for device-based traces
   - Accepts: source, destination, inventoryFile, startDevice, sourceContext, netboxUrl, netboxToken
   - Returns: Full trace results with device details, routing info, VRF contexts

4. **Updated Existing Endpoint: `/api/traceroute`**
   - Now explicitly returns ICMP traces
   - Adds `mode: 'icmp'` to response
   - Maintains backward compatibility

### Frontend Changes ([src/components/tools/PathTracer.tsx](src/components/tools/PathTracer.tsx))

1. **New TypeScript Interfaces**
   - `ICMPHop`: Represents ICMP traceroute hop
   - `DeviceHop`: Represents device-based path trace hop
   - Updated `TraceResult`: Supports both modes with discriminated union

2. **New State Variables**
   - `traceMode`: Toggle between 'icmp' and 'device-based'
   - `startDevice`: Override starting device hostname
   - `sourceContext`: Starting VRF/virtual router
   - `inventoryFile`: Custom inventory file path

3. **Enhanced UI Components**
   - **Mode Toggle**: Radio buttons to switch between ICMP and device-based
   - **Device-Based Options**: Conditional inputs for start device, source context, inventory file
   - **Smart Hop Display**: Detects hop type and renders appropriately
   - **Enhanced Expanded View**: Shows routing protocol, metric, preference, VRF context, egress interface

4. **Type-Safe Hop Rendering**
   - Helper functions: `isICMPHop()`, `isDeviceHop()`, `getHopKey()`
   - Conditional rendering based on hop type
   - Different detail views for ICMP vs device-based hops

---

## How to Use

### Prerequisites

1. **Install Dependencies**
   ```bash
   cd pathtracer
   pip install -r requirements.txt
   ```

2. **Create Inventory File**
   ```bash
   cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml
   # Edit inventory.yaml with your network devices
   ```

3. **Set Credentials**
   ```bash
   export PATHTRACE_USER="admin"
   export PATHTRACE_PASS="your_password"
   export PATHTRACE_SECRET="enable_secret"  # For Cisco devices
   ```

### Using ICMP Mode (Default)

1. Open First Aid Kit web UI
2. Navigate to "Path Tracer" tool
3. Keep "ICMP Traceroute" selected (default)
4. Enter source and destination IPs
5. Click "Start Trace"

**Characteristics:**
- Fast execution (~5-15 seconds)
- Works from any source IP
- Shows transit path (not necessarily forwarding path)
- May fail if ICMP is blocked
- No VRF awareness

### Using Device-Based Mode

1. Open First Aid Kit web UI
2. Navigate to "Path Tracer" tool
3. Select "Device-Based" radio button
4. Enter source and destination IPs
5. **Optional**: Click "Show Advanced Settings"
   - Enter start device hostname
   - Enter source VRF/context
   - Specify custom inventory file path
6. Click "Start Trace"

**Characteristics:**
- Slower execution (~10-30 seconds depending on hop count)
- Requires device inventory and credentials
- Shows actual forwarding path from routing tables
- Works even when ICMP is blocked
- VRF-aware - shows logical context at each hop
- Displays routing protocol, metric, preference

---

## Understanding the Results

### ICMP Trace Results

```
Hop 1: 10.1.1.1 (router1.example.com)
       RTT: 5.2 ms
       Device: core-rtr-01 (from NetBox)

Hop 2: *
       Timeout (ICMP blocked)

Hop 3: 192.168.100.1
       RTT: 15.8 ms
```

### Device-Based Trace Results

```
Hop 1: core-rtr-01
       10.1.1.1 | cisco_ios | OSPF | global
       Egress: GigabitEthernet0/1
       Next Hop: 10.1.1.5
       Metric: 20 | Admin Distance: 110
       Lookup Time: 1,245 ms

Hop 2: dist-rtr-01
       10.1.1.5 | arista_eos | CONNECTED | global
       Egress: Ethernet1/1
       Next Hop: 192.168.100.1
       Metric: 0 | Admin Distance: 0
       Lookup Time: 1,180 ms
```

**Key Differences:**
- Device-based shows device hostname, not just IP
- Shows routing protocol that determined the path
- Displays VRF/logical context
- Shows egress interface
- Includes routing metrics

---

## Configuration

### Environment Variables

```bash
# Required for device-based mode
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="password"
export PATHTRACE_SECRET="enable_secret"  # Cisco only

# Optional
export PATHTRACE_INVENTORY="/path/to/inventory.yaml"
export PATHTRACE_CREDENTIALS="/path/to/credentials.yaml"
```

### Inventory File Location

The backend looks for inventory files in this order:

1. Path specified in request body (`inventoryFile` parameter)
2. `PATHTRACE_INVENTORY` environment variable
3. `inventory.yaml` in current directory
4. `pathtracer/inventory.yaml` relative to API directory

### Credentials File Location

The backend looks for credentials in this order:

1. Environment variables (`PATHTRACE_USER`, `PATHTRACE_PASS`, `PATHTRACE_SECRET`)
2. `PATHTRACE_CREDENTIALS` environment variable
3. `credentials.yaml` in current directory
4. `pathtracer/credentials.yaml` relative to API directory

---

## API Reference

### POST /api/traceroute (ICMP Mode)

**Request:**
```json
{
  "source": "192.168.1.100",
  "destination": "8.8.8.8",
  "netboxUrl": "https://netbox.example.com",
  "netboxToken": "your-token"
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
      "hostname": "router.example.com",
      "rtt": 5.2,
      "timeout": false,
      "device": {
        "name": "core-rtr-01",
        "site": "datacenter-1",
        "role": "core",
        "platform": "cisco_ios"
      }
    }
  ],
  "startTime": "2024-01-16T10:00:00.000Z",
  "endTime": "2024-01-16T10:00:15.000Z",
  "hopCount": 10
}
```

### POST /api/traceroute/device-based (Device-Based Mode)

**Request:**
```json
{
  "source": "10.10.5.100",
  "destination": "192.168.100.50",
  "startDevice": "core-rtr-01",
  "sourceContext": "VRF_CORP",
  "inventoryFile": "inventory.yaml",
  "netboxUrl": "https://netbox.example.com",
  "netboxToken": "your-token"
}
```

**Response:**
```json
{
  "mode": "device-based",
  "source_ip": "10.10.5.100",
  "destination_ip": "192.168.100.50",
  "status": "COMPLETE",
  "hops": [
    {
      "sequence": 1,
      "device": {
        "hostname": "core-rtr-01",
        "management_ip": "10.1.1.1",
        "vendor": "cisco_ios",
        "device_type": "router",
        "netbox": {
          "name": "core-rtr-01",
          "site": "datacenter-1"
        }
      },
      "egress_interface": "GigabitEthernet0/1",
      "logical_context": "VRF_CORP",
      "lookup_time_ms": 1245.8,
      "route": {
        "destination": "192.168.100.0/24",
        "next_hop": "10.1.1.5",
        "next_hop_type": "ip",
        "protocol": "ospf",
        "metric": 20,
        "preference": 110
      }
    }
  ],
  "hop_count": 2,
  "total_time_ms": 2500.5,
  "error_message": null,
  "startTime": "2024-01-16T10:00:00.000Z",
  "endTime": "2024-01-16T10:00:02.500Z"
}
```

---

## Troubleshooting

### Error: "Device-based path tracer not available"

**Cause:** PathTracer module not found or dependencies missing

**Fix:**
```bash
cd pathtracer
pip install -r requirements.txt

# Verify installation
python -c "from pathtracer.orchestrator import PathTracer; print('OK')"
```

### Error: "Inventory file not found"

**Cause:** Inventory file path incorrect or file doesn't exist

**Fix:**
```bash
# Create inventory file
cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml

# Or set environment variable
export PATHTRACE_INVENTORY="/full/path/to/inventory.yaml"
```

### Error: "Authentication failed"

**Cause:** Incorrect credentials or credentials not set

**Fix:**
```bash
# Verify credentials
echo $PATHTRACE_USER
echo $PATHTRACE_PASS

# Test SSH manually
ssh $PATHTRACE_USER@10.1.1.1
```

### Device-Based Trace Shows "No device found for source IP"

**Cause:** Source IP not in any device's subnets in inventory

**Fix:**
1. Add source IP's subnet to appropriate device in inventory:
   ```yaml
   subnets:
     - 10.10.0.0/16  # Add this
   ```
2. Or specify start device explicitly in UI
3. Or use `--start-device` parameter in API request

### ICMP Works But Device-Based Fails

**Common Causes:**
1. Inventory doesn't include all devices in path
2. Credentials incorrect for some devices
3. SSH not enabled on devices
4. Device vendor not supported (only Cisco, Arista, Palo Alto, Aruba currently)

**Debug Steps:**
```bash
# Test individual device connectivity
ssh admin@10.1.1.1
show ip route 192.168.100.50

# Check inventory has all devices
cat pathtracer/inventory.yaml

# Run CLI with verbose logging
cd pathtracer
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 -vvv
```

---

## Performance Considerations

### ICMP Traceroute
- **Typical time**: 5-15 seconds
- **Factors**: Network latency, hop count, ICMP rate limiting
- **Best for**: Quick checks, external paths

### Device-Based Trace
- **Typical time**: 10-30 seconds
- **Factors**: SSH connection time (~1-3s per hop), routing table query time (~0.5-1s per hop)
- **Best for**: Detailed troubleshooting, VRF environments, when ICMP is blocked

### Optimization Tips

1. **Use connection pooling** (future enhancement)
   - Reuse SSH connections across traces
   - Can reduce device-based trace time by 50%

2. **Cache routing tables** (future enhancement)
   - Query full routing table once, cache for 5 minutes
   - Reduces per-hop time from ~2s to ~0.1s

3. **Choose appropriate mode**
   - Use ICMP for quick checks and external paths
   - Use device-based when you need routing details or ICMP fails

---

## Supported Vendors

The device-based path tracer currently supports:

- ✅ **Cisco IOS/IOS-XE/NX-OS** - Full VRF support
- ✅ **Arista EOS** - Full VRF support
- ✅ **Palo Alto PAN-OS** - Virtual router support
- ✅ **Aruba AOS-CX/AOS-Switch** - VRF support

To add more vendors, see [pathtracer/VENDOR-REFERENCE.md](pathtracer/VENDOR-REFERENCE.md).

---

## Future Enhancements

### Planned Features

1. **Parallel Mode Selection**
   - Run both ICMP and device-based simultaneously
   - Compare results side-by-side
   - Highlight differences

2. **Path Visualization**
   - Network diagram showing trace path
   - Color-coded by latency or protocol
   - Interactive hop details

3. **Scheduled Traces**
   - Monitor critical paths continuously
   - Alert on path changes
   - Historical path tracking

4. **NetBox Integration**
   - Load device inventory from NetBox
   - Dynamic credential lookup
   - Automated inventory sync

5. **Enhanced Multi-Vendor Support**
   - Juniper Junos
   - Fortinet FortiOS
   - Checkpoint GAiA
   - F5 BIG-IP

6. **Performance Optimizations**
   - SSH connection pooling
   - Routing table caching
   - Parallel device queries

---

## Migration from ICMP-Only

If you were using the previous ICMP-only version:

### What Changed

1. **Backward Compatible**: ICMP mode still works exactly as before
2. **New Mode Available**: Device-based mode is an optional enhancement
3. **No Breaking Changes**: Existing API calls continue to work

### How to Adopt Device-Based Mode

1. **Phase 1: Setup** (one-time)
   - Create device inventory file
   - Set up credentials
   - Test with CLI tool first

2. **Phase 2: Try It Out**
   - Use web UI to run device-based traces
   - Compare with ICMP results
   - Verify accuracy

3. **Phase 3: Integrate**
   - Use device-based for managed infrastructure
   - Keep ICMP for internet/external paths
   - Use both modes complementarily

### When to Use Each Mode

| Scenario | Recommended Mode | Reason |
|----------|-----------------|--------|
| Quick health check | ICMP | Faster |
| External/internet path | ICMP | Can't SSH to external devices |
| VRF environment | Device-Based | VRF-aware |
| ICMP blocked | Device-Based | Works through firewalls |
| Detailed troubleshooting | Device-Based | Shows routing decisions |
| Automated monitoring | Both | Comprehensive visibility |

---

## Summary

### Integration Highlights

- ✅ Dual-mode support (ICMP + Device-Based) in single UI
- ✅ Mode toggle with conditional UI elements
- ✅ Type-safe TypeScript implementation
- ✅ Backward compatible with existing ICMP functionality
- ✅ Multi-vendor device support (Cisco, Arista, Palo Alto, Aruba)
- ✅ VRF/Virtual Router awareness
- ✅ NetBox integration for both modes
- ✅ Comprehensive error handling
- ✅ Detailed hop information display

### Files Modified

- `api/traceroute.py` - Added device-based trace function and endpoint
- `src/components/tools/PathTracer.tsx` - Added dual-mode UI and rendering

### Files Referenced

- `pathtracer/*` - All path tracer modules (drivers, parsers, models, etc.)
- `pathtracer/inventory.yaml` - Device inventory (user must create)
- `pathtracer/credentials.yaml` - Device credentials (optional)

### Next Steps

1. Create your device inventory file
2. Set up credentials
3. Test device-based mode in UI
4. Compare results with ICMP mode
5. Use appropriate mode for each scenario

---

**The integration is complete and ready for use!** 🎉

For detailed path tracer documentation, see:
- [pathtracer/README.md](pathtracer/README.md)
- [pathtracer/TESTING.md](pathtracer/TESTING.md)
- [pathtracer/VENDOR-REFERENCE.md](pathtracer/VENDOR-REFERENCE.md)
- [pathtracer/QUICKSTART-CHECKLIST.md](pathtracer/QUICKSTART-CHECKLIST.md)
