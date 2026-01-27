# Configuration

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket endpoint |

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

## Feature Flags

Currently no feature flags are implemented. All features are enabled by default.

## Theming

Theme preference is stored in browser localStorage:
- Key: `fak-theme`
- Values: `light`, `dark`, `system`

To reset theme, clear localStorage or use the toggle in the header.
