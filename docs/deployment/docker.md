# Docker Deployment

## Quick Start

```bash
docker compose up -d
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 8081 | Nginx serving React app |
| backend | 5000 | Python API (traceroute) |
| iperf-backend | 8082 | Go API (iPerf server) |

## Configuration

### Environment Variables

Create `.env` file:
```bash
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=your-token-here
```

### Volumes

- `iperf-data`: Persistent storage for iPerf test history

### Path Tracer Configuration

For device-based path tracing, add credentials to `.env`:
```bash
PATHTRACE_USER=network_admin
PATHTRACE_PASS=your_password
PATHTRACE_SECRET=your_enable_secret
```

The device inventory and credentials files are mounted read-only from the host:
- `./pathtracer/inventory.yaml` → `/app/pathtracer/inventory.yaml`
- `./pathtracer/credentials.yaml` → `/app/pathtracer/credentials.yaml`

## Building Images

```bash
# Build all
docker compose build

# Build specific service
docker compose build frontend
```

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f iperf-backend
```
