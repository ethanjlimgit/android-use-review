# WebSocket Cellular Connection Optimization

## Problem
When phones connect via cellular data (4G/5G), WebSocket connections were timing out with error:
```
OSError: [WinError 121] The semaphore timeout period has expired
```

This occurred because cellular connections have:
- **Higher latency** (50-300ms vs 1-10ms on WiFi)
- **Packet loss** (1-5% typical)
- **NAT traversal delays**
- **Network handoffs** during movement
- **Variable bandwidth**

## Solutions Implemented

### 1. **Ping/Pong Keep-Alive**
Implemented WebSocket ping/pong to keep connections alive:
- **Ping interval**: 20 seconds (sends heartbeat every 20s)
- **Ping timeout**: 60 seconds (waits up to 60s for response)

This prevents cellular carrier NAT from timing out idle connections (typically 30-60s).

### 2. **Extended Timeouts**
Increased timeouts throughout the stack:
- **Close timeout**: 30 seconds (graceful close handshake)
- **Initial receive timeout**: 120 seconds (first message from phone)
- **Max message size**: 10MB (large screenshots/UI states)

### 3. **Better Error Handling**
Added specific handling for cellular network errors:
- Detect `WinError 121` (semaphore timeout) and log appropriately
- Handle `asyncio.TimeoutError` gracefully
- Log connection quality issues without crashing

### 4. **Configurable Settings**
All timeout values are now configurable in `config.yaml`:

```yaml
websocket_server:
  ping_interval: 20           # Heartbeat frequency (seconds)
  ping_timeout: 60            # Max wait for pong (seconds)
  close_timeout: 30           # Close handshake timeout (seconds)
  max_message_size: 10485760  # 10MB max message
  initial_recv_timeout: 120.0 # First message timeout (seconds)
```

## Configuration

### For Fast WiFi Connections
```yaml
websocket_server:
  ping_interval: 30
  ping_timeout: 20
  initial_recv_timeout: 30.0
```

### For Slow Cellular Connections (3G/Edge)
```yaml
websocket_server:
  ping_interval: 15
  ping_timeout: 90
  initial_recv_timeout: 180.0
```

### For Unstable Networks
```yaml
websocket_server:
  ping_interval: 10
  ping_timeout: 120
  initial_recv_timeout: 240.0
```

## Usage

The WebSocket server now automatically applies these settings:

```bash
# Start server with default cellular-optimized settings
droiduse-backend serve --host 0.0.0.0 --port 8000
```

Server logs will show the active configuration:
```
✅ WebSocket server running on ws://0.0.0.0:8000
📱 Waiting for phone connections (cellular-optimized)...
   - Ping interval: 20s, Ping timeout: 60s
   - Close timeout: 30s, Max message: 10MB, Initial recv timeout: 120s
```

## Testing

Test with a phone on cellular data:

1. **Connect phone** to cellular network (disable WiFi)
2. **Start backend server**:
   ```bash
   droiduse-backend serve --debug
   ```
3. **Monitor logs** for connection quality:
   ```
   📱 New WebSocket connection from <IP>:<PORT>
   [auth] ✅ Authenticated user <email> with device <device-id>
   📥 Received initial request from client
   ```

## Troubleshooting

### Still Getting Timeouts?
Increase timeouts in config.yaml:
```yaml
websocket_server:
  ping_timeout: 120        # 2 minutes
  initial_recv_timeout: 300.0  # 5 minutes
```

### Connection Drops Frequently?
Reduce ping interval for more frequent heartbeats:
```yaml
websocket_server:
  ping_interval: 10  # Ping every 10 seconds
```

### Large Screenshots Failing?
Increase max message size:
```yaml
websocket_server:
  max_message_size: 20971520  # 20MB
```

## Network Best Practices

1. **Use HTTPS/WSS** for production (encryption + better NAT traversal)
2. **Monitor ping/pong** in server logs to detect connection issues early
3. **Implement client-side reconnect** logic with exponential backoff
4. **Test on multiple carriers** (different NAT behaviors)
5. **Consider compression** for large payloads on slow connections

## Error Codes

Common cellular connection errors and their meanings:

- **WinError 121**: Semaphore timeout - network too slow or interrupted
- **WinError 10054**: Connection reset - carrier NAT timeout or handoff
- **TimeoutError**: Read/write timeout - check ping_timeout settings
- **ConnectionClosed 1006**: Abnormal closure - network interruption

## Performance Metrics

Expected performance on different networks:

| Network | Latency | Recommended ping_interval | Recommended ping_timeout |
|---------|---------|--------------------------|-------------------------|
| WiFi    | 1-10ms  | 30s                      | 20s                     |
| 5G      | 20-50ms | 20s                      | 60s                     |
| 4G LTE  | 30-100ms| 20s                      | 60s                     |
| 3G      | 100-300ms| 15s                     | 90s                     |
| Edge    | 200-500ms| 10s                     | 120s                    |

## References

- WebSocket RFC 6455: https://datatracker.ietf.org/doc/html/rfc6455
- Cellular NAT timeouts: Typically 30-60 seconds for idle TCP connections
- Python websockets library: https://websockets.readthedocs.io/
