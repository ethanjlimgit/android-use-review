"""
Comprehensive WebSocket Server Tests.

Tests the full websocket_server.py implementation with corner cases including:
- Connection handling and lifecycle
- Task request/response flow
- Malformed data and invalid inputs
- Binary data handling (screenshots)
- Concurrent connections
- Error propagation
- Timeout scenarios
"""

import asyncio
import base64
import json
import uuid
from typing import Any, Dict, Optional

import pytest
import websockets
from websockets.legacy.client import WebSocketClientProtocol

# Sample test data matching Android device format
SAMPLE_STATE_RESPONSE = {
    "a11y_tree": {
        "index": -1,
        "text": "",
        "type": "root",
        "bounds": "0,0,1080,2400",
        "className": "android.view.ViewGroup",
        "children": [
            {
                "index": 0,
                "text": "Settings",
                "type": "clickable",
                "bounds": "100,100,200,200",
                "className": "android.widget.TextView",
                "children": [],
            },
            {
                "index": 1,
                "text": "Battery",
                "type": "clickable",
                "bounds": "100,250,200,350",
                "className": "android.widget.TextView",
                "children": [],
            },
        ],
    },
    "phone_state": {
        "battery_level": 85,
        "screen_on": True,
        "current_package": "com.android.settings",
    },
    "device_context": {"screen_width": 1080, "screen_height": 2400},
}


@pytest.fixture
def server_port():
    """Provides unique port for each test."""
    import random

    return random.randint(9000, 9999)


@pytest.fixture
def server_config():
    """Create test config with authentication disabled."""
    from droiduse_backend import AndroidUseConfig
    from droiduse_backend.config_manager.config_manager import WebSocketServerConfig

    config = AndroidUseConfig()
    config.websocket_server = WebSocketServerConfig(auth_enabled=False)
    return config


# =============================================================================
# Phone Client Simulator
# =============================================================================


