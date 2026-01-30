# Codebase Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up git hygiene, harden security, fix outdated documentation, and improve code consistency across the FAK codebase.

**Architecture:** Five categories of changes: (1) remove tracked artifacts from git, (2) harden Docker/nginx security, (3) fix a Flask production bug and a TypeScript type issue, (4) consolidate and update documentation, (5) sync `.env.example` with actual configuration options.

**Tech Stack:** Docker, nginx, Flask/Python, React/TypeScript, git

---

### Task 1: Remove tracked venv and __pycache__ from git index

The entire `pathtracer/venv/` directory and `__pycache__/` bytecode files are tracked in git despite `.gitignore` rules. They were committed before the gitignore entries existed.

**Files:**
- Modify: git index (remove tracked files)
- Modify: `.gitignore` (add `.pytest_cache/`)

**Step 1: Add `.pytest_cache/` to `.gitignore`**

In `.gitignore`, after the `*.tsbuildinfo` line, the Python section should read:

```
# Python
__pycache__/
*.pyc
venv/
.venv/
.pytest_cache/
```

**Step 2: Remove tracked artifacts from git index**

```bash
git rm -r --cached pathtracer/venv/
git rm -r --cached pathtracer/__pycache__/
git rm -r --cached pathtracer/drivers/__pycache__/
git rm -r --cached pathtracer/parsers/__pycache__/
git rm -r --cached pathtracer/tests/__pycache__/
git rm -r --cached pathtracer/utils/__pycache__/
git rm -r --cached api/__pycache__/
git rm -r --cached .pytest_cache/ 2>/dev/null || true
```

The `--cached` flag removes files from git tracking without deleting them from disk.

**Step 3: Verify nothing else is tracked that shouldn't be**

```bash
git ls-files | grep -E '(venv/|__pycache__|\.pyc$|\.pytest_cache)'
```

Expected: empty output.

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: remove tracked venv, __pycache__, and .pytest_cache from git index"
```

---

### Task 2: Harden Docker Compose — replace privileged mode with capabilities

The backend container runs with `privileged: true`, granting full host access. It only needs raw socket capabilities.

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Replace privileged with capabilities on backend service**

In `docker-compose.yml`, replace:

```yaml
    privileged: true  # Required for raw socket access (traceroute) and SSH
```

With:

```yaml
    cap_add:
      - NET_RAW
      - NET_ADMIN
    security_opt:
      - no-new-privileges:true
```

**Step 2: Add `security_opt` to frontend and iperf-backend services**

Add to the `frontend` service (after `restart: unless-stopped`):

```yaml
    security_opt:
      - no-new-privileges:true
```

Add to the `iperf-backend` service (after `restart: unless-stopped`):

```yaml
    security_opt:
      - no-new-privileges:true
```

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "security: replace privileged mode with NET_RAW/NET_ADMIN capabilities"
```

---

### Task 3: Harden API Dockerfile — add non-root user

The API container runs as root. With `NET_RAW`/`NET_ADMIN` capabilities granted at container level, the process no longer needs to be root.

**Files:**
- Modify: `api/Dockerfile`

**Step 1: Replace the Dockerfile contents**

The new Dockerfile should be:

```dockerfile
FROM python:3.11-slim

# Install system dependencies for Scapy and SSH
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpcap-dev \
    tcpdump \
    curl \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy API requirements and install Python dependencies
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy pathtracer requirements and install dependencies
COPY pathtracer/requirements.txt ./pathtracer-requirements.txt
RUN pip install --no-cache-dir -r pathtracer-requirements.txt

# Copy application code
COPY api/traceroute.py .

# Copy pathtracer module
COPY pathtracer ./pathtracer

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

# Expose Flask port
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["python", "traceroute.py"]
```

Key changes:
- Added non-root `appuser` (raw socket caps come from docker-compose, not uid 0)
- Added `HEALTHCHECK` using the existing `/health` endpoint
- Removed "Run as root" comment

**Step 2: Commit**

```bash
git add api/Dockerfile
git commit -m "security: add non-root user and healthcheck to API Dockerfile"
```

---

### Task 4: Harden frontend Dockerfile — add healthcheck

The Go backend Dockerfile already uses a non-root user (`appuser`). The frontend Dockerfile needs a healthcheck.

**Files:**
- Modify: `Dockerfile`

**Step 1: Replace the Dockerfile contents**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

Key change: Added `HEALTHCHECK`. Nginx alpine already runs worker processes as `nginx` user by default; the master process must be root to bind port 80, which is standard.

**Step 2: Commit**

