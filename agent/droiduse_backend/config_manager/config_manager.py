from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

import yaml

from droiduse_backend.config_manager.path_resolver import PathResolver
from droiduse_backend.config_manager.safe_execution import SafeExecutionConfig

# Try to load dotenv for .env file support
try:
    from dotenv import load_dotenv

    _DOTENV_AVAILABLE = True
except ImportError:
    _DOTENV_AVAILABLE = False


# ---------- Config Schema ----------
@dataclass
class LLMProfile:
    """LLM profile configuration."""

    provider: str = "GoogleGenAI"
    model: str = "models/gemini-2.0-flash-exp"
    temperature: float = 0.2
    base_url: Optional[str] = None
    api_base: Optional[str] = None
    kwargs: Dict[str, Any] = field(default_factory=dict)

    def to_load_llm_kwargs(self) -> Dict[str, Any]:
        """Convert profile to kwargs for load_llm function."""
        result = {
            "model": self.model,
            "temperature": self.temperature,
        }
        # Add optional URL parameters
        if self.base_url:
            result["base_url"] = self.base_url
        if self.api_base:
            result["api_base"] = self.api_base
        # Merge additional kwargs
        result.update(self.kwargs)
        return result


@dataclass
class CodeActConfig:
    """CodeAct agent configuration."""

    vision: bool = False
    system_prompt: str = "system.jinja2"
    user_prompt: str = "user.jinja2"
    safe_execution: bool = False
    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class ManagerConfig:
    """Manager agent configuration."""

    vision: bool = False
    system_prompt: str = "system.jinja2"
    stateless: bool = False  # Use stateless manager (no chat history)
    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class ExecutorConfig:
    """Executor agent configuration."""

    vision: bool = False
    system_prompt: str = "system.jinja2"
    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class ScripterConfig:
    """Scripter agent configuration."""

    enabled: bool = True
    max_steps: int = 10
    execution_timeout: float = 30.0
    system_prompt_path: str = "system.jinja2"
    safe_execution: bool = False
    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class TextManipulatorConfig:
    """Text manipulator agent configuration."""

    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class AppOpenerConfig:
    """App opener agent configuration."""

    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class StructuredOutputConfig:
    """Structured output agent configuration."""

    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class SuggesterConfig:
    """Task suggester agent configuration."""

    llm: Optional[LLMProfile] = None  # Nested LLM config
    max_suggestions: int = 5  # Maximum suggestions to return


@dataclass
class AutoGLMConfig:
    """AutoGLM external agent configuration."""

    enabled: bool = False  # Enable AutoGLM agent
    lang: str = "cn"  # "cn" (Chinese with 18 rules) or "en" (English with minimal rules)
    stream: bool = True  # Enable streaming responses
    llm: Optional[LLMProfile] = None  # Nested LLM config


@dataclass
class AppCardConfig:
    """App card configuration."""

    enabled: bool = True
    mode: str = "local"  # local | server | composite | database
    app_cards_dir: str = "config/app_cards"
    server_url: Optional[str] = None
    server_timeout: float = 2.0
    server_max_retries: int = 2