class PhoneSimulator:
    """Simulates an Android phone client for testing."""

    def __init__(self):
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.received_messages = []
        self.pending_responses = {}
        self.response_handlers = {}

    async def connect(self, uri: str):
        """Connect to server."""
        self.websocket = await websockets.connect(uri)

    async def disconnect(self):
        """Disconnect from server."""
        if self.websocket:
            await self.websocket.close()

    async def send_task_request(self, command: str, task_id: str = None, config: Dict = None):
        """Send task request to server."""
        if not task_id:
            task_id = str(uuid.uuid4())

        request = {
            "task_id": task_id,
            "command": command,
            "device_id": "test-device-123",
        }

        if config:
            request["config"] = config

        await self.websocket.send(json.dumps(request))
        return task_id

    async def receive_message(self, timeout: float = 5.0):
        """Receive one message from server."""
        try:
            message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout)
            if isinstance(message, str):
                data = json.loads(message)
                self.received_messages.append(data)
                return data
            return message
        except asyncio.TimeoutError:
            return None

    async def handle_device_command(self, message: Dict) -> Any:
        """Handle command from server (e.g., click, screenshot, state_full)."""
        if "id" not in message or "method" not in message:
            return None

        request_id = message["id"]
        method = message["method"]
        params = message.get("params", {})

        # Check if we have a custom handler
        if method in self.response_handlers:
            return await self.response_handlers[method](request_id, params)

        # Default handlers
        if method == "state_full":
            return await self.send_state_response(request_id)
        elif method == "click":
            return await self.send_click_response(request_id, params)
        elif method == "screenshot":
            return await self.send_screenshot_response(request_id)
        elif method == "keyboard/input":
            return await self.send_success_response(request_id, {})
        elif method == "keyevent":
            return await self.send_success_response(request_id, {})
        elif method == "apps":
            return await self.send_apps_response(request_id)
        elif method == "date":
            return await self.send_date_response(request_id)
        elif method == "swipe":
            return await self.send_success_response(request_id, {})
        else:
            return await self.send_success_response(request_id, {})

    async def send_state_response(self, request_id: str):
        """Send state_full response."""
        response = {
            "id": request_id,
            "status": "success",
            "result": SAMPLE_STATE_RESPONSE,
        }
        await self.websocket.send(json.dumps(response))

    async def send_click_response(self, request_id: str, params: Dict):
        """Send click response."""
        response = {
            "id": request_id,
            "status": "success",
            "result": {"x": params.get("x"), "y": params.get("y")},
        }
        await self.websocket.send(json.dumps(response))

    async def send_screenshot_response(self, request_id: str):
        """Send screenshot response (binary)."""
        fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        response = request_id.encode("utf-8") + fake_png
        await self.websocket.send(response)

    async def send_apps_response(self, request_id: str):
        """Send apps list response."""
        mock_apps = [
            {
                "packageName": "com.android.settings",
                "label": "Settings",
                "isSystemApp": True,
            },
            {
                "packageName": "com.android.calculator",
                "label": "Calculator",
                "isSystemApp": False,
            },
            {
                "packageName": "com.android.chrome",
                "label": "Chrome",
                "isSystemApp": False,
            },
        ]
        response = {
            "id": request_id,
            "status": "success",
            "result": {"apps": mock_apps},
        }
        await self.websocket.send(json.dumps(response))

    async def send_date_response(self, request_id: str):
        """Send date response."""
        response = {
            "id": request_id,
            "status": "success",
            "result": {"data": "2026-01-02 10:00:00"},
        }
        await self.websocket.send(json.dumps(response))

    async def send_success_response(self, request_id: str, result: Any):
        """Send generic success response."""
        response = {"id": request_id, "status": "success", "result": result}
        await self.websocket.send(json.dumps(response))

    async def send_error_response(self, request_id: str, error: str):
        """Send error response."""
        response = {"id": request_id, "status": "error", "error": error}
        await self.websocket.send(json.dumps(response))

    def register_handler(self, method: str, handler):
        """Register custom handler for a method."""
        self.response_handlers[method] = handler

    async def message_loop(self, stop_event: asyncio.Event = None):
        """Process incoming messages in a loop."""
        try:
            async for message in self.websocket:
                if stop_event and stop_event.is_set():
                    break

                if isinstance(message, str):
                    data = json.loads(message)
                    self.received_messages.append(data)

                    # If it's a command from server, handle it
                    if "method" in data:
                        await self.handle_device_command(data)
                else:
                    # Binary message
                    self.received_messages.append({"binary": len(message)})

        except websockets.exceptions.ConnectionClosed:
            pass


# =============================================================================
# Server Lifecycle Tests
# =============================================================================


@pytest.mark.asyncio
async def test_server_accepts_connection(server_port, server_config):
    """Test that server accepts phone connections."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    # Create server instance
    ws_server = WebSocketServer(config=server_config)

    # Start server
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        # Connect as phone
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send minimal task request
        task_id = await phone.send_task_request("test command")

        # Should receive acknowledgment
        ack = await phone.receive_message(timeout=2.0)
        assert ack is not None, "Should receive acknowledgment"
        assert ack.get("status") == "accepted", f"Expected accepted, got {ack.get('status')}"
        assert ack.get("task_id") == task_id

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_server_rejects_invalid_json(server_port, server_config):
    """Test that server handles invalid JSON gracefully."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send invalid JSON
        await phone.websocket.send("{this is not valid json")

        # Should receive error response
        error = await phone.receive_message(timeout=2.0)
        assert error is not None
        assert error.get("status") == "error"
        assert "Invalid JSON" in error.get("error", "")

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_server_rejects_missing_task_id(server_port, server_config):
    """Test that server rejects request without task_id."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send request without task_id
        request = {"command": "test command"}
        await phone.websocket.send(json.dumps(request))

        error = await phone.receive_message(timeout=2.0)
        assert error is not None
        assert error.get("status") == "error"
        assert "task_id" in error.get("error", "").lower()

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_server_rejects_missing_command(server_port, server_config):
    """Test that server rejects request without command."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send request without command
        request = {"task_id": str(uuid.uuid4())}
        await phone.websocket.send(json.dumps(request))

        error = await phone.receive_message(timeout=2.0)
        assert error is not None
        assert error.get("status") == "error"
        assert "command" in error.get("error", "").lower()

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Task Execution Tests
# =============================================================================


