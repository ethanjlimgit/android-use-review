"""
Tests for WebSocket server configuration.

Verifies that WebSocket configuration is at root level and loads correctly.
"""

import tempfile
from pathlib import Path

import pytest
import yaml

from droiduse_backend.config_manager import AndroidUseConfig


class TestWebSocketServerConfig:
    """Test cases for WebSocket server configuration."""

    def test_websocket_config_at_root_level(self):
        """Test that websocket_server config is at root level (not under device)."""
        config = AndroidUseConfig()

        # Verify websocket_server is accessible at root level
        assert hasattr(config, "websocket_server")
        assert config.websocket_server is not None

        # Verify device config does NOT have websocket_server
        assert not hasattr(config.device, "websocket_server")

    def test_websocket_config_defaults(self):
        """Test that websocket_server has correct default values."""
        config = AndroidUseConfig()

        # Check default values
        assert config.websocket_server.ping_interval == 20
        assert config.websocket_server.ping_timeout == 60
        assert config.websocket_server.close_timeout == 30
        assert config.websocket_server.max_message_size == 10 * 1024 * 1024  # 10MB
        assert config.websocket_server.initial_recv_timeout == 120.0

    def test_device_config_still_works(self):
        """Test that device config still works without websocket_server."""
        config = AndroidUseConfig()

        # Verify device config fields are accessible
        assert hasattr(config.device, "serial")
        assert hasattr(config.device, "use_tcp")
        assert hasattr(config.device, "platform")
        assert hasattr(config.device, "token")
        assert hasattr(config.device, "websocket_port")

        # Check default values
        assert config.device.serial is None
        assert config.device.use_tcp is False
        assert config.device.platform == "android"
        assert config.device.token is None
        assert config.device.websocket_port == 8081

    def test_websocket_config_in_yaml(self):
        """Test that websocket_server config loads from YAML file."""
        # This test loads the actual config.yaml file
        try:
            config = AndroidUseConfig.from_yaml("droiduse_backend/config.yaml")

            # Verify it loaded successfully
            assert config.websocket_server is not None
            assert config.websocket_server.ping_interval > 0
            assert config.websocket_server.ping_timeout > 0
            assert config.websocket_server.max_message_size > 0

        except FileNotFoundError:
            # If config.yaml doesn't exist, that's okay for this test
            pytest.skip("config.yaml not found")

    def test_websocket_server_initialization(self):
        """Test that WebSocketServer can access config from root level."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        server = WebSocketServer()

        # Verify server can access websocket_server config
        ws_config = server.config.websocket_server
        assert ws_config is not None
        assert ws_config.ping_interval > 0
        assert ws_config.ping_timeout > 0
        assert ws_config.close_timeout > 0
        assert ws_config.max_message_size > 0
        assert ws_config.initial_recv_timeout > 0

    def test_config_merging(self):
        """Test that config merging works correctly (base + override)."""
        # Create temporary base config
        base_config = {
            "agent": {"max_steps": 15, "reasoning": False, "streaming": True},
            "llm_profiles": {
                "manager": {
                    "provider": "Anthropic",
                    "model": "claude-sonnet-4-5",
                    "temperature": 0.2,
                }
            },
            "device": {"platform": "android", "serial": None},
        }

        # Create temporary override config (only changing specific values)
        override_config = {
            "agent": {"max_steps": 20},  # Override max_steps only
            "llm_profiles": {
                "manager": {"model": "claude-opus-4-5"}  # Override model only
            },
        }

        # Write configs to temporary files
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = Path(tmpdir) / "base.yaml"
            override_path = Path(tmpdir) / "override.yaml"

            with open(base_path, "w") as f:
                yaml.dump(base_config, f)

            with open(override_path, "w") as f:
                yaml.dump(override_config, f)

            # Load merged config
            merged = AndroidUseConfig.from_yaml_with_base(str(base_path), str(override_path))

            # Verify merged values
            assert merged.agent.max_steps == 20  # From override
            assert merged.agent.reasoning is False  # From base (preserved)
            assert merged.agent.streaming is True  # From base (preserved)

            # Verify LLM profile merging
            manager_profile = merged.llm_profiles["manager"]
            assert manager_profile.model == "claude-opus-4-5"  # From override
            assert manager_profile.provider == "Anthropic"  # From base (preserved)
            assert manager_profile.temperature == 0.2  # From base (preserved)

            # Verify device config is preserved
            assert merged.device.platform == "android"  # From base (preserved)

    def test_config_merging_nested_dicts(self):
        """Test that nested dictionary merging works correctly."""
        base_config = {
            "websocket_server": {
                "ping_interval": 20,
                "ping_timeout": 60,
                "close_timeout": 30,
                "auth_enabled": True,
            }
        }

        override_config = {
            "websocket_server": {
                "ping_interval": 30,  # Override only ping_interval
            }
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = Path(tmpdir) / "base.yaml"
            override_path = Path(tmpdir) / "override.yaml"

            with open(base_path, "w") as f:
                yaml.dump(base_config, f)

            with open(override_path, "w") as f:
                yaml.dump(override_config, f)

            merged = AndroidUseConfig.from_yaml_with_base(str(base_path), str(override_path))

            # Verify ping_interval was overridden
            assert merged.websocket_server.ping_interval == 30

            # Verify other values were preserved
            assert merged.websocket_server.ping_timeout == 60
            assert merged.websocket_server.close_timeout == 30
            assert merged.websocket_server.auth_enabled is True

    def test_websocket_server_with_override_config(self):
        """Test that WebSocketServer can load with override config."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        # Create a simple override config
        override_config = {"agent": {"max_steps": 25}}

        with tempfile.TemporaryDirectory() as tmpdir:
            override_path = Path(tmpdir) / "override.yaml"

            with open(override_path, "w") as f:
                yaml.dump(override_config, f)

            # Initialize server with override config
            # Note: This may fail if base config.yaml doesn't exist, which is okay
            try:
                server = WebSocketServer(override_config_path=str(override_path))
                # If base config exists and was merged, verify the override worked
                if server.config:
                    assert server.config.agent.max_steps == 25
            except FileNotFoundError:
                # If base config doesn't exist, that's okay for this test
                pytest.skip("base config.yaml not found")

    def test_task_limits_validation(self):
        """Test that task request limits are validated against server config limits."""
        from droiduse_backend.api.websocket_server import WebSocketServer

        # Create server with specific limits
        config = AndroidUseConfig()
        config.agent.max_steps = 20
        config.agent.max_time = 300.0

        server = WebSocketServer(config=config)

        # Test valid config (within limits)
        valid_config = {"agent": {"max_steps": 15, "max_time": 200.0}}
        is_valid, error = server._validate_task_limits(valid_config)
        assert is_valid is True
        assert error is None

        # Test invalid max_steps (exceeds limit)
        invalid_steps = {"agent": {"max_steps": 25}}
        is_valid, error = server._validate_task_limits(invalid_steps)
        assert is_valid is False
        assert "max_steps" in error
        assert "exceeds server limit" in error

        # Test invalid max_time (exceeds limit)
        invalid_time = {"agent": {"max_time": 400.0}}
        is_valid, error = server._validate_task_limits(invalid_time)
        assert is_valid is False
        assert "max_time" in error
        assert "exceeds server limit" in error

        # Test None config (should be valid)
        is_valid, error = server._validate_task_limits(None)
        assert is_valid is True
        assert error is None

        # Test empty config (should be valid)
        is_valid, error = server._validate_task_limits({})
        assert is_valid is True
        assert error is None

        # Test config with other fields (should be valid)
        other_config = {"agent": {"reasoning": True, "streaming": False}}
        is_valid, error = server._validate_task_limits(other_config)
        assert is_valid is True
        assert error is None

    def test_max_time_config_defaults(self):
        """Test that max_time config has correct default value."""
        config = AndroidUseConfig()

        # Check default value
        assert config.agent.max_time == 600.0  # 10 minutes

    def test_max_time_config_from_dict(self):
        """Test that max_time can be loaded from dictionary."""
        config_dict = {"agent": {"max_time": 120.0}}
        config = AndroidUseConfig.from_dict(config_dict)

        assert config.agent.max_time == 120.0

    def test_max_time_config_from_yaml(self):
        """Test that max_time can be loaded from YAML file."""
        yaml_content = {"agent": {"max_steps": 15, "max_time": 180.0}}

        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"

            with open(config_path, "w") as f:
                yaml.dump(yaml_content, f)

            config = AndroidUseConfig.from_yaml(str(config_path))

            assert config.agent.max_steps == 15
            assert config.agent.max_time == 180.0


if __name__ == "__main__":
    """Run tests with pytest."""
    pytest.main([__file__, "-v"])