@dataclass
class AgentConfig:
    """Agent-related configuration."""

    name: str = "droiduse"  # "droiduse" for native agents, or external agent name (e.g. "autoglm")
    max_steps: int = 15
    max_time: float = 600.0  # Maximum execution time in seconds (default: 10 minutes)
    per_step_timeout: float = 20.0  # Timeout per manager/executor step in seconds
    reasoning: bool = False
    streaming: bool = True
    after_sleep_action: float = 1.0
    wait_for_stable_ui: float = 0.3
    prompts_dir: str = "config/prompts"
    use_semantic_actions: bool = False  # True = semantic element selection, False = index-based

    codeact: CodeActConfig = field(default_factory=CodeActConfig)
    manager: ManagerConfig = field(default_factory=ManagerConfig)
    executor: ExecutorConfig = field(default_factory=ExecutorConfig)
    scripter: ScripterConfig = field(default_factory=ScripterConfig)
    text_manipulator: TextManipulatorConfig = field(default_factory=TextManipulatorConfig)
    app_opener: AppOpenerConfig = field(default_factory=AppOpenerConfig)
    structured_output: StructuredOutputConfig = field(default_factory=StructuredOutputConfig)
    suggester: SuggesterConfig = field(default_factory=SuggesterConfig)
    autoglm: AutoGLMConfig = field(default_factory=AutoGLMConfig)
    app_cards: AppCardConfig = field(default_factory=AppCardConfig)

    def get_codeact_system_prompt_path(self) -> str:
        """Get resolved absolute path to CodeAct system prompt."""
        if self.use_semantic_actions:
            path = f"{self.prompts_dir}/codeact/system_semantic.jinja2"
        else:
            path = f"{self.prompts_dir}/codeact/{self.codeact.system_prompt}"
        return str(PathResolver.resolve(path, must_exist=True))

    def get_codeact_user_prompt_path(self) -> str:
        """Get resolved absolute path to CodeAct user prompt."""
        path = f"{self.prompts_dir}/codeact/{self.codeact.user_prompt}"
        return str(PathResolver.resolve(path, must_exist=True))

    def get_manager_system_prompt_path(self) -> str:
        """Get resolved absolute path to Manager system prompt."""
        if self.use_semantic_actions:
            path = f"{self.prompts_dir}/manager/system_semantic.jinja2"
        else:
            path = f"{self.prompts_dir}/manager/{self.manager.system_prompt}"
        return str(PathResolver.resolve(path, must_exist=True))

    def get_executor_system_prompt_path(self) -> str:
        """Get resolved absolute path to Executor system prompt."""
        if self.use_semantic_actions:
            path = f"{self.prompts_dir}/executor/system_semantic.jinja2"
        else:
            path = f"{self.prompts_dir}/executor/{self.executor.system_prompt}"
        return str(PathResolver.resolve(path, must_exist=True))

    def get_scripter_system_prompt_path(self) -> str:
        """Get resolved absolute path to Scripter system prompt."""
        path = f"{self.prompts_dir}/scripter/{self.scripter.system_prompt_path}"
        return str(PathResolver.resolve(path, must_exist=True))


@dataclass
class WebSocketServerConfig:
    """WebSocket server configuration for cellular-friendly connections."""

    ping_interval: int = 20  # Send ping every N seconds (keep-alive)
    ping_timeout: int = 60  # Wait N seconds for pong response
    close_timeout: int = 30  # Wait N seconds for close handshake
    max_message_size: int = 10 * 1024 * 1024  # Max message size in bytes (10MB)
    initial_recv_timeout: float = 120.0  # Timeout for initial message recv (seconds)
    auth_enabled: bool = True  # Enable/disable JWT authentication validation
    app_card_server_enabled: bool = False  # Enable/disable app card HTTP server
    app_card_server_port: int = 8001  # Port for app card HTTP server
    web_api_url: str = "http://localhost:3000/api"  # Web API server URL for HTTP logging
    web_api_auth_secret: str = (
        ""  # Service-level token for web API (fallback when user token unavailable)
    )
    # Server metadata for heartbeat reporting
    public_ip_address: str = ""  # Public IP address (auto-detected if empty)
    server_name: str = ""  # Server name (e.g., "agent-prod-1")
    server_region: str = "unknown"  # Server region (e.g., "us-east")
    server_capacity: int = 10  # Maximum concurrent connections/tasks


@dataclass
class HeartbeatServerConfig:
    """Heartbeat server configuration for reporting server status to control plane."""

    enabled: bool = False  # Enable/disable heartbeat reporting
    heartbeat_api_url: str = (
        ""  # API endpoint to send heartbeats (e.g., "http://control-plane.example.com")
    )
    heartbeat_interval: int = 30  # Send heartbeat every N seconds


@dataclass
class DeviceConfig:
    """Device-related configuration."""

    serial: Optional[str] = None
    use_tcp: bool = False
    platform: str = "android"  # "android" or "ios"
    token: Optional[str] = None  # Bearer token for Portal authentication
    websocket_port: int = 8081  # WebSocket server port (default: 8081, HTTP is 8080)


