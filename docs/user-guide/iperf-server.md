# iPerf Server

Run an iperf3 server for bandwidth testing with real-time monitoring.

## Features

- **Live Graphs**: Real-time bandwidth visualization
- **WebSocket Updates**: Instant test progress
- **Test History**: Stored results with filtering
- **Export**: CSV and JSON export options

## Requirements

- Backend with iperf3 installed
- Ports 5201-5205 available (configurable)

## Usage

1. Navigate to iPerf Server from the sidebar
2. Configure port and protocol settings
3. Click "Start Server"
4. Run iperf3 client from another machine:
   ```bash
   iperf3 -c <server-ip> -p 5201
   ```
5. Monitor results in real-time

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 5201 | Server listen port |
| Protocol | TCP | TCP or UDP |
| One-off | Off | Exit after single test |
| Idle Timeout | 300s | Auto-stop after idle |
