# Scanopy Integration

First Aid Kit integrates with Scanopy for automatic network topology discovery.

## Configuration

```bash
SCANOPY_URL=http://scanopy:60072
```

## Features

### Path Tracer

Enriches traceroute hops with discovered device information:
- Automatically detected devices
- Service discovery results
- Network topology context

## Deployment

Scanopy can be deployed alongside First Aid Kit:

```yaml
# docker-compose.yml
services:
  scanopy:
    image: scanopy/scanopy:latest
    ports:
      - "60072:60072"
```

See [Scanopy Documentation](https://scanopy.net) for full setup.
