# Heartbeat Server

The heartbeat server is a background service that periodically reports the agent server's status to a control plane API endpoint. This is useful for monitoring multiple agent servers and implementing load balancing or failover mechanisms.

## Overview

The heartbeat server sends periodic POST requests to a configured API endpoint with information about:
- Server identity (name, region, IP address)
- Server capacity and current active connections
- Server status (online, starting, offline)

## Configuration

Configure the heartbeat server in your `config.yaml`:

```yaml
# === WebSocket Server Settings ===
websocket_server:
  # ... other settings ...

  # Server metadata for heartbeat reporting
  public_ip_address: ""  # Public IP address (auto-detected if empty)
  server_name: "agent-prod-1"  # Server name identifier
  server_region: "us-east"  # Server region
  server_capacity: 10  # Maximum concurrent connections/tasks

# === Heartbeat Server Settings ===
heartbeat_server:
  # Enable/disable heartbeat reporting
  enabled: true
  # Control plane API URL to send heartbeats to
  heartbeat_api_url: "https://control-plane.example.com"
  # Send heartbeat every N seconds
  heartbeat_interval: 30
```

### Configuration Options

#### WebSocket Server Config (server metadata):
- `public_ip_address` (string): Public IP address of the server. Auto-detected using ipify.org if empty.
- `server_name` (string): Unique identifier for this server (e.g., "agent-prod-1", "agent-dev-us-east-1").
- `server_region` (string): Geographic region (e.g., "us-east", "eu-west", "ap-south").
- `server_capacity` (int): Maximum number of concurrent connections/tasks this server can handle.

#### Heartbeat Server Config:
- `enabled` (bool): Enable or disable heartbeat reporting. Default: `false`.
- `heartbeat_api_url` (string): Base URL of the control plane API (e.g., "https://control-plane.example.com").
- `heartbeat_interval` (int): Interval in seconds between heartbeat requests. Default: `30`.

## Heartbeat Payload

The heartbeat server sends POST requests to `/api/agent-servers/heartbeat` with the following JSON payload:

```json
{
  "name": "agent-prod-1",
  "ipAddress": "45.33.22.11",
  "privateIpAddress": "10.0.0.5",
  "port": 8000,
  "region": "us-east",
  "capacity": 10,
  "activeConnections": 3,
  "status": "online"
}
```

### Payload Fields

- `name` (string): Server name from config (`websocket_server.server_name`)
- `ipAddress` (string): Public IP address (from config or auto-detected)
- `privateIpAddress` (string): Private IP address (auto-detected)
- `port` (int): WebSocket server port
- `region` (string): Server region from config
- `capacity` (int): Maximum capacity from config
- `activeConnections` (int): Current number of active WebSocket connections
- `status` (string): Server status:
  - `"online"` - Server is running and accepting connections
  - `"starting"` - Server is initializing
  - `"offline"` - Server has stopped

## Control Plane API Requirements

Your control plane API must implement the following endpoint:

```
POST /api/agent-servers/heartbeat
Content-Type: application/json

{
  "name": "agent-prod-1",
  "ipAddress": "45.33.22.11",
  "privateIpAddress": "10.0.0.5",
  "port": 8000,
  "region": "us-east",
  "capacity": 10,
  "activeConnections": 3,
  "status": "online"
}
```

The endpoint should:
1. Accept POST requests with JSON payload
2. Return HTTP 200 OK on success
3. Update the server registry/database with the latest heartbeat data

## Example Use Cases

### 1. Load Balancing

Monitor `activeConnections` vs `capacity` across multiple servers to route new connections to the least loaded server:

```python
def select_server(servers):
    """Select server with most available capacity."""
    return min(servers, key=lambda s: s.activeConnections / s.capacity)
```

### 2. Health Monitoring

Track server health by monitoring heartbeat timestamps:

```python
def get_unhealthy_servers(servers, timeout=60):
    """Find servers that haven't sent heartbeat in timeout seconds."""
    now = time.time()
    return [s for s in servers if now - s.last_heartbeat > timeout]
```

### 3. Regional Routing

Route connections to servers in specific regions:

```python
def get_servers_in_region(servers, region):
    """Get all online servers in a specific region."""
    return [s for s in servers if s.region == region and s.status == "online"]
```

## Troubleshooting

### Heartbeat not being sent

1. Check that `heartbeat_server.enabled` is set to `true`
2. Verify `heartbeat_api_url` is correct
3. Check server logs for connection errors
4. Ensure control plane API is accessible from the agent server

### Public IP not detected

If `public_ip_address` is empty in config, the server will try to auto-detect it using ipify.org. If this fails:

1. Manually set `websocket_server.public_ip_address` in config
2. Check network connectivity to ipify.org
3. Review logs for detection errors

### Control plane not receiving heartbeats

1. Verify the endpoint path is `/api/agent-servers/heartbeat`
2. Check control plane API logs for errors
3. Ensure firewall rules allow connections from agent servers
4. Test the endpoint manually with curl:

```bash
curl -X POST https://control-plane.example.com/api/agent-servers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server",
    "ipAddress": "1.2.3.4",
    "privateIpAddress": "10.0.0.5",
    "port": 8000,
    "region": "test",
    "capacity": 10,
    "activeConnections": 0,
    "status": "online"
  }'
```

## Implementation Details

### Architecture

- The heartbeat server runs as an independent asyncio task
- It does not block the main WebSocket server
- Uses httpx for async HTTP requests
- Automatically stops when the WebSocket server stops
- **Observable Pattern**: Uses callback functions to get server state, avoiding circular dependencies
  - `get_active_connections`: Callback to retrieve current connection count
  - `is_server_running`: Callback to check if the main server is running
  - No direct reference to WebSocketServer, enabling clean separation of concerns

### IP Detection

- **Private IP**: Auto-detected by creating a UDP socket connection
- **Public IP**: Auto-detected using ipify.org API on first heartbeat
- Both can be manually configured to skip auto-detection

### Error Handling

- Network errors are logged but don't crash the server
- Failed heartbeats are retried on the next interval
- Connection timeouts default to 10 seconds

## Security Considerations

1. **HTTPS**: Use HTTPS for the control plane API URL in production
2. **Authentication**: Consider adding authentication to the heartbeat endpoint
3. **Rate Limiting**: Implement rate limiting on the control plane API
4. **IP Validation**: Validate IP addresses on the control plane side
5. **Secrets**: Never expose API keys or secrets in heartbeat payloads
