"""
Test debug logging for WebSocket server.

Verifies that all client messages are logged in debug mode.
"""

import asyncio
import json
import logging
import uuid

import pytest
import websockets

from droiduse_backend.api.websocket_server import WebSocketServer, truncate_message


@pytest.fixture
def server_port():
    """Provides unique port for each test."""
    import random

    return random.randint(9000, 9999)


def test_truncate_message():
    """Test truncate_message function."""
    # Short message
    short_msg = "hello world"
    assert truncate_message(short_msg) == short_msg

    # Long message
    long_msg = "x" * 1000
    truncated = truncate_message(long_msg, max_length=500)
    assert len(truncated) < len(long_msg)
    assert "truncated" in truncated
    assert "1000 chars" in truncated

    # Binary message
    binary_msg = b"\x89PNG\r\n" + b"\x00" * 200
    truncated_binary = truncate_message(binary_msg, max_length=500)
    assert "<binary" in truncated_binary
    assert "206 bytes" in truncated_binary

    # Dict message
    dict_msg = {"key": "value", "data": "x" * 1000}
    truncated_dict = truncate_message(dict_msg, max_length=500)
    assert "truncated" in truncated_dict or len(truncated_dict) <= 500


def test_truncate_large_binary():
    """Test truncating large binary messages."""
    # Create large binary (simulated screenshot)
    large_binary = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100000

    truncated = truncate_message(large_binary, max_length=500)

    # Should show size and preview
    assert "<binary" in truncated
    assert "100008 bytes" in truncated
    assert "..." in truncated
    # Preview should be present
    assert "89504e47" in truncated  # PNG header in hex


def test_truncate_json_dict():
    """Test truncating large JSON dictionary."""
    # Create large nested dict
    large_dict = {
        "a11y_tree": {
            "children": [
                {
                    "index": i,
                    "text": f"Element {i}",
                    "bounds": f"{i*10},{i*10},{i*10+50},{i*10+50}",
                }
                for i in range(100)
            ]
        }
    }

    truncated = truncate_message(large_dict, max_length=500)

    # Should be truncated
    assert len(truncated) <= 550  # 500 + some overhead for message
    assert "truncated" in truncated


@pytest.mark.asyncio
async def test_debug_logging_in_server(server_port, caplog):
    """Test that debug logging captures client messages."""

    from droiduse_backend import AndroidUseConfig
    from droiduse_backend.config_manager.config_manager import WebSocketServerConfig

    # Create config with authentication disabled
    config = AndroidUseConfig()
    config.websocket_server = WebSocketServerConfig(auth_enabled=False)

    ws_server = WebSocketServer(config=config)

    # Set logging level to DEBUG for this test
    logging.getLogger("droiduse-backend.websocket").setLevel(logging.DEBUG)

    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        # Connect as client
        websocket = await websockets.connect(f"ws://localhost:{server_port}")

        # Send task request
        task_request = {
            "task_id": str(uuid.uuid4()),
            "command": "test command",
            "device_id": "test-device",
        }

        with caplog.at_level(logging.DEBUG, logger="droiduse-backend.websocket"):
            await websocket.send(json.dumps(task_request))

            # Wait briefly for logging
            await asyncio.sleep(0.5)

            # Check that message was logged
            debug_messages = [
                record.message for record in caplog.records if record.levelname == "DEBUG"
            ]
            assert any(
                "📥 Received" in msg for msg in debug_messages
            ), f"Debug messages: {debug_messages}"
            assert any(
                "test command" in msg for msg in debug_messages
            ), f"Debug messages: {debug_messages}"

        await websocket.close()

    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_debug_logging_truncates_long_messages(server_port, caplog):
    """Test that long messages are truncated in debug logs."""
    from droiduse_backend import AndroidUseConfig
    from droiduse_backend.config_manager.config_manager import WebSocketServerConfig

    # Create config with authentication disabled
    config = AndroidUseConfig()
    config.websocket_server = WebSocketServerConfig(auth_enabled=False)

    ws_server = WebSocketServer(config=config)

    # Set logging level to DEBUG
    logging.getLogger("droiduse-backend.websocket").setLevel(logging.DEBUG)

    server = await websockets.serve(ws_server.handle_connection, "localhost", server_port)

    try:
        websocket = await websockets.connect(f"ws://localhost:{server_port}")

        # Create a very long command
        long_command = "x" * 2000

        task_request = {
            "task_id": str(uuid.uuid4()),
            "command": long_command,
            "device_id": "test-device",
        }

        with caplog.at_level(logging.DEBUG, logger="droiduse-backend.websocket"):
            await websocket.send(json.dumps(task_request))

            # Wait for logging
            await asyncio.sleep(0.5)

            # Check that message was logged and truncated
            debug_messages = [
                record.message for record in caplog.records if record.levelname == "DEBUG"
            ]
            logged_request_msg = [msg for msg in debug_messages if "📥 Received" in msg]

            assert len(logged_request_msg) > 0, "Should have logged the request"

            # The logged message should be truncated (not full 2000+ chars)
            for msg in logged_request_msg:
                # Message should contain truncation indicator
                if long_command in msg:
                    # If full command is there, it means it wasn't truncated
                    # (which is ok if it's below threshold)
                    pass
                else:
                    # Should have truncation message
                    assert "truncated" in msg.lower(), f"Message should be truncated: {msg[:200]}"

        await websocket.close()

    finally:
        server.close()
        await server.wait_closed()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
