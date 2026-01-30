# Multi-Vendor Network Path Tracer - MVP

A Python application that traces the actual forwarding path between two IP addresses by logging into network devices and consulting their routing tables.

## Features (MVP)

- ✅ Cisco IOS/IOS-XE support via SSH
- ✅ VRF-aware routing table queries
- ✅ File-based device inventory
- ✅ Environment variable credentials
- ✅ Loop detection
- ✅ Routing table parsing
- ✅ CLI interface with table output
- ✅ Modular driver architecture

## Quick Start

### 1. Install Dependencies

```bash
cd pathtracer
pip install -r requirements.txt
```

### 2. Create Inventory File

Copy the example and edit with your devices:

```bash
cp example-inventory.yaml inventory.yaml
# Edit inventory.yaml with your network devices
```

### 3. Set Credentials

```bash
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="your_password"
export PATHTRACE_SECRET="your_enable_secret"  # Optional
```

### 4. Run Path Trace

```bash
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory inventory.yaml
```

## Usage Examples

### Basic trace
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50
```

### With specific starting device
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 \
  --start-device core-rtr-01
```

### With VRF context
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 \
  --source-context VRF_CORP
```

### Verbose output for debugging
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 -vvv
```

### JSON output
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output json
```

## Inventory File Format

```yaml
devices:
  - hostname: core-rtr-01
    management_ip: 10.1.1.1
    vendor: cisco_ios
    device_type: router
    credentials_ref: default
    subnets:
      - 10.10.0.0/16      # Subnets this device owns
      - 172.16.0.0/12
    default_vrf: global
    logical_contexts:     # VRFs available on device
      - global
      - VRF_CORP
    metadata:
      location: dc1
      role: core
```

## How It Works

1. **Find Starting Device**: Looks up which device owns the subnet containing the source IP
2. **Query Routing Table**: SSH to device and run `show ip route <destination>`
3. **Parse Next Hop**: Extract next hop IP and outgoing interface
4. **Find Next Device**: Look up which device owns the next hop IP
5. **Repeat**: Continue until destination is reached or error occurs

## Supported Commands

### Cisco IOS/IOS-XE

- `show ip route <destination>` - Query specific route
- `show ip route vrf <vrf> <destination>` - Query route in VRF
- `show vrf` / `show ip vrf` - List VRFs
- `show ip interface brief` - List interfaces

## Architecture

```
pathtracer/
├── models.py           # Data models
├── orchestrator.py     # Main trace logic
├── discovery.py        # Device inventory
├── credentials.py      # Credential management
├── cli.py             # Command-line interface
├── drivers/
│   ├── base.py        # Abstract driver
│   └── cisco_ios.py   # Cisco IOS driver
├── parsers/
│   └── cisco_ios_parser.py
└── utils/
    └── ip_utils.py
```

## Extending with New Vendors

To add support for a new vendor:

1. Create a new driver in `drivers/` that inherits from `NetworkDriver`
2. Implement the abstract methods (connect, get_route, etc.)
3. Create a parser in `parsers/` for that vendor's output
4. Register the driver in `orchestrator.py`'s `_get_driver()` method

Example:

```python
from .base import NetworkDriver

class AristaEOSDriver(NetworkDriver):
    def connect(self):
        # Implement Arista connection logic
        pass

    def get_route(self, destination, context=None):
        # Implement route lookup
        pass

    # ... other methods
