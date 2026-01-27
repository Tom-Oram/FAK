# Migration Guide: ICMP to Device-Based Path Tracing

This guide helps you transition from ICMP-based traceroute to device-based path tracing.

## Understanding the Difference

### ICMP Traceroute (Old Approach)

**How it works:**
1. Sends ICMP/UDP packets with incrementing TTL
2. Each router decrements TTL and sends back ICMP Time Exceeded
3. Shows IP addresses of routers that responded
4. Relies on ICMP being allowed

**Limitations:**
- ❌ Many networks block or rate-limit ICMP
- ❌ Shows transit path, not actual forwarding path
- ❌ Cannot show VRF/routing context information
- ❌ No visibility into routing protocol or metrics
- ❌ Load balancing can cause inconsistent results
- ❌ Firewalls often block ICMP time-exceeded messages

**Example output:**
```
traceroute to 192.168.100.50
 1  10.1.1.1 (10.1.1.1)  5 ms
 2  * * *                      # Blocked or no response
 3  192.168.100.1 (192.168.100.1)  15 ms
```

### Device-Based Path Tracing (New Approach)

**How it works:**
1. SSH into starting device
2. Query routing table: "show ip route <destination>"
3. Find next hop from routing decision
4. SSH into next hop device
5. Repeat until destination reached

**Advantages:**
- ✅ Shows actual forwarding path (not transit path)
- ✅ Works even when ICMP is blocked
- ✅ Shows routing protocol, metric, preference
- ✅ Handles VRFs and logical routing contexts
- ✅ Shows egress interfaces at each hop
- ✅ Consistent results (no ECMP variation)
- ✅ Can detect blackholes and routing loops
- ✅ Works through firewalls (uses device routing tables)

**Example output:**
```
Hop  Device         Interface  Next Hop      Protocol  VRF     Metric
1    core-rtr-01    Gi0/1     10.1.1.5      ospf      global  20
2    dist-rtr-01    Gi0/2     192.168.100.1 connected global  0
```

---

## When to Use Each Approach

### Use ICMP Traceroute When:

