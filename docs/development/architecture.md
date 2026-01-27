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
│  - API proxy (/api/* → backend)                         │
│  - WebSocket proxy (/iperf/* → iperf-backend)          │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│   Python Backend    │    │       Go Backend            │
│   (Flask)           │    │       (Chi router)          │
│   - Traceroute      │    │   - iPerf3 management       │
│   - NetBox client   │    │   - WebSocket hub           │
│   - Scanopy client  │    │   - SQLite persistence      │
└─────────────────────┘    └─────────────────────────────┘
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
- **Python Backend**: Flask, Scapy, NetBox client
- **Go Backend**: Chi router, gorilla/websocket, go-sqlite3
- **Infrastructure**: Docker, Nginx, SQLite