@dataclass
class LoggingConfig:
    """Logging configuration."""

    debug: bool = False
    rich_text: bool = False


@dataclass
class ToolsConfig:
    """Tools configuration."""

    disabled_tools: List[str] = field(default_factory=list)


@dataclass
class CredentialsConfig:
    """Credentials configuration."""

    enabled: bool = False
    file_path: str = "config/credentials.yaml"


@dataclass
class ApiKeysConfig:
    """API keys configuration for LLM providers."""

    # LLM Provider API keys
    google_api_key: str = ""  # GOOGLE_API_KEY
    openai_api_key: str = ""  # OPENAI_API_KEY
    anthropic_api_key: str = ""  # ANTHROPIC_API_KEY
    deepseek_api_key: str = ""  # DEEPSEEK_API_KEY
    groq_api_key: str = ""  # GROQ_API_KEY

    def __post_init__(self):
        """Load API keys from environment variables if not set in config."""
        if not self.google_api_key:
            self.google_api_key = os.getenv("GOOGLE_API_KEY", "")
        if not self.openai_api_key:
            self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        if not self.anthropic_api_key:
            self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not self.deepseek_api_key:
            self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
        if not self.groq_api_key:
            self.groq_api_key = os.getenv("GROQ_API_KEY", "")

    def get_llm_api_key(self, provider_name: str) -> Optional[str]:
        """
        Get API key for an LLM provider.

        Args:
            provider_name: Provider name (e.g., "GoogleGenAI", "OpenAI")

        Returns:
            API key string or None if not set
        """
        key_map = {
            "GoogleGenAI": self.google_api_key,
            "Gemini": self.google_api_key,
            "OpenAI": self.openai_api_key,
            "OpenAILike": self.openai_api_key,
            "Anthropic": self.anthropic_api_key,
            "DeepSeek": self.deepseek_api_key,
            "Groq": self.groq_api_key,
        }
        api_key = key_map.get(provider_name, "")
        # Return None if empty string or None, otherwise return the key
        if not api_key or api_key.strip() == "":
            return None
        return api_key


# ---------- Plugin Configs ----------
@dataclass
class LocalLoggingPluginConfig:
    """Local logging plugin configuration."""

    enabled: bool = True


@dataclass
class PostHogPluginConfig:
    """PostHog telemetry plugin configuration."""

    enabled: bool = True
    api_key: str = ""  # POSTHOG_API_KEY
    host: str = ""  # POSTHOG_HOST

    def __post_init__(self):
        """Load PostHog settings from environment if not set."""
        if not self.api_key:
            self.api_key = os.getenv("POSTHOG_API_KEY", "")
        if not self.host:
            self.host = os.getenv("POSTHOG_HOST", "")


@dataclass
class TracingPluginConfig:
    """Tracing plugin configuration (Langfuse/Phoenix)."""

    enabled: bool = False
    provider: str = "langfuse"  # langfuse or phoenix
    screenshots_enabled: bool = False
    langfuse_secret_key: str = ""  # LANGFUSE_SECRET_KEY
    langfuse_public_key: str = ""  # LANGFUSE_PUBLIC_KEY
    langfuse_host: str = ""  # LANGFUSE_HOST
    langfuse_screenshots: bool = False
    langfuse_user_id: str = "anonymous"
    langfuse_session_id: str = ""  # Empty = auto-generate UUID

    def __post_init__(self):
        """Load Langfuse settings from environment if not set."""
        if not self.langfuse_secret_key:
            self.langfuse_secret_key = os.getenv("LANGFUSE_SECRET_KEY", "")
        if not self.langfuse_public_key:
            self.langfuse_public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "")
        if not self.langfuse_host:
            self.langfuse_host = os.getenv("LANGFUSE_HOST", "")


@dataclass
class TrajectoryPluginConfig:
    """Trajectory plugin configuration."""

    enabled: bool = True
    save_trajectory: str = "none"  # "none" | "step" | "action"
    trajectory_path: str = "trajectories"
    queue_size: int = 300
    create_gifs: bool = True


