# iPerf Server Integration Design

## Overview

Add a fully integrated iPerf3 server to First Aid Kit (FAK) with a Go backend managing the iperf3 process and a React frontend providing real-time visualization, historical data, and export functionality.

## Architecture

**Three-container architecture via Docker Compose:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   React Frontend│   Go Backend    │   iperf3 (managed)      │
│   (nginx)       │   (API + WS)    │   (subprocess)          │
│   Port 80       │   Port 8080     │   Port 5201 (default)   │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Go Backend Responsibilities

- REST API for configuration and historical data
- WebSocket server for real-time updates
- Spawn/manage iperf3 server subprocess
- Parse iperf3 JSON output in real-time
- Store test results in SQLite
- Enforce client IP allowlist

### React Frontend Responsibilities

- Server control panel (start/stop, configuration)
- Live bandwidth graph (updating in real-time via WebSocket)
- Connection log (who connected, when, test params)
- Historical test table with filtering and export
- Display server status and listening address for clients to connect to

### Data Flow

1. User configures options and clicks "Start Server"
2. Frontend sends config via WebSocket
3. Backend spawns `iperf3 -s --json` with configured options
4. Backend parses JSON output, broadcasts metrics via WebSocket
5. Frontend renders live graph and logs
6. On test completion, backend writes summary to SQLite

## Go Backend Design

### Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go           # Entry point, starts HTTP/WS server
├── internal/
│   ├── api/
│   │   ├── handlers.go       # REST handlers (history, export, config)
│   │   └── websocket.go      # WebSocket hub + client management
│   ├── iperf/
│   │   ├── manager.go        # Start/stop iperf3 subprocess
│   │   ├── parser.go         # Parse iperf3 JSON output stream
│   │   └── config.go         # Config struct, validation, CLI builder
│   ├── storage/
│   │   └── sqlite.go         # SQLite operations (tests, history)
│   └── models/
│       └── types.go          # Shared types (TestResult, ServerConfig, etc.)
├── go.mod
├── go.sum
└── Dockerfile
```

### Key Dependencies

- `gorilla/websocket` - WebSocket handling
- `chi` or `echo` - Lightweight HTTP router
- `mattn/go-sqlite3` - SQLite driver
- Standard library for subprocess management (`os/exec`)

### iperf3 Manager Behavior

- Validates config before spawning
- Runs `iperf3 -s -J` (JSON mode) with configured flags
- Streams stdout line-by-line to parser
- Detects client connections from JSON "start" events
- Broadcasts parsed metrics to WebSocket clients
- Handles graceful shutdown (SIGTERM to iperf3)
- Auto-stops after configurable idle timeout

## Frontend Design

### Component Structure

```
src/components/tools/IperfServer/
├── index.tsx                 # Main component, WebSocket connection
├── types.ts                  # TypeScript interfaces
├── components/
│   ├── ServerControls.tsx    # Start/stop, status indicator
│   ├── ConfigPanel.tsx       # Port, bind, protocol, options
│   ├── AllowlistEditor.tsx   # IP/CIDR allowlist management
│   ├── LiveGraph.tsx         # Real-time bandwidth chart
│   ├── ConnectionLog.tsx     # Live connection events
│   ├── TestHistory.tsx       # Historical results table
│   └── ClientInstructions.tsx # Shows command for clients to connect
└── hooks/
    └── useIperfWebSocket.ts  # WebSocket connection + state management
```

### UI Layout (single page, vertical sections)

1. **Header** - "iPerf Server" title, server status badge (stopped/running/error)
2. **Config panel** (collapsible when running) - All iperf3 options, allowlist
3. **Server controls** - Start/Stop button, listening address display
4. **Client instructions** - Copy-ready command: `iperf3 -c <host> -p <port>`
5. **Live graph** - Real-time bandwidth chart (Recharts library, matches existing FAK style)
6. **Connection log** - Scrolling list of events (client connected, test started, test completed)
7. **Test history** - Table with filters, sorting, CSV export button

### WebSocket Message Types

- `server_status` - Running/stopped state changes
- `client_connected` - New client connection
- `bandwidth_update` - Real-time throughput data points
- `test_complete` - Final test summary
- `error` - Server or iperf3 errors

## Configuration Options

### Server Configuration (user-adjustable)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| port | number | 5201 | Listening port |
| bindAddress | string | 0.0.0.0 | Interface to bind |
| protocol | tcp/udp | tcp | Transport protocol |
| oneOff | boolean | false | Exit after single client |
| idleTimeout | number | 300 | Seconds before auto-stop (0 = never) |
| allowlist | string[] | [] | Allowed client IPs/CIDRs (empty = all) |

### iperf3 Authentication (optional)

- Uses iperf3's `--rsa-public-key-path` and authorized users file
- Backend generates/manages key pair
- UI shows credentials for client to use

## Data Models

### TestResult (stored in SQLite)

```typescript
interface TestResult {
  id: string
  timestamp: Date
  clientIp: string
  clientPort: number
  protocol: 'tcp' | 'udp'
  duration: number          // seconds
  bytesTransferred: number
  avgBandwidth: number      // bits/sec
  maxBandwidth: number
  minBandwidth: number
  retransmits?: number      // TCP only
  jitter?: number           // UDP only
  packetLoss?: number       // UDP only
  direction: 'upload' | 'download'
}
```

### BandwidthUpdate (WebSocket, not persisted)

```typescript
interface BandwidthUpdate {
  timestamp: number
  intervalStart: number
  intervalEnd: number
  bytes: number
  bitsPerSecond: number
}
```

## Docker Compose Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8080:8080"      # API + WebSocket
      - "5201:5201"      # iperf3 default (configurable range)
      - "5202-5210:5202-5210"  # Additional ports if needed
    volumes:
      - iperf-data:/app/data   # SQLite persistence
    environment:
      - IPERF_PORT_MIN=5201
      - IPERF_PORT_MAX=5210

volumes:
  iperf-data:
```

### Frontend Dockerfile

- Multi-stage: Node build → nginx serve
- nginx config proxies `/api/*` and `/ws` to backend

### Backend Dockerfile

- Multi-stage: Go build → minimal runtime image
- Installs `iperf3` binary in final image
- Runs as non-root user (security)

### Port Considerations

- Port range 5201-5210 exposed for flexibility
- User can configure which port iperf3 listens on within this range
- If user needs different ports, they modify compose file

### Development Mode

- `docker-compose.dev.yml` override for hot-reload
- Mounts source code, uses `air` for Go hot-reload
- Vite dev server for frontend

## Live Graph Features

### Bandwidth Graph (using Recharts)

- Line chart showing bits/sec over time
- Rolling window of last 60 seconds (configurable)
- Dual Y-axis if showing both directions simultaneously
- Color-coded: upload (blue), download (green)
- Tooltip shows exact values on hover
- Pauses updates when user hovers (for inspection)
- "Clear" button to reset graph during long sessions

### Connection Log

- Auto-scroll with newest at bottom
- Severity icons: info (connect), success (complete), error (failed)
- Timestamp, client IP, event type, brief details
- Max 500 entries in view (older ones archived to history)
- Filter by client IP or event type

### Test History Table

- Columns: Time, Client, Protocol, Duration, Avg Bandwidth, Peak, Direction
- Sortable by any column
- Date range filter
- Client IP filter
- Pagination (25/50/100 per page)

### Export Options

- CSV download of filtered results
- JSON export for programmatic use
- Copy single row as formatted text
- "Export All" for full database dump
