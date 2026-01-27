# First Aid Kit - Deployment Guide

## Quick Start

```bash
# Start the application
./start.sh
```

Access at: http://localhost:8081

## Manual Deployment

### Prerequisites

- Docker & Docker Compose
- User must be in docker group (see troubleshooting below)

### Steps

```bash
# 1. Build and start services
docker compose up -d

# 2. Check status
docker compose ps

# 3. View logs
docker compose logs -f
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 8081 | React web application |
| Backend API | 5000 | Python/Flask traceroute service |

## Configuration

### Optional: NetBox Integration

Edit `.env` file:

```bash
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=your_api_token_here
```

## Troubleshooting

### Docker Permission Denied

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker
```

### Port Already in Use

If port 8081 is in use, edit `docker-compose.yml` and change the port:

```yaml
ports:
  - "8082:80"  # Change 8081 to 8082 or any free port
```

### Backend Can't Create Raw Sockets

The backend container needs `privileged: true` in docker-compose.yml for traceroute to work. This is already configured but requires:

1. Docker daemon must be running
2. User must have docker permissions

### View Backend Logs

```bash
docker compose logs -f backend
```

## Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Path Tracer Usage

1. Open http://localhost:8081
2. Navigate to **Path Tracer** from the sidebar
3. Enter **Source IP** - The IP address to trace from
4. Enter **Destination IP** - The IP address to trace to
5. (Optional) Configure NetBox URL and token
6. Click **Start Trace**

### Notes

- Source IP must be reachable from your network
- ICMP must be allowed through firewalls
- Some routers may filter ICMP packets
- The backend uses Scapy which requires raw socket access (hence privileged mode)

## Architecture

```
┌─────────────┐
│  Browser    │
│ (localhost: │
│   8081)     │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│  Frontend   │
│  (nginx)    │
│  Port 80    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │
│  (Flask)    │
│  Port 5000  │
└──────┬──────┘
       │
       ├─────► Scapy (Raw Sockets)
       │        └─ ICMP Traceroute
       │
       └─────► NetBox API (Optional)
                └─ Device Lookup
```

## Production Deployment

For production use:

1. **Use HTTPS**: Deploy behind a reverse proxy (nginx, Traefik)
2. **Change Ports**: Don't expose internal ports publicly
3. **Secure NetBox Tokens**: Use Docker secrets or vault
4. **Resource Limits**: Add CPU/memory limits to docker-compose.yml
5. **Monitoring**: Add health checks and log aggregation

Example production setup:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

## Support

- **Issues**: See [FIX-DOCKER-PERMISSIONS.md](FIX-DOCKER-PERMISSIONS.md) for common Docker issues
- **API Docs**: See [api/README.md](api/README.md) for backend API details
- **Project**: See [README.md](README.md) for project overview
