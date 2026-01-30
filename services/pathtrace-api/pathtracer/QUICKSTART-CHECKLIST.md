# Multi-Vendor Path Tracer - Quick Start Checklist

Use this checklist to get your path tracer up and running.

## Pre-Deployment Checklist

### ☐ Environment Setup

- [ ] Python 3.7+ installed
  ```bash
  python3 --version
  # Should show Python 3.7 or higher
  ```

- [ ] Virtual environment created (recommended)
  ```bash
  python3 -m venv venv
  source venv/bin/activate  # Linux/Mac
  # or
  venv\Scripts\activate  # Windows
  ```

- [ ] Dependencies installed
  ```bash
  cd pathtracer
  pip install -r requirements.txt
  ```

- [ ] Verify Netmiko installation
  ```bash
  python -c "import netmiko; print(netmiko.__version__)"
  # Should print version number without errors
  ```

### ☐ Network Access Verification

- [ ] SSH access to network devices confirmed
  ```bash
  ssh admin@10.1.1.1
  # Should successfully connect to at least one device
  ```

- [ ] Credentials verified
  ```bash
  # Test login manually first
  ssh admin@10.1.1.1
  show ip route
  # Verify command works
  ```

- [ ] Management network reachable
  ```bash
  ping 10.1.1.1
  # Verify connectivity to device management IPs
  ```

- [ ] Firewall rules allow SSH from your host
  - Check with network team if needed
  - Verify ports 22 (SSH) is allowed

### ☐ Credential Setup

Choose one method:

**Option 1: Environment Variables (Recommended for testing)**

- [ ] Set credentials
  ```bash
  export PATHTRACE_USER="admin"
  export PATHTRACE_PASS="your_password"
  export PATHTRACE_SECRET="enable_secret"  # Cisco only
  ```

- [ ] Verify they're set
  ```bash
  echo $PATHTRACE_USER
  # Should print: admin
  ```

**Option 2: Credentials File (Recommended for production)**

- [ ] Create credentials file
  ```bash
  cat > credentials.yaml <<EOF
  credentials:
    default:
      username: admin
      password: your_password
      enable_secret: enable_secret

    firewall_creds:
      username: firewall_admin
      password: different_password
  EOF
  ```

- [ ] Secure the file
  ```bash
  chmod 600 credentials.yaml
  ```

### ☐ Inventory File Creation

- [ ] Copy example inventory
  ```bash
  cp example-inventory-multivendor.yaml my-inventory.yaml
  ```

- [ ] Edit inventory with your devices
  ```bash
  nano my-inventory.yaml
  # or your preferred editor
  ```

- [ ] For each device, fill in:
  - [ ] Hostname
  - [ ] Management IP (must be reachable from your host)
  - [ ] Vendor code (cisco_ios, arista_eos, paloalto, aruba)
  - [ ] Device type (router, l3_switch, firewall)
  - [ ] Subnets (networks this device owns)
  - [ ] Default VRF/context
  - [ ] Logical contexts (VRFs/virtual routers)

**Example device entry:**
```yaml
- hostname: core-rtr-01
  management_ip: 10.1.1.1
  vendor: cisco_ios
  device_type: router
  credentials_ref: default
  subnets:
    - 10.10.0.0/16
    - 172.16.0.0/12
  default_vrf: global
  logical_contexts:
    - global
    - VRF_CORP
```

### ☐ Inventory Validation

- [ ] Check YAML syntax
  ```bash
  python -c "import yaml; yaml.safe_load(open('my-inventory.yaml'))"
  # Should complete without errors
  ```

- [ ] Verify subnet coverage
  - [ ] Source IP subnet is listed in at least one device
  - [ ] Destination IP subnet is listed in at least one device
  - [ ] Or you'll use `--start-device` parameter

---

## First Test Checklist

### ☐ Single Device Test

Start with one device to verify connectivity and parsing.

