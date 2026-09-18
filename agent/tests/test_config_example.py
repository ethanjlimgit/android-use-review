"""
Tests to verify config_example.yaml is correctly configured.

This test ensures the example configuration file:
1. Loads without errors
2. Has valid structure
3. Uses the correct default LLM provider (Gemini)
"""

import pytest

from droiduse_backend.config_manager import AndroidUseConfig


class TestConfigExample:
    """Test cases for config_example.yaml validation."""

    def test_config_example_loads_successfully(self):
        """Test that config_example.yaml loads without errors."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify basic structure
        assert config is not None
        assert config.agent is not None
        assert config.llm_profiles is not None
        assert config.plugins is not None
        assert config.websocket_server is not None

    def test_config_example_agent_settings(self):
        """Test that agent settings are correctly configured."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify agent settings
        assert config.agent.max_steps == 30
        assert config.agent.max_time == 600.0
        assert config.agent.reasoning is False
        assert config.agent.streaming is True
        assert config.agent.after_sleep_action == 1.0
        assert config.agent.wait_for_stable_ui == 0.3

    def test_config_example_uses_gemini_provider(self):
        """Test that all agent LLM configs use Gemini provider."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify codeact uses Gemini
        assert config.agent.codeact.llm is not None
        assert config.agent.codeact.llm.provider == "Gemini"
        assert "gemini" in config.agent.codeact.llm.model.lower()

        # Verify manager uses Gemini
        assert config.agent.manager.llm is not None
        assert config.agent.manager.llm.provider == "Gemini"
        assert "gemini" in config.agent.manager.llm.model.lower()

        # Verify executor uses Gemini
        assert config.agent.executor.llm is not None
        assert config.agent.executor.llm.provider == "Gemini"
        assert "gemini" in config.agent.executor.llm.model.lower()

        # Verify scripter uses Gemini
        assert config.agent.scripter.llm is not None
        assert config.agent.scripter.llm.provider == "Gemini"
        assert "gemini" in config.agent.scripter.llm.model.lower()

        # Verify text_manipulator uses Gemini
        assert config.agent.text_manipulator.llm is not None
        assert config.agent.text_manipulator.llm.provider == "Gemini"
        assert "gemini" in config.agent.text_manipulator.llm.model.lower()

        # Verify app_opener uses Gemini
        assert config.agent.app_opener.llm is not None
        assert config.agent.app_opener.llm.provider == "Gemini"
        assert "gemini" in config.agent.app_opener.llm.model.lower()

        # Verify structured_output uses Gemini
        assert config.agent.structured_output.llm is not None
        assert config.agent.structured_output.llm.provider == "Gemini"
        assert "gemini" in config.agent.structured_output.llm.model.lower()

    def test_config_example_llm_profiles_populated(self):
        """Test that LLM profiles are populated from nested config."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Nested LLM configs should be extracted to llm_profiles
        expected_profiles = [
            "codeact",
            "manager",
            "executor",
            "scripter",
            "text_manipulator",
            "app_opener",
            "structured_output",
        ]

        for profile_name in expected_profiles:
            assert profile_name in config.llm_profiles, f"Missing profile: {profile_name}"
            profile = config.llm_profiles[profile_name]
            assert profile.provider == "Gemini", f"{profile_name} should use Gemini provider"
            assert "gemini" in profile.model.lower(), f"{profile_name} should use a Gemini model"

    def test_config_example_websocket_settings(self):
        """Test that websocket settings are correctly configured."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify websocket settings
        assert config.websocket_server.ping_interval == 20
        assert config.websocket_server.ping_timeout == 60
        assert config.websocket_server.close_timeout == 30
        assert config.websocket_server.max_message_size == 10 * 1024 * 1024
        assert config.websocket_server.auth_enabled is True

    def test_config_example_plugin_settings(self):
        """Test that plugin settings are correctly configured."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify plugin settings
        assert config.plugins.local_logging.enabled is True
        assert config.plugins.posthog_telemetry.enabled is False
        assert config.plugins.tracing.enabled is False
        assert config.plugins.trajectory.enabled is False
        assert config.plugins.memory_summary.enabled is True

    def test_config_example_safe_execution_settings(self):
        """Test that safe execution settings are correctly configured."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Verify safe execution settings
        assert config.safe_execution.allow_all_imports is True
        assert config.safe_execution.allow_all_builtins is True
        assert "os" in config.safe_execution.blocked_modules
        assert "subprocess" in config.safe_execution.blocked_modules
        assert "open" in config.safe_execution.blocked_builtins
        assert "exec" in config.safe_execution.blocked_builtins

    def test_config_example_to_dict_roundtrip(self):
        """Test that config can be serialized to dict and back."""
        config = AndroidUseConfig.from_yaml("droiduse_backend/config_example.yaml")

        # Convert to dict
        config_dict = config.to_dict()
        assert isinstance(config_dict, dict)

        # Verify key sections exist in dict
        assert "agent" in config_dict
        assert "llm_profiles" in config_dict
        assert "websocket_server" in config_dict
        assert "plugins" in config_dict


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
