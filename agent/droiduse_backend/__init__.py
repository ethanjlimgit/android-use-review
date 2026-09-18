"""
DroidUse Backend - Backend service for device automation through LLM agents.
"""

__version__ = "0.5.0"

# Import main classes for easier access
from droiduse_backend.agent import ResultEvent
from droiduse_backend.agent.droid import DroidAgent
from droiduse_backend.agent.utils.llm_picker import load_llm

# Import configuration classes
from droiduse_backend.config_manager import (
    # Agent configs
    AgentConfig,
    AndroidUseConfig,
    AppCardConfig,
    CodeActConfig,
    CredentialsConfig,
    # Feature configs
    DeviceConfig,
    ExecutorConfig,
    LLMProfile,
    LoggingConfig,
    ManagerConfig,
    # Plugin configs
    PluginsConfig,
    SafeExecutionConfig,
    ScripterConfig,
    ToolsConfig,
    TracingPluginConfig,
)

# Import tools
from droiduse_backend.tools import IOSTools, Tools

# Make main components available at package level
__all__ = [
    # Agent
    "DroidAgent",
    "load_llm",
    "ResultEvent",
    # Tools
    "Tools",
    "IOSTools",
    # Configuration
    "AndroidUseConfig",
    "AgentConfig",
    "CodeActConfig",
    "ManagerConfig",
    "ExecutorConfig",
    "ScripterConfig",
    "AppCardConfig",
    "DeviceConfig",
    "LoggingConfig",
    "ToolsConfig",
    "CredentialsConfig",
    "SafeExecutionConfig",
    "LLMProfile",
    # Plugin configs
    "PluginsConfig",
    "TracingPluginConfig",
]

try:
    from droiduse_backend.tools import MobileRunTools  # noqa: F401

    __all__.append("MobileRunTools")
except ImportError:
    pass