```bash
git add Dockerfile
git commit -m "security: add healthcheck to frontend Dockerfile"
```

---

### Task 5: Add security headers to nginx

Add missing security headers to `nginx.conf`.

**Files:**
- Modify: `nginx.conf`

**Step 1: Replace the security headers block**

Replace lines 59-62:

```nginx
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
```

With:

```nginx
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'" always;
```

**Step 2: Commit**

```bash
git add nginx.conf
git commit -m "security: add CSP, Referrer-Policy, and Permissions-Policy headers to nginx"
```

---

### Task 6: Fix Flask debug mode and Python import ordering

`api/traceroute.py` line 481 runs Flask with `debug=True` — this exposes the Werkzeug debugger in production (interactive Python console accessible via browser). This is a significant security vulnerability.

Also fix the import ordering (stdlib → third-party → local).

**Files:**
- Modify: `api/traceroute.py`

**Step 1: Fix import ordering**

Replace lines 1-17:

```python
#!/usr/bin/env python3
"""
Path Tracer API
Provides both ICMP traceroute and device-based path tracing with optional NetBox integration.
Requires: scapy, requests, flask, netmiko, pyyaml
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from scapy.all import sr1, IP, ICMP, conf
import requests
import socket
import time
import os
import sys
from datetime import datetime
from pathlib import Path
```

With:

```python
#!/usr/bin/env python3
"""
Path Tracer API
Provides both ICMP traceroute and device-based path tracing with optional NetBox integration.
Requires: scapy, requests, flask, netmiko, pyyaml
"""

import os
import socket
import sys
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from scapy.all import sr1, IP, ICMP, conf
import requests
```

**Step 2: Fix debug mode**

Replace line 481:

```python
    app.run(host='0.0.0.0', port=5000, debug=True)
```

With:

```python
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
```

This defaults to `debug=False` in production and allows enabling it explicitly via environment variable for local development.

**Step 3: Commit**

```bash
git add api/traceroute.py
git commit -m "security: disable Flask debug mode in production, fix import ordering"
```

---

### Task 7: Fix TypeScript `any` type in PathTracer

`src/components/tools/PathTracer/index.tsx` line 71 uses `any` for the request body.

**Files:**
- Modify: `src/components/tools/PathTracer/types.ts`
- Modify: `src/components/tools/PathTracer/index.tsx`

**Step 1: Add the request body interface to types.ts**

At the end of `src/components/tools/PathTracer/types.ts`, add:

```typescript
export interface TraceRequestBody {
  source: string;
  destination: string;
  netboxUrl?: string;
  netboxToken?: string;
  startDevice?: string;
  sourceContext?: string;
  inventoryFile?: string;
  protocol?: string;
  destinationPort?: number;
}
```

**Step 2: Use the type in index.tsx**

Replace line 71:

```typescript
      const requestBody: any = {
```

With:

```typescript
      const requestBody: TraceRequestBody = {
```

Add the import if not already present — update line 16:

```typescript
import type { ICMPHop, DeviceHop, DeviceCandidate, TraceResult, TraceRequestBody } from './types';
```

**Step 3: Verify the build**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/types.ts src/components/tools/PathTracer/index.tsx
git commit -m "fix: replace any type with TraceRequestBody interface in PathTracer"
```

---

### Task 8: Remove stale setup instructions from PathTracer component

`src/components/tools/PathTracer/index.tsx` lines 869-913 contain an inline "Backend API Setup" card with a hardcoded Scapy code example. This is outdated — the backend already exists and is deployed via Docker. This setup instruction belongs in documentation, not in the running application UI.

**Files:**
- Modify: `src/components/tools/PathTracer/index.tsx`

**Step 1: Remove the setup instructions card**

Delete lines 869-913 (the entire `{/* Setup Instructions */}` block including the `<div className="card bg-slate-50 ...">` and everything inside it, up to and including its closing `</div>`).

**Step 2: Verify the build**

```bash
npx tsc --noEmit
```

**Step 3: Check for unused imports**

After removing the setup block, the `Server` import from lucide-react (line 8) may now be unused. Remove it if so.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/index.tsx
git commit -m "fix: remove stale setup instructions from PathTracer UI"
```

---

### Task 9: Sync .env.example with all configuration options

`.env.example` only documents NetBox and PathTrace credentials. The actual `.env` has Scanopy and Postgres config too. New developers won't know these options exist.

**Files:**
- Modify: `.env.example`

**Step 1: Replace .env.example contents**

