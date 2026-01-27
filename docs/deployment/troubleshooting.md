# Troubleshooting

## Common Issues

### Docker Permission Errors

If you see permission denied errors:

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Port Already in Use

If port 5201 is busy (system iperf3 service):

```bash
# Check what's using the port
sudo lsof -i :5201

# Stop system service
sudo systemctl stop iperf3
```

### Backend Not Connecting

1. Check backend is running: `docker compose ps`
2. Check logs: `docker compose logs backend`
3. Verify ports aren't blocked by firewall

### WebSocket Connection Failed

- Verify backend URL in environment
- Check browser console for CORS errors
- Ensure WebSocket port is accessible

## Health Checks

### Backend API
```bash
curl http://localhost:8080/health
```

### iPerf Status
```bash
curl http://localhost:8080/api/status
```
