#!/bin/bash
set -e

echo "🚀 First Aid Kit - Quick Start"
echo "=============================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please update Docker Desktop."
    exit 1
fi

# Check if .env exists, create if not
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file"
    fi
fi

# Pull latest images
echo "📦 Building images..."
docker compose build

# Start services
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ First Aid Kit is running!"
echo ""
echo "📍 Access Points:"
echo "   - First Aid Kit UI:  http://localhost:8081"
echo "   - Path Tracer API:   http://localhost:5000/health"
echo ""
echo "📝 Next Steps:"
echo "   1. Open First Aid Kit at http://localhost:8081"
echo "   2. Navigate to Path Tracer tool"
echo "   3. Enter source and destination IP addresses"
echo "   4. Click 'Start Trace' to begin traceroute"
echo ""
echo "💡 Tips:"
echo "   - The source IP should be reachable from your network"
echo "   - The backend uses NET_RAW/NET_ADMIN capabilities for raw socket access"
echo "   - Configure NetBox in .env for device enrichment (optional)"
echo ""
echo "🛠️  Useful Commands:"
echo "   - View logs:        docker compose logs -f"
echo "   - Stop services:    docker compose down"
echo "   - Restart services: docker compose restart"
echo "   - View pathtrace:   docker compose logs -f pathtrace-api"
echo ""
