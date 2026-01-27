# Fix Docker Permission Denied Error

## The Problem

You're seeing: `permission denied while trying to connect to the Docker daemon socket`

This means your user account doesn't have permission to access Docker.

## Solutions

### Option 1: Add Your User to Docker Group (Recommended for Development)

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Apply the group change (logout/login or use newgrp)
newgrp docker

# Verify it works
docker ps

# Now run the start script again
./start.sh
```

**Note**: After adding yourself to the docker group, you may need to:
- Log out and log back in, OR
- Restart your terminal, OR
- Run `newgrp docker` in your current terminal

### Option 2: Run with Sudo (Quick but Less Secure)

```bash
# Run docker commands with sudo
sudo docker compose up -d

# Check status
sudo docker compose ps

# View logs
sudo docker compose logs -f
```

### Option 3: Fix Docker Socket Permissions (Temporary)

```bash
# Give everyone read/write access to docker socket (temporary - resets on reboot)
sudo chmod 666 /var/run/docker.sock

# Now you can run without sudo
docker compose up -d
```

**Warning**: This is less secure and resets when Docker restarts.

## Verify Docker Access

After applying one of the fixes above, test that Docker works:

```bash
# Should show Docker version without errors
docker version

# Should list running containers (may be empty)
docker ps

# Should work without sudo
docker run hello-world
```

## WSL2 Specific Notes

If you're using Docker Desktop on Windows with WSL2:

1. **Make sure Docker Desktop is running** in Windows
2. **Enable WSL2 integration**:
   - Open Docker Desktop
   - Go to Settings → Resources → WSL Integration
   - Enable integration for your WSL2 distribution
   - Click "Apply & Restart"

3. **Restart WSL2** if needed:
   ```powershell
   # In Windows PowerShell (as Administrator)
   wsl --shutdown
   # Then reopen your WSL2 terminal
   ```

## After Fixing Permissions

Once Docker works without permission errors:

```bash
# Start First Aid Kit
./start.sh

# Or manually
docker compose up -d

# Check everything is running
docker compose ps

# View logs
docker compose logs -f
```

## Still Having Issues?

If you continue to see permission errors:

1. **Check Docker is actually running**:
   ```bash
   sudo systemctl status docker
   # or for Docker Desktop on Windows/Mac, check the GUI
   ```

2. **Verify your user is in docker group**:
   ```bash
   groups $USER
   # Should list "docker" among the groups
   ```

3. **Check Docker socket exists**:
   ```bash
   ls -la /var/run/docker.sock
   # Should show: srw-rw---- 1 root docker
   ```

4. **Restart Docker service** (Linux):
   ```bash
   sudo systemctl restart docker
   ```

## Security Note

Adding users to the `docker` group gives them root-equivalent privileges because they can run containers with volume mounts and privileged mode. Only add trusted users to the docker group.

For production environments, consider:
- Using rootless Docker
- Implementing proper access controls
- Using Kubernetes for orchestration with RBAC
