# First Aid Kit - Docker Setup with Device-Based Path Tracer

## Quick Start (Docker - Recommended)

This is the easiest way to run First Aid Kit with full device-based path tracing support.

### Prerequisites

- Docker and Docker Compose installed
- Network devices accessible from Docker host
- Device credentials

### Step 1: Create Inventory File

```bash
cd ~/src/github.com/Tom-Oram/fak

# Copy example inventory
cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml

# Edit with your network devices
nano pathtracer/inventory.yaml
```

Example inventory entry:
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
```

### Step 2: Create Credentials File (Optional)

If not using environment variables:

```bash
# Create credentials file
cat > pathtracer/credentials.yaml <<EOF
credentials:
  default:
    username: admin
    password: your_password
    enable_secret: your_enable_secret
EOF

# Secure the file
chmod 600 pathtracer/credentials.yaml
```

**OR** use environment variables (recommended):

```bash
# Copy .env example
cp .env.example .env

# Edit .env file
nano .env
```

Add:
```env
PATHTRACE_USER=admin
PATHTRACE_PASS=your_device_password
PATHTRACE_SECRET=your_enable_secret
```

### Step 3: Build and Run

```bash
# Build containers (includes pathtracer dependencies)
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### Step 4: Access First Aid Kit

Open browser to: **http://localhost:8081**

### Step 5: Use Path Tracer

1. Navigate to "Path Tracer" tool
2. Select "Device-Based" mode
3. Enter source and destination IPs
4. Click "Start Trace"

---

## Environment Variables

The backend container uses these environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PATHTRACE_USER` | For device-based mode | SSH username | `admin` |
| `PATHTRACE_PASS` | For device-based mode | SSH password | `password123` |
| `PATHTRACE_SECRET` | For Cisco only | Enable secret | `enable123` |
| `NETBOX_URL` | Optional | NetBox instance URL | `https://netbox.example.com` |
| `NETBOX_TOKEN` | Optional | NetBox API token | `token123` |

Set in `.env` file or export before running:

```bash
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="password"
export PATHTRACE_SECRET="enable_secret"
```

---

## Volume Mounts

The backend container mounts these files from your host:

```yaml
volumes:
  - ./pathtracer/inventory.yaml:/app/pathtracer/inventory.yaml:ro
  - ./pathtracer/credentials.yaml:/app/pathtracer/credentials.yaml:ro
```

**Benefits:**
- Edit inventory without rebuilding container
- Update credentials without rebuilding
- Keep sensitive data on host

**Note:** Both files are mounted read-only (`:ro`) for security.

---

## Docker Architecture

```
┌─────────────────────────────────────┐
│  First Aid Kit Frontend             │
│  (React App)                        │
│  Port: 8081                         │
└──────────────┬──────────────────────┘
               │
               │ HTTP API calls
               ↓
┌─────────────────────────────────────┐
│  First Aid Kit Backend              │
│  (Flask API)                        │
│  Port: 5000                         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ICMP Traceroute (Scapy)       │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Device-Based Path Tracer      │ │
│  │ - SSH to devices (Netmiko)    │ │
│  │ - Query routing tables        │ │
│  │ - Multi-vendor support        │ │
│  └───────────────────────────────┘ │
│                                     │
│  Mounted volumes:                  │
│  - inventory.yaml (device list)   │
│  - credentials.yaml (SSH creds)   │
└──────────────┬──────────────────────┘
               │
               │ SSH (port 22)
               ↓
┌─────────────────────────────────────┐
│  Your Network Devices               │
│  - Cisco routers/switches           │
│  - Arista switches                  │
│  - Palo Alto firewalls              │
│  - Aruba switches                   │
└─────────────────────────────────────┘
```

---

## Troubleshooting Docker Setup

### Error: "Cannot find inventory.yaml"

**Cause:** File doesn't exist or mount failed

**Fix:**
```bash
# Check file exists
ls -l pathtracer/inventory.yaml

# If not, create it
cp pathtracer/example-inventory-multivendor.yaml pathtracer/inventory.yaml

# Restart backend
docker-compose restart backend
```

### Error: "Device-based path tracer not available"

**Cause:** Pathtracer module not copied into container

**Fix:**
```bash
# Rebuild backend with pathtracer included
docker-compose build backend
docker-compose up -d backend
```

### Error: "Authentication failed"

**Cause:** Wrong credentials or not set

**Fix:**
```bash
# Check environment variables are set
docker-compose exec backend env | grep PATHTRACE

# If missing, add to .env and restart
docker-compose down
docker-compose up -d
```

### Error: "Connection refused" to network device

**Cause:** Container can't reach device management IP

**Fix:**
```bash
# Test from container
docker-compose exec backend ping 10.1.1.1

# If fails, check network routing
# Container needs access to management network
```

### Container Can't SSH to Devices

**Options:**

1. **Use host network mode** (less secure):
```yaml
# docker-compose.yml
backend:
  network_mode: host
```

