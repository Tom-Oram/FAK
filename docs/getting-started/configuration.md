# Configuration

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8082` | iPerf backend API URL (dev mode only) |
| `VITE_WS_URL` | `ws://localhost:8082/ws` | iPerf WebSocket endpoint (dev mode only) |

> **Note:** In production (Docker Compose), the frontend is served by nginx which proxies API requests internally. These variables are only used during `npm run dev`.

### Backend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATA_DIR` | `./data` | SQLite database directory |
| `IPERF_PORT_MIN` | `5201` | Minimum iPerf port |
| `IPERF_PORT_MAX` | `5205` | Maximum iPerf port |

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

## Feature Flags

Currently no feature flags are implemented. All features are enabled by default.

## Theming

Theme preference is stored in browser localStorage:
- Key: `fak-theme`
- Values: `light`, `dark`, `system`

To reset theme, clear localStorage or use the toggle in the header.