```
# ─── Scanopy Configuration ───────────────────────────────────────────
# SCANOPY_SERVER_PORT=60072
# SCANOPY_DAEMON_PORT=60073
# SCANOPY_LOG_LEVEL=info
# SCANOPY_PUBLIC_URL=http://localhost:60072

# ─── PostgreSQL Database ─────────────────────────────────────────────
# POSTGRES_PASSWORD=changeme_secure_password

# ─── NetBox Integration (Optional) ──────────────────────────────────
# NETBOX_URL=https://netbox.example.com
# NETBOX_TOKEN=your_netbox_api_token_here

# ─── Device-Based Path Tracer Credentials (Optional) ────────────────
# PATHTRACE_USER=admin
# PATHTRACE_PASS=your_device_password
# PATHTRACE_SECRET=your_enable_secret

# ─── Scanopy Daemon Configuration (Optional) ────────────────────────
# SCANOPY_NAME=scanopy-daemon
# SCANOPY_HEARTBEAT_INTERVAL=30
# SCANOPY_MODE=Push
# SCANOPY_BIND_ADDRESS=0.0.0.0
# SCANOPY_SERVER_URL=http://127.0.0.1:60072
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: sync .env.example with all available configuration options"
```

---

### Task 10: Delete pathtracer/SUMMARY.md

This 731-line file duplicates 90%+ of `pathtracer/README.md` content. It adds no unique value — it's an implementation summary that was generated during initial development and never pruned.

**Files:**
- Delete: `pathtracer/SUMMARY.md`

**Step 1: Delete the file**

```bash
git rm pathtracer/SUMMARY.md
```

**Step 2: Commit**

```bash
git commit -m "docs: remove duplicate SUMMARY.md (content covered by README.md)"
```

---

### Task 11: Consolidate MIGRATION.md and INTEGRATION.md into path-tracer.md

`pathtracer/MIGRATION.md` (548 lines) and `pathtracer/INTEGRATION.md` (225 lines) describe how PathTracer works within FAK. This content belongs in the user-facing `docs/user-guide/path-tracer.md`, not as standalone module docs. Both files also contain outdated information (references to `/api/pathtrace` endpoint that doesn't exist, "Future: Device-Based" when it's already implemented, "Vendor Support: Currently only Cisco IOS (MVP)" when 5 vendors are supported).

**Files:**
- Delete: `pathtracer/MIGRATION.md`
- Delete: `pathtracer/INTEGRATION.md`
- Rewrite: `docs/user-guide/path-tracer.md`

**Step 1: Delete the old files**

```bash
git rm pathtracer/MIGRATION.md pathtracer/INTEGRATION.md
```

**Step 2: Rewrite docs/user-guide/path-tracer.md**

Replace the entire file with up-to-date content covering both trace modes, the visual diagram, VRF support, device-based features, and integration setup. Key sections:

```markdown
# Path Tracer

Network path discovery with two trace modes and visual hop-by-hop diagram.

## Features

- **Two Trace Modes**: ICMP traceroute and device-based SSH path tracing
- **Visual Path Diagram**: Interactive left-column path view with detailed right-column panels
- **Device-Based Tracing**: Queries actual routing tables via SSH — works through firewalls, VRF-aware
- **Multi-Vendor Support**: Cisco IOS/IOS-XE/NX-OS, Arista EOS, Palo Alto PAN-OS, Aruba AOS-CX, Cisco FTD
- **NetBox Integration**: Device enrichment with site, role, platform, status
- **Firewall Inspection**: Security policy match and NAT translation display
- **Interface Health**: Utilisation bars, error/discard counters, speed and status

## Trace Modes

### ICMP Traceroute
- Fast, works from any source
- Uses ICMP packets with incrementing TTL
- No device credentials needed
- Best for: external paths, quick checks, validating actual traffic flow

### Device-Based Path Tracing
- SSH into network devices to query routing tables
- Shows actual forwarding path, routing protocol, metric, admin distance
- VRF/virtual router aware
- Works when ICMP is blocked
- Shows firewall policy matches and NAT translations
- Best for: internal troubleshooting, VRF environments, detailed analysis

## Requirements

- Backend API running (Docker Compose handles this)
- For device-based: device inventory file and SSH credentials
- For NetBox enrichment: `NETBOX_URL` and `NETBOX_TOKEN` in `.env`

## Usage

1. Navigate to Path Tracer from the sidebar
2. Select trace mode (ICMP or Device-Based)
3. Enter source and destination IP addresses
4. Optionally configure: start device, VRF/context, protocol, destination port
5. Click "Start Trace"
6. For device-based traces: click hops in the path diagram to view detailed panels

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NETBOX_URL` | NetBox instance URL for device enrichment |
| `NETBOX_TOKEN` | NetBox API token |
| `PATHTRACE_USER` | SSH username for device-based tracing |
| `PATHTRACE_PASS` | SSH password |
| `PATHTRACE_SECRET` | Enable secret (Cisco devices) |
| `PATHTRACE_INVENTORY` | Path to inventory YAML file |