@dataclass
class MemorySummaryPluginConfig:
    """Memory summary plugin configuration for saving task summaries as user long-term memory."""

    enabled: bool = True
    max_task_summaries: int = 50  # Maximum task summaries to keep per user


@dataclass
class TranscriptionConfig:
    """Configuration for real-time transcription using ElevenLabs Scribe v2."""

    enabled: bool = False
    elevenlabs_api_key: str = ""  # Falls back to ELEVENLABS_API_KEY env var
    default_language: str = ""  # Auto-detect if empty
    vad_silence_threshold: float = (
        1.0  # Voice activity detection silence threshold (0.5-1.5 seconds)
    )
    max_session_duration: int = 300  # Maximum session duration in seconds (5 minutes)
    model_id: str = "scribe_v2_realtime"  # ElevenLabs model ID
    play_audio: bool = False  # Play received audio on server (for debugging)

    def __post_init__(self):
        """Load API key from environment variable if not set in config."""
        if not self.elevenlabs_api_key:
            self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")

    def is_configured(self) -> bool:
        """Check if transcription is properly configured."""
        return self.enabled and bool(self.elevenlabs_api_key)


@dataclass
class TaskMemoryConfig:
    """Task memory replay configuration."""

    enabled: bool = True


@dataclass
class PluginsConfig:
    """Configuration for all plugins."""

    local_logging: LocalLoggingPluginConfig = field(default_factory=LocalLoggingPluginConfig)
    posthog_telemetry: PostHogPluginConfig = field(default_factory=PostHogPluginConfig)
    tracing: TracingPluginConfig = field(default_factory=TracingPluginConfig)
    trajectory: TrajectoryPluginConfig = field(default_factory=TrajectoryPluginConfig)
    memory_summary: MemorySummaryPluginConfig = field(default_factory=MemorySummaryPluginConfig)
    task_memory: TaskMemoryConfig = field(default_factory=TaskMemoryConfig)


