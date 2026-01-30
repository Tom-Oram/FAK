# Multi-Vendor Path Tracer Testing Guide

This guide helps you test the path tracer with different vendor devices.

## Prerequisites

1. **Install dependencies**
```bash
cd pathtracer
pip install -r requirements.txt
```

2. **Set up credentials**
```bash
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="your_password"
export PATHTRACE_SECRET="enable_secret"  # For Cisco devices if needed
```

3. **Create inventory file**
Copy and edit the example inventory:
```bash
cp example-inventory-multivendor.yaml my-inventory.yaml
# Edit my-inventory.yaml with your actual devices
```

## Testing Strategy

### Phase 1: Single Device Tests

Test each vendor driver individually to verify connectivity and parsing.

#### Test Cisco IOS Device

```bash
# Create test inventory with one Cisco device
cat > test-cisco.yaml <<EOF
devices:
  - hostname: cisco-test
    management_ip: 10.1.1.1
    vendor: cisco_ios
    device_type: router
    credentials_ref: default
    subnets:
      - 10.10.0.0/16
    default_vrf: global
    logical_contexts:
      - global
EOF

# Test trace (use IPs that exist in your network)
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.1.50 \
  --inventory test-cisco.yaml \
  -vvv
```

Expected output:
- Successfully connects to Cisco device
- Queries routing table
- Parses route entry correctly
- Shows next hop information

#### Test Arista EOS Device

```bash
# Create test inventory with one Arista device
cat > test-arista.yaml <<EOF
devices:
  - hostname: arista-test
    management_ip: 10.1.1.2
    vendor: arista_eos
    device_type: l3_switch
    credentials_ref: default
    subnets:
      - 10.20.0.0/16
    default_vrf: default
    logical_contexts:
      - default
EOF

python -m pathtracer.cli \
  --source 10.20.5.100 \
  --dest 192.168.1.50 \
  --inventory test-arista.yaml \
  -vvv
```

#### Test Palo Alto Firewall

```bash
# Create test inventory with one Palo Alto device
cat > test-paloalto.yaml <<EOF
devices:
  - hostname: paloalto-test
    management_ip: 10.1.1.10
    vendor: paloalto
    device_type: firewall
    credentials_ref: default
    subnets:
      - 192.168.0.0/16
    default_context: default
    logical_contexts:
      - default
EOF

python -m pathtracer.cli \
  --source 192.168.10.100 \
  --dest 10.10.1.50 \
  --inventory test-paloalto.yaml \
  -vvv
```

**Note**: Palo Alto uses virtual routers instead of VRFs. Ensure your user has permission to run routing commands.

#### Test Aruba Switch

```bash
# Create test inventory with one Aruba device
cat > test-aruba.yaml <<EOF
devices:
  - hostname: aruba-test
    management_ip: 10.1.1.3
    vendor: aruba
    device_type: l3_switch
    credentials_ref: default
    subnets:
      - 192.168.1.0/24
    default_vrf: default
    logical_contexts:
      - default
EOF

python -m pathtracer.cli \
  --source 192.168.1.100 \
  --dest 10.10.1.50 \
  --inventory test-aruba.yaml \
  -vvv
```

### Phase 2: Multi-Hop Tests

Test path tracing across multiple devices.

#### Test Cisco-to-Cisco Path

```bash
# Two Cisco devices in sequence
cat > test-multi-cisco.yaml <<EOF
devices:
  - hostname: core-rtr-01
    management_ip: 10.1.1.1
    vendor: cisco_ios
    device_type: router
    credentials_ref: default
    subnets:
      - 10.10.0.0/16
    default_vrf: global
    logical_contexts:
      - global

  - hostname: dist-rtr-01
    management_ip: 10.1.1.5
    vendor: cisco_ios
    device_type: router
    credentials_ref: default
    subnets:
      - 192.168.0.0/16
    default_vrf: global
    logical_contexts:
      - global
EOF

python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory test-multi-cisco.yaml \
  -vvv
```

Expected output:
- Hop 1: core-rtr-01 (source device)
- Hop 2: dist-rtr-01 (next hop)
- Status: COMPLETE or shows where path ends

#### Test Mixed Vendor Path

```bash
# Use your multi-vendor inventory
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory example-inventory-multivendor.yaml \
  -vvv
```

This tests:
- Cisco router → Arista switch → Destination
- or Cisco → Palo Alto firewall → Aruba switch → Destination

### Phase 3: VRF/Virtual Router Tests

Test logical context handling.

#### Test Cisco VRF Path

```bash
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory my-inventory.yaml \
  --source-context VRF_CORP \
  -vvv
```

Expected output:
- Shows "logical_context: VRF_CORP" in hops
- Queries routing table in VRF context

#### Test Palo Alto Virtual Router

```bash
python -m pathtracer.cli \
  --source 192.168.10.100 \
  --dest 10.10.1.50 \
  --inventory my-inventory.yaml \
  --source-context trust \
  -vvv
```

### Phase 4: Error Condition Tests

Test error handling and edge cases.

#### Test No Route Condition

