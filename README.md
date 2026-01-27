# First Aid Kit

> Network diagnostics toolkit for incident response and troubleshooting

![First Aid Kit Dashboard](docs/assets/dashboard-preview.png)

## Features

- **PCAP Analyzer** - Parse and analyze packet captures in-browser
- **DNS Lookup** - Query DNS records from multiple resolvers with DNSSEC
- **SSL Checker** - Validate certificates via Certificate Transparency
- **Path Tracer** - Layer 3 traceroute with NetBox/Scanopy integration
- **iPerf Server** - Bandwidth testing with real-time monitoring
- **Capture Builder** - Generate capture commands for multiple platforms

## Quick Start

```bash
# Clone and start with Docker
git clone <repository-url>
cd fak
docker compose up -d

# Open http://localhost:8081
```

For development setup, see [Installation Guide](docs/getting-started/installation.md).

## Documentation

- [Quick Start](docs/getting-started/quick-start.md)
- [User Guide](docs/user-guide/)
- [Deployment](docs/deployment/)
- [Integrations](docs/integrations/)

## Tech Stack

React • TypeScript • Tailwind CSS • Go • Python • Docker

## License

MIT