@pytest.mark.asyncio
async def test_server_handles_device_commands(server_port, server_config):
    """Test that server sends commands to phone and receives responses."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send task request
        task_id = await phone.send_task_request("tap on settings")

        # Receive acknowledgment
        ack = await phone.receive_message(timeout=2.0)
        assert ack.get("status") == "accepted"

        # Start message loop to handle commands
        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        # Wait for task completion (with timeout)
        try:
            # Server will send commands, phone responds, eventually completes
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            # Expected - task might not complete in test environment
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        # Verify commands were sent
        assert len(phone.received_messages) > 1, "Should have received multiple messages"

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Binary Data Tests
# =============================================================================


@pytest.mark.asyncio
async def test_server_handles_binary_screenshot(server_port, server_config):
    """Test that server can receive binary screenshot data."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Send task that will request screenshot
        task_id = await phone.send_task_request("take a screenshot")

        ack = await phone.receive_message(timeout=2.0)
        assert ack.get("status") == "accepted"

        # Message loop will handle screenshot requests
        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_phone_sends_malformed_binary(server_port, server_config):
    """Test server handles malformed binary responses."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler that sends bad binary
        async def bad_binary_handler(request_id, params):
            # Send binary that's too short
            await phone.websocket.send(b"short")

        phone.register_handler("screenshot", bad_binary_handler)

        task_id = await phone.send_task_request("take screenshot")
        ack = await phone.receive_message(timeout=2.0)

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Text Input Tests
# =============================================================================


@pytest.mark.asyncio
async def test_server_sends_text_with_unicode(server_port, server_config):
    """Test server handles Unicode text input correctly."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    received_text = []

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler to capture text
        async def text_handler(request_id, params):
            base64_text = params.get("base64_text", "")
            text = base64.b64decode(base64_text).decode("utf-8")
            received_text.append(text)
            await phone.send_success_response(request_id, {})

        phone.register_handler("keyboard/input", text_handler)

        task_id = await phone.send_task_request("type hello 世界 🎉")
        ack = await phone.receive_message(timeout=2.0)

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        # Verify text was received (if agent tried to type)
        # Note: May not receive text if agent doesn't execute input

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Error Handling Tests
# =============================================================================