```

## Limitations (MVP)

- Only Cisco IOS support currently
- SSH-only (no API support yet)
- Basic VRF handling (no complex transitions)
- No connection pooling
- No jump host support
- No credential vault integration

## Next Steps

1. Add Arista EOS driver
2. Add Juniper Junos driver
3. Add Palo Alto firewall driver
4. Implement connection pooling
5. Add API support (eAPI, NETCONF, REST)
6. Integrate with NetBox for inventory
7. Add visualization output (diagrams)
8. Support credential vault (HashiCorp Vault)

## Troubleshooting

### "No device found for source IP"

Make sure your inventory file has the correct subnets listed for each device.

### "Authentication failed"

Check your credentials:
```bash
echo $PATHTRACE_USER
echo $PATHTRACE_PASS
```

### "Connection timeout"

- Verify device is reachable: `ping 10.1.1.1`
- Check SSH is enabled on device
- Verify management IP is correct

### Enable debug logging

```bash
python -m pathtracer.cli -s <source> -d <dest> -vvv
```

## License

MIT

## Supported Vendors (Expanded)

### Cisco IOS/IOS-XE
- ✅ SSH connectivity
- ✅ VRF support
- ✅ Full routing table parsing
- ✅ Interface-to-VRF mapping

**Commands Used:**
- `show ip route [vrf <vrf>] <destination>`
- `show vrf` / `show ip vrf`
- `show ip interface brief`

### Arista EOS
- ✅ SSH connectivity
- ✅ VRF support
- ✅ Full routing table parsing
- ✅ Interface-to-VRF mapping

**Commands Used:**
- `show ip route [vrf <vrf>] <destination>`
- `show vrf`
- `show ip interface brief`

**Vendor Code:** `arista_eos`

### Palo Alto PAN-OS
- ✅ SSH connectivity
- ✅ Virtual router support
- ✅ Routing table parsing
- ✅ Multi-VSYS support

**Commands Used:**
- `show routing route destination <ip> virtual-router <vr>`
- `show routing virtual-router`
- `show interface all`

**Vendor Code:** `paloalto` or `paloalto_panos`

**Notes:**
- Virtual routers are treated as logical contexts
- Firewall zones are not explicitly handled in MVP
- Use default virtual router if not specified

### Aruba AOS-CX / AOS-Switch
- ✅ SSH connectivity
- ✅ VRF support
- ✅ Full routing table parsing
- ✅ Interface-to-VRF mapping

**Commands Used:**
- `show ip route [vrf <vrf>] <destination>`
- `show vrf`
- `show ip interface brief`

**Vendor Code:** `aruba` or `aruba_os`

## Example Multi-Vendor Inventory

See `example-inventory-multivendor.yaml` for a complete example with:
- Cisco IOS routers
- Arista EOS switches
- Palo Alto firewalls
- Aruba switches
- Cisco NX-OS switches

## Usage Examples by Vendor

### Trace through Cisco network
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 \
  --inventory inventory-cisco.yaml
```

### Trace through mixed vendor network
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 \
  --inventory example-inventory-multivendor.yaml \
  --start-device core-rtr-01
```

### Trace with firewall in path
```bash
python -m pathtracer.cli -s 172.16.5.100 -d 192.168.50.10 \
  --inventory inventory.yaml \
  -vvv  # Verbose to see firewall route lookups
```

### Trace through Arista network with VRF
```bash
python -m pathtracer.cli -s 10.20.1.100 -d 10.30.1.50 \
  --inventory inventory.yaml \
  --start-device dist-sw-01 \
  --source-context PROD
```

## Vendor-Specific Notes

### Cisco IOS/IOS-XE
- Enable secret required for privileged mode
- VRF syntax: `ip vrf forwarding <name>`
- Supports longest prefix match

### Cisco NX-OS
- Uses same driver as IOS (commands are compatible)
- VRF syntax: `vrf member <name>`
- May require different device_type in inventory

### Arista EOS
- Very similar to Cisco IOS output
- VRF syntax: `vrf member <name>`
- Can also use eAPI for better performance (future enhancement)

### Palo Alto PAN-OS
- Virtual routers instead of VRFs
- May need to specify VSYS for multi-tenant firewalls
- Route flags: A=active, S=static, C=connected, O=OSPF, B=BGP
- Next hop "discard" = null route

### Aruba AOS-CX
- Modern CLI similar to Cisco
- VRF syntax: `vrf attach <name>`
- REST API available (future enhancement)

### Aruba AOS-Switch (ProCurve)
- Older platform, simpler CLI
- Limited VRF support on some models
- VLANs often used instead of VRFs

## Troubleshooting by Vendor

### Palo Alto Connection Issues

If you get "command authorization failed":
```bash
# Ensure user has proper role
# Required permissions:
# - Device > Setup > Operations
# - Network > VirtualRouters
```

### Arista SSH Issues

If connection times out:
```bash
# Verify SSH is enabled
show management ssh
# Enable if needed (from config mode)
management ssh
  idle-timeout 30
  authentication mode password
```

### Aruba Certificate Warnings

If you see SSL warnings with Aruba AOS-CX:
```python
# In credentials, you may need to disable strict host key checking
# This is handled automatically by Netmiko
```

## Performance Considerations

**Fastest to Slowest (typical):**
1. Arista EOS - Fast SSH, efficient output
2. Cisco IOS/NX-OS - Standard performance
3. Aruba AOS-CX - Good performance
4. Palo Alto PAN-OS - Slower due to firewall processing
5. Aruba AOS-Switch - Variable based on model

**Tips:**
- Use connection pooling for multiple traces
- Cache routing tables when possible
- Consider API access for Arista (eAPI) and Palo Alto (XML API)

## Adding More Vendors

To add support for Juniper, Fortinet, or other vendors:

1. Create parser in `parsers/<vendor>_parser.py`
2. Create driver in `drivers/<vendor>.py`
3. Register in `orchestrator.py`'s `_get_driver()` method
4. Add vendor code to `models.py` DeviceVendor enum
5. Test with sample device output
6. Update documentation

See existing drivers as templates!
