"""
Tests for WebSocket Server Authentication.

Tests JWT token and X-Device-Id header validation on WebSocket connections.
"""

import asyncio
import json
import time
import uuid

import jwt
import pytest
import websockets


@pytest.fixture
def auth_secret():
    """Generate a test web_api_auth_secret."""
    return "test-secret-key-for-jwt-testing-12345"


@pytest.fixture
def server_config(auth_secret):
    """Create a test config with auth_secret set."""
    from droiduse_backend import AndroidUseConfig
    from droiduse_backend.config_manager.config_manager import WebSocketServerConfig

    config = AndroidUseConfig()
    config.websocket_server = WebSocketServerConfig(web_api_auth_secret=auth_secret)
    return config


@pytest.fixture
def server_port():
    """Provides unique port for each test."""
    import random

    return random.randint(9000, 9999)


@pytest.fixture
def valid_jwt_token(auth_secret):
    """Generate a valid JWT token for testing."""
    payload = {
        "userId": "user-123",
        "email": "test@example.com",
        "role": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,  # Valid for 1 hour
    }
    return jwt.encode(payload, auth_secret, algorithm="HS256")


@pytest.fixture
def expired_jwt_token(auth_secret):
    """Generate an expired JWT token for testing."""
    payload = {
        "userId": "user-123",
        "email": "test@example.com",
        "role": "user",
        "iat": int(time.time()) - 7200,  # Issued 2 hours ago
        "exp": int(time.time()) - 3600,  # Expired 1 hour ago
    }
    return jwt.encode(payload, auth_secret, algorithm="HS256")


class TestWebSocketAuthentication:
    """Test cases for WebSocket authentication."""

    @pytest.mark.asyncio
    async def test_connection_with_valid_auth(self, server_port, valid_jwt_token, server_config):
        """Test that connection succeeds with valid JWT token and device ID."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            # Connect with authentication headers
            additional_headers = {
                "Authorization": f"Bearer {valid_jwt_token}",
                "X-Device-Id": "test-device-123",
            }

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Send task request
                request = {
                    "task_id": str(uuid.uuid4()),
                    "command": "test command",
                    "device_id": "test-device-123",
                }
                await websocket.send(json.dumps(request))

                # Should receive acknowledgment
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "accepted", f"Expected accepted, got {data}"

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_connection_without_auth_header(self, server_port):
        """Test that connection fails without Authorization header."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer()
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            # Connect without authentication headers
            async with websockets.connect(f"ws://localhost:{server_port}") as websocket:
                # Should receive error response
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "error"
                assert "Authentication failed" in data.get("error", "")

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_connection_without_device_id(self, server_port, valid_jwt_token, server_config):
        """Test that connection fails without X-Device-Id header."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            # Connect with token but no device ID
            additional_headers = {"Authorization": f"Bearer {valid_jwt_token}"}

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Should receive error response
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "error"
                assert "Authentication failed" in data.get("error", "")

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_connection_with_expired_token(
        self, server_port, expired_jwt_token, server_config
    ):
        """Test that connection fails with expired JWT token."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            additional_headers = {
                "Authorization": f"Bearer {expired_jwt_token}",
                "X-Device-Id": "test-device-123",
            }

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Should receive error response
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "error"
                assert "Authentication failed" in data.get("error", "")

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_connection_with_invalid_bearer_format(self, server_port, server_config):
        """Test that connection fails with invalid Authorization header format."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            # Connect with invalid Bearer format
            additional_headers = {
                "Authorization": "InvalidFormat token123",
                "X-Device-Id": "test-device-123",
            }

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Should receive error response
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "error"
                assert "Authentication failed" in data.get("error", "")

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_device_id_from_header_when_not_in_request(
        self, server_port, valid_jwt_token, server_config
    ):
        """Test that device_id from header is used when not provided in request."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            additional_headers = {
                "Authorization": f"Bearer {valid_jwt_token}",
                "X-Device-Id": "test-device-123",
            }

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Send request without device_id
                request = {
                    "task_id": str(uuid.uuid4()),
                    "command": "test command",
                    # No device_id field
                }
                await websocket.send(json.dumps(request))

                # Should receive acknowledgment (device_id taken from header)
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "accepted", f"Expected accepted, got {data}"

        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_connection_with_invalid_jwt_signature(self, server_port, server_config):
        """Test that connection fails with token signed with wrong secret."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        # Create token with wrong secret
        wrong_secret = "wrong-secret-key"
        payload = {
            "userId": "user-123",
            "email": "test@example.com",
            "role": "user",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        invalid_token = jwt.encode(payload, wrong_secret, algorithm="HS256")

        ws_server = WebSocketServer(config=server_config)
        server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

        try:
            additional_headers = {
                "Authorization": f"Bearer {invalid_token}",
                "X-Device-Id": "test-device-123",
            }

            async with websockets.connect(
                f"ws://localhost:{server_port}",
                additional_headers=additional_headers,
            ) as websocket:
                # Should receive error response
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)

                assert data.get("status") == "error"
                assert "Authentication failed" in data.get("error", "")

        finally:
            server.close()
            await server.wait_closed()


if __name__ == "__main__":
    """Run tests with pytest."""
    pytest.main([__file__, "-v", "-s"])