```bash
# Use a destination that doesn't exist in routing tables
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 203.0.113.1 \
  --inventory my-inventory.yaml \
  -vvv
```

Expected output:
- Status: INCOMPLETE
- Error: "No route to 203.0.113.1 on <device>"

#### Test Loop Detection

Create a scenario where routing would loop (requires test devices with static routes).

#### Test Authentication Failure

```bash
# Temporarily set wrong password
export PATHTRACE_PASS="wrong_password"

python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory my-inventory.yaml \
  -vvv
```

Expected output:
- Error: "Authentication failed"

## Debugging Tips

### Enable Maximum Verbosity

```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 -vvv
```

This shows:
- SSH connection details
- Commands executed on devices
- Raw output from devices
- Parsing results
- Route lookup decisions

### Check Inventory Mapping

Verify devices are mapped correctly:
```python
from pathtracer.discovery import DeviceInventory

inv = DeviceInventory('my-inventory.yaml')
inv.load_from_file()

# Check if source IP maps to device
device = inv.find_device_for_subnet('10.10.5.100')
print(f"Device for 10.10.5.100: {device.hostname if device else 'NOT FOUND'}")

# Check all devices
for device in inv.list_all_devices():
    print(f"{device.hostname}: {device.subnets}")
```

### Test Device Connectivity Manually

Before running path tracer, verify you can SSH to devices:

```bash
# For Cisco/Arista/Aruba
ssh admin@10.1.1.1
show ip route 192.168.100.50

# For Palo Alto
ssh admin@10.1.1.10
show routing route destination 192.168.100.50 virtual-router default
```

### Test Parser Independently

Test parsers with sample output:

```python
from pathtracer.parsers.cisco_ios_parser import CiscoIOSParser

output = """
Routing entry for 192.168.100.0/24
  Known via "ospf 1", distance 110, metric 20
  Tag 0, type intra area
  Last update from 10.1.1.5 on GigabitEthernet0/1, 00:05:23 ago
  Routing Descriptor Blocks:
  * 10.1.1.5, from 10.1.1.5, 00:05:23 ago, via GigabitEthernet0/1
      Route metric is 20, traffic share count is 1
"""

route = CiscoIOSParser.parse_route_entry(output, "192.168.100.50", "global")
print(f"Route: {route}")
```

## Output Formats

### Table Output (default)

```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output table
```

Shows:
```
Path Trace: 10.10.5.100 → 192.168.100.50
Status: COMPLETE

Hop  Device         Interface       Next Hop      Protocol  Context  Time
---  -------------  --------------  ------------  --------  -------  ------
1    core-rtr-01    Gi0/1          10.1.1.5      ospf      global   45ms
2    dist-rtr-01    Gi0/2          192.168.100.1 connected global   38ms
```

### JSON Output

```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output json
```

Useful for automation and integration.

## Common Issues

### Issue: "No device found for source IP"

**Cause**: Inventory doesn't have a device with subnet containing source IP.

**Fix**:
1. Check your inventory file
2. Ensure device has correct subnets listed
3. Or use `--start-device` to specify starting device manually

```bash
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --start-device core-rtr-01
```

### Issue: "Connection timeout"

**Cause**: Cannot reach device management IP.

**Fix**:
1. Verify management IP is correct
2. Test connectivity: `ping 10.1.1.1`
3. Check firewall rules
4. Verify SSH is enabled on device

### Issue: "Unsupported vendor: xyz"

**Cause**: Vendor code in inventory doesn't match supported vendors.

**Fix**: Use one of these vendor codes:
- `cisco_ios` or `cisco_iosxe` or `cisco_nxos`
- `arista_eos`
- `paloalto` or `paloalto_panos`
- `aruba` or `aruba_os`

### Issue: Palo Alto "command authorization failed"

**Cause**: User lacks permissions to run routing commands.

**Fix**: Ensure user has these permissions in PAN-OS:
- Device > Setup > Operations
- Network > VirtualRouters

### Issue: Parser returns None

**Cause**: Command output format doesn't match expected pattern.

**Fix**:
1. Run with `-vvv` to see raw output
2. Check if device output format is different
3. May need to adjust parser regex patterns

## Performance Benchmarks

Typical performance per vendor (single hop):

| Vendor        | Connection Time | Command Time | Total   |
|---------------|-----------------|--------------|---------|
| Arista EOS    | 1-2s            | 0.2-0.5s     | ~1.5s   |
| Cisco IOS     | 2-3s            | 0.3-0.8s     | ~2.5s   |
| Aruba AOS-CX  | 1-2s            | 0.3-0.6s     | ~1.8s   |
| Palo Alto     | 2-4s            | 0.5-1.5s     | ~3.5s   |

Multi-hop traces scale linearly (each hop adds ~1-3s).

## Next Steps

After successful testing:

1. **Integration**: Integrate into First Aid Kit (see [INTEGRATION.md](INTEGRATION.md))
2. **Production Use**: Create production inventory files
3. **Automation**: Use JSON output for automation
4. **Monitoring**: Set up regular path traces for critical flows
5. **Enhancement**: Add more vendors (Juniper, Fortinet)
