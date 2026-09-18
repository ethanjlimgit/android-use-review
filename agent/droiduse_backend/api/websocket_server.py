"""
WebSocket Server for DroidUse Backend.

Phone-initiated WebSocket connections for task execution.
The phone connects to the backend and sends task execution requests.
All communication (task requests + device control) happens through the single WebSocket connection.
"""

import asyncio
import copy
import http
import json
import logging
import uuid
from typing import Any, Dict, Optional

import websockets
from websockets.server import WebSocketServerProtocol, serve

from droiduse_backend import AndroidUseConfig, DroidAgent
from droiduse_backend.agent.suggester import suggest_tasks
from droiduse_backend.api.app_card_server import AppCardServer
from droiduse_backend.auth.jwt_verify import verify_mobile_token
from droiduse_backend.config_manager.path_resolver import PathResolver
from droiduse_backend.plugins import (
    LocalLoggingPlugin,
    MemorySummaryPlugin,
    PostHogTelemetryPlugin,
    TracingPlugin,
    TrajectoryPlugin,
    get_plugin_manager,
)
from droiduse_backend.tools.websocket_connection_tool import WebSocketConnectionTool
from droiduse_backend.transcription import TranscriptionSessionManager, get_audio_player

logger = logging.getLogger("droiduse-backend.websocket")