- [ ] Create test inventory with single device
  ```bash
  cat > test-single.yaml <<EOF
  devices:
    - hostname: test-rtr-01
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
  ```

- [ ] Run basic trace with verbose output
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --inventory test-single.yaml \
    -vvv
  ```

- [ ] Verify output shows:
  - [ ] "Successfully connected to..."
  - [ ] "Executing: show ip route..."
  - [ ] Route entry parsed correctly
  - [ ] Status shown (COMPLETE, INCOMPLETE, etc.)

**If errors occur, see "Troubleshooting" section below.**

### ☐ Two-Hop Test

- [ ] Add second device to inventory
  ```bash
  # Edit test-single.yaml to add second device
  ```

- [ ] Run trace that spans both devices
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --inventory test-single.yaml \
    -vvv
  ```

- [ ] Verify output shows:
  - [ ] Hop 1 from first device
  - [ ] Hop 2 from second device
  - [ ] Correct next hop progression

### ☐ Multi-Vendor Test

- [ ] Create inventory with different vendors
  ```yaml
  devices:
    - hostname: cisco-rtr
      vendor: cisco_ios
      ...

    - hostname: arista-sw
      vendor: arista_eos
      ...
  ```

- [ ] Run trace across vendors
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --inventory my-inventory.yaml \
    -vvv
  ```

- [ ] Verify:
  - [ ] Connects to both vendor types
  - [ ] Parses both output formats
  - [ ] Shows complete path

### ☐ VRF Test (if applicable)

- [ ] Run trace with VRF context
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --source-context VRF_CORP \
    --inventory my-inventory.yaml \
    -vvv
  ```

- [ ] Verify output shows:
  - [ ] "logical_context: VRF_CORP" in hops
  - [ ] Correct VRF at each device

---

## Output Validation Checklist

### ☐ Table Output (Default)