2. **Add route in container**:
```bash
# Add route to management network
docker-compose exec backend ip route add 10.1.1.0/24 via <gateway>
```

3. **Use Docker macvlan** (advanced):
```yaml
networks:
  mgmt-network:
    driver: macvlan
    driver_opts:
      parent: eth0
```

---

## Security Considerations

### Credentials in Environment Variables

**Risk:** Environment variables visible in `docker inspect`

**Mitigations:**
1. Use Docker secrets (swarm mode)
2. Use credentials file with restricted permissions
3. Use external secrets manager (Vault)

### Privileged Mode

The backend runs in privileged mode for:
- Raw socket access (ICMP traceroute)
- Some SSH operations

**Mitigations:**
1. Run backend on isolated network
2. Use firewall rules to restrict access
3. Consider splitting ICMP and device-based into separate containers

### SSH Access from Container

Container can SSH to your network devices.

**Mitigations:**
1. Use read-only credentials when possible
2. Restrict source IPs on devices
3. Use jump host/bastion pattern
4. Audit SSH access logs

---

## Advanced Configuration

### Using Jump Host/Bastion

If devices require bastion host:

```yaml
# docker-compose.yml
backend:
  environment:
    SSH_PROXY_COMMAND: "ssh -W %h:%p bastion.example.com"
```

### Connection Pooling (Future)

For better performance with repeated traces:

```yaml
backend:
  environment:
    PATHTRACE_POOL_SIZE: 10
    PATHTRACE_POOL_TIMEOUT: 300
```

### Custom Inventory Path

Override default inventory location:

```yaml
backend:
  environment:
    PATHTRACE_INVENTORY: /custom/path/inventory.yaml
  volumes:
    - /host/path/inventory.yaml:/custom/path/inventory.yaml:ro
```

---

## Performance Tuning

### SSH Connection Timeout

```yaml
backend:
  environment:
    PATHTRACE_SSH_TIMEOUT: 30
    PATHTRACE_COMMAND_TIMEOUT: 60
```

### Parallel Queries (Future)

```yaml
backend:
  environment:
    PATHTRACE_PARALLEL_QUERIES: "true"
    PATHTRACE_MAX_WORKERS: 5
```

---

## Updating

### Update Inventory Without Restart

Since inventory is mounted as a volume:

```bash
# Edit inventory
nano pathtracer/inventory.yaml

# Changes take effect immediately (file is read on each trace)
# No restart needed
```

### Update Credentials

```bash
# Edit credentials
nano pathtracer/credentials.yaml

# OR update .env
nano .env

# Restart backend to reload environment
docker-compose restart backend
```

### Update Code

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose build

# Restart
docker-compose down
docker-compose up -d
```

---

## Monitoring

### View Backend Logs

```bash
# Follow logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Grep for errors
docker-compose logs backend | grep ERROR
```

### Check Backend Health

```bash
# Health endpoint
curl http://localhost:5000/health

# Expected response
{"status":"ok","service":"traceroute-api"}
```

### Monitor Traces

```bash
# Watch for trace activity
docker-compose logs -f backend | grep "trace"
```

---

## Backup and Restore

### Backup Configuration

```bash
# Create backup directory
mkdir -p ~/fak-backup

# Backup inventory and credentials
cp pathtracer/inventory.yaml ~/fak-backup/
cp pathtracer/credentials.yaml ~/fak-backup/
cp .env ~/fak-backup/
```

### Restore Configuration

```bash
# Restore files
cp ~/fak-backup/inventory.yaml pathtracer/
cp ~/fak-backup/credentials.yaml pathtracer/
cp ~/fak-backup/.env .

# Restart
docker-compose restart backend
```

---

## Alternative: Local Development (No Docker)

If you prefer to run locally without Docker:

### Option 1: Virtual Environment

```bash
cd ~/src/github.com/Tom-Oram/fak

# Create venv for backend
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install pathtracer
cd ../pathtracer
pip install -r requirements.txt

# Run backend
cd ../api
export PATHTRACE_USER="admin"
export PATHTRACE_PASS="password"
python traceroute.py
```

### Option 2: System-Wide (Not Recommended)

```bash
cd ~/src/github.com/Tom-Oram/fak/pathtracer

# Override warning (not recommended)
pip install -r requirements.txt --break-system-packages

# Better: use pipx
sudo apt install pipx
pipx install netmiko paramiko pyyaml
```

---

## Summary

**Recommended Setup:**
1. Use Docker (easier, isolated)
2. Store credentials in `.env` file
3. Mount inventory as volume for easy updates
4. Use read-only mounts for security

**Benefits of Docker Approach:**
- ✅ No Python virtual environment needed
- ✅ All dependencies installed automatically
- ✅ Isolated from host system
- ✅ Easy to deploy and update
- ✅ Consistent across environments

**Next Steps:**
1. Create inventory file
2. Set credentials in `.env`
3. `docker-compose build && docker-compose up -d`
4. Test with ICMP mode first
5. Try device-based mode
