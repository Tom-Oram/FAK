# First Aid Kit - Quick Start Guide

## The Easiest Way: Docker 🐳

### 1. Create Inventory (One-Time Setup)

```bash
cd ~/src/github.com/Tom-Oram/fak
cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml
nano pathtracer/inventory.yaml
```

Add your devices:
```yaml
devices:
  - hostname: my-router
    management_ip: 10.1.1.1
    vendor: cisco_ios
    subnets:
      - 10.10.0.0/16
```

### 2. Set Credentials

```bash
cp .env.example .env
nano .env
```

Add:
```
PATHTRACE_USER=admin
PATHTRACE_PASS=your_password
PATHTRACE_SECRET=enable_secret
```

### 3. Build & Run

```bash
docker-compose build
docker-compose up -d
```

### 4. Access

Open browser: **http://localhost:8081**

---

## Using Path Tracer

### ICMP Mode (Traditional Traceroute)
1. Select "ICMP Traceroute" (default)
2. Enter source IP: `192.168.1.100`
3. Enter destination IP: `8.8.8.8`
4. Click "Start Trace"

**Fast, works anywhere, may be blocked by firewalls**

### Device-Based Mode (Routing Table Queries)
1. Select "Device-Based"
2. Enter source IP: `10.10.5.100`
3. Enter destination IP: `192.168.100.50`
4. **Optional:** Click "Show Advanced Settings"
   - Start Device: `core-rtr-01` (to override auto-discovery)
   - Source VRF: `VRF_CORP` (if using VRFs)
5. Click "Start Trace"

**Shows routing decisions, VRF-aware, works through firewalls**

---

## Troubleshooting

### "Cannot find inventory.yaml"
```bash
# Check file exists
ls pathtracer/inventory.yaml

# Create if missing
cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml
docker-compose restart backend
```

### "Authentication failed"
```bash
# Verify credentials in .env
cat .env | grep PATHTRACE

# Restart backend
docker-compose restart backend
```

### "No device found for source IP"
- Add device with source IP's subnet to inventory
- OR specify start device manually

### View Logs
```bash
docker-compose logs -f backend
```

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after changes
docker-compose build

# View logs
docker-compose logs -f backend

# Restart backend
docker-compose restart backend

# Check if running
docker-compose ps

# Health check
curl http://localhost:5000/health
```

---

## File Locations

```
~/src/github.com/Tom-Oram/fak/
├── pathtracer/
│   ├── inventory.yaml          ← Your devices (EDIT THIS)
│   ├── credentials.yaml        ← Optional: device credentials
│   └── example-inventory-multivendor.yaml
├── .env                        ← Credentials (EDIT THIS)
├── .env.example
├── docker-compose.yml
└── api/
    └── traceroute.py          ← Backend API
```

---

## Supported Vendors

- ✅ Cisco IOS/IOS-XE/NX-OS
- ✅ Arista EOS
- ✅ Palo Alto PAN-OS
- ✅ Aruba AOS-CX/AOS-Switch

---

## Next Steps

1. ✅ Set up inventory file
2. ✅ Set credentials
3. ✅ Start Docker containers
4. ✅ Test ICMP mode
5. ✅ Test device-based mode
6. 📖 Read [INTEGRATION-COMPLETE.md](INTEGRATION-COMPLETE.md) for details
7. 📖 Read [DOCKER-SETUP.md](DOCKER-SETUP.md) for advanced config

---

## Need Help?

- **Integration Guide**: [INTEGRATION-COMPLETE.md](INTEGRATION-COMPLETE.md)
- **Docker Details**: [DOCKER-SETUP.md](DOCKER-SETUP.md)
- **Path Tracer Docs**: [pathtracer/README.md](pathtracer/README.md)
- **Testing Guide**: [pathtracer/TESTING.md](pathtracer/TESTING.md)
- **Vendor Reference**: [pathtracer/VENDOR-REFERENCE.md](pathtracer/VENDOR-REFERENCE.md)
