# Architecture Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure backend directories so PathTracer and iPerf are peer services under `services/`, with self-documenting names and symmetric nginx routing.

**Architecture:** Move `api/` + `pathtracer/` into `services/pathtrace-api/`, move `backend/` into `services/iperf-api/`. Update all references: docker-compose, nginx, frontend fetch URLs, .gitignore, docs. Remove the `sys.path` hack in traceroute.py.

**Tech Stack:** Docker Compose, nginx, React/TypeScript, Python Flask, Go

---

### Task 1: Move api/ and pathtracer/ into services/pathtrace-api/

**Files:**
- Move: `api/*` → `services/pathtrace-api/`
- Move: `pathtracer/*` → `services/pathtrace-api/pathtracer/`
- Delete: `api/` (empty after move)
- Delete: `pathtracer/` (empty after move, except `venv/` which stays gitignored)

**Step 1: Create directory and move files**

```bash
mkdir -p services/pathtrace-api
# Move api contents into new location
git mv api/Dockerfile services/pathtrace-api/Dockerfile
git mv api/README.md services/pathtrace-api/README.md
git mv api/traceroute.py services/pathtrace-api/traceroute.py
git mv api/requirements.txt services/pathtrace-api/requirements.txt
git mv api/__init__.py services/pathtrace-api/__init__.py
# Move pathtracer module into the service directory
git mv pathtracer services/pathtrace-api/pathtracer
# Remove empty api/ directory (git mv should handle this)
rmdir api 2>/dev/null || true
```

**Step 2: Merge requirements.txt**

Replace `services/pathtrace-api/requirements.txt` with the merged contents of both files:

```
flask==3.0.0
flask-cors==4.0.0
scapy==2.5.0
requests==2.31.0
netmiko>=4.0.0
paramiko>=3.0.0
pyyaml>=6.0
```

Delete the old pathtracer requirements (now inside the moved directory — it will be `services/pathtrace-api/pathtracer/requirements.txt`). Remove it since the merged one at `services/pathtrace-api/requirements.txt` replaces it.

```bash
git rm services/pathtrace-api/pathtracer/requirements.txt
```

**Step 3: Verify directory structure**

```bash
ls -la services/pathtrace-api/
# Expected: Dockerfile, README.md, __init__.py, pathtracer/, requirements.txt, traceroute.py
ls -la services/pathtrace-api/pathtracer/
# Expected: __init__.py, cli.py, credentials.py, discovery.py, drivers/, models.py,
#           orchestrator.py, output/, parsers/, tests/, utils/, README.md, etc.
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move api/ and pathtracer/ into services/pathtrace-api/"
```

---

### Task 2: Move backend/ into services/iperf-api/

**Files:**
- Move: `backend/*` → `services/iperf-api/`
- Delete: `backend/` (empty after move)

**Step 1: Move files**

```bash
git mv backend services/iperf-api
```

**Step 2: Verify directory structure**

```bash
ls -la services/iperf-api/
# Expected: Dockerfile, cmd/, go.mod, go.sum, internal/
ls services/
# Expected: iperf-api/  pathtrace-api/
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move backend/ into services/iperf-api/"
```

---

### Task 3: Remove sys.path hack and simplify Dockerfile

**Files:**
- Modify: `services/pathtrace-api/traceroute.py` (lines 10, 13, 26-29)
- Modify: `services/pathtrace-api/Dockerfile`

**Step 1: Update traceroute.py**

Remove the `sys` import (line 10) and the `Path` import (line 13, used only by the hack), and remove the sys.path hack block (lines 26-29).

The file currently has:

```python
import sys
```
at line 10 — remove it.

```python
from pathlib import Path
```
at line 13 — remove it.

```python
# Add pathtracer module to Python path
pathtracer_path = Path(__file__).parent.parent / 'pathtracer'
if str(pathtracer_path) not in sys.path:
    sys.path.insert(0, str(pathtracer_path))
```
at lines 26-29 — remove all 4 lines (including the comment).

The imports at lines 32-40 remain unchanged — they already use `from pathtracer.orchestrator import PathTracer` etc., which will now resolve natively since `pathtracer/` is a sibling directory.

**Step 2: Update inventory fallback path in traceroute.py**

