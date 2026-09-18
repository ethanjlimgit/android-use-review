import asyncio
import time
from typing import Any, Callable, Coroutine, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DroidAgentState(BaseModel):
    """
    State model for DroidAgent workflow - shared across parent and child workflows.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)
    # Task context
    instruction: str = ""
    step_number: int = 0
    task_start_time: float = 0.0  # Time when task started (from time.perf_counter())
    runtype: str = "developer"
    user_id: str | None = None
    jwt_token: str | None = None  # User's JWT token for authenticated API calls
    device_id: str | None = None  # Device ID for this task (for multi-connection support)
    connection_id: str | None = None  # Unique connection identifier (hash of jwt_token + device_id)
    task_id: str | None = None  # Unique task ID for this execution (for WebSocket routing)
    cancellation_event: asyncio.Event | None = None  # Event to signal task cancellation

    # ========================================================================
    # Voice Command Mode (real-time transcription + TTS responses)
    # ========================================================================
    voice_command_enabled: bool = False  # Whether voice command mode is active
    voice_instruction_queue: asyncio.Queue | None = None  # Queue for incoming voice instructions
    last_voice_instruction: str = ""  # Most recent voice instruction
    voice_instruction_timestamp: float = 0.0  # When the last instruction was received
    voice_instruction_history: List[Dict] = Field(default_factory=list)  # All voice instructions
    # Callback for sending agent responses for TTS (set by WebSocket server)
    _agent_response_callback: Optional[Callable[[str, str, str], Coroutine[Any, Any, bool]]] = None

    # ========================================================================
    # Device State (current)
    # ========================================================================
    formatted_device_state: str = ""  # Text description for prompts
    focused_text: str = ""  # Text in focused input field
    a11y_tree: List[Dict] = Field(default_factory=list)  # Raw accessibility tree
    phone_state: Dict = Field(default_factory=dict)  # Package, activity, etc.
    screenshot: str | bytes | None = None  # Current screenshot
    width: int = 0
    height: int = 0

    # ========================================================================
    # Device State (previous - for before/after comparison)
    # ========================================================================
    previous_formatted_device_state: str = ""

    # ========================================================================
    # App Tracking
    # ========================================================================
    app_card: str = ""
    current_package_name: str = ""
    current_activity_name: str = ""
    visited_packages: set = Field(default_factory=set)
    visited_activities: set = Field(default_factory=set)

    # ========================================================================
    # Unified Thought/Plan Tracking (used by all agents)
    # ========================================================================
    last_thought: str = ""  # Most recent thought from any agent
    previous_plan: str = ""  # Plan from previous iteration
    progress_summary: str = ""  # Cumulative progress (replaces each turn)

    # ========================================================================
    # Planning State (Manager sets these)
    # ========================================================================
    plan: str = ""  # Current plan
    current_subgoal: str = ""  # Current subgoal for Executor
    manager_answer: str = ""  # Final answer when complete

    # ========================================================================
    # Action Tracking
    # ========================================================================
    action_history: List[Dict] = Field(default_factory=list)
    summary_history: List[str] = Field(default_factory=list)
    action_outcomes: List[bool] = Field(default_factory=list)
    error_descriptions: List[str] = Field(default_factory=list)
    last_action: Dict = Field(default_factory=dict)
    last_summary: str = ""

    # ========================================================================
    # Memory (append-only information storage)
    # ========================================================================
    memory: str = ""

    # ========================================================================
    # Message History (for stateful agents - list of dicts)
    # ========================================================================
    message_history: List[Dict] = Field(default_factory=list)

    # ========================================================================
    # Error Handling
    # ========================================================================
    error_flag_plan: bool = False
    err_to_manager_thresh: int = 2

    # ========================================================================
    # Script Execution Tracking
    # ========================================================================
    scripter_history: List[Dict] = Field(default_factory=list)
    last_scripter_message: str = ""
    last_scripter_success: bool = True

    # ========================================================================
    # Text Manipulation Tracking
    # ========================================================================
    has_text_to_modify: bool = False
    text_manipulation_history: List[Dict] = Field(default_factory=list)
    last_text_manipulation_success: bool = False

    # ========================================================================
    # Custom Variables (user-defined)
    # ========================================================================
    custom_variables: Dict = Field(default_factory=dict)
    output_dir: str = ""

    def update_current_app(self, package_name: str, activity_name: str):
        """
        Update package and activity together, capturing telemetry event only once.

        This prevents duplicate PackageVisitEvents when both package and activity change.
        """
        # Check if either changed
        package_changed = package_name != self.current_package_name
        activity_changed = activity_name != self.current_activity_name

        if not (package_changed or activity_changed):
            return  # No change, nothing to do

        # Update tracking sets
        if package_changed and package_name:
            self.visited_packages.add(package_name)
        if activity_changed and activity_name:
            self.visited_activities.add(activity_name)

        # Update values
        self.current_package_name = package_name
        self.current_activity_name = activity_name

        # Capture telemetry event for any change
        # This ensures we track when apps close or transitions to empty state occur
        from droiduse_backend.telemetry import PackageVisitEvent, capture

        capture(
            PackageVisitEvent(
                package_name=package_name or "Unknown",
                activity_name=activity_name or "Unknown",
                step_number=self.step_number,
            ),
            user_id=self.user_id,
        )

    def initialize_voice_queue(self) -> None:
        """Initialize the voice instruction queue if not already created."""
        if self.voice_instruction_queue is None:
            self.voice_instruction_queue = asyncio.Queue()

    async def add_voice_instruction(self, instruction: str) -> None:
        """
        Add a voice instruction to the queue.

        Args:
            instruction: The transcribed voice instruction
        """
        if self.voice_instruction_queue is None:
            self.initialize_voice_queue()

        self.last_voice_instruction = instruction
        self.voice_instruction_timestamp = time.time()

        # Add to history
        self.voice_instruction_history.append(
            {
                "instruction": instruction,
                "timestamp": self.voice_instruction_timestamp,
                "step_number": self.step_number,
            }
        )

        # Put in queue for immediate processing
        await self.voice_instruction_queue.put(instruction)

    async def get_pending_voice_instruction(self) -> str | None:
        """
        Get the next pending voice instruction without blocking.

        Returns:
            The instruction string or None if no pending instructions
        """
        if self.voice_instruction_queue is None:
            return None

        try:
            return self.voice_instruction_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def has_pending_voice_instructions(self) -> bool:
        """Check if there are pending voice instructions."""
        if self.voice_instruction_queue is None:
            return False
        return not self.voice_instruction_queue.empty()

    def get_recent_voice_instruction(self, max_age_seconds: float = 30.0) -> str | None:
        """
        Get the most recent voice instruction if it's not too old.

        Args:
            max_age_seconds: Maximum age of instruction to return

        Returns:
            The instruction or None if too old or not set
        """
        if not self.last_voice_instruction:
            return None

        age = time.time() - self.voice_instruction_timestamp
        if age > max_age_seconds:
            return None

        return self.last_voice_instruction

    def set_agent_response_callback(
        self, callback: Callable[[str, str, str], Coroutine[Any, Any, bool]]
    ) -> None:
        """
        Set the callback for sending agent responses for TTS.

        Args:
            callback: Async function(task_id, text, response_type) -> bool
        """
        self._agent_response_callback = callback

    async def send_agent_response(
        self,
        text: str,
        response_type: str = "status",
        task_id: str | None = None,
    ) -> bool:
        """
        Send an agent response to the phone for TTS (text-to-speech).

        Only sends if voice_command_enabled is True and callback is set.

        Args:
            text: The text to be spoken by TTS
            response_type: Type of response - "status", "thought", "completed", "error"
            task_id: Optional task ID override (uses device_id if not provided)

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.voice_command_enabled:
            return False

        if self._agent_response_callback is None:
            return False

        # Use stored task_id if not provided
        effective_task_id = task_id or self.task_id or ""
        if not effective_task_id:
            return False

        return await self._agent_response_callback(effective_task_id, text, response_type)
