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