Line 283 currently reads:
```python
            inventory_file = os.path.join(os.path.dirname(__file__), '..', 'pathtracer', 'inventory.yaml')
```

Change to (pathtracer is now a sibling, not parent's sibling):
```python
            inventory_file = os.path.join(os.path.dirname(__file__), 'pathtracer', 'inventory.yaml')
```

Line 305 currently reads:
```python
            creds_file = os.path.join(os.path.dirname(__file__), '..', 'pathtracer', 'credentials.yaml')
```

Change to:
```python
            creds_file = os.path.join(os.path.dirname(__file__), 'pathtracer', 'credentials.yaml')
```

**Step 3: Rewrite Dockerfile**

The Dockerfile currently uses build context `.` (repo root) and copies from `api/` and `pathtracer/` separately. Now the build context will be `services/pathtrace-api/` and everything is local.

Replace the entire `services/pathtrace-api/Dockerfile` with:

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

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY traceroute.py .
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

**Step 4: Commit**

```bash
git add services/pathtrace-api/traceroute.py services/pathtrace-api/Dockerfile
git commit -m "refactor: remove sys.path hack, simplify Dockerfile for new structure"
```

---

### Task 4: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

**Step 1: Update docker-compose.yml**

Replace the entire file with:

```yaml
name: first-aid-kit

services:
  # First Aid Kit Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fak-frontend
    ports:
      - "8081:80"
    networks:
      - fak-network
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
      - /tmp
    depends_on:
      - pathtrace-api
      - iperf-api

  # Path Tracer API (Python Flask)
  pathtrace-api:
    build:
      context: ./services/pathtrace-api
      dockerfile: Dockerfile
    container_name: fak-pathtrace-api
    ports:
      - "5000:5000"
    environment:
      FLASK_ENV: production
      NETBOX_URL: ${NETBOX_URL:-}
      NETBOX_TOKEN: ${NETBOX_TOKEN:-}
      # Path tracer credentials
      PATHTRACE_USER: ${PATHTRACE_USER:-}
      PATHTRACE_PASS: ${PATHTRACE_PASS:-}
      PATHTRACE_SECRET: ${PATHTRACE_SECRET:-}
      PATHTRACE_INVENTORY: /app/pathtracer/inventory.yaml
    volumes:
      # Mount inventory and credentials from host (create these files first)
      - ./services/pathtrace-api/pathtracer/inventory.yaml:/app/pathtracer/inventory.yaml:ro
      - ./services/pathtrace-api/pathtracer/credentials.yaml:/app/pathtracer/credentials.yaml:ro
    cap_add:
      - NET_RAW
      - NET_ADMIN
    security_opt:
      - no-new-privileges:true
    networks:
      - fak-network
    restart: unless-stopped

  # iPerf Server API (Go)
  iperf-api:
    build:
      context: ./services/iperf-api
      dockerfile: Dockerfile
    container_name: fak-iperf-api
    ports:
      - "8082:8080"
      - "5201:5201"
      - "5202:5202"
      - "5203:5203"
      - "5204:5204"
      - "5205:5205"
    volumes:
      - iperf-data:/app/data
    environment:
      DATA_DIR: /app/data
      PORT: "8080"
      IPERF_PORT_MIN: "5201"
      IPERF_PORT_MAX: "5205"
    networks:
      - fak-network
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true

networks:
  fak-network:
    driver: bridge

volumes:
  iperf-data:
```

**Step 2: Update docker-compose.dev.yml**

Replace the entire file with:

```yaml
# docker-compose.dev.yml - Development overrides
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up

services:
  # Development frontend with hot reloading
  frontend:
    build:
      context: .
      target: builder
    command: npm run dev -- --host
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8082
      VITE_WS_URL: ws://localhost:8082/ws

  # Development iPerf backend with live reload would require air or similar
  iperf-api:
    build:
      context: ./services/iperf-api
    volumes:
      - ./services/iperf-api:/app/src
      - iperf-data:/app/data
    environment:
      DATA_DIR: /app/data
      PORT: "8080"
      DEBUG: "true"
```

**Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "refactor: update docker-compose service names and build paths"
```

---

### Task 5: Update nginx.conf

**Files:**
- Modify: `nginx.conf`

**Step 1: Update proxy paths and upstream names**

Replace the entire file with:

```nginx
server {
    listen 80;
    server_name localhost;
    server_tokens off;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        # Repeat security headers — nginx drops server-context add_header directives
        # when a location block defines its own add_header
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'" always;
    }

    # Handle SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy Path Tracer API requests
    location /pathtrace/api/ {
        proxy_pass http://pathtrace-api:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Proxy iPerf API requests
    location /iperf/api/ {
        proxy_pass http://iperf-api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Proxy iPerf WebSocket
    location /iperf/ws {
        proxy_pass http://iperf-api:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # iPerf health check
    location /iperf/health {
        proxy_pass http://iperf-api:8080/health;
    }

    # Path Tracer health check
    location /pathtrace/health {
        proxy_pass http://pathtrace-api:5000/health;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'" always;
}
```

Key changes:
- `/api/` → `/pathtrace/api/` (namespaced)
- `backend:5000` → `pathtrace-api:5000` (service name)
- `iperf-backend:8080` → `iperf-api:8080` (service name)
- Added `/pathtrace/health` endpoint (symmetric with `/iperf/health`)

**Step 2: Commit**

```bash
git add nginx.conf
git commit -m "refactor: update nginx proxy paths and upstream service names"
```

---

### Task 6: Update frontend fetch URLs

**Files:**
- Modify: `src/components/tools/PathTracer/index.tsx` (lines 67-68, 159)

**Step 1: Update API endpoint paths**

In `src/components/tools/PathTracer/index.tsx`, there are 3 places that reference `/api/traceroute`:

**Line 67-68** — the `startTrace` function endpoint selection:
```typescript
      const endpoint = traceMode === 'device-based'
        ? '/api/traceroute/device-based'
        : '/api/traceroute';
```

Change to:
```typescript
      const endpoint = traceMode === 'device-based'
        ? '/pathtrace/api/traceroute/device-based'
        : '/pathtrace/api/traceroute';
```

**Line 159** — the `handleContinueTrace` function:
```typescript
      const response = await fetch('/api/traceroute/device-based', {
```

Change to:
```typescript
      const response = await fetch('/pathtrace/api/traceroute/device-based', {
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Verify build succeeds**

```bash
npx vite build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/index.tsx
git commit -m "refactor: update PathTracer fetch URLs to /pathtrace/api/ namespace"
```

---

### Task 7: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Update Go build artifact paths**

The `.gitignore` currently has:
```
# Go build artifacts
backend/server
backend/main
backend/data/
```

Change to:
```
# Go build artifacts
services/iperf-api/server
services/iperf-api/main
services/iperf-api/data/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore paths for new services/ layout"
```

---

### Task 8: Update start.sh

**Files:**
- Modify: `start.sh` (line 52, 69)

**Step 1: Update references**

Line 52 currently reads:
```bash
echo "   - Backend API:       http://localhost:5000/health"
```

Change to:
```bash
echo "   - Path Tracer API:   http://localhost:5000/health"
```

Line 69 currently reads:
```bash
echo "   - View backend:     docker compose logs -f backend"
```

Change to:
```bash
echo "   - View pathtrace:   docker compose logs -f pathtrace-api"
```

**Step 2: Commit**

```bash
git add start.sh
git commit -m "docs: update start.sh service names and labels"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `services/pathtrace-api/README.md`
- Modify: `docs/user-guide/path-tracer.md`
- Modify: `docs/deployment/docker.md`
- Modify: `docs/getting-started/configuration.md`

**Step 1: Update services/pathtrace-api/README.md**

The "Docker Deployment" section (line 130) currently says:
```
The API is deployed as the `backend` service in `docker-compose.yml`.
```

Change to:
```
The API is deployed as the `pathtrace-api` service in `docker-compose.yml`.
```

The "Local Development" section (lines 134-141) currently says:
```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r ../pathtracer/requirements.txt  # device-based tracing deps
FLASK_DEBUG=true python traceroute.py
```

Change to:
```bash
cd services/pathtrace-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
FLASK_DEBUG=true python traceroute.py
```

The "API Endpoints" section headers (lines 14, 52) currently say:
```
### POST /api/traceroute
### POST /api/traceroute/device-based
```

Change to:
```
### POST /pathtrace/api/traceroute
### POST /pathtrace/api/traceroute/device-based
```

**Step 2: Update docs/user-guide/path-tracer.md**

Line 75 currently says:
```
Create `pathtracer/inventory.yaml` with your network devices:
```

Change to:
```
Create `services/pathtrace-api/pathtracer/inventory.yaml` with your network devices:
```

Line 89 currently says:
```
See `pathtracer/README.md` for full inventory format and vendor configuration.
```

Change to:
```
See `services/pathtrace-api/pathtracer/README.md` for full inventory format and vendor configuration.
```

The API Endpoints table (lines 93-97) currently says:
```
| `/api/traceroute` | POST | ICMP traceroute |
| `/api/traceroute/device-based` | POST | Device-based path trace |
```

Change to:
```
| `/pathtrace/api/traceroute` | POST | ICMP traceroute |
| `/pathtrace/api/traceroute/device-based` | POST | Device-based path trace |
```

Line 99 currently says:
```
See `api/README.md` for full request/response documentation.
```

Change to:
```
See `services/pathtrace-api/README.md` for full request/response documentation.
```

**Step 3: Update docs/deployment/docker.md**

The Services table (lines 12-15) currently says:
```
| backend | 5000 | Python API (traceroute) |
| iperf-backend | 8082 | Go API (iPerf server) |
```

Change to:
```
| pathtrace-api | 5000 | Python API (traceroute) |
| iperf-api | 8082 | Go API (iPerf server) |
```

The volume mount paths (lines 41-42) currently say:
```
- `./pathtracer/inventory.yaml` → `/app/pathtracer/inventory.yaml`
- `./pathtracer/credentials.yaml` → `/app/pathtracer/credentials.yaml`
```

Change to:
```
- `./services/pathtrace-api/pathtracer/inventory.yaml` → `/app/pathtracer/inventory.yaml`
- `./services/pathtrace-api/pathtracer/credentials.yaml` → `/app/pathtracer/credentials.yaml`
```

The logs example (line 61) currently says:
```
docker compose logs -f iperf-backend
```

Change to:
```
docker compose logs -f iperf-api
```

**Step 4: Update docs/getting-started/configuration.md**

The "Backend Variables" section header (line 22) currently says:
```
### Backend Variables
```

Change to:
```
### iPerf API Variables
```

No other changes needed — the variable names themselves haven't changed.

**Step 5: Commit**

```bash
git add services/pathtrace-api/README.md docs/user-guide/path-tracer.md docs/deployment/docker.md docs/getting-started/configuration.md
git commit -m "docs: update all documentation for services/ directory structure"
```

---

### Task 10: Final verification

**Step 1: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 2: Verify Vite build**

```bash
npx vite build
```

Expected: Build succeeds.

**Step 3: Verify directory structure**

```bash
ls services/
# Expected: iperf-api/  pathtrace-api/

ls services/pathtrace-api/
# Expected: Dockerfile  README.md  __init__.py  pathtracer/  requirements.txt  traceroute.py

ls services/iperf-api/
# Expected: Dockerfile  cmd/  go.mod  go.sum  internal/

# Verify old directories are gone
ls api/ 2>&1
# Expected: No such file or directory

ls backend/ 2>&1
# Expected: No such file or directory
```

**Step 4: Verify no stale references to old paths**

```bash
grep -r "api/Dockerfile\|api/traceroute\|api/requirements" . --include="*.yml" --include="*.yaml" --include="*.md" --include="*.sh" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".git/" | grep -v "services/pathtrace-api"
# Expected: No output (no stale references)

grep -r '"backend"' docker-compose.yml nginx.conf
# Expected: No output (old service name gone)

grep -r "iperf-backend" . --include="*.yml" --include="*.yaml" --include="*.conf" --include="*.md" | grep -v node_modules | grep -v ".git/"
# Expected: No output
```

**Step 5: Verify grep for old fetch paths in frontend**

```bash
grep -r "/api/traceroute" src/
# Expected: No output (all updated to /pathtrace/api/traceroute)
```

No commit for this task — it's verification only.
