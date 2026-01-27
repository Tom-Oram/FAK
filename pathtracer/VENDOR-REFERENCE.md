# Vendor Command Reference

Quick reference for commands used by each vendor driver.

## Cisco IOS / IOS-XE / NX-OS

**Vendor Code**: `cisco_ios`, `cisco_iosxe`, `cisco_nxos`

### Commands Used

| Purpose | Command | Notes |
|---------|---------|-------|
| Route lookup (global) | `show ip route <destination>` | Shows best route to destination |
| Route lookup (VRF) | `show ip route vrf <vrf> <destination>` | VRF-aware lookup |
| Full routing table | `show ip route` | All routes in global table |
| Full routing table (VRF) | `show ip route vrf <vrf>` | All routes in VRF |
| List VRFs | `show vrf` or `show ip vrf` | IOS-XE vs IOS |
| Interface list | `show ip interface brief` | Interface status |
| Interface VRF | `show run interface <int> \| include vrf` | Which VRF interface is in |

### Output Format Example

```
Routing entry for 192.168.100.0/24
  Known via "ospf 1", distance 110, metric 20
  Tag 0, type intra area
  Last update from 10.1.1.5 on GigabitEthernet0/1, 00:05:23 ago
  Routing Descriptor Blocks:
  * 10.1.1.5, from 10.1.1.5, 00:05:23 ago, via GigabitEthernet0/1
      Route metric is 20, traffic share count is 1
```

### VRF Syntax

```
ip vrf VRF_CORP
!
interface GigabitEthernet0/1
 ip vrf forwarding VRF_CORP
 ip address 10.1.1.1 255.255.255.0
```

### Route Protocols

- `C` = Connected
- `S` = Static
- `O` = OSPF
- `B` = BGP
- `D` = EIGRP
- `R` = RIP
- `i` = IS-IS

---

## Arista EOS

**Vendor Code**: `arista_eos`

### Commands Used

| Purpose | Command | Notes |
|---------|---------|-------|
| Route lookup (default) | `show ip route <destination>` | Very similar to Cisco |
| Route lookup (VRF) | `show ip route vrf <vrf> <destination>` | Same syntax as Cisco |
| Full routing table | `show ip route` | All routes |
| Full routing table (VRF) | `show ip route vrf <vrf>` | VRF routes |
| List VRFs | `show vrf` | List all VRFs |
| Interface list | `show ip interface brief` | Interface status |

### Output Format Example

```
VRF: default
Codes: C - connected, S - static, K - kernel,
       O - OSPF, IA - OSPF inter area, E1 - OSPF external type 1,
       E2 - OSPF external type 2, N1 - OSPF NSSA external type 1,
       N2 - OSPF NSSA external type2, B - BGP, B I - iBGP, B E - eBGP,
       R - RIP, I L1 - IS-IS level 1, I L2 - IS-IS level 2,
       O3 - OSPFv3, A B - BGP Aggregate, A O - OSPF Summary,
       NG - Nexthop Group Static Route, V - VXLAN Control Service,
       DH - DHCP client installed default route, M - Martian,
       DP - Dynamic Policy Route, L - VRF Leaked,
       G  - gRIBI, RC - Route Cache Route

 O      192.168.100.0/24 [110/20] via 10.1.1.5, GigabitEthernet1
```

### VRF Syntax

```
vrf instance VRF_CORP
!
interface Ethernet1
   vrf VRF_CORP
   ip address 10.1.1.1/24
```

### Performance Notes

- Arista EOS is typically faster than Cisco IOS
- Consider using eAPI instead of SSH for better performance (future enhancement)
- `show ip route <destination>` is very efficient

---

## Palo Alto PAN-OS

**Vendor Code**: `paloalto`, `paloalto_panos`

### Commands Used

| Purpose | Command | Notes |
|---------|---------|-------|
| Route lookup | `show routing route destination <ip> virtual-router <vr>` | Tabular output |
| Route lookup (default VR) | `show routing route destination <ip> virtual-router default` | Uses default VR |
| Full routing table | `show routing route virtual-router <vr>` | All routes in VR |
| List virtual routers | `show routing virtual-router` | List all VRs |
| Interface list | `show interface all` | All interfaces |

