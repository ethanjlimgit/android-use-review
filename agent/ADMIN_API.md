# Admin API Documentation

The DroidUse Backend includes a FastAPI admin server for monitoring and managing backend services.

## Starting the Admin Server

### Option 1: Admin Server Only

```bash
droiduse-backend serve-admin --host 0.0.0.0 --port 8001
```

### Option 2: WebSocket + Admin Server Together

```bash
droiduse-backend serve --enable-admin --host 0.0.0.0 --port 8000 --admin-port 8001
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T12:00:00",
  "version": "0.5.0",
  "websocket_server_running": true
}
```

### GET /status

Get active WebSocket connections and connected devices.

**Response:**
```json
{
  "active_connections": 2,
  "websocket_server_running": true,
  "devices": [
    {
      "device_id": "device-123",
      "user_id": "user-456",
      "client_address": "192.168.1.100:54321",
      "connected_at": "2026-01-18T12:00:00"
    }
  ]
}
```

### GET /config

Get current backend configuration.

**Response:**
```json
{
  "agent": {
    "manager": {
      "vision": true,
      ...
    },
    ...
  },
  ...
}
```

### POST /config

Update configuration value.

**Request:**
```json
{
  "path": "agent.manager.vision",
  "value": true
}
```

**Response:**
```json
{
  "success": true,
  "path": "agent.manager.vision",
  "value": true
}
```

### POST /send_task

Send a task to a connected device.

**Request:**
```json
{
  "device_id": "device-123",
  "command": "Open settings and turn on wifi",
  "config": {
    "agent": {
      "manager": {
        "vision": true
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "device_id": "device-123",
  "result": {
    "task_id": "abc123def456",
    "status": "sent",
    "message": "Task sent to device device-123. The device should begin execution shortly."
  }
}
```

**Error Responses:**

- `404` - Device not connected
- `500` - Failed to send task
- `503` - WebSocket server not available

## How Task Sending Works

The `/send_task` endpoint uses a **push-based protocol** where the admin server sends tasks to connected devices via WebSocket.

### Protocol Flow

1. Admin sends POST request to `/send_task` with device_id and command
2. Backend validates that device is connected
3. Backend sends task message to device via existing WebSocket connection:
   ```json
   {
     "type": "admin_task",
     "task_id": "abc123def456",
     "command": "Open settings and turn on wifi",
     "config": {...}
   }
   ```
4. Device receives the message and begins task execution
5. Backend returns success response immediately

### Important Notes

- **Phone App Requirements**: The Android app must be updated to handle server-initiated messages with `type="admin_task"`
- **Connection Required**: Device must be actively connected to the WebSocket server
- **Async Execution**: The endpoint returns immediately after sending the task, not after completion
- **Task Tracking**: Use the returned `task_id` to track task execution

## Example Usage

### Using curl

```bash
# Health check
curl http://localhost:8001/health

# Get status
curl http://localhost:8001/status

# Get config
curl http://localhost:8001/config

# Update config
curl -X POST http://localhost:8001/config \
  -H "Content-Type: application/json" \
  -d '{"path": "agent.manager.vision", "value": true}'

# Send task to device
curl -X POST http://localhost:8001/send_task \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-123",
    "command": "Open settings and enable bluetooth"
  }'
```

### Using Python

```python
import requests

# Health check
response = requests.get("http://localhost:8001/health")
print(response.json())

# Get connected devices
response = requests.get("http://localhost:8001/status")
devices = response.json()["devices"]
print(f"Connected devices: {len(devices)}")

# Send task to first device
if devices:
    device_id = devices[0]["device_id"]
    response = requests.post(
        "http://localhost:8001/send_task",
        json={
            "device_id": device_id,
            "command": "Open YouTube and search for cooking videos"
        }
    )
    print(response.json())
```

## Admin UI

The admin frontend provides a web interface for all these endpoints:

1. Start the admin app: `cd droiduse-frontend && pnpm dev`
2. Navigate to http://localhost:3001
3. Log in with admin credentials
4. Go to "Backend Services" in the sidebar

The UI provides:
- **Monitoring Tab**: Real-time server health and device connections
- **Configuration Tab**: View and update backend configuration
- **Send Task Tab**: Send commands to connected devices

## Security Considerations

- The admin API has no authentication by default - add authentication middleware in production
- CORS is configured to allow all origins - restrict this in production
- Configuration changes are immediate and not persisted to file
- Sensitive config values (API keys) are returned in `/config` - consider filtering these
