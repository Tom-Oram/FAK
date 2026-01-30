# Architecture

## Overview

First Aid Kit is a multi-service application:

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React Frontend                      │   │
│  │  - PCAP parsing (in-browser)                    │   │
│  │  - DNS over HTTPS                               │   │
│  │  - WebSocket client                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Proxy)                         │
│  - Static file serving                                   │
│  - Path Tracer proxy (/pathtrace/api/* → pathtrace-api) │
│  - iPerf proxy (/iperf/* → iperf-api)                   │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│  pathtrace-api      │    │       iperf-api             │
│  (Python Flask)     │    │       (Go Chi router)       │
│  - Traceroute       │    │   - iPerf3 management       │
│  - Path tracer      │    │   - WebSocket hub           │
│  - NetBox client    │    │   - SQLite persistence      │
└─────────────────────┘    └─────────────────────────────┘
```

## Service Structure

```
services/
├── pathtrace-api/     # Python Flask — ICMP traceroute + device-based path tracing
│   ├── traceroute.py  # Flask app with API endpoints
│   └── pathtracer/    # Device tracing module (drivers, parsers, models)
└── iperf-api/         # Go — iPerf3 server lifecycle management
    ├── cmd/server/    # Entry point
    └── internal/      # API handlers, WebSocket, storage
```

## Frontend Structure

```
src/
├── components/
│   ├── layout/      # Layout, Dashboard, SystemHealthBar
│   ├── tools/       # Tool-specific components
│   └── ui/          # Reusable UI components
├── features/
│   └── pcap/        # PCAP parsing engine
└── hooks/           # Custom React hooks
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **pathtrace-api**: Flask, Scapy, Netmiko, NetBox client
- **iperf-api**: Chi router, gorilla/websocket, go-sqlite3
- **Infrastructure**: Docker, Nginx, SQLite