### Output Format Example

```
virtual-router: default
destination        nexthop         metric  flags  age        interface
192.168.100.0/24   10.1.1.5        20      A S    00h:05m:23 ethernet1/1
```

### Flags

- `A` = Active (best route)
- `S` = Static
- `C` = Connected
- `O` = OSPF
- `B` = BGP
- `R` = RIP
- `?` = Unresolved

### Virtual Router Syntax

PAN-OS uses "virtual routers" instead of VRFs:

```
# Virtual router named "trust"
set network virtual-router trust interface [ ethernet1/1 ethernet1/2 ]
set network virtual-router trust routing-table ip static-route default destination 0.0.0.0/0 nexthop ip-address 10.1.1.254
```

### Important Notes

- **Permission Required**: User must have permissions to run routing commands
  - Device > Setup > Operations
  - Network > VirtualRouters
- **Next hop "discard"**: Means null route (blackhole)
- **Multi-VSYS**: In multi-tenant firewalls, may need to specify VSYS
- **Slower Performance**: Firewall processing makes commands slower than routers/switches

### Troubleshooting

If you get "command authorization failed":
1. Check user role has proper permissions
2. Try from web UI first to verify command works
3. May need "superuser" role for full access

---

## Aruba AOS-CX / AOS-Switch

**Vendor Code**: `aruba`, `aruba_os`

### Commands Used

| Purpose | Command | Notes |
|---------|---------|-------|
| Route lookup (default) | `show ip route <destination>` | Similar to Cisco |
| Route lookup (VRF) | `show ip route vrf <vrf> <destination>` | VRF-aware |
| Full routing table | `show ip route` | All routes |
| Full routing table (VRF) | `show ip route vrf <vrf>` | VRF routes |
| List VRFs | `show vrf` | All VRFs |
| Interface list | `show ip interface brief` | Interface status |

### Output Format Example

**AOS-CX:**
```
Displaying ipv4 routes selected for forwarding

'[x/y]' denotes [distance/metric]

192.168.100.0/24, vrf default, tag 0
    via 10.1.1.5, [110/20], ospf
```

**AOS-Switch (ProCurve):**
```
IP Route Entries

  Destination        Gateway         VLAN Type      Sub-Type   Metric
  ------------------ --------------- ---- --------- ---------- ------
  192.168.100.0/24   10.1.1.5        100  ospf                 20
```

### VRF Syntax

**AOS-CX:**
```
vrf VRF_CORP
!
interface 1/1/1
    vrf attach VRF_CORP
    ip address 10.1.1.1/24
```

**AOS-Switch:**
Limited VRF support; often uses VLANs instead.

### Platform Differences

| Feature | AOS-CX (Modern) | AOS-Switch (Legacy) |
|---------|-----------------|---------------------|
| VRF Support | Full | Limited |
| CLI Style | Cisco-like | HP ProCurve style |
| REST API | Yes | Limited |
| Management | Modern | Legacy |

### Auto-Detection

The driver attempts to auto-detect between AOS-CX and AOS-Switch:
- Tries AOS-CX commands first
- Falls back to AOS-Switch format if needed
- Uses different parsing for each

---

## Command Comparison Table

| Purpose | Cisco/Arista | Palo Alto | Aruba |
|---------|--------------|-----------|-------|
| **Route lookup** | `show ip route <ip>` | `show routing route destination <ip> virtual-router <vr>` | `show ip route <ip>` |
| **VRF/VR route** | `show ip route vrf <vrf> <ip>` | `show routing route destination <ip> virtual-router <vr>` | `show ip route vrf <vrf> <ip>` |
| **List contexts** | `show vrf` | `show routing virtual-router` | `show vrf` |
| **Interfaces** | `show ip interface brief` | `show interface all` | `show ip interface brief` |

---

## Protocol Codes by Vendor

### Cisco/Arista Common Codes

```
C - connected         S - static            R - RIP
O - OSPF              B - BGP               D - EIGRP
i - IS-IS             L - local
* - candidate default
```

### Palo Alto Flags

```
A - Active            S - Static            C - Connected
O - OSPF              B - BGP               R - RIP
? - Unresolved
```

### Aruba Codes