### Device Inventory

Create `pathtracer/inventory.yaml` with your network devices:

    devices:
      - hostname: core-rtr-01
        management_ip: 10.1.1.1
        vendor: cisco_ios
        subnets:
          - 10.10.0.0/16
        logical_contexts:
          - global
          - VRF_CORP

See `pathtracer/README.md` for full inventory format documentation.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/traceroute` | POST | ICMP traceroute |
| `/api/traceroute/device-based` | POST | Device-based path trace |
| `/health` | GET | Health check |
```

**Step 3: Commit**

```bash
git add docs/user-guide/path-tracer.md
git commit -m "docs: rewrite path-tracer.md, consolidate MIGRATION.md and INTEGRATION.md"
```

---

### Task 12: Update api/README.md

The current `api/README.md` only describes the ICMP/Scapy approach. The API now has two endpoints and handles device-based tracing.

**Files:**
- Rewrite: `api/README.md`

**Step 1: Replace the file contents**

```markdown
# Path Tracer API

Python Flask backend providing both ICMP traceroute and device-based path tracing with optional NetBox enrichment.

## Requirements

- Python 3.8+
- System packages: `libpcap-dev`, `tcpdump`, `openssh-client`
- For ICMP: `NET_RAW` capability (handled by Docker Compose)
- For device-based: device inventory and SSH credentials

## API Endpoints

### POST /api/traceroute

ICMP traceroute using Scapy.

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
  "mode": "icmp",
  "hops": [
    {
      "ttl": 1,
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "rtt": 1.23,
      "timeout": false,
      "device": {
        "name": "core-router-01",
        "site": "datacenter-1",
        "role": "Core Router"
      }
    }
  ],
  "startTime": "2026-01-30T10:00:00Z",
  "endTime": "2026-01-30T10:00:05Z",
  "hopCount": 10
}
```

### POST /api/traceroute/device-based

Device-based path tracing via SSH to network devices.

**Request:**
```json
{
  "source": "10.10.5.100",
  "destination": "192.168.100.50",
  "startDevice": "core-rtr-01",
  "sourceContext": "VRF_CORP",
  "protocol": "tcp",
  "destinationPort": 443,
  "netboxUrl": "https://netbox.example.com",
  "netboxToken": "your-api-token"
}
```

All fields except `source` and `destination` are optional.

**Response:**
```json
{
  "mode": "device-based",
  "source_ip": "10.10.5.100",
  "destination_ip": "192.168.100.50",
  "status": "complete",
  "hop_count": 3,
  "total_time_ms": 4230,
  "hops": [
    {
      "sequence": 1,
      "device": {
        "hostname": "core-rtr-01",
        "management_ip": "10.1.1.1",
        "vendor": "cisco_ios",
        "device_type": "router",
        "site": "dc-1"
      },
      "ingress_interface": null,
      "egress_interface": "GigabitEthernet0/1",
      "logical_context": "global",
      "lookup_time_ms": 1420,
      "route": {
        "destination": "192.168.100.0/24",
        "next_hop": "10.1.1.5",
        "protocol": "ospf",
        "metric": 20,
        "preference": 110
      },
      "ingress_detail": null,
      "egress_detail": { ... },
      "policy_result": null,
      "nat_result": null
    }
  ]
}
```

### GET /health

Returns `{"status": "ok", "service": "traceroute-api"}`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLASK_ENV` | `production` or `development` |
| `FLASK_DEBUG` | Set to `true` to enable debug mode (default: `false`) |
| `NETBOX_URL` | NetBox instance URL |
| `NETBOX_TOKEN` | NetBox API token |
| `PATHTRACE_USER` | SSH username for device tracing |
| `PATHTRACE_PASS` | SSH password |
| `PATHTRACE_SECRET` | Enable secret (Cisco) |
| `PATHTRACE_INVENTORY` | Path to inventory YAML file |

## Docker Deployment

The API is deployed as the `backend` service in `docker-compose.yml`. It runs with `NET_RAW` and `NET_ADMIN` capabilities for ICMP raw socket access.

## Local Development

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
FLASK_DEBUG=true python traceroute.py
```
```

**Step 2: Commit**

```bash
git add api/README.md
git commit -m "docs: rewrite api/README.md to cover both trace modes and current API"
```

---

### Task 13: Update configuration.md and docker.md

`docs/getting-started/configuration.md` has incorrect port references (`VITE_API_URL` default shows 8080, but docker-compose uses 5000 for backend and 8082 for iperf). `docs/deployment/docker.md` is missing PathTrace credential documentation.

**Files:**
- Modify: `docs/getting-started/configuration.md`
- Modify: `docs/deployment/docker.md`

**Step 1: Update configuration.md**

Replace the entire "Frontend Variables" table:

```markdown
### Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8082` | iPerf backend API URL (dev mode only) |
| `VITE_WS_URL` | `ws://localhost:8082/ws` | iPerf WebSocket endpoint (dev mode only) |