def truncate_message(message: Any, max_length: int = 500) -> str:
    """
    Truncate message for debug logging.

    Args:
        message: Message to truncate (can be str, bytes, or dict)
        max_length: Maximum length before truncating

    Returns:
        Truncated string representation
    """
    if isinstance(message, bytes):
        # For binary data, show size and first/last few bytes
        if len(message) > max_length:
            preview_size = min(50, len(message) // 2)
            preview = message[:preview_size].hex()
            return f"<binary {len(message)} bytes: {preview}...>"
        return f"<binary {len(message)} bytes: {message.hex()}>"

    elif isinstance(message, dict):
        # For JSON/dict, serialize and truncate
        msg_str = json.dumps(message, indent=None)
        if len(msg_str) > max_length:
            return msg_str[:max_length] + f"... (truncated, total {len(msg_str)} chars)"
        return msg_str

    else:
        # For strings
        msg_str = str(message)
        if len(msg_str) > max_length:
            return msg_str[:max_length] + f"... (truncated, total {len(msg_str)} chars)"
        return msg_str


class WebSocketServer:
    """
    WebSocket server for handling phone-initiated connections.

    Manages task execution requests from phones, orchestrates LLM agents,
    and handles bidirectional communication with devices.
    """

    @staticmethod
    def generate_connection_id() -> str:
        """
        Generate a random unique connection identifier.

        Returns:
            Random UUID string (32 hex characters without hyphens)
        """
        return uuid.uuid4().hex

    def __init__(
        self,
        config: Optional[AndroidUseConfig] = None,
        override_config_path: Optional[str] = None,
    ):
        """
        Initialize WebSocket server.

        Args:
            config: Optional AndroidUseConfig instance. If not provided, will be loaded from config.yaml
            override_config_path: Optional path to override config file. If provided, it will be merged
                                 with the base config.yaml (only specified entries are overwritten)
        """
        self.config = config or self._load_config(override_config_path=override_config_path)
        self.server = None
        self._running = False
        self._app_card_server: Optional[AppCardServer] = None
        self._heartbeat_server: Optional[Any] = None  # HeartbeatServer, imported at runtime

        # Device connection registry: device_id -> websocket
        self.device_connections: Dict[str, WebSocketServerProtocol] = {}
        # Connection metadata: device_id -> connection info
        self.device_metadata: Dict[str, Dict[str, Any]] = {}
        # Task queue for admin-initiated tasks: device_id -> list of pending tasks
        self.pending_tasks: Dict[str, list] = {}
        # Active tasks: task_id -> asyncio.Event for cancellation
        self.active_tasks: Dict[str, asyncio.Event] = {}
        # Active task states: task_id -> DroidAgentState for voice instruction injection
        self.active_task_states: Dict[str, Any] = {}
        # Active task per connection: connection_id -> task_id (ensures one task per connection)
        self.connection_active_task: Dict[str, str] = {}
        # Task websockets: task_id -> websocket for sending agent responses
        self.task_websockets: Dict[str, WebSocketServerProtocol] = {}

        # Transcription session manager
        self._transcription_manager: Optional[TranscriptionSessionManager] = None
        if self.config.transcription.is_configured():
            self._transcription_manager = TranscriptionSessionManager(
                self.config.transcription,
                on_committed_transcript=self._handle_voice_instruction,
            )
            logger.info("Transcription service initialized")
        else:
            # Log why transcription is not configured
            tc = self.config.transcription
            logger.info(
                f"Transcription service not initialized: enabled={tc.enabled}, "
                f"api_key_set={bool(tc.elevenlabs_api_key)}"
            )

        # Audio player for debugging (plays received voice audio on server)
        self._audio_player = None
        if self.config.transcription.play_audio:
            try:
                self._audio_player = get_audio_player(enabled=True)
                logger.info("Audio playback enabled (will play received voice audio)")
            except Exception as e:
                logger.warning(f"Failed to initialize audio player: {e}")
                self._audio_player = None

    def _has_existing_connection(self, device_id: str) -> bool:
        """
        Check if device already has an active connection.

        Args:
            device_id: Device identifier

        Returns:
            True if device has an existing connection, False otherwise
        """
        if device_id not in self.device_connections:
            return False

        # Check if the existing websocket is still open
        existing_ws = self.device_connections[device_id]
        try:
            # websockets library uses 'state' attribute to track connection state
            # OPEN = 1, CLOSING = 2, CLOSED = 3
            if hasattr(existing_ws, "state"):
                from websockets.protocol import State

                return existing_ws.state == State.OPEN
            # Fallback: check if connection appears active
            return existing_ws.open if hasattr(existing_ws, "open") else True
        except Exception:
            # If we can't determine state, assume connection is gone
            return False

    def _register_device_connection(
        self,
        device_id: str,
        websocket: WebSocketServerProtocol,
        user_id: Optional[str] = None,
        client_address: str = "unknown",
    ) -> bool:
        """
        Register a device connection.

        Args:
            device_id: Device identifier
            websocket: WebSocket connection
            user_id: Optional user identifier
            client_address: Client IP:port address

        Returns:
            True if registration successful, False if device already has an active connection
        """
        from datetime import datetime

        # Check if device already has an active connection
        if self._has_existing_connection(device_id):
            logger.warning(
                f"📱 Device {device_id} already has an active connection, rejecting new connection"
            )
            return False

        # Clean up any stale entry if exists
        if device_id in self.device_connections:
            del self.device_connections[device_id]
        if device_id in self.device_metadata:
            del self.device_metadata[device_id]

        self.device_connections[device_id] = websocket
        self.device_metadata[device_id] = {
            "device_id": device_id,
            "user_id": user_id,
            "client_address": client_address,
            "connected_at": datetime.now().isoformat(),
        }
        logger.info(f"📱 Registered device connection: {device_id}")
        return True

    def _unregister_device_connection(self, device_id: str) -> None:
        """
        Unregister a device connection.

        Args:
            device_id: Device identifier
        """
        if device_id in self.device_connections:
            del self.device_connections[device_id]
        if device_id in self.device_metadata:
            del self.device_metadata[device_id]
        logger.info(f"📱 Unregistered device connection: {device_id}")

    async def _handle_voice_instruction(self, session_id: str, text: str, is_final: bool) -> None:
        """
        Handle committed transcription and inject into the active agent.

        This is called by TranscriptionSessionManager when a transcript is committed.

        Args:
            session_id: The transcription session ID
            text: The transcribed text
            is_final: Whether this is the final transcript for the utterance
        """
        # Find the task that matches this session
        # The session_id should match the task_id for proper routing
        if session_id in self.active_task_states:
            shared_state = self.active_task_states[session_id]
            await shared_state.add_voice_instruction(text)
            logger.info(f"🎤 Voice instruction injected into task {session_id}: {text[:50]}...")
        else:
            # Try to find an active task for this connection
            # If there's only one active task, use that
            if len(self.active_task_states) == 1:
                task_id = next(iter(self.active_task_states))
                shared_state = self.active_task_states[task_id]
                await shared_state.add_voice_instruction(text)
                logger.info(
                    f"🎤 Voice instruction injected into active task {task_id}: {text[:50]}..."
                )
            else:
                logger.warning(
                    f"🎤 No matching task found for voice instruction (session={session_id}): {text}"
                )

    async def inject_voice_instruction(self, task_id: str, instruction: str) -> bool:
        """
        Manually inject a voice instruction into an active task.

        Args:
            task_id: The task ID to inject into
            instruction: The voice instruction text

        Returns:
            True if injected successfully, False if task not found
        """
        if task_id not in self.active_task_states:
            return False

        shared_state = self.active_task_states[task_id]
        await shared_state.add_voice_instruction(instruction)
        logger.info(f"🎤 Voice instruction manually injected into task {task_id}")
        return True

    async def send_agent_response(
        self,
        task_id: str,
        text: str,
        response_type: str = "status",
    ) -> bool:
        """
        Send an agent response to the phone for TTS (text-to-speech).

        This is used when voice command mode is enabled to provide verbal feedback
        to the user about what the agent is doing.

        Args:
            task_id: The task ID (used to find the WebSocket connection)
            text: The text to be spoken by TTS
            response_type: Type of response - "status", "thought", "completed", "error"

        Returns:
            True if sent successfully, False if task/connection not found
        """
        # Look up the WebSocket directly from task_websockets
        websocket = self.task_websockets.get(task_id)

        if not websocket:
            logger.warning(f"🔊 No WebSocket found for agent response to task {task_id}")
            return False

        message = {
            "type": "agent_response",
            "task_id": task_id,
            "text": text,
            "response_type": response_type,
        }

        try:
            await websocket.send(json.dumps(message))
            logger.info(f"🔊 Agent response sent for task {task_id}: {text[:50]}...")
            return True
        except Exception as e:
            logger.warning(f"🔊 Failed to send agent response: {e}")
            return False

    def get_device_metadata(self) -> Dict[str, Dict[str, Any]]:
        """
        Get metadata for all connected devices.

        Returns:
            Dictionary of device_id -> metadata
        """
        return self.device_metadata.copy()

    async def queue_task_for_device(
        self,
        device_id: str,
        command: str,
        config_dict: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Queue a task for a specific connected device and push it via WebSocket.

        Args:
            device_id: Device identifier
            command: Command to execute
            config_dict: Optional configuration overrides

        Returns:
            Task ID for tracking

        Raises:
            ValueError: If device is not connected
        """
        if device_id not in self.device_connections:
            raise ValueError(f"Device {device_id} is not connected")

        websocket = self.device_connections[device_id]

        # Generate task ID
        task_id = self.generate_connection_id()

        # Create task request
        task_request = {
            "type": "admin_task",  # Distinguish from regular device-initiated tasks
            "task_id": task_id,
            "command": command,
        }
        if config_dict:
            task_request["config"] = config_dict

        # Send task to device via WebSocket
        try:
            await websocket.send(json.dumps(task_request))
            logger.info(f"📤 Sent admin task {task_id} to device {device_id}: {command}")
        except Exception as e:
            logger.error(f"Failed to send task to device {device_id}: {e}")
            raise ValueError(f"Failed to send task to device: {str(e)}") from e

        return task_id

    def get_pending_task(self, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Get next pending task for a device.

        Args:
            device_id: Device identifier

        Returns:
            Task dict or None if no pending tasks
        """
        if device_id not in self.pending_tasks or not self.pending_tasks[device_id]:
            return None

        return self.pending_tasks[device_id].pop(0)

    async def send_task_to_device(
        self,
        device_id: str,
        command: str,
        config_dict: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a task to a specific connected device via WebSocket push.

        The task is pushed to the device immediately via the WebSocket connection.
        The phone app must be updated to handle server-initiated task messages
        with type="admin_task".

        Args:
            device_id: Device identifier
            command: Command to execute
            config_dict: Optional configuration overrides

        Returns:
            Task sending result with task_id

        Raises:
            ValueError: If device is not connected or task sending fails
        """
        task_id = await self.queue_task_for_device(device_id, command, config_dict)

        return {
            "task_id": task_id,
            "status": "sent",
            "message": f"Task sent to device {device_id}. The device should begin execution shortly.",
        }

    def _authenticate_connection(
        self, websocket: WebSocketServerProtocol
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Authenticate WebSocket connection using JWT token and device ID.

        Extracts and validates:
        - Authorization header (Bearer token)
        - X-Device-Id header

        Args:
            websocket: WebSocket connection to authenticate

        Returns:
            Tuple of (user_id, device_id, jwt_token) if authentication succeeds, (None, None, None) otherwise
        """
        # Extract headers from WebSocket request
        # In websockets 14.0+, headers are accessed via the request.headers attribute
        try:
            headers = websocket.request.headers
        except AttributeError:
            # Fallback for older versions
            headers = websocket.request_headers

        # Extract Authorization header
        auth_header = headers.get("Authorization")
        if not auth_header:
            logger.warning("[auth] Missing Authorization header")
            return None, None, None

        # Extract Bearer token
        if not auth_header.startswith("Bearer "):
            logger.warning(
                f"[auth] Invalid Authorization header format (must be 'Bearer <token>'). Got: '{auth_header[:32]}...'"
            )
            return None, None, None

        token = auth_header[7:]  # Remove "Bearer " prefix

        # Verify JWT token using web_api_auth_secret from config
        user = verify_mobile_token(token, secret=self.config.websocket_server.web_api_auth_secret)
        if not user:
            logger.warning("[auth] JWT token verification failed")
            return None, None, None

        # Extract X-Device-Id header (case-insensitive)
        device_id = headers.get("X-Device-Id")
        if not device_id:
            logger.warning(f"[auth] Missing X-Device-Id header for user {user.email}")
            return None, None, None

        logger.info(f"[auth] ✅ Authenticated user {user.email} with device {device_id}")
        return user.id, device_id, token

    def _load_config(self, override_config_path: Optional[str] = None) -> AndroidUseConfig:
        """
        Load configuration from config.yaml or use defaults.
        If override_config_path is provided, merge it with base config.yaml.

        Args:
            override_config_path: Optional path to override config file

        Returns:
            AndroidUseConfig instance
        """
        # Find base config.yaml
        # Use "config.yaml" since PathResolver.get_project_root() returns droiduse_backend/
        base_config_path = PathResolver.resolve("config.yaml")
        if not base_config_path.exists():
            base_config_path = None

        # Load config based on whether override is provided
        if override_config_path and base_config_path:
            # Merge override config with base config.yaml
            try:
                config = AndroidUseConfig.from_yaml_with_base(
                    str(base_config_path), override_config_path
                )
                logger.info(
                    f"Loaded merged configuration: base={base_config_path}, override={override_config_path}"
                )
            except Exception as e:
                logger.warning(
                    f"Could not load override config {override_config_path}: {e}. Using base config only."
                )
                config = AndroidUseConfig.from_yaml(str(base_config_path))
                logger.info(f"Loaded configuration from: {base_config_path}")
        elif base_config_path:
            # Load base config only
            try:
                config = AndroidUseConfig.from_yaml(str(base_config_path))
                logger.info(f"Loaded configuration from: {base_config_path}")
            except Exception as e:
                logger.warning(f"Could not load config.yaml: {e}. Using defaults.")
                config = AndroidUseConfig()
        else:
            # No base config found, use defaults
            logger.warning("Could not find config.yaml. Using defaults.")
            config = AndroidUseConfig()

        # Configure HTTP client for web API communication
        from droiduse_backend.db.helpers import configure_http_client

        configure_http_client(
            base_url=config.websocket_server.web_api_url,
            auth_secret=config.websocket_server.web_api_auth_secret,
        )

        return config

    def _setup_plugins(self) -> None:
        """
        Register and configure plugins based on config.

        Only plugins that are enabled in config are registered.
        This is called once at server startup.
        """
        plugins_cfg = self.config.plugins
        plugin_manager = get_plugin_manager()

        # Local logging plugin for recording tasks and steps via HTTP API
        if plugins_cfg.local_logging.enabled:
            local_logging_plugin = LocalLoggingPlugin(enabled=True)
            plugin_manager.register(local_logging_plugin)
            logger.info("Registered LocalLoggingPlugin")

        # PostHog telemetry plugin - manages its own API key and flush timing
        if plugins_cfg.posthog_telemetry.enabled:
            posthog_plugin = PostHogTelemetryPlugin(
                enabled=True,
                api_key=plugins_cfg.posthog_telemetry.api_key or None,
                host=plugins_cfg.posthog_telemetry.host or None,
            )
            plugin_manager.register(posthog_plugin)
            logger.info("Registered PostHogTelemetryPlugin")

        # Tracing plugin for Langfuse screenshots
        if plugins_cfg.tracing.enabled:
            tracing_plugin = TracingPlugin(
                enabled=True,
                screenshots_enabled=plugins_cfg.tracing.screenshots_enabled,
            )
            plugin_manager.register(tracing_plugin)
            logger.info("Registered TracingPlugin")

        # Trajectory plugin for writing trajectories
        trajectory_enabled = (
            plugins_cfg.trajectory.enabled and plugins_cfg.trajectory.save_trajectory != "none"
        )
        logger.info(
            f"Trajectory config: enabled={plugins_cfg.trajectory.enabled}, save_trajectory={plugins_cfg.trajectory.save_trajectory}"
        )
        if trajectory_enabled:
            trajectory_plugin = TrajectoryPlugin(
                enabled=True,
                queue_size=plugins_cfg.trajectory.queue_size,
                create_gifs=plugins_cfg.trajectory.create_gifs,
            )
            plugin_manager.register(trajectory_plugin)
            logger.info("Registered TrajectoryPlugin")

        # Memory summary plugin for saving task summaries as user long-term memory
        if plugins_cfg.memory_summary.enabled:
            memory_summary_plugin = MemorySummaryPlugin(
                enabled=True,
                max_task_summaries=plugins_cfg.memory_summary.max_task_summaries,
            )
            plugin_manager.register(memory_summary_plugin)
            logger.info("Registered MemorySummaryPlugin")

    def _validate_task_limits(
        self, config_dict: Optional[Dict[str, Any]]
    ) -> tuple[bool, Optional[str]]:
        """
        Validate that task request limits don't exceed server config limits.

        Args:
            config_dict: Optional configuration overrides from task request

        Returns:
            Tuple of (is_valid, error_message). error_message is None if valid.
        """
        if not config_dict:
            return True, None

        # Get server limits from instance config
        server_max_steps = self.config.agent.max_steps
        server_max_time = self.config.agent.max_time

        # Check agent config overrides
        agent_dict = config_dict.get("agent", {})

        # Validate max_steps
        task_max_steps = agent_dict.get("max_steps")
        if task_max_steps is not None and task_max_steps > server_max_steps:
            return (
                False,
                f"Task max_steps ({task_max_steps}) exceeds server limit ({server_max_steps})",
            )

        # Validate max_time
        task_max_time = agent_dict.get("max_time")
        if task_max_time is not None and task_max_time > server_max_time:
            return (
                False,
                f"Task max_time ({task_max_time}s) exceeds server limit ({server_max_time}s)",
            )

        return True, None

    async def _handle_suggest_tasks(
        self,
        websocket: WebSocketServerProtocol,
        request: Dict[str, Any],
    ) -> None:
        """
        Handle a request to suggest tasks based on current device state.

        The request should include:
        - state_full: Full device state containing a11y_tree, phone_state, device_context
        - screenshot_base64: Optional base64-encoded screenshot

        Sends back a response with suggested tasks.

        Args:
            websocket: Active WebSocket connection
            request: The suggest_tasks request containing device state
        """
        request_id = request.get("request_id", "")
        logger.info(f"💡 Received suggest_tasks request (id: {request_id})")

        try:
            # Extract full device state from request
            state_full = request.get("state_full")
            screenshot_base64 = request.get("screenshot_base64")
            # Use config default for max_suggestions, allow request to override
            config_max_suggestions = self.config.agent.suggester.max_suggestions
            max_suggestions = request.get("max_suggestions", config_max_suggestions)

            if not state_full:
                error_response = {
                    "type": "suggest_tasks_response",
                    "request_id": request_id,
                    "success": False,
                    "error": "Missing required field: state_full",
                    "suggestions": [],
                }
                await websocket.send(json.dumps(error_response))
                return

            # Load LLM for suggester - use suggester profile, fall back to manager, then first available
            from droiduse_backend.agent.utils.llm_picker import load_llm

            profile_name = "suggester"
            if profile_name not in self.config.llm_profiles:
                profile_name = "manager"
            if profile_name not in self.config.llm_profiles:
                profile_name = next(iter(self.config.llm_profiles.keys()), None)

            if not profile_name:
                error_response = {
                    "type": "suggest_tasks_response",
                    "request_id": request_id,
                    "success": False,
                    "error": "No LLM profiles configured",
                    "suggestions": [],
                }
                await websocket.send(json.dumps(error_response))
                return

            profile = self.config.llm_profiles[profile_name]
            llm = load_llm(
                provider_name=profile.provider,
                model=profile.model,
                config=self.config,
                temperature=profile.temperature if profile.temperature else 0.7,
            )

            # Generate suggestions
            suggestions = await suggest_tasks(
                llm=llm,
                state_full=state_full,
                screenshot_base64=screenshot_base64,
                max_suggestions=max_suggestions,
            )

            # Send response
            response = {
                "type": "suggest_tasks_response",
                "request_id": request_id,
                "success": True,
                "context_summary": suggestions.context_summary,
                "suggestions": [s.model_dump() for s in suggestions.suggestions],
            }
            await websocket.send(json.dumps(response))
            logger.info(
                f"💡 Sent {len(suggestions.suggestions)} task suggestions (id: {request_id})"
            )

        except Exception as e:
            logger.exception(f"Failed to generate task suggestions: {e}")
            error_response = {
                "type": "suggest_tasks_response",
                "request_id": request_id,
                "success": False,
                "error": str(e),
                "suggestions": [],
            }
            await websocket.send(json.dumps(error_response))

    async def handle_task_request(
        self,
        websocket: WebSocketServerProtocol,
        task_id: str,
        command: str,
        config_dict: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None,
        user_id: Optional[str] = None,
        jwt_token: Optional[str] = None,
        connection_id: Optional[str] = None,
        voice_command_enabled: bool = False,
    ) -> Dict[str, Any]:
        """
        Execute a task request from the phone.

        Args:
            websocket: Active WebSocket connection to the phone
            task_id: Unique task identifier
            command: The command/task to execute
            config_dict: Optional configuration overrides
            device_id: Optional device identifier for database recording
            user_id: Optional user identifier for database recording
            jwt_token: User's JWT token for authenticated HTTP API requests
            connection_id: Unique identifier for this connection
            voice_command_enabled: If True, enable voice command mode (auto-start
                                   transcription and send agent responses for TTS)

        Returns:
            Result dictionary with success, reason, and steps
        """
        # Create cancellation event for this task
        cancellation_event = asyncio.Event()
        self.active_tasks[task_id] = cancellation_event

        # Track if we started a transcription session for cleanup
        transcription_session_started = False

        try:
            logger.info(f"📱 Starting task {task_id}: {command}")

            # Auto-start transcription session if voice command mode is enabled
            logger.info(
                f"🎤 Voice command check: enabled={voice_command_enabled}, "
                f"manager_available={self._transcription_manager is not None}"
            )
            if voice_command_enabled and self._transcription_manager:
                # Start transcription session with task_id as session_id
                # This allows voice instructions to be routed to the correct agent
                logger.info(f"🎤 Starting transcription session for task {task_id}")
                result_session_id = await self._transcription_manager.start_session(
                    phone_websocket=websocket,
                    language=None,  # Auto-detect
                    session_id=task_id,  # Use task_id for routing
                )
                logger.info(f"🎤 Transcription session result: {result_session_id}")
                if result_session_id:
                    transcription_session_started = True
                    logger.info(f"🎤 Voice command mode enabled for task {task_id}")
                    # Tell the phone to start recording via transcription_status
                    status_msg = {
                        "type": "transcription_status",
                        "task_id": task_id,
                        "session_id": result_session_id,
                        "status": "started",
                    }
                    await websocket.send(json.dumps(status_msg))
                    logger.info(f"🎤 Sent transcription_status:started to phone for task {task_id}")
                else:
                    logger.warning(f"🎤 Failed to start transcription session for task {task_id}")
            elif voice_command_enabled and not self._transcription_manager:
                tc = self.config.transcription
                logger.warning(
                    f"🎤 Voice command requested but transcription not configured for task {task_id}. "
                    f"Config: enabled={tc.enabled}, api_key_set={bool(tc.elevenlabs_api_key)}"
                )

            # Validate task limits against server config limits
            is_valid, error_msg = self._validate_task_limits(config_dict)
            if not is_valid:
                logger.warning(f"❌ Task {task_id} rejected: {error_msg}")
                return {
                    "success": False,
                    "reason": f"Task configuration invalid: {error_msg}",
                    "steps": 0,
                    "structured_output": None,
                }

            # Load config - use instance config as base, then apply overrides
            if config_dict:
                config = AndroidUseConfig.from_dict(config_dict)
            else:
                # Create a copy to avoid modifying instance config
                config = copy.deepcopy(self.config)

            # Create tool instance that uses the existing WebSocket connection
            tools = WebSocketConnectionTool(
                websocket=websocket,
                vision_enabled=(
                    config.agent.manager.vision
                    or config.agent.executor.vision
                    or config.agent.codeact.vision
                ),
                streaming=config.agent.streaming,
                cancellation_event=cancellation_event,
            )

            # Create and run agent with cancellation support
            droid_agent = DroidAgent(
                goal=command,
                llms=None,  # Will be loaded from config
                tools=tools,  # Pass pre-created tools using the WebSocket connection
                config=config,
                timeout=config.agent.max_time,
                device_id=device_id,
                user_id=user_id,
                jwt_token=jwt_token,
                connection_id=connection_id,
                runtype="websocket",
                cancellation_event=cancellation_event,  # Pass cancellation event
            )

            # Register shared state for voice instruction injection
            self.active_task_states[task_id] = droid_agent.shared_state
            # Register websocket for agent responses
            self.task_websockets[task_id] = websocket
            # Set task_id on shared state for agent response routing
            droid_agent.shared_state.task_id = task_id

            # Set up voice command mode if enabled
            if voice_command_enabled:
                droid_agent.shared_state.voice_command_enabled = True
                droid_agent.shared_state.initialize_voice_queue()

                # Set up the agent response callback
                async def agent_response_callback(tid: str, text: str, response_type: str) -> bool:
                    return await self.send_agent_response(tid, text, response_type)

                droid_agent.shared_state.set_agent_response_callback(agent_response_callback)

            # Start agent execution
            handler = droid_agent.run()

            # Create background task to handle incoming messages while agent runs
            message_handler_task = asyncio.create_task(
                self.handle_incoming_messages(websocket, tools, task_id)
            )

            try:
                # Stream events with cancellation checking
                async for _ in handler.stream_events():
                    # Check if task was cancelled during streaming
                    if cancellation_event.is_set():
                        raise asyncio.CancelledError()

                    # Check if message handler crashed — if so, no more phone
                    # responses can be received, so abort the task early.
                    if message_handler_task.done():
                        exc = (
                            message_handler_task.exception()
                            if not message_handler_task.cancelled()
                            else None
                        )
                        if exc:
                            logger.error(f"Message handler crashed during task {task_id}: {exc}")
                        else:
                            logger.error(
                                f"Message handler stopped unexpectedly during task {task_id}"
                            )
                        raise RuntimeError(
                            "Message handler died — phone responses can no longer be received"
                        )

                # Check again before awaiting result
                if cancellation_event.is_set():
                    raise asyncio.CancelledError()

                result = await handler

                logger.info(
                    f"✅ Task {task_id} completed: success={result['success']}, steps={result['steps']}"
                )

                return {
                    "success": result["success"],
                    "reason": result["reason"],
                    "steps": result["steps"],
                    "structured_output": result.get("structured_output"),
                }

            finally:
                # Cancel message handler
                message_handler_task.cancel()
                try:
                    await message_handler_task
                except asyncio.CancelledError:
                    pass

        except asyncio.CancelledError:
            return {
                "success": False,
                "reason": "Task was cancelled by user",
                "steps": 0,
                "structured_output": None,
            }

        except Exception as e:
            error_msg = str(e)
            logger.exception(f"❌ Task {task_id} failed: {error_msg}")

            return {
                "success": False,
                "reason": f"Task failed: {error_msg}",
                "steps": 0,
                "structured_output": None,
            }

        finally:
            # Stop transcription session if we started one
            if transcription_session_started and self._transcription_manager:
                await self._transcription_manager.stop_session(task_id)
                # Note: Android stops recording automatically when task result is received

            # Clean up cancellation event, shared state, and websocket mapping
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
            if task_id in self.active_task_states:
                del self.active_task_states[task_id]
            if task_id in self.task_websockets:
                del self.task_websockets[task_id]

    async def handle_incoming_messages(
        self, websocket: WebSocketServerProtocol, tools: WebSocketConnectionTool, task_id: str
    ) -> None:
        """
        Handle incoming messages from phone while agent is running.

        This runs as a background task to process two types of messages:
        1. Control messages (e.g., cancel_task) - handled directly
        2. Device command responses - routed to tools for processing

        Cancellation handling: When a cancel_task message is received for the
        active task, we set the cancellation event and send acknowledgment.
        The agent will detect this at its next cancellation check point.

        Args:
            websocket: Active WebSocket connection
            tools: Tool instance to route responses to
            task_id: Current task ID for handling cancellation
        """
        try:
            async for message in websocket:
                # Handle binary messages (audio chunks or screenshots)
                if isinstance(message, bytes):
                    # Check if this looks like transcription audio
                    # Audio format: [36-byte session_id] + [PCM audio data]
                    if len(message) > 36 and self._transcription_manager:
                        session_id = message[:36].decode("utf-8", errors="ignore").strip()
                        # Check if this session_id looks like a UUID (transcription session)
                        # vs a request ID (screenshot response)
                        if self._transcription_manager.has_session(session_id):
                            audio_data = message[36:]
                            await self._transcription_manager.forward_audio(session_id, audio_data)
                            # Play audio on server if enabled (for debugging, non-blocking)
                            if self._audio_player:
                                try:
                                    self._audio_player.play(audio_data)
                                except Exception:
                                    pass  # Ignore audio playback errors
                            continue
                    # Not transcription audio - treat as screenshot response
                    await tools.handle_binary_response(message)

                # Handle text messages (JSON responses or control messages)
                else:
                    # Try to parse as JSON to check for control messages
                    try:
                        parsed = json.loads(message)
                        message_type = parsed.get("type")

                        # Handle cancel_task control message
                        if message_type == "cancel_task":
                            task_id_to_cancel = parsed.get("task_id")
                            logger.debug(
                                f"📬 Cancel request: requested_id={task_id_to_cancel}, "
                                f"current_task_id={task_id}, match={task_id_to_cancel == task_id}, "
                                f"in_active_tasks={task_id in self.active_tasks}"
                            )
                            if task_id_to_cancel == task_id and task_id in self.active_tasks:
                                logger.info(f"🛑 Cancellation requested for running task {task_id}")
                                # Set the cancellation event - this signals the agent to stop
                                self.active_tasks[task_id].set()
                                # Send acknowledgment
                                cancel_ack = {
                                    "status": "cancelled",
                                    "task_id": task_id,
                                    "message": "Task cancellation initiated",
                                }
                                await websocket.send(json.dumps(cancel_ack))
                                # Don't route this to tools
                                continue
                            else:
                                logger.warning(
                                    f"❌ Cannot cancel: requested={task_id_to_cancel}, "
                                    f"current={task_id}, exists={task_id_to_cancel in self.active_tasks}"
                                )
                                error_response = {
                                    "status": "error",
                                    "error": f"Task {task_id_to_cancel} not found or already completed (current: {task_id})",
                                }
                                await websocket.send(json.dumps(error_response))
                                continue

                        # For other JSON messages, route to tools
                        await tools.handle_response(message)

                    except (json.JSONDecodeError, KeyError):
                        # Not JSON or missing expected fields, route to tools as before
                        await tools.handle_response(message)

        except asyncio.CancelledError:
            logger.debug("Message handler cancelled")

        except Exception as e:
            logger.error(f"Error handling incoming message: {e}")

    async def handle_connection(self, websocket: WebSocketServerProtocol) -> None:
        """
        Handle a phone connection.

        The phone sends a task request in this format:
        {
            "task_id": "unique-id",
            "command": "open settings and search for battery",
            "config": {...},  # optional
            "device_id": "device-123"  # optional
        }

        Headers required (when auth_enabled=True):
        - Authorization: Bearer <JWT token>
        - X-Device-Id: <device identifier>

        Args:
            websocket: WebSocket connection from the phone
        """
        client_ip = websocket.remote_address[0] if websocket.remote_address else "unknown"
        client_port = (
            websocket.remote_address[1]
            if websocket.remote_address and len(websocket.remote_address) > 1
            else "unknown"
        )
        logger.info(f"📱 New WebSocket connection from {client_ip}:{client_port}")

        # Check if authentication is enabled
        auth_enabled = self.config.websocket_server.auth_enabled

        if auth_enabled:
            # Authenticate the connection
            user_id, authenticated_device_id, jwt_token = self._authenticate_connection(websocket)

            if not user_id or not authenticated_device_id:
                logger.warning(
                    f"❌ Authentication failed for connection from {client_ip}:{client_port}"
                )
                error_response = {
                    "status": "error",
                    "error": "Authentication failed. Missing or invalid Authorization header or X-Device-Id.",
                }
                try:
                    await websocket.send(json.dumps(error_response))
                except Exception:
                    pass
                return

            # Generate random unique connection_id for this authenticated connection
            connection_id = self.generate_connection_id()
            logger.info(
                f"✅ Authenticated connection {connection_id} from {client_ip}:{client_port} "
                f"(user: {user_id}, device: {authenticated_device_id})"
            )

            # Register device connection (enforces one connection per device)
            if not self._register_device_connection(
                device_id=authenticated_device_id,
                websocket=websocket,
                user_id=user_id,
                client_address=f"{client_ip}:{client_port}",
            ):
                # Device already has an active connection
                error_response = {
                    "status": "error",
                    "error": f"Device {authenticated_device_id} already has an active connection. "
                    f"Disconnect the existing connection first.",
                }
                try:
                    await websocket.send(json.dumps(error_response))
                except Exception:
                    pass
                return
        else:
            logger.info(
                f"🔓 Authentication disabled, accepting connection from {client_ip}:{client_port}"
            )
            user_id = None
            authenticated_device_id = None
            jwt_token = None
            connection_id = None

        try:
            # Keep connection alive and process multiple tasks
            while True:
                # Wait for task request from phone with timeout for cellular networks
                # Use configured timeout to account for slow cellular connections
                timeout = self.config.websocket_server.initial_recv_timeout
                try:
                    request_message = await asyncio.wait_for(websocket.recv(), timeout=timeout)
                except asyncio.TimeoutError:
                    logger.warning(f"⏰ Timeout waiting for request from {client_ip}:{client_port}")
                    error_response = {
                        "status": "error",
                        "error": f"Timeout: No task request received within {timeout} seconds",
                    }
                    try:
                        await websocket.send(json.dumps(error_response))
                    except Exception:
                        pass
                    # Continue waiting for next request instead of closing
                    continue

                # Handle binary messages (audio data for transcription)
                # Note: Audio during task execution is handled by handle_incoming_messages.
                # This handles audio that arrives between tasks (e.g., late packets).
                if isinstance(request_message, bytes):
                    # Binary format: [36-byte UUID session_id] + [PCM audio data]
                    if len(request_message) > 36 and self._transcription_manager:
                        session_id = request_message[:36].decode("utf-8", errors="ignore").strip()
                        # Only forward if session still exists (it may have ended)
                        if self._transcription_manager.has_session(session_id):
                            audio_data = request_message[36:]
                            await self._transcription_manager.forward_audio(session_id, audio_data)
                            # Play audio on server if enabled (for debugging, non-blocking)
                            if self._audio_player:
                                try:
                                    self._audio_player.play(audio_data)
                                except Exception:
                                    pass  # Ignore audio playback errors
                        else:
                            # Session ended, just ignore late audio packets
                            logger.debug(f"Ignoring audio for ended session {session_id[:8]}...")
                    else:
                        logger.debug(
                            f"Received binary message but transcription not configured "
                            f"or message too short ({len(request_message)} bytes)"
                        )
                    continue

                # Debug log received request
                logger.debug(
                    f"📥 Received request from client: {truncate_message(request_message)}"
                )

                # Parse request
                try:
                    request = json.loads(request_message)
                except json.JSONDecodeError as e:
                    error_response = {"status": "error", "error": f"Invalid JSON: {e}"}
                    await websocket.send(json.dumps(error_response))
                    # Continue waiting for next request
                    continue

                # Check if this is a cancellation request
                # Cancellation Flow:
                # 1. Client sends {"type": "cancel_task", "task_id": "..."}
                # 2. We set the cancellation event for that task
                # 3. Agent checks for cancellation at strategic points (see cancellation.py)
                # 4. When detected, CancelledError is raised and propagates up
                # 5. Main handler catches it and returns cancelled result
                message_type = request.get("type")
                if message_type == "cancel_task":
                    task_id_to_cancel = request.get("task_id")
                    if task_id_to_cancel and task_id_to_cancel in self.active_tasks:
                        logger.info(f"🛑 Cancellation requested for task {task_id_to_cancel}")
                        # Set the cancellation event - this signals the agent to stop
                        self.active_tasks[task_id_to_cancel].set()
                        # Send immediate acknowledgment
                        cancel_ack = {
                            "status": "cancelled",
                            "task_id": task_id_to_cancel,
                            "message": "Task cancellation initiated",
                        }
                        await websocket.send(json.dumps(cancel_ack))
                    else:
                        error_response = {
                            "status": "error",
                            "error": f"Task {task_id_to_cancel} not found or already completed",
                        }
                        await websocket.send(json.dumps(error_response))
                    continue

                # Handle transcription start request
                if message_type == "transcription_start":
                    if not self._transcription_manager:
                        error_response = {
                            "type": "transcription_error",
                            "error": "Transcription service not configured",
                        }
                        await websocket.send(json.dumps(error_response))
                        continue

                    language = request.get("language")
                    session_id = request.get("session_id")
                    result_session_id = await self._transcription_manager.start_session(
                        phone_websocket=websocket,
                        language=language,
                        session_id=session_id,
                    )
                    if result_session_id:
                        logger.info(f"🎤 Transcription session started: {result_session_id}")
                    continue

                # Handle transcription stop request
                if message_type == "transcription_stop":
                    if self._transcription_manager:
                        session_id = request.get("session_id")
                        if session_id:
                            await self._transcription_manager.stop_session(session_id)
                            logger.info(f"🎤 Transcription session stopped: {session_id}")
                    continue

                # Handle direct voice transcription (for injecting into agent)
                if message_type == "voice_transcription":
                    task_id = request.get("task_id")
                    text = request.get("text", "")
                    is_final = request.get("is_final", True)

                    if task_id and text:
                        success = await self.inject_voice_instruction(task_id, text)
                        if success:
                            logger.info(f"🎤 Voice transcription received for task {task_id}")
                            ack = {
                                "type": "voice_transcription_ack",
                                "task_id": task_id,
                                "status": "injected",
                            }
                        else:
                            logger.warning(
                                f"🎤 No active task found for voice transcription: {task_id}"
                            )
                            ack = {
                                "type": "voice_transcription_ack",
                                "task_id": task_id,
                                "status": "error",
                                "error": "Task not found or not active",
                            }
                        await websocket.send(json.dumps(ack))
                    continue

                # Handle suggest_tasks request
                if message_type == "suggest_tasks":
                    await self._handle_suggest_tasks(websocket, request)
                    continue

                # Validate request fields for task execution
                task_id = request.get("task_id")
                command = request.get("command")

                if not task_id:
                    error_response = {
                        "status": "error",
                        "error": "Missing required field: task_id",
                    }
                    await websocket.send(json.dumps(error_response))
                    continue

                if not command:
                    error_response = {
                        "status": "error",
                        "error": "Missing required field: command",
                    }
                    await websocket.send(json.dumps(error_response))
                    continue

                # Check if this connection already has an active task running
                # (enforces one task per connection)
                if connection_id and connection_id in self.connection_active_task:
                    active_task_id = self.connection_active_task[connection_id]
                    logger.warning(
                        f"❌ Connection {connection_id} already has active task {active_task_id}, "
                        f"rejecting new task {task_id}"
                    )
                    error_response = {
                        "status": "error",
                        "error": f"Connection already has an active task ({active_task_id}). "
                        f"Cancel or wait for it to complete before starting a new task.",
                        "active_task_id": active_task_id,
                    }
                    await websocket.send(json.dumps(error_response))
                    continue

                config_dict = request.get("config")
                voice_command_enabled = request.get("voice_command_enabled", False)
                no_memorised_task = request.get("no_memorised_task", False)
                logger.info(f"Received request: {request}")

                # --- Task Memory Replay ---
                # Try to find a similar completed task and replay it
                if not no_memorised_task and self.config.plugins.task_memory.enabled:
                    memory_match = None
                    try:
                        from droiduse_backend.task_memory import search_similar_task

                        memory_match = await search_similar_task(
                            command,
                            auth_token=jwt_token,
                            device_id_header=authenticated_device_id,
                        )
                    except Exception as e:
                        logger.warning(f"Task memory search failed: {type(e).__name__}: {e}")
                        logger.debug(
                            f"Task memory search details - auth_token present: {bool(jwt_token)}, "
                            f"device_id: {authenticated_device_id}, goal: {command[:80]}"
                        )

                    if memory_match:
                        logger.info(
                            f"🧠 Memory match found (similarity={memory_match['similarity']:.3f}), "
                            f"original_goal=\"{memory_match['original_goal']}\", "
                            f"attempting replay for task {task_id}"
                        )
                        if connection_id:
                            self.connection_active_task[connection_id] = task_id
                        try:
                            # Send replay actions to phone
                            await websocket.send(
                                json.dumps(
                                    {
                                        "type": "memory_replay",
                                        "task_id": task_id,
                                        "actions": memory_match["replay_actions"],
                                        "similarity": memory_match["similarity"],
                                    }
                                )
                            )

                            # Wait for replay result from phone
                            result_raw = await asyncio.wait_for(websocket.recv(), timeout=300)
                            replay_result = json.loads(result_raw)

                            if replay_result.get(
                                "type"
                            ) == "memory_replay_result" and replay_result.get("success"):
                                # Replay succeeded - record completed task
                                from droiduse_backend.db.http_client import (
                                    create_task,
                                    update_task,
                                )

                                try:
                                    replay_task_id = await create_task(
                                        device_id=authenticated_device_id,
                                        goal=command,
                                        user_id=user_id,
                                        run_type="replay",
                                        is_reasoning=False,
                                        status="RUNNING",
                                        is_replay=True,
                                        replay_source_id=memory_match.get("source_task_id"),
                                        auth_token=jwt_token,
                                        device_id_header=authenticated_device_id,
                                    )
                                    if replay_task_id:
                                        await update_task(
                                            task_id=replay_task_id,
                                            status="COMPLETED",
                                            response="Completed via memory replay",
                                            total_steps=replay_result.get("steps_completed", 0),
                                            auth_token=jwt_token,
                                            device_id_header=authenticated_device_id,
                                        )
                                except Exception as db_err:
                                    logger.warning(f"Failed to record replay task: {db_err}")

                                # Send completion to phone
                                await websocket.send(
                                    json.dumps(
                                        {
                                            "status": "completed",
                                            "task_id": task_id,
                                            "result": {
                                                "success": True,
                                                "reason": "Task completed via memory replay",
                                                "steps": replay_result.get("steps_completed", 0),
                                                "replay": True,
                                            },
                                        }
                                    )
                                )
                                logger.info(
                                    f"🧠 Task {task_id} completed via memory replay "
                                    f"({replay_result.get('steps_completed', 0)} steps)"
                                )
                                continue  # Next task

                            # Replay failed - fall through to LLM execution
                            logger.info(
                                f"🧠 Memory replay failed for task {task_id} "
                                f"(step {replay_result.get('failed_at_step')}), "
                                f"falling back to LLM"
                            )

                        except (asyncio.TimeoutError, Exception) as e:
                            logger.warning(f"Memory replay failed: {e}")
                        finally:
                            if connection_id and connection_id in self.connection_active_task:
                                del self.connection_active_task[connection_id]

                # Register active task for this connection
                if connection_id:
                    self.connection_active_task[connection_id] = task_id

                try:
                    # Send acknowledgment
                    ack_response = {
                        "status": "accepted",
                        "task_id": task_id,
                        "message": "Task execution started",
                        "voice_command_enabled": voice_command_enabled,
                    }
                    await websocket.send(json.dumps(ack_response))

                    # Execute task with hard timeout to prevent indefinite hangs.
                    # Use max_time + 30s buffer so the agent's own max_time check
                    # fires first under normal conditions, but this catches truly
                    # stuck operations (hung LLM calls, unresponsive phone, etc.).
                    hard_timeout = self.config.agent.max_time + 30
                    try:
                        result = await asyncio.wait_for(
                            self.handle_task_request(
                                websocket=websocket,
                                task_id=task_id,
                                command=command,
                                config_dict=config_dict,
                                device_id=authenticated_device_id,
                                user_id=user_id,
                                jwt_token=jwt_token,
                                connection_id=connection_id,
                                voice_command_enabled=voice_command_enabled,
                            ),
                            timeout=hard_timeout,
                        )
                    except asyncio.TimeoutError:
                        logger.error(
                            f"⏰ Task {task_id} hit hard timeout after {hard_timeout}s, force-killing"
                        )
                        result = {
                            "success": False,
                            "reason": f"Task exceeded hard time limit ({hard_timeout}s)",
                            "steps": 0,
                            "structured_output": None,
                        }

                    # Send final result
                    final_response = {
                        "status": "completed",
                        "task_id": task_id,
                        "result": result,
                    }
                    await websocket.send(json.dumps(final_response))

                    logger.info(f"📱 Task {task_id} completed, waiting for next task...")

                finally:
                    # Always clean up active task tracking for this connection
                    if connection_id and connection_id in self.connection_active_task:
                        del self.connection_active_task[connection_id]

        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(
                f"📱 Phone disconnected from {client_ip} (code: {e.code}, reason: {e.reason})"
            )

        except OSError as e:
            # Handle network-related errors (common on cellular)
            if e.winerror == 121:  # Semaphore timeout
                logger.warning(
                    f"⏰ Network timeout from {client_ip}:{client_port} - "
                    f"Cellular connection may be slow or interrupted"
                )
            else:
                logger.error(f"🌐 Network error from {client_ip}:{client_port}: {e}")

        except asyncio.TimeoutError:
            logger.warning(f"⏰ Connection timeout from {client_ip}:{client_port}")

        except Exception as e:
            logger.exception(f"❌ Error handling connection from {client_ip}: {e}")

            # Try to send error response
            try:
                error_response = {"status": "error", "error": str(e)}
                await websocket.send(json.dumps(error_response))
            except Exception:
                pass

        finally:
            # Clean up transcription sessions for this connection
            if self._transcription_manager:
                await self._transcription_manager.cleanup_phone_sessions(websocket)

            # Clean up active task tracking for this connection
            if connection_id and connection_id in self.connection_active_task:
                del self.connection_active_task[connection_id]

            # Unregister device connection when it disconnects
            if authenticated_device_id:
                self._unregister_device_connection(authenticated_device_id)

    async def start(self, host: str = "0.0.0.0", port: int = 8000) -> None:
        """
        Start the WebSocket server with cellular-friendly settings.

        Args:
            host: Host address to bind to (default: 0.0.0.0 for all interfaces)
            port: Port to listen on (default: 8000)
        """
        logger.info("WebSocket server initialized with config")

        # Start audio player if enabled (non-blocking, won't break server)
        if self._audio_player:
            try:
                if self._audio_player.start():
                    logger.info("Audio player started for voice playback")
                else:
                    logger.info("Audio playback not available (missing dependencies)")
                    self._audio_player = None
            except Exception as e:
                logger.warning(f"Failed to start audio player: {e}")
                self._audio_player = None

        # Setup and initialize plugins based on config
        self._setup_plugins()
        plugin_manager = get_plugin_manager()
        await plugin_manager.initialize()
        logger.info("Plugins initialized")

        # Start app card HTTP server if enabled
        ws_config = self.config.websocket_server
        if ws_config.app_card_server_enabled:
            self._app_card_server = AppCardServer()
            await self._app_card_server.start(
                host=host,
                port=ws_config.app_card_server_port,
            )
            logger.info(
                f"App Card HTTP server started on http://{host}:{ws_config.app_card_server_port}"
            )

        # Start heartbeat server if enabled
        heartbeat_config = self.config.heartbeat_server
        if heartbeat_config.enabled:
            from droiduse_backend.api.heartbeat_server import HeartbeatServer

            self._heartbeat_server = HeartbeatServer(
                config=heartbeat_config,
                server_port=port,
                public_ip_address=ws_config.public_ip_address,
                server_name=ws_config.server_name,
                server_region=ws_config.server_region,
                server_capacity=ws_config.server_capacity,
                get_active_connections=lambda: len(self.device_metadata),
                is_server_running=lambda: self._running,
            )
            await self._heartbeat_server.start()
            logger.info(
                f"Heartbeat server started (interval: {heartbeat_config.heartbeat_interval}s)"
            )

        logger.info(f"🚀 Starting WebSocket server on {host}:{port}")

        # Configure WebSocket server with cellular-friendly timeouts from config
        async with serve(
            self.handle_connection,
            host,
            port,
            # Process HTTP requests (e.g., health checks) before WebSocket upgrade
            process_request=self._process_request,
            # Keep connection alive with ping/pong
            ping_interval=ws_config.ping_interval,
            ping_timeout=ws_config.ping_timeout,
            # Longer close timeout for slow networks
            close_timeout=ws_config.close_timeout,
            # Increase max message size for large screenshots/states
            max_size=ws_config.max_message_size,
        ) as server:
            self.server = server
            self._running = True

            logger.info(f"✅ WebSocket server running on ws://{host}:{port}")
            logger.info("📱 Waiting for phone connections (cellular-optimized)...")
            logger.info(
                f"   - Ping interval: {ws_config.ping_interval}s, "
                f"Ping timeout: {ws_config.ping_timeout}s"
            )
            logger.info(
                f"   - Close timeout: {ws_config.close_timeout}s, "
                f"Max message: {ws_config.max_message_size // (1024 * 1024)}MB, "
                f"Initial recv timeout: {ws_config.initial_recv_timeout}s"
            )
            auth_status = "enabled" if ws_config.auth_enabled else "disabled"
            logger.info(f"   - Authentication: {auth_status}")

            # Run forever
            await asyncio.Future()

    async def _process_request(self, path: str, request_headers):
        """
        Process HTTP requests before WebSocket upgrade.

        This allows the server to handle health checks on the same port as WebSocket connections.

        Args:
            path: Request path
            request_headers: Request headers

        Returns:
            HTTP response tuple (status, headers, body) or None to continue with WebSocket upgrade
        """
        # Health check endpoint for load balancer
        if path == "/health":
            import json as json_mod
            from datetime import datetime

            health_data = {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "version": "0.5.0",
                "websocket_server_running": self.is_running(),
            }
            return (
                http.HTTPStatus.OK,
                [("Content-Type", "application/json")],
                json_mod.dumps(health_data).encode() + b"\n",
            )

        # Continue with WebSocket upgrade for other paths
        return None

    def is_running(self) -> bool:
        """Check if server is running."""
        return self._running

    async def stop(self):
        """Stop the WebSocket server and shutdown plugins."""
        # Stop audio player if running
        if self._audio_player:
            try:
                self._audio_player.stop()
                logger.info("Audio player stopped")
            except Exception:
                pass  # Ignore cleanup errors

        # Stop heartbeat server if running
        if self._heartbeat_server:
            await self._heartbeat_server.stop()
            logger.info("Heartbeat server stopped")

        # Stop app card server if running
        if self._app_card_server:
            await self._app_card_server.stop()
            logger.info("App Card HTTP server stopped")

        # Shutdown plugins first
        plugin_manager = get_plugin_manager()
        await plugin_manager.shutdown()
        logger.info("Plugins shutdown")

        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self._running = False
            logger.info("🛑 WebSocket server stopped")


# Backwards compatibility: Keep the functional API
async def start_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """
    Start the WebSocket server (functional API).

    Args:
        host: Host address to bind to (default: 0.0.0.0 for all interfaces)
        port: Port to listen on (default: 8000)
    """
    server = WebSocketServer()
    await server.start(host=host, port=port)


def main():
    """Main entry point for the WebSocket server."""
    import sys

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Parse command line arguments
    import argparse

    parser = argparse.ArgumentParser(description="DroidUse WebSocket Server")
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host address to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to listen on (default: 8000)",
    )
    args = parser.parse_args()

    # Run server
    try:
        server = WebSocketServer()
        asyncio.run(server.start(host=args.host, port=args.port))
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")


if __name__ == "__main__":
    main()
