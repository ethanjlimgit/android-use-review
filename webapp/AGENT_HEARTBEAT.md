# Agent Server Heartbeat Integration

This document describes how agent servers (droiduse-backend) should send heartbeat signals to automatically register and update their status in the database.

## Overview

Agent servers automatically register themselves on first heartbeat using their server name as the unique identifier. All subsequent heartbeats use the same name to update status.

## Heartbeat Endpoint

**URL:** `POST /api/agent-servers/heartbeat`

**Headers:**
```
Content-Type: application/json
```

### Heartbeat Request

All heartbeats use the same format - the server is identified by its `name`:

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

**First Heartbeat (Auto-Registration):**
- If a server with this `name` doesn't exist, it will be created automatically
- Returns: `{ "success": true, "message": "Server registered successfully" }`

**Subsequent Heartbeats (Updates):**
- If a server with this `name` exists, it updates `lastPing` and any provided fields
- Returns: `{ "success": true, "message": "Heartbeat received" }`

### Request Fields

**Required:**
- `name` (string): Unique server name - used to identify the server

**Optional (recommended for first heartbeat):**
- `ipAddress` (string): Public IP address (defaults to "unknown")
- `privateIpAddress` (string): Private IP for connections (defaults to "unknown")
- `port` (number): Port number (defaults to 8000)
- `region` (string): Geographic region (e.g., "us-east", "eu-west")
- `capacity` (number): Max concurrent connections (defaults to 10)
- `description` (string): Server description

**Optional (for status updates):**
- `status` (string): "online", "offline", or "error" (defaults to "online")
- `activeConnections` (number): Current number of connected devices (defaults to 0)

**Metadata (future use):**
- `version` (string): Server version
- `websocketServerRunning` (boolean): WebSocket server status

### Error Responses

- `400 Bad Request`: Missing `name` field
- `403 Forbidden`: Server is disabled (heartbeat rejected)
- `500 Internal Server Error`: Database or server error

## Implementation Guide

### 1. Configure Server Identity

Configure your server with a consistent name and connection details:

```yaml
# config.yaml
server:
  name: "agent-prod-1"  # Must be unique and consistent
  public_ip: "45.33.22.11"
  private_ip: "10.0.0.5"
  port: 8000
  region: "us-east"
  capacity: 10
  nextjs_api_url: "http://localhost:3000"
```

**Important:** The `name` must be:
- Unique across all agent servers
- Consistent across server restarts
- Used in every heartbeat

### 2. Implement Heartbeat Service

```python
import asyncio
import httpx
from datetime import datetime

class HeartbeatService:
    def __init__(self, config: dict, api_url: str):
        self.config = config
        self.api_url = api_url
        self.heartbeat_url = f"{api_url}/api/agent-servers/heartbeat"
        self.interval = 60  # Send heartbeat every 60 seconds

    def get_active_connections(self) -> int:
        """Get current number of active connections"""
        # Implement this based on your WebSocket server
        # Example: return len(self.websocket_server.connections)
        return 0

    async def send_heartbeat(self):
        """Send a heartbeat to the Next.js API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.heartbeat_url,
                    json={
                        "name": self.config["name"],
                        "ipAddress": self.config.get("public_ip"),
                        "privateIpAddress": self.config.get("private_ip"),
                        "port": self.config.get("port", 8000),
                        "region": self.config.get("region"),
                        "capacity": self.config.get("capacity", 10),
                        "activeConnections": self.get_active_connections(),
                        "status": "online",
                    },
                    timeout=5.0
                )

                if response.status_code == 200:
                    data = response.json()
                    if "Server registered" in data["message"]:
                        print(f"Server registered: {self.config['name']}")
                    else:
                        print(f"Heartbeat sent successfully at {datetime.now()}")
                elif response.status_code == 403:
                    print("Server is disabled, heartbeat rejected")
                else:
                    print(f"Heartbeat failed: {response.status_code}")

        except Exception as e:
            print(f"Error sending heartbeat: {e}")

    async def start(self):
        """Start the heartbeat loop"""
        while True:
            await self.send_heartbeat()
            await asyncio.sleep(self.interval)

# Usage in your main application
async def main():
    config = {
        "name": "agent-prod-1",  # Unique server name
        "public_ip": "45.33.22.11",
        "private_ip": "10.0.0.5",
        "port": 8000,
        "region": "us-east",
        "capacity": 10
    }

    heartbeat = HeartbeatService(
        config=config,
        api_url="http://localhost:3000"
    )

    # Run heartbeat in background
    asyncio.create_task(heartbeat.start())

    # Your main application code here
    # ...
```