- [ ] Run with table output
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --output table
  ```

- [ ] Verify table shows:
  - [ ] Hop sequence numbers
  - [ ] Device hostnames
  - [ ] Egress interfaces
  - [ ] Next hop IPs
  - [ ] Routing protocols
  - [ ] VRF/context
  - [ ] Lookup times

### ☐ JSON Output

- [ ] Run with JSON output
  ```bash
  python -m pathtracer.cli \
    --source 10.10.5.100 \
    --dest 192.168.100.50 \
    --output json > trace-output.json
  ```

- [ ] Verify JSON structure
  ```bash
  cat trace-output.json | python -m json.tool
  # Should pretty-print valid JSON
  ```

- [ ] Check JSON contains:
  - [ ] `source_ip`
  - [ ] `destination_ip`
  - [ ] `status`
  - [ ] `hops` array
  - [ ] Each hop has: `sequence`, `device`, `route_used`

---

## Troubleshooting Checklist

### ☐ Connection Issues

**Error: "Connection timeout"**

- [ ] Verify device is reachable
  ```bash
  ping 10.1.1.1
  ```

- [ ] Check SSH port is open
  ```bash
  nc -zv 10.1.1.1 22
  # or
  telnet 10.1.1.1 22
  ```

- [ ] Test manual SSH connection
  ```bash
  ssh admin@10.1.1.1
  ```

- [ ] Check firewall rules
  - [ ] Is SSH allowed from your source IP?
  - [ ] Contact network team if needed

**Error: "Authentication failed"**

- [ ] Verify credentials are correct
  ```bash
  ssh admin@10.1.1.1
  # Try to login manually
  ```

- [ ] Check environment variables
  ```bash
  echo $PATHTRACE_USER
  echo $PATHTRACE_PASS
  ```

- [ ] For Cisco, check enable secret
  ```bash
  ssh admin@10.1.1.1
  enable
  # Does it require password?
  ```

- [ ] Verify credentials_ref matches
  ```yaml
  credentials_ref: default  # Must exist in credentials file
  ```

### ☐ Parsing Issues

**Error: Route returns None despite route existing**

- [ ] Run with maximum verbosity
  ```bash
  python -m pathtracer.cli ... -vvv
  ```

- [ ] Check raw command output in logs
  - Does it match expected format?

- [ ] Test manually on device
  ```bash
  ssh admin@10.1.1.1
  show ip route 192.168.100.50
  # Does this return a route?
  ```

- [ ] Verify vendor code is correct
  ```yaml
  vendor: cisco_ios  # Not "cisco" or "ios"
  ```

- [ ] Check for unusual output format
  - Different IOS version?
  - Custom command output?
  - May need parser adjustment

### ☐ Inventory Issues

**Error: "No device found for source IP"**

- [ ] Verify source IP is in device subnets
  ```yaml
  subnets:
    - 10.10.0.0/16  # Must contain source IP
  ```

- [ ] Check subnet format (CIDR notation)
  ```yaml
  subnets:
    - 10.10.0.0/16  # Correct
    # NOT: 10.10.0.0/255.255.0.0
  ```

- [ ] Or use --start-device
  ```bash
  python -m pathtracer.cli \
    --start-device core-rtr-01 \
    ...
  ```

**Error: "Next hop device not found"**

- [ ] Ensure all devices in path are in inventory
  - Check trace output for next hop IP
  - Add missing device to inventory

- [ ] Verify subnet mappings are complete
  - Each device lists its owned subnets
  - Next hop IPs should fall in those subnets

### ☐ Vendor-Specific Issues

**Palo Alto: "command authorization failed"**

- [ ] Check user permissions
  - Device > Setup > Operations
  - Network > VirtualRouters

- [ ] Try command manually
  ```bash
  ssh admin@firewall
  show routing route destination 192.168.100.50 virtual-router default
  ```

- [ ] May need superuser role

**Aruba: Parser returns None**

- [ ] Check if AOS-CX or AOS-Switch
  ```bash
  ssh admin@aruba-switch
  show version
  # Check platform type
  ```

- [ ] Driver should auto-detect, but may need adjustment

**Cisco: Enable mode issues**

- [ ] Ensure enable_secret is set
  ```bash
  export PATHTRACE_SECRET="enable_password"
  ```

- [ ] Or in credentials file:
  ```yaml
  enable_secret: enable_password
  ```

---

## Production Readiness Checklist

### ☐ Security

- [ ] Credentials file secured
  ```bash
  chmod 600 credentials.yaml
  ```

- [ ] Environment variables not in shell history
  ```bash
  # Use space prefix to avoid history (in some shells)
   export PATHTRACE_PASS="password"
  ```

- [ ] Consider using HashiCorp Vault (future enhancement)

- [ ] Inventory file version controlled (without secrets)
  ```bash
  git add my-inventory.yaml
  git add credentials.yaml.example  # Example only!
  # Add credentials.yaml to .gitignore
  ```

### ☐ Documentation

- [ ] Document your inventory
  - Which devices are included
  - Subnet mappings
  - VRF contexts

- [ ] Create runbook for common traces
  ```bash
  # Critical path: Data center to branch
  python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50

  # Customer A VRF path
  python -m pathtracer.cli -s 10.20.5.100 -d 192.168.200.50 --source-context VRF_CUSTOMER_A
  ```

- [ ] Document vendor-specific quirks
  - Palo Alto permission requirements
  - Aruba platform detection
  - etc.

### ☐ Automation

- [ ] Create wrapper scripts
  ```bash
  #!/bin/bash
  # trace-critical-paths.sh
  python -m pathtracer.cli ... --output json > trace-$(date +%s).json
  ```

- [ ] Set up scheduled traces
  ```bash
  # Crontab
  */15 * * * * /path/to/trace-critical-paths.sh
  ```

- [ ] Implement alerting
  ```python
  # Compare current trace with baseline
  # Alert if path changes
  ```

### ☐ Monitoring

- [ ] Monitor trace execution time
  - Baseline: What's normal?
  - Alert if traces take too long

- [ ] Track trace success rate
  - Are traces completing?
  - What's the failure rate?

- [ ] Log trace results
  ```bash
  python -m pathtracer.cli ... --output json >> /var/log/traces.jsonl
  ```

---

## Integration Checklist (Optional)

### ☐ First Aid Kit Integration

If integrating into First Aid Kit web app:

- [ ] Review [INTEGRATION.md](INTEGRATION.md)
- [ ] Add pathtracer to backend requirements
- [ ] Create API endpoint `/api/trace/device-based`
- [ ] Store inventory in database or file
- [ ] Update frontend PathTracer component
- [ ] Add UI toggle between ICMP and device-based

### ☐ NetBox Integration

- [ ] Review NetBox API access
- [ ] Create dynamic inventory loader
- [ ] Sync devices from NetBox
- [ ] Map NetBox fields to inventory format

---

## Ongoing Maintenance Checklist

### ☐ Weekly

- [ ] Review trace logs
  - Any failures?
  - New errors?

- [ ] Check credential expiration
  - Passwords changed?
  - Update credentials file

### ☐ Monthly

- [ ] Update inventory
  - New devices added to network?
  - Devices decommissioned?
  - Subnet changes?

- [ ] Review path baselines
  - Have critical paths changed?
  - Expected or unexpected?

### ☐ Quarterly

- [ ] Update dependencies
  ```bash
  pip install --upgrade netmiko paramiko pyyaml
  ```

- [ ] Review vendor support
  - New device types to add?
  - Parser adjustments needed?

---

## Help Resources

If you get stuck:

1. **Check documentation:**
   - [README.md](README.md) - Main usage guide
   - [TESTING.md](TESTING.md) - Testing guide
   - [VENDOR-REFERENCE.md](VENDOR-REFERENCE.md) - Vendor commands
   - [MIGRATION.md](MIGRATION.md) - ICMP vs device-based

2. **Enable verbose logging:**
   ```bash
   python -m pathtracer.cli ... -vvv
   ```

3. **Test manually:**
   - SSH to device
   - Run commands manually
   - Verify output format

4. **Check inventory:**
   - YAML syntax valid?
   - Subnets correct?
   - Vendor codes match?

5. **Verify connectivity:**
   - Can you ping the device?
   - Can you SSH to it?
   - Are credentials correct?

---

## Success Criteria

You know it's working when:

✅ SSH connections succeed to all devices
✅ Routing table queries return valid routes
✅ Parsers extract next hop correctly
✅ Multi-hop traces complete successfully
✅ Table output is readable and accurate
✅ JSON output is valid and complete
✅ No Python exceptions or errors
✅ Traces complete in reasonable time (10-30s typical)

---

## Next Steps After Success

Once basic path tracing works:

1. **Expand coverage**
   - Add more devices to inventory
   - Cover all critical paths

2. **Automate**
   - Schedule regular traces
   - Compare with baselines
   - Alert on changes

3. **Integrate**
   - Add to monitoring dashboard
   - Integrate with First Aid Kit
   - Connect to NetBox

4. **Enhance**
   - Add more vendors (Juniper, Fortinet)
   - Implement connection pooling
   - Add visualization

5. **Share**
   - Document for your team
   - Create runbooks
   - Train others

---

## Quick Reference Commands

```bash
# Basic trace
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50

# With verbose output
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 -vvv

# With VRF
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --source-context VRF_CORP

# JSON output
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --output json

# Specify start device
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --start-device core-rtr-01

# Custom inventory
python -m pathtracer.cli -s 10.10.5.100 -d 192.168.100.50 --inventory my-inventory.yaml
```

---

**You're ready to start! Begin with the "Pre-Deployment Checklist" and work through each section.**
