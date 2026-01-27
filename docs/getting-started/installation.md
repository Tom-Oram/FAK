# Installation

## System Requirements

- **Node.js**: 18.0 or higher
- **Docker**: 20.10 or higher (for containerized deployment)
- **Memory**: 512MB minimum, 1GB recommended
- **Browser**: Modern browser with ES2020+ support

## Installation Methods

### Docker Compose (Recommended)

Full stack deployment with all services:

```bash
git clone <repository-url>
cd fak
cp .env.example .env
docker compose up -d
```

Services started:
- Frontend: http://localhost:8081
- Backend API: http://localhost:5000
- iPerf Backend: http://localhost:8082

### Development Setup

For local development with hot reloading:

```bash
# Frontend
npm install
npm run dev

# Backend (in separate terminal)
cd backend
go run ./cmd/server
```

### Production Build

Build static files for deployment:

```bash
npm run build
# Output in dist/ directory
```

### Kubernetes

See [Kubernetes Deployment](../deployment/kubernetes.md) for cluster deployment.

## Verification

After installation, verify all services:

1. Open http://localhost:8081 (or :5173 for dev)
2. Check System Health bar shows "Backend API: Online"
3. Navigate to iPerf Server tool
4. Verify status shows "Stopped" (not "Offline")