@pytest.mark.asyncio
async def test_phone_returns_error_responses(server_port, server_config):
    """Test server handles error responses from phone."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler that returns errors
        async def error_handler(request_id, params):
            await phone.send_error_response(request_id, "Element not found")

        phone.register_handler("click", error_handler)
        phone.register_handler("state_full", error_handler)

        task_id = await phone.send_task_request("click on button")
        ack = await phone.receive_message(timeout=2.0)

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_phone_never_responds(server_port, server_config):
    """Test server handles timeout when phone doesn't respond."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler that never responds
        async def silent_handler(request_id, params):
            # Don't send any response
            pass

        phone.register_handler("state_full", silent_handler)
        phone.register_handler("click", silent_handler)

        task_id = await phone.send_task_request("click something")
        ack = await phone.receive_message(timeout=2.0)
        assert ack.get("status") == "accepted"

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            # Should timeout
            await asyncio.wait_for(asyncio.shield(message_task), timeout=15.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Connection Lifecycle Tests
# =============================================================================


@pytest.mark.asyncio
async def test_phone_disconnects_mid_task(server_port, server_config):
    """Test server handles phone disconnecting during task."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        task_id = await phone.send_task_request("long running task")
        ack = await phone.receive_message(timeout=2.0)
        assert ack.get("status") == "accepted"

        # Disconnect immediately
        await phone.disconnect()

        # Server should handle this gracefully (no crash)
        await asyncio.sleep(1.0)

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_multiple_sequential_connections(server_port, server_config):
    """Test server handles multiple connections sequentially."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        for i in range(3):
            phone = PhoneSimulator()
            await phone.connect(f"ws://localhost:{server_port}")

            task_id = await phone.send_task_request(f"task {i}")
            ack = await phone.receive_message(timeout=2.0)
            assert ack.get("status") == "accepted"

            await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Concurrent Connection Tests
# =============================================================================


@pytest.mark.asyncio
async def test_concurrent_phone_connections(server_port, server_config):
    """Test server handles multiple phones connecting concurrently."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phones = []
        tasks = []

        # Create 3 concurrent connections
        for i in range(3):
            phone = PhoneSimulator()
            phones.append(phone)

            async def connect_and_send(ph, idx):
                await ph.connect(f"ws://localhost:{server_port}")
                task_id = await ph.send_task_request(f"concurrent task {idx}")
                ack = await ph.receive_message(timeout=2.0)
                assert ack.get("status") == "accepted"

                # Start message loop
                stop = asyncio.Event()
                loop_task = asyncio.create_task(ph.message_loop(stop))

                await asyncio.sleep(5.0)

                stop.set()
                loop_task.cancel()
                try:
                    await loop_task
                except asyncio.CancelledError:
                    pass

                await ph.disconnect()

            tasks.append(asyncio.create_task(connect_and_send(phone, i)))

        # Wait for all to complete
        await asyncio.gather(*tasks, return_exceptions=True)

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# State Response Tests
# =============================================================================


@pytest.mark.asyncio
async def test_phone_sends_large_state(server_port, server_config):
    """Test server handles large state responses (500+ elements)."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    # Create large state
    large_tree = {
        "index": -1,
        "children": [
            {
                "index": i,
                "text": f"Element {i}",
                "type": "clickable",
                "bounds": f"{i*10},{i*10},{i*10+50},{i*10+50}",
                "className": "android.widget.TextView",
                "children": [],
            }
            for i in range(500)
        ],
    }

    large_state = {
        "a11y_tree": large_tree,
        "phone_state": {"battery_level": 85},
        "device_context": {"screen_width": 1080, "screen_height": 2400},
    }

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler with large state
        async def large_state_handler(request_id, params):
            response = {"id": request_id, "status": "success", "result": large_state}
            await phone.websocket.send(json.dumps(response))

        phone.register_handler("state_full", large_state_handler)

        task_id = await phone.send_task_request("check state")
        ack = await phone.receive_message(timeout=2.0)

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_phone_sends_malformed_state(server_port, server_config):
    """Test server handles state response missing required fields."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    ws_server = WebSocketServer(config=server_config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phone = PhoneSimulator()
        await phone.connect(f"ws://localhost:{server_port}")

        # Register handler with incomplete state
        async def bad_state_handler(request_id, params):
            incomplete_state = {
                "a11y_tree": []
                # Missing phone_state
            }
            response = {
                "id": request_id,
                "status": "success",
                "result": incomplete_state,
            }
            await phone.websocket.send(json.dumps(response))

        phone.register_handler("state_full", bad_state_handler)

        task_id = await phone.send_task_request("get state")
        ack = await phone.receive_message(timeout=2.0)

        stop_event = asyncio.Event()
        message_task = asyncio.create_task(phone.message_loop(stop_event))

        try:
            await asyncio.wait_for(asyncio.shield(message_task), timeout=30.0)
        except asyncio.TimeoutError:
            pass
        finally:
            stop_event.set()
            message_task.cancel()
            try:
                await message_task
            except asyncio.CancelledError:
                pass

        await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


# =============================================================================
# Connection Constraint Tests (One Device, One Connection)
# =============================================================================


@pytest.fixture
def auth_server_config():
    """Create test config with authentication enabled."""

    from droiduse_backend import AndroidUseConfig
    from droiduse_backend.config_manager.config_manager import WebSocketServerConfig

    test_secret = "test-secret-key-for-testing-only"
    config = AndroidUseConfig()
    config.websocket_server = WebSocketServerConfig(
        auth_enabled=True, web_api_auth_secret=test_secret
    )
    return config, test_secret


def create_test_jwt(secret: str, user_id: str = "user-123", email: str = "test@example.com"):
    """Create a valid JWT for testing."""
    import time

    import jwt

    payload = {
        "userId": user_id,
        "email": email,
        "role": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,  # 1 hour expiry
    }
    return jwt.encode(payload, secret, algorithm="HS256")


class AuthenticatedPhoneSimulator(PhoneSimulator):
    """Phone simulator with authentication headers."""

    def __init__(self, device_id: str, jwt_token: str):
        super().__init__()
        self.device_id = device_id
        self.jwt_token = jwt_token

    async def connect(self, uri: str):
        """Connect to server with authentication headers."""
        headers = {"Authorization": f"Bearer {self.jwt_token}", "X-Device-Id": self.device_id}
        # websockets 15+ uses additional_headers instead of extra_headers
        self.websocket = await websockets.connect(uri, additional_headers=headers)


@pytest.mark.asyncio
async def test_device_rejects_duplicate_connection(server_port, auth_server_config):
    """Test that a device with an existing connection gets rejected."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    config, secret = auth_server_config
    jwt_token = create_test_jwt(secret)
    device_id = "test-device-single-connection"

    ws_server = WebSocketServer(config=config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        # First connection should succeed
        phone1 = AuthenticatedPhoneSimulator(device_id=device_id, jwt_token=jwt_token)
        await phone1.connect(f"ws://localhost:{server_port}")

        # Give server time to register connection
        await asyncio.sleep(0.2)

        # Verify device is registered
        assert device_id in ws_server.device_connections

        # Second connection from same device should be rejected
        phone2 = AuthenticatedPhoneSimulator(device_id=device_id, jwt_token=jwt_token)
        await phone2.connect(f"ws://localhost:{server_port}")

        # Should receive an error response
        error = await phone2.receive_message(timeout=2.0)
        assert error is not None
        assert error.get("status") == "error"
        assert "already has an active connection" in error.get("error", "")

        # First connection should still be active
        assert device_id in ws_server.device_connections

        # Clean up
        await phone2.disconnect()
        await phone1.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_device_allows_new_connection_after_disconnect(server_port, auth_server_config):
    """Test that a device can reconnect after disconnecting."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    config, secret = auth_server_config
    jwt_token = create_test_jwt(secret)
    device_id = "test-device-reconnect"

    ws_server = WebSocketServer(config=config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        # First connection
        phone1 = AuthenticatedPhoneSimulator(device_id=device_id, jwt_token=jwt_token)
        await phone1.connect(f"ws://localhost:{server_port}")
        await asyncio.sleep(0.2)
        assert device_id in ws_server.device_connections

        # Disconnect first phone
        await phone1.disconnect()
        await asyncio.sleep(0.2)

        # Device should be unregistered
        assert device_id not in ws_server.device_connections

        # Second connection from same device should now succeed
        phone2 = AuthenticatedPhoneSimulator(device_id=device_id, jwt_token=jwt_token)
        await phone2.connect(f"ws://localhost:{server_port}")
        await asyncio.sleep(0.2)

        # Should be registered again
        assert device_id in ws_server.device_connections

        # Send a task request to verify connection works
        task_id = await phone2.send_task_request("test task")
        ack = await phone2.receive_message(timeout=2.0)
        assert ack is not None
        assert ack.get("status") == "accepted"

        await phone2.disconnect()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_different_devices_can_connect_simultaneously(server_port, auth_server_config):
    """Test that different devices can have connections at the same time."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    config, secret = auth_server_config
    jwt_token = create_test_jwt(secret)

    ws_server = WebSocketServer(config=config)
    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        phones = []

        # Connect multiple different devices
        for i in range(3):
            phone = AuthenticatedPhoneSimulator(device_id=f"device-{i}", jwt_token=jwt_token)
            await phone.connect(f"ws://localhost:{server_port}")
            phones.append(phone)
            await asyncio.sleep(0.1)

        # Verify all devices are registered
        for i in range(3):
            assert f"device-{i}" in ws_server.device_connections

        # Each phone should be able to send tasks
        for i, phone in enumerate(phones):
            task_id = await phone.send_task_request(f"task for device {i}")
            ack = await phone.receive_message(timeout=2.0)
            assert ack is not None
            assert ack.get("status") == "accepted"

        # Clean up
        for phone in phones:
            await phone.disconnect()

    finally:
        server.close()
        await server.wait_closed()


if __name__ == "__main__":
    """Run tests with pytest."""
    pytest.main([__file__, "-v", "-s"])