> **Note:** In production (Docker Compose), the frontend is served by nginx which proxies API requests internally. These variables are only used during `npm run dev`.
```

Replace the "Integration Variables" table to include all options:

```markdown
### Integration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NETBOX_URL` | - | NetBox instance URL |
| `NETBOX_TOKEN` | - | NetBox API token |
| `SCANOPY_URL` | - | Scanopy server URL |
| `PATHTRACE_USER` | - | SSH username for device-based path tracing |
| `PATHTRACE_PASS` | - | SSH password for device-based path tracing |
| `PATHTRACE_SECRET` | - | Enable secret for Cisco devices |
| `PATHTRACE_INVENTORY` | `inventory.yaml` | Path to device inventory YAML file |
```

**Step 2: Update docker.md**

Add a new section after "Environment Variables" in docker.md:

```markdown
### Path Tracer Configuration

For device-based path tracing, add credentials to `.env`:
```bash
PATHTRACE_USER=network_admin
PATHTRACE_PASS=your_password
PATHTRACE_SECRET=your_enable_secret
```

Mount the device inventory file (configured in `docker-compose.yml`):
- `./pathtracer/inventory.yaml` → `/app/pathtracer/inventory.yaml` (read-only)
- `./pathtracer/credentials.yaml` → `/app/pathtracer/credentials.yaml` (read-only)
```

**Step 3: Commit**

```bash
git add docs/getting-started/configuration.md docs/deployment/docker.md
git commit -m "docs: fix port references in configuration.md, add pathtrace config to docker.md"
```

---

### Task 14: Mark kubernetes.md as incomplete

The `k8s/` directory has manifests (`deployment.yaml`, `service.yaml`, `ingress.yaml`, `kustomization.yaml`) but they only cover the frontend service — not the backend or iperf services. The kubernetes.md doc doesn't mention this limitation.

**Files:**
- Modify: `docs/deployment/kubernetes.md`

**Step 1: Add a warning at the top**

After the `# Kubernetes Deployment` heading, add:

```markdown
> **Note:** These manifests currently only deploy the frontend (nginx) service. The Python backend and Go iPerf backend are not yet included. For a complete deployment, use Docker Compose instead.
```

**Step 2: Commit**

```bash
git add docs/deployment/kubernetes.md
git commit -m "docs: add incomplete-deployment warning to kubernetes.md"
```

---

### Task 15: Add read-only filesystem to frontend container

The frontend container only serves static files via nginx. It doesn't need write access to its filesystem.

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add read_only and tmpfs to frontend service**

In `docker-compose.yml`, add to the `frontend` service (after `security_opt`):

```yaml
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
      - /tmp
```

These `tmpfs` mounts provide writable directories that nginx needs for PID file and cache, without allowing writes to the container filesystem.

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "security: set frontend container filesystem to read-only"
```

---

## Summary

| Task | Category | Impact |
|------|----------|--------|
| 1 | Git hygiene | Remove ~380KB of tracked venv/pycache |
| 2 | Security | Drop privileged mode → least privilege |
| 3 | Security | Non-root API container + healthcheck |
| 4 | Security | Frontend healthcheck |
| 5 | Security | CSP, Referrer-Policy, Permissions-Policy |
| 6 | Security | Disable Flask debug in production, fix imports |
| 7 | Code quality | Eliminate `any` type |
| 8 | Code quality | Remove stale inline setup instructions |
| 9 | Documentation | Sync .env.example with actual config |
| 10 | Documentation | Remove duplicate SUMMARY.md |
| 11 | Documentation | Consolidate + rewrite path-tracer docs |
| 12 | Documentation | Rewrite api/README.md for current API |
| 13 | Documentation | Fix config port references |
| 14 | Documentation | Mark k8s as incomplete |
| 15 | Security | Read-only frontend filesystem |