- ✅ You don't have device credentials
- ✅ Testing from end-host perspective
- ✅ Quick diagnostic from your workstation
- ✅ Testing internet paths (can't SSH to ISP routers)
- ✅ Validating that traffic actually flows (live test)

### Use Device-Based Path Tracing When:

- ✅ You manage the network infrastructure
- ✅ ICMP is blocked or unreliable
- ✅ Need to see routing decisions (protocol, metric)
- ✅ Working with VRFs or multi-tenant networks
- ✅ Need consistent, reproducible results
- ✅ Troubleshooting routing issues
- ✅ Documenting forwarding paths
- ✅ Need to see policy routing or PBR

---

## Migration Steps

### Step 1: Gather Device Inventory

You need a list of all network devices in the path.

**From ICMP traceroute:**
```bash
traceroute 192.168.100.50
 1  10.1.1.1
 2  10.1.1.5
 3  192.168.100.1
```

**Create inventory file:**
```yaml
devices:
  - hostname: core-rtr-01
    management_ip: 10.1.1.1
    vendor: cisco_ios
    subnets:
      - 10.10.0.0/16

  - hostname: dist-rtr-01
    management_ip: 10.1.1.5
    vendor: cisco_ios
    subnets:
      - 192.168.0.0/16
```

**Tips:**
- Get device hostnames from network documentation
- Map IP addresses to management IPs (may be different)
- Document which subnets each device owns
- Include vendor information

### Step 2: Set Up Credentials

**Environment variables (recommended for testing):**
```bash
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="your_password"
export PATHTRACE_SECRET="enable_secret"  # Cisco only
```

**Or use credentials file:**
```yaml
# credentials.yaml
credentials:
  default:
    username: admin
    password: your_password
    enable_secret: enable_secret

  firewall_creds:
    username: firewall_admin
    password: different_password
```

### Step 3: Run Initial Test

**Old ICMP approach:**
```bash
traceroute 192.168.100.50
```

**New device-based approach:**
```bash
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --inventory inventory.yaml
```

### Step 4: Compare Results

**ICMP traceroute might show:**
```
 1  10.1.1.1      5 ms
 2  * * *               # Blocked!
 3  192.168.100.1  15 ms
```

**Device-based trace shows:**
```
Hop  Device         Next Hop       Protocol
1    core-rtr-01    10.1.1.5      ospf
2    dist-rtr-01    192.168.100.1 connected
```

Notice: Device-based works even when hop 2 doesn't respond to ICMP.

### Step 5: Handle Differences

#### Difference 1: Load Balancing (ECMP)

**ICMP behavior:**
- Each probe might take different path
- Results can vary between runs
- Shows: "Multiple equal-cost paths detected"

**Device-based behavior:**
- Shows single path (the one in routing table)
- Consistent results every time
- To see all ECMP paths, query full routing table

**Solution:**
```bash
# Device-based shows primary path
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50

# To see all ECMP paths, check full routing table
# (Future enhancement: show all equal-cost paths)
```

#### Difference 2: VRF/Tenant Separation

**ICMP limitation:**
- Cannot specify VRF context
- Shows only default routing table path

**Device-based advantage:**
```bash
# Trace in specific VRF
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --source-context VRF_CORP
```

#### Difference 3: Firewalls in Path

**ICMP behavior:**
- Often blocked by firewall
- Shows: "* * *"
- Cannot see beyond firewall

**Device-based behavior:**
```bash
# SSH to firewall, query its routing table
# Works even when ICMP is blocked
# Shows firewall's routing decision
```

**Inventory for firewall:**
```yaml
devices:
  - hostname: fw-pa-01
    management_ip: 10.1.1.10
    vendor: paloalto
    device_type: firewall
    subnets:
      - 192.168.0.0/16
    logical_contexts:
      - default
      - trust
      - untrust
```

---

## Common Migration Scenarios

### Scenario 1: Simple Single-Path Network

**Old approach:**
```bash
traceroute 192.168.100.50
# Works fine, gets results
```

**Why migrate:**
- Want to see routing protocol information
- Want to document the path reliably
- ICMP occasionally blocked by some devices

**New approach:**
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50
# Shows protocol, metric, interface details
```

### Scenario 2: Network with Firewalls

**Old approach:**
```bash
traceroute 192.168.100.50
 1  10.1.1.1      5 ms
 2  * * *              # Firewall blocks ICMP
 3  * * *
 4  192.168.100.50  timeout
# Cannot see path through firewall
```

**New approach:**
```bash
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50
# Successfully traces through firewall
# Shows firewall's routing decision
```

### Scenario 3: Multi-Tenant / VRF Network

**Old approach:**
```bash
traceroute 192.168.100.50
# Only shows default VRF path
# Cannot trace customer-specific VRF
```

**New approach:**
```bash
# Trace in customer VRF
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --source-context VRF_CUSTOMER_A

# Shows VRF at each hop
```

### Scenario 4: Multi-Vendor Network

**Old approach:**
```bash
traceroute 192.168.100.50
# Works, but no vendor-specific info
```

**New approach:**
```bash
# Works across Cisco, Arista, Palo Alto, Aruba
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50
# Shows path through mixed vendor environment
# Each vendor's routing table queried correctly
```

---

## Integration with First Aid Kit

If you're using First Aid Kit (the web UI):

### Current: ICMP Traceroute

**Backend (api/traceroute.py):**
```python
# Uses scapy to send ICMP probes
# Returns list of hops with IP addresses
```

**Frontend (PathTracer.tsx):**
```typescript
// Displays ICMP trace results
// Shows hop IP, RTT, AS number
```

### Future: Device-Based Path Tracing

See [INTEGRATION.md](INTEGRATION.md) for complete integration guide.

**Quick overview:**
1. Add pathtracer as Python module to backend
2. Create API endpoint: `/api/trace/device-based`
3. Store inventory in database or file
4. Return detailed hop information (protocol, metric, VRF)
5. Update frontend to show enhanced details

**Benefits:**
- Parallel modes: Offer both ICMP and device-based
- User chooses based on scenario
- Device-based for managed infrastructure
- ICMP for internet/external paths

---

## Troubleshooting Migration Issues

### Issue: "No device found for source IP"

**Cause:** Inventory doesn't map source IP to a device.

**ICMP approach didn't need this** because it sent packets from your machine.

**Solution:**
```bash
# Option 1: Fix inventory
# Add device with subnet containing source IP

# Option 2: Specify start device manually
python -m pathtracer.cli \
  --source 10.10.5.100 \
  --dest 192.168.100.50 \
  --start-device core-rtr-01
```

### Issue: Paths Don't Match Between ICMP and Device-Based

**Possible causes:**

1. **ECMP Load Balancing**
   - ICMP packets took different path due to load balancing
   - Device-based shows primary path from routing table
   - Both are correct, just different equal-cost paths

2. **Policy-Based Routing**
   - ICMP packets may trigger PBR rule
   - Device-based shows standard routing table
   - Need to account for PBR in device trace

3. **Asymmetric Routing**
   - ICMP shows forward path
   - Return path may be different
   - Device-based can trace both directions

4. **TTL Exceeded Source**
   - ICMP TTL-exceeded may come from different interface
   - Device-based shows actual egress interface
   - Device-based is more accurate

### Issue: Device-Based Shows "Blackhole" but ICMP Works

**Cause:**
- Device routing table has null route
- But device has additional policy routing or firewall rule allowing traffic

**Solution:**
- Device-based shows routing table only
- May need to check firewall policies separately
- ICMP is testing actual forwarding (more realistic)
- Use both approaches for complete picture

### Issue: Authentication Failures

**This is new requirement for device-based approach.**

**Solutions:**
1. Verify credentials: `ssh admin@10.1.1.1`
2. Check enable password for Cisco devices
3. Verify user permissions for Palo Alto
4. Use credential file for different device types

---

## Best Practices: Using Both Approaches

Don't completely abandon ICMP traceroute! Use both strategically:

### Use ICMP Traceroute For:

1. **Quick checks from end-host perspective**
   ```bash
   traceroute 192.168.100.50
   # Fast, no setup needed
   ```

2. **Validating actual traffic flow**
   ```bash
   # ICMP proves packets actually traverse the path
   # Device-based shows what SHOULD happen
   ```

3. **Internet/external paths**
   ```bash
   traceroute google.com
   # Can't SSH to internet routers
   ```

### Use Device-Based Path Tracing For:

1. **Detailed troubleshooting**
   ```bash
   python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 -vvv
   # See routing protocol, metric, preference
   ```

2. **When ICMP is blocked**
   ```bash
   # Works when ICMP fails
   ```

3. **VRF/multi-tenant scenarios**
   ```bash
   python -m pathtracer.cli ... --source-context VRF_CORP
   ```

4. **Documentation and automation**
   ```bash
   python -m pathtracer.cli ... --output json > path.json
   # Programmatic access to routing decisions
   ```

### Complementary Use Cases

**Problem:** ICMP trace shows "* * *" at hop 3

**Solution:**
```bash
# 1. Run ICMP to see what works
traceroute 192.168.100.50

# 2. Run device-based to see routing decisions
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50

# 3. Compare results
# - ICMP shows where packets go
# - Device-based shows why (routing table)
```

**Problem:** Need to validate routing changes

**Solution:**
```bash
# Before change
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output json > before.json

# Make routing change

# After change
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output json > after.json

# Compare
diff before.json after.json
```

---

## Performance Comparison

| Aspect | ICMP Traceroute | Device-Based |
|--------|----------------|--------------|
| **Speed (5 hops)** | 5-10 seconds | 10-20 seconds |
| **Setup time** | None | Initial inventory setup |
| **Reliability** | 70-90% (ICMP blocking) | 95%+ (requires credentials) |
| **Detail level** | IP, RTT | IP, interface, protocol, metric, VRF |
| **Works through firewalls** | Often no | Yes |
| **Credentials required** | No | Yes |
| **VRF support** | No | Yes |

---

## Conclusion

**Migration checklist:**

- ✅ Create device inventory file
- ✅ Set up credentials
- ✅ Test with simple path first
- ✅ Compare results with ICMP traceroute
- ✅ Document any differences
- ✅ Expand to complex paths (VRFs, firewalls)
- ✅ Integrate into automation/monitoring

**Keep ICMP traceroute for:**
- Quick checks
- End-user perspective
- Internet paths
- Validation of actual traffic flow

**Use device-based path tracing for:**
- Detailed troubleshooting
- VRF environments
- When ICMP is blocked
- Documentation and automation
- Routing protocol visibility

**Best approach:** Use both! They complement each other.
