# First Aid Kit

A web-based network diagnostics toolkit for incident response and troubleshooting. Built with React, TypeScript, and Tailwind CSS.

## Features

- **PCAP Analyzer** - Upload and analyze packet captures (pcap/pcapng) to identify network issues, security threats, and performance problems
- **DNS Lookup** - Query DNS records from multiple public resolvers with DNSSEC validation
- **SSL/TLS Checker** - Validate SSL certificates using Certificate Transparency logs
- **Path Tracer** - Layer 3 hop-by-hop path discovery with Scanopy and NetBox integration

## Quick Start

### Full Stack Deployment (Recommended)

Deploy First Aid Kit with integrated Scanopy network discovery:

```bash
# Clone the repository
git clone <repository-url>
cd fak

# Create environment configuration
cat > .env << EOF
POSTGRES_PASSWORD=changeme
SCANOPY_SERVER_PORT=60072
SCANOPY_DAEMON_PORT=60073
EOF

# Deploy all services with Docker Compose
docker compose up -d

# Access applications
# - First Aid Kit: http://localhost:8080
# - Scanopy: http://localhost:60072
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Frontend Development Only

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker (Frontend Only)

```bash
# Build the image
docker build -t first-aid-kit .

# Run the container
docker run -d -p 8080:80 first-aid-kit
```

Access the app at `http://localhost:8080`

### Kubernetes

Deploy to a Kubernetes cluster using the provided manifests:

```bash
# Build and push Docker image to your registry
docker build -t your-registry/first-aid-kit:latest .
docker push your-registry/first-aid-kit:latest

# Update the image in kustomization.yaml
cd k8s
sed -i 's|first-aid-kit|your-registry/first-aid-kit|g' kustomization.yaml

# Deploy using kustomize
kubectl apply -k k8s/

# Or apply manifests directly
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

#### Kubernetes Configuration

The `k8s/` directory contains:

| File | Description |
|------|-------------|
| `deployment.yaml` | Deployment with 2 replicas, resource limits, and health checks |
| `service.yaml` | ClusterIP service exposing port 80 |
| `ingress.yaml` | Ingress resource (configure host and TLS as needed) |
| `kustomization.yaml` | Kustomize configuration for easy customization |

#### Customizing for Your Environment

1. **Update the ingress host:**
   ```bash
   # Edit k8s/ingress.yaml and change:
   host: first-aid-kit.example.com
   # to your actual domain
   ```

2. **Enable TLS:**
   Uncomment the TLS section in `ingress.yaml` and configure cert-manager or provide your own certificate.

3. **Scale replicas:**
   ```bash
   kubectl scale deployment first-aid-kit --replicas=3
   ```

4. **Use a different ingress controller:**
   Update the `ingressClassName` in `ingress.yaml` to match your cluster's ingress controller.

#### Port Forwarding (for testing)

```bash
kubectl port-forward svc/first-aid-kit 8080:80
```

Access the app at `http://localhost:8080`

## Project Structure

```
src/
├── App.tsx                 # Main application with routing
├── main.tsx               # Application entry point
├── index.css              # Global styles and Tailwind config
├── components/
│   ├── layout/            # Layout and navigation components
│   │   ├── Layout.tsx     # Main layout with sidebar
│   │   ├── Dashboard.tsx  # Home dashboard
│   │   └── index.ts       # Barrel exports
│   └── tools/             # Individual tool components
│       ├── PcapAnalyzer.tsx
│       ├── DnsLookup.tsx
│       ├── SslChecker.tsx
│       └── index.ts       # Barrel exports
└── features/
    └── pcap/              # PCAP parsing and analysis
        ├── types.ts       # TypeScript interfaces
        ├── pcapParser.ts  # Binary PCAP/PCAPNG parser
        ├── pcapAnalyzer.ts # Traffic analysis engine
        └── index.ts       # Barrel exports
```

## Tools Overview

### PCAP Analyzer

Parses and analyzes network packet captures entirely in the browser:

- Supports both pcap and pcapng file formats
- Protocol detection: Ethernet, IPv4, IPv6, TCP, UDP, ICMP, ARP
- Application-layer analysis: DNS, HTTP, TLS/SSL
- Security checks: weak ciphers, cleartext credentials, suspicious patterns
- Performance metrics: retransmissions, latency, throughput

### DNS Lookup

Query DNS records using public DNS-over-HTTPS resolvers:

- Supported record types: A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA
- Multiple resolvers: Google, Cloudflare, Quad9
- DNSSEC validation status
- Response time comparison

### SSL/TLS Checker

Certificate validation using Certificate Transparency:

- Queries crt.sh for certificate information
- Shows certificate chain and validity dates
- Identifies issuing CA and certificate type
- Lists Subject Alternative Names (SANs)

### Path Tracer

Layer 3 traceroute with infrastructure integration:

- Hop-by-hop path discovery using ICMP TTL manipulation
- **Scanopy integration** - Automatic device enrichment from network topology
- **NetBox integration** - Optional IPAM device lookup for each hop
- RTT (Round-Trip Time) analysis with color-coded indicators
- Service detection - Shows discovered services on each hop
- Hostname resolution for network devices
- Requires Python backend with Scapy (see [api/README.md](api/README.md))

**Unique Features:**
- Combines live traceroute with discovered topology data
- Shows services running on intermediate hops
- Displays both Scanopy (discovered) and NetBox (documented) device info
- Helps identify undocumented network devices

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Lucide React** - Icon library

## Integrated Services

First Aid Kit integrates with the following services to provide enhanced functionality:

### Scanopy (Network Discovery)

- **Purpose**: Automatic network topology discovery and visualization
- **Integration**: Enriches traceroute hops with discovered device information
- **Deployment**: Included in docker-compose.yml
- **Documentation**: [scanopy.net](https://scanopy.net)

### NetBox (Optional IPAM)

- **Purpose**: IP address and device documentation
- **Integration**: Provides authoritative device information for hops
- **Deployment**: External (must be deployed separately)
- **Documentation**: [docs.netbox.dev](https://docs.netbox.dev)

## Browser Compatibility

Requires a modern browser with support for:

- ES2020+ JavaScript features
- Fetch API
- ArrayBuffer and DataView (for PCAP parsing)
- CSS Grid and Flexbox

## License

MIT
