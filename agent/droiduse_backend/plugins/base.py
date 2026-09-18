"""
Base plugin interface and event definitions.

Plugins receive events and process them asynchronously in fire-and-forget mode.
The main agent workflow never blocks waiting for plugin operations to complete.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, Optional

logger = logging.getLogger("androiduse.plugins")


class PluginPriority(Enum):
    """Plugin execution priority. Higher priority plugins execute first."""

    CRITICAL = 0  # Must run first (e.g., tracing context setup)
    HIGH = 1
    NORMAL = 2
    LOW = 3


class PluginEventType(Enum):
    """Types of events that plugins can handle."""

    # Task lifecycle events (used by database, telemetry plugins)
    TASK_START = auto()  # Task begins - includes trajectory init
    TASK_STEP = auto()  # Task step completed - for database recording
    TASK_END = auto()  # Task ends - includes trajectory final

    # Trajectory events (for trajectory plugin)
    TRAJECTORY_STEP = auto()  # Trajectory step - separate from database recording

    # Screenshot events
    SCREENSHOT_CAPTURED = auto()

    # Agent telemetry events (for PostHog, etc.)
    AGENT_INIT = auto()
    AGENT_FINALIZE = auto()
    PACKAGE_VISIT = auto()

    # Custom events
    CUSTOM = auto()


@dataclass
class PluginEvent:
    """
    Event passed to plugins for processing.

    Events carry all necessary data for plugins to process without needing
    to access external state. This enables safe concurrent processing.
    """

    event_type: PluginEventType
    data: Dict[str, Any] = field(default_factory=dict)
    task_id: Optional[str] = None
    step_number: Optional[int] = None

    # Connection/Authentication context for task-related events
    connection_id: Optional[str] = (
        None  # Unique identifier for the connection (jwt_token + device_id)
    )
    jwt_token: Optional[str] = None  # User's JWT token
    device_id: Optional[str] = None  # Device identifier

    # Metadata
    source: str = "droidagent"  # Which component emitted the event
    priority: PluginPriority = PluginPriority.NORMAL


class Plugin(ABC):
    """
    Abstract base class for all plugins.

    Plugins process events asynchronously without blocking the main workflow.
    They should be designed to handle failures gracefully - a plugin failure
    should never crash the main agent execution.
    """

    def __init__(self, enabled: bool = True, priority: PluginPriority = PluginPriority.NORMAL):
        self.enabled = enabled
        self.priority = priority
        self._initialized = False

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name for this plugin."""
        pass

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        """
        Set of event types this plugin wants to receive.

        Override to filter events. By default, receives all events.
        """
        return set(PluginEventType)

    async def initialize(self) -> None:
        """
        Initialize plugin resources.

        Called once when the plugin is registered. Override to set up
        connections, load configuration, etc.
        """
        self._initialized = True

    async def shutdown(self) -> None:
        """
        Clean up plugin resources.

        Called when the plugin manager shuts down. Override to close
        connections, flush buffers, etc.
        """
        self._initialized = False

    @abstractmethod
    async def handle_event(self, event: PluginEvent) -> None:
        """
        Handle an event asynchronously.

        This method is called in fire-and-forget mode - the caller does not
        wait for it to complete. Implementations should handle all exceptions
        internally and log errors appropriately.

        Args:
            event: The event to process
        """
        pass

    def should_handle(self, event: PluginEvent) -> bool:
        """Check if this plugin should handle the given event."""
        if not self.enabled:
            return False
        if not self._initialized:
            return False
        return event.event_type in self.subscribed_events


@dataclass
class TaskStartData:
    """Data for TASK_START events."""

    goal: str
    user_id: Optional[str] = None
    run_type: str = "developer"
    is_reasoning: bool = False
    max_steps: Optional[int] = None
    timeout_sec: Optional[int] = None
    device_id: Optional[str] = None


@dataclass
class TaskEndData:
    """Data for TASK_END events."""

    status: str  # "COMPLETED", "FAILED", "TIMED_OUT"
    error: Optional[str] = None
    total_steps: Optional[int] = None
    trajectory_path: Optional[str] = None
    success: bool = False
    reason: str = ""


@dataclass
class TaskStepData:
    """Data for TASK_STEP events (database recording)."""

    step_number: int
    agent_type: str
    actions: Optional[list[Dict[str, Any]]] = None
    thought: Optional[str] = None
    description: Optional[str] = None
    subgoal: Optional[str] = None
    confidence: Optional[float] = None
    status: str = "PENDING"
    error: Optional[str] = None
    summary: Optional[str] = None
    full_response: Optional[str] = None
    screenshot_path: Optional[str] = None
    a11y_tree: Optional[Any] = None
    phone_state: Optional[Dict[str, Any]] = None
    formatted_text: Optional[str] = None


@dataclass
class TrajectoryStepData:
    """Data for TRAJECTORY_STEP events."""

    trajectory: Any  # Trajectory instance
    step_number: int


@dataclass
class ScreenshotData:
    """Data for SCREENSHOT_CAPTURED events."""

    screenshot: bytes
    mime_type: str = "image/png"
    vision_enabled: bool = False
    screenshots_enabled: bool = False
