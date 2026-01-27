# Quick Start

Get First Aid Kit running in under 5 minutes.

## Prerequisites

- Node.js 18+ (for frontend development)
- Docker & Docker Compose (for full stack deployment)

## Option 1: Full Stack (Recommended)

Deploy the complete application with all backends:

```bash
# Clone and start
git clone <repository-url>
cd fak
docker compose up -d

# Access the app
open http://localhost:8081
```

## Option 2: Frontend Only

For frontend development or when backends aren't needed:

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Access the app
open http://localhost:5173
```

## Next Steps

- [Installation Guide](./installation.md) - Detailed setup options
- [Configuration](./configuration.md) - Environment variables and options
- [User Guide](../user-guide/pcap-analyzer.md) - Learn to use each tool
