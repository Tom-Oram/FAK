# NetBox Integration

First Aid Kit integrates with NetBox for IP address and device documentation.

## Configuration

Set environment variables:
```bash
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=your-api-token
```

## Features

### Path Tracer

When tracing paths, each hop's IP is looked up in NetBox:
- Device name and role
- Site information
- Interface details

## API Token

Create a NetBox API token:
1. Log into NetBox
2. Navigate to Admin → API Tokens
3. Create token with read permissions for:
   - IPAM (IP addresses)
   - DCIM (devices, interfaces)