@dataclass
class AndroidUseConfig:
    """Complete AndroidUse configuration schema."""

    agent: AgentConfig = field(default_factory=AgentConfig)
    llm_profiles: Dict[str, LLMProfile] = field(default_factory=dict)
    device: DeviceConfig = field(default_factory=DeviceConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    tools: ToolsConfig = field(default_factory=ToolsConfig)
    credentials: CredentialsConfig = field(default_factory=CredentialsConfig)
    safe_execution: SafeExecutionConfig = field(default_factory=SafeExecutionConfig)
    api_keys: ApiKeysConfig = field(default_factory=ApiKeysConfig)
    plugins: PluginsConfig = field(default_factory=PluginsConfig)
    websocket_server: WebSocketServerConfig = field(default_factory=WebSocketServerConfig)
    heartbeat_server: HeartbeatServerConfig = field(default_factory=HeartbeatServerConfig)
    transcription: TranscriptionConfig = field(default_factory=TranscriptionConfig)
    external_agents: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def __post_init__(self):
        """Ensure default profiles exist."""
        if not self.llm_profiles:
            self.llm_profiles = self._default_profiles()

    @staticmethod
    def _default_profiles() -> Dict[str, LLMProfile]:
        """Get default agent specific LLM profiles."""
        return {
            "manager": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.2,
                kwargs={},
            ),
            "executor": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.1,
                kwargs={},
            ),
            "codeact": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.2,
                kwargs={},
            ),
            "text_manipulator": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.3,
                kwargs={},
            ),
            "app_opener": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.0,
                kwargs={},
            ),
            "scripter": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.1,
                kwargs={},
            ),
            "structured_output": LLMProfile(
                provider="Gemini",
                model="gemini-3-flash-preview",
                temperature=0.0,
                kwargs={},
            ),
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary."""
        result = asdict(self)
        # Convert LLMProfile objects to dicts
        result["llm_profiles"] = {
            name: asdict(profile) for name, profile in self.llm_profiles.items()
        }
        # safe_execution and api_keys are already converted by asdict
        return result

    @staticmethod
    def _parse_llm_profile(data: Dict[str, Any]) -> Optional[LLMProfile]:
        """Parse LLM profile from dict, returns None if no llm key."""
        llm_data = data.get("llm")
        if llm_data:
            return LLMProfile(**llm_data)
        return None

    @staticmethod
    def _parse_agent_config_with_llm(
        data: Dict[str, Any],
        config_class: type,
        llm_key: str = "llm",
    ) -> Any:
        """Parse agent config, extracting llm separately."""
        if not data:
            return config_class()

        # Extract llm data separately
        llm_data = data.pop(llm_key, None)
        llm_profile = LLMProfile(**llm_data) if llm_data else None

        # Create config with remaining data
        config = config_class(**data, llm=llm_profile)
        return config

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AndroidUseConfig":
        """Create config from dictionary.

        Supports both nested LLM config (agent.codeact.llm) and
        legacy llm_profiles section. Nested config takes precedence.
        """
        # Start with legacy llm_profiles if present
        llm_profiles = {}
        for name, profile_data in data.get("llm_profiles", {}).items():
            llm_profiles[name] = LLMProfile(**profile_data)

        # Parse agent config with sub-configs
        agent_data = data.get("agent", {})

        # Parse each agent sub-config, extracting nested LLM profiles
        # Make copies to avoid modifying original data
        codeact_data = dict(agent_data.get("codeact", {}))
        codeact_llm = codeact_data.pop("llm", None)
        codeact_config = (
            CodeActConfig(**codeact_data, llm=LLMProfile(**codeact_llm) if codeact_llm else None)
            if codeact_data or codeact_llm
            else CodeActConfig()
        )
        if codeact_llm:
            llm_profiles["codeact"] = LLMProfile(**codeact_llm)

        manager_data = dict(agent_data.get("manager", {}))
        manager_llm = manager_data.pop("llm", None)
        manager_config = (
            ManagerConfig(**manager_data, llm=LLMProfile(**manager_llm) if manager_llm else None)
            if manager_data or manager_llm
            else ManagerConfig()
        )
        if manager_llm:
            llm_profiles["manager"] = LLMProfile(**manager_llm)

        executor_data = dict(agent_data.get("executor", {}))
        executor_llm = executor_data.pop("llm", None)
        executor_config = (
            ExecutorConfig(
                **executor_data,
                llm=LLMProfile(**executor_llm) if executor_llm else None,
            )
            if executor_data or executor_llm
            else ExecutorConfig()
        )
        if executor_llm:
            llm_profiles["executor"] = LLMProfile(**executor_llm)

        scripter_data = dict(agent_data.get("scripter", {}))
        scripter_llm = scripter_data.pop("llm", None)
        scripter_config = (
            ScripterConfig(
                **scripter_data,
                llm=LLMProfile(**scripter_llm) if scripter_llm else None,
            )
            if scripter_data or scripter_llm
            else ScripterConfig()
        )
        if scripter_llm:
            llm_profiles["scripter"] = LLMProfile(**scripter_llm)

        text_manipulator_data = dict(agent_data.get("text_manipulator", {}))
        text_manipulator_llm = text_manipulator_data.pop("llm", None)
        text_manipulator_config = TextManipulatorConfig(
            llm=LLMProfile(**text_manipulator_llm) if text_manipulator_llm else None
        )
        if text_manipulator_llm:
            llm_profiles["text_manipulator"] = LLMProfile(**text_manipulator_llm)

        app_opener_data = dict(agent_data.get("app_opener", {}))
        app_opener_llm = app_opener_data.pop("llm", None)
        app_opener_config = AppOpenerConfig(
            llm=LLMProfile(**app_opener_llm) if app_opener_llm else None
        )
        if app_opener_llm:
            llm_profiles["app_opener"] = LLMProfile(**app_opener_llm)

        structured_output_data = dict(agent_data.get("structured_output", {}))
        structured_output_llm = structured_output_data.pop("llm", None)
        structured_output_config = StructuredOutputConfig(
            llm=LLMProfile(**structured_output_llm) if structured_output_llm else None
        )
        if structured_output_llm:
            llm_profiles["structured_output"] = LLMProfile(**structured_output_llm)

        suggester_data = dict(agent_data.get("suggester", {}))
        suggester_llm = suggester_data.pop("llm", None)
        suggester_config = SuggesterConfig(
            llm=LLMProfile(**suggester_llm) if suggester_llm else None,
            max_suggestions=suggester_data.get("max_suggestions", 5),
        )
        if suggester_llm:
            llm_profiles["suggester"] = LLMProfile(**suggester_llm)

        autoglm_data = dict(agent_data.get("autoglm", {}))
        autoglm_llm = autoglm_data.pop("llm", None)
        autoglm_config = AutoGLMConfig(
            enabled=autoglm_data.get("enabled", False),
            lang=autoglm_data.get("lang", "cn"),
            stream=autoglm_data.get("stream", True),
            llm=LLMProfile(**autoglm_llm) if autoglm_llm else None,
        )
        if autoglm_llm:
            llm_profiles["autoglm"] = LLMProfile(**autoglm_llm)

        app_cards_data = agent_data.get("app_cards", {})
        app_cards_config = AppCardConfig(**app_cards_data) if app_cards_data else AppCardConfig()

        agent_config = AgentConfig(
            name=agent_data.get("name", "droiduse"),
            max_steps=agent_data.get("max_steps", 15),
            max_time=agent_data.get("max_time", 600.0),
            reasoning=agent_data.get("reasoning", False),
            streaming=agent_data.get("streaming", False),
            after_sleep_action=agent_data.get("after_sleep_action", 1.0),
            wait_for_stable_ui=agent_data.get("wait_for_stable_ui", 0.3),
            prompts_dir=agent_data.get("prompts_dir", "config/prompts"),
            use_semantic_actions=agent_data.get("use_semantic_actions", False),
            codeact=codeact_config,
            manager=manager_config,
            executor=executor_config,
            scripter=scripter_config,
            text_manipulator=text_manipulator_config,
            app_opener=app_opener_config,
            structured_output=structured_output_config,
            suggester=suggester_config,
            autoglm=autoglm_config,
            app_cards=app_cards_config,
        )

        # Parse safe_execution config
        safe_exec_data = data.get("safe_execution", {})
        safe_execution_config = (
            SafeExecutionConfig(**safe_exec_data) if safe_exec_data else SafeExecutionConfig()
        )

        # Parse api_keys config
        api_keys_data = data.get("api_keys", {})
        api_keys_config = ApiKeysConfig(**api_keys_data) if api_keys_data else ApiKeysConfig()

        # Parse plugins config
        plugins_data = data.get("plugins", {})
        # Support both old "database" and new "local_logging" config names for backward compatibility
        local_logging_data = plugins_data.get("local_logging") or plugins_data.get("database", {})
        posthog_data = plugins_data.get("posthog_telemetry", {})
        tracing_data = plugins_data.get("tracing", {})
        trajectory_data = plugins_data.get("trajectory", {})
        memory_summary_data = plugins_data.get("memory_summary", {})
        task_memory_data = plugins_data.get("task_memory", {})

        plugins_config = PluginsConfig(
            local_logging=(
                LocalLoggingPluginConfig(**local_logging_data)
                if local_logging_data
                else LocalLoggingPluginConfig()
            ),
            posthog_telemetry=(
                PostHogPluginConfig(**posthog_data) if posthog_data else PostHogPluginConfig()
            ),
            tracing=(
                TracingPluginConfig(**tracing_data) if tracing_data else TracingPluginConfig()
            ),
            trajectory=(
                TrajectoryPluginConfig(**trajectory_data)
                if trajectory_data
                else TrajectoryPluginConfig()
            ),
            memory_summary=(
                MemorySummaryPluginConfig(**memory_summary_data)
                if memory_summary_data
                else MemorySummaryPluginConfig()
            ),
            task_memory=(
                TaskMemoryConfig(**task_memory_data) if task_memory_data else TaskMemoryConfig()
            ),
        )

        # Parse websocket_server config
        websocket_server_data = data.get("websocket_server", {})
        websocket_server_config = (
            WebSocketServerConfig(**websocket_server_data)
            if websocket_server_data
            else WebSocketServerConfig()
        )

        # Parse heartbeat_server config
        heartbeat_server_data = data.get("heartbeat_server", {})
        heartbeat_server_config = (
            HeartbeatServerConfig(**heartbeat_server_data)
            if heartbeat_server_data
            else HeartbeatServerConfig()
        )

        # Parse transcription config
        transcription_data = data.get("transcription", {})
        transcription_config = (
            TranscriptionConfig(**transcription_data)
            if transcription_data
            else TranscriptionConfig()
        )

        # Parse external_agents config (pass-through as dict of dicts)
        external_agents = data.get("external_agents", {})

        return cls(
            agent=agent_config,
            llm_profiles=llm_profiles,
            device=DeviceConfig(**data.get("device", {})),
            logging=LoggingConfig(**data.get("logging", {})),
            tools=ToolsConfig(**data.get("tools", {})),
            credentials=CredentialsConfig(**data.get("credentials", {})),
            safe_execution=safe_execution_config,
            api_keys=api_keys_config,
            plugins=plugins_config,
            websocket_server=websocket_server_config,
            heartbeat_server=heartbeat_server_config,
            transcription=transcription_config,
            external_agents=external_agents,
        )

    @classmethod
    def from_yaml(cls, path: str, load_env: bool = True) -> "AndroidUseConfig":
        """
        Load config from YAML file.

        Args:
            path: Path to config file (relative to CWD or absolute)
            load_env: If True, attempt to load .env file from the same directory as the YAML file

        Returns:
            AndroidUseConfig instance

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: If file can't be parsed
        """
        # Load .env file if available and requested
        if load_env and _DOTENV_AVAILABLE:
            # Try to find .env in the same directory as the config file
            import pathlib

            config_dir = pathlib.Path(path).parent
            env_file = config_dir / ".env"
            if env_file.exists():
                load_dotenv(env_file, override=False)  # Don't override existing env vars

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls.from_dict(data)

    @classmethod
    def from_yaml_with_base(
        cls, base_path: str, override_path: str, load_env: bool = True
    ) -> "AndroidUseConfig":
        """
        Load config from YAML file with base config merging.

        This method loads a base config and merges it with an override config.
        Only the entries that exist in the override config will overwrite the base config.

        Args:
            base_path: Path to base config file (e.g., "config.yaml")
            override_path: Path to override config file
            load_env: If True, attempt to load .env file from the same directory as the YAML file

        Returns:
            AndroidUseConfig instance with merged configuration

        Raises:
            FileNotFoundError: If either file doesn't exist
            Exception: If files can't be parsed
        """
        # Load base config
        with open(base_path, "r", encoding="utf-8") as f:
            base_data = yaml.safe_load(f) or {}

        # Load override config
        with open(override_path, "r", encoding="utf-8") as f:
            override_data = yaml.safe_load(f) or {}

        # Deep merge override into base
        merged_data = _deep_merge(base_data, override_data)

        # Load .env file if available and requested
        if load_env and _DOTENV_AVAILABLE:
            import pathlib

            # Load .env from override config directory (takes precedence)
            override_dir = pathlib.Path(override_path).parent
            override_env = override_dir / ".env"
            if override_env.exists():
                load_dotenv(override_env, override=False)

            # Also check base config directory
            base_dir = pathlib.Path(base_path).parent
            base_env = base_dir / ".env"
            if base_env.exists() and base_env != override_env:
                load_dotenv(base_env, override=False)

        return cls.from_dict(merged_data)


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep merge two dictionaries. Override values take precedence over base values.

    Args:
        base: Base dictionary
        override: Override dictionary (values from this dict take precedence)

    Returns:
        Merged dictionary
    """
    result = base.copy()

    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            # Recursively merge nested dictionaries
            result[key] = _deep_merge(result[key], value)
        else:
            # Override value (for non-dict values or new keys)
            result[key] = value

    return result