### 3. Integration with FastAPI/WebSocket Server

```python
from fastapi import FastAPI
import asyncio

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """Start heartbeat service when server starts"""
    config = {
        "name": os.getenv("AGENT_SERVER_NAME", "agent-1"),
        "public_ip": os.getenv("AGENT_PUBLIC_IP"),
        "private_ip": os.getenv("AGENT_PRIVATE_IP"),
        "port": int(os.getenv("AGENT_PORT", "8000")),
        "region": os.getenv("AGENT_REGION"),
        "capacity": int(os.getenv("AGENT_CAPACITY", "10"))
    }

    heartbeat = HeartbeatService(
        config=config,
        api_url=os.getenv("NEXTJS_API_URL", "http://localhost:3000")
    )
    asyncio.create_task(heartbeat.start())

@app.on_event("shutdown")
async def shutdown_event():
    """Send final heartbeat with offline status"""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{os.getenv('NEXTJS_API_URL')}/api/agent-servers/heartbeat",
            json={
                "name": os.getenv("AGENT_SERVER_NAME"),
                "status": "offline"
            }
        )
```

## Status Detection Logic

The admin CMS determines server status based on the `lastPing` timestamp:

- **Online**: Last heartbeat received within 2 minutes
- **Offline**: No heartbeat for more than 2 minutes, or never received

**Recommendation:** Send heartbeat every 60 seconds to ensure reliable status detection.

## Testing

Test your heartbeat implementation:

1. **Configure server name**: Set a unique name in your config
2. **Start your agent server** with heartbeat enabled
3. **Check registration**: Look for "Server registered: agent-prod-1" in logs
4. **Verify in admin CMS**:
   - Go to Agent Servers → Manage Servers
   - Your server should appear in the table automatically
   - Status should show as "online"
5. **Check monitoring**:
   - Go to Agent Servers → Monitor Servers
   - Verify your server appears with recent "Last Heartbeat" time
6. **Test updates**:
   - Change server IP or region in config
   - Restart server
   - Verify updated info appears in admin
7. **Test offline detection**:
   - Stop your agent server
   - Wait 2 minutes
   - Status should change to "offline" in the monitoring view

## Environment Variables

Add to your backend `.env`:

```bash
# Agent Server Configuration
AGENT_SERVER_NAME=agent-prod-1  # MUST be unique and consistent
AGENT_PUBLIC_IP=45.33.22.11
AGENT_PRIVATE_IP=10.0.0.5
AGENT_PORT=8000
AGENT_REGION=us-east
AGENT_CAPACITY=10

# Next.js API
NEXTJS_API_URL=http://localhost:3000
HEARTBEAT_INTERVAL=60  # seconds
```

**Important:** The `AGENT_SERVER_NAME` must be:
- Unique across all your agent servers
- Consistent across server restarts
- Not changed once set (or the server will be re-registered as a new server)

## Server Management by Admins

Once your server is registered via heartbeat, admins can:

1. **View all servers** in the Manage Servers tab
2. **Edit server details**: name, IPs, port, region, capacity, description
3. **Disable servers**: Prevents heartbeat updates (returns 403 error)
4. **Delete servers**: Removes from database (server will re-register on next heartbeat)

**Note:** If an admin changes the server name in the database, your backend should be updated to use the new name, or the server will be registered as a new entry.

## How It Works

1. **First Heartbeat**:
   - Backend sends heartbeat with `name` = "agent-prod-1"
   - API checks if server with this name exists
   - If not, creates new server entry
   - Returns success message

2. **Subsequent Heartbeats**:
   - Backend sends heartbeat with same `name` = "agent-prod-1"
   - API finds existing server by name
   - Updates `lastPing` and any changed fields (IP, port, region, etc.)
   - Returns success message

3. **Status Monitoring**:
   - Admin CMS queries database every 10 seconds
   - Calculates status based on `lastPing` timestamp
   - Shows "online" if heartbeat within 2 minutes, "offline" otherwise

## Benefits of Name-Based Identification

- **Simple**: No need to persist or manage server IDs
- **Consistent**: Same name used across all heartbeats
- **Self-healing**: Server re-registers automatically if deleted from database
- **Portable**: Server configuration portable across deployments
- **Intuitive**: Server name directly identifies the server in admin UI