```
C - connected         S - static            R - RIP
O - OSPF              B - BGP               D - default
L - local
```

---

## Authentication Requirements

### Cisco IOS/IOS-XE

- **SSH enabled**: `ip ssh version 2`
- **Enable secret**: May need enable password for privileged mode
- **AAA**: If using AAA, ensure user has privilege 15 or can enable

### Arista EOS

- **SSH enabled**: Usually enabled by default
- **Authentication**: Can use local or RADIUS/TACACS+
- **Privilege**: User needs exec mode access

### Palo Alto PAN-OS

- **SSH enabled**: Management interface must allow SSH
- **User role**: Needs permissions for routing commands
- **Minimum role**: "Device > Setup > Operations" + "Network > VirtualRouters"

### Aruba AOS-CX

- **SSH enabled**: Usually enabled by default
- **User privilege**: Needs read access to routing table
- **REST API**: Available but not used by MVP

---

## Performance Optimization Tips

### Use Connection Pooling (Future)

Current MVP creates new SSH connection for each device. Future enhancement:
```python
# Maintain connection pool
# Reuse connections for multiple queries
# Significant performance improvement for multiple traces
```

### Cache Routing Tables (Future)

For multiple traces through same network:
```python
# Cache full routing tables
# Only refresh periodically
# Reduces query time from seconds to milliseconds
```

### Use APIs Where Available

| Vendor | API | Performance Gain |
|--------|-----|------------------|
| Arista | eAPI (JSON-RPC) | 2-3x faster |
| Palo Alto | XML API | 2-3x faster |
| Aruba AOS-CX | REST API | 2-3x faster |
| Cisco IOS-XE | RESTCONF/NETCONF | 2-3x faster |

---

## Inventory File Examples

### Single Cisco Device

```yaml
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
      - VRF_CORP
```

### Single Palo Alto Firewall

```yaml
devices:
  - hostname: fw-pa-01
    management_ip: 10.1.1.10
    vendor: paloalto
    device_type: firewall
    credentials_ref: default
    subnets:
      - 192.168.0.0/16
    default_context: default
    logical_contexts:
      - default
      - trust
      - untrust
```

### Mixed Vendor Network

See [example-inventory-multivendor.yaml](example-inventory-multivendor.yaml) for complete example.

---

## Adding New Vendors

To add Juniper, Fortinet, or other vendors:

### 1. Create Parser

```python
# pathtracer/parsers/juniper_parser.py
class JuniperParser:
    @staticmethod
    def parse_route_entry(output: str, destination: str, context: str):
        # Parse "show route <destination>"
        # Juniper format is very different from Cisco
        pass
```

### 2. Create Driver

```python
# pathtracer/drivers/juniper.py
from .base import NetworkDriver

class JuniperDriver(NetworkDriver):
    def get_route(self, destination: str, context: str = None):
        # Use routing-instance instead of VRF
        if context:
            command = f"show route {destination} routing-instance {context}"
        else:
            command = f"show route {destination}"
        # Execute and parse
```

### 3. Register in Orchestrator

```python
# pathtracer/orchestrator.py
vendor_drivers = {
    'juniper': JuniperDriver,
    'juniper_junos': JuniperDriver,
    # ... existing vendors
}
```

### 4. Update Exports

```python
# pathtracer/drivers/__init__.py
from .juniper import JuniperDriver
__all__ = [..., 'JuniperDriver']

# pathtracer/parsers/__init__.py
from .juniper_parser import JuniperParser
__all__ = [..., 'JuniperParser']
```

### 5. Test

Create test inventory and run traces.

### 6. Document

Update README.md with Juniper-specific information.

---

## References

- [Cisco IOS Command Reference](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/iproute_pi/command/iri-cr-book.html)
- [Arista EOS Command Reference](https://www.arista.com/en/um-eos/eos-command-line-interface-commands)
- [Palo Alto PAN-OS CLI Reference](https://docs.paloaltonetworks.com/pan-os/10-1/pan-os-cli-quick-start)
- [Aruba AOS-CX CLI Reference](https://www.arubanetworks.com/techdocs/AOS-CX/10.08/HTML/5200-8729/)
- [Netmiko Documentation](https://github.com/ktbyers/netmiko)
