"""
Memory Summary plugin for saving task summaries as user long-term memory.

This plugin listens to TASK_END events and creates a summary of the completed
task, storing it in the UserMemory table for long-term user context.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins.memory_summary")


class MemorySummaryPlugin(Plugin):
    """
    Plugin for saving task summaries as user long-term memory.

    Handles TASK_END events and stores a summary of the task execution
    in the UserMemory table, enabling agents to access historical context
    about user tasks.
    """

    # Memory key for storing task history
    TASK_HISTORY_KEY = "task_history"

    def __init__(self, enabled: bool = True, max_task_summaries: int = 50):
        super().__init__(enabled=enabled, priority=PluginPriority.LOW)
        self._task_id: Optional[str] = None
        self._goal: Optional[str] = None
        self._user_id: Optional[str] = None
        self._start_time: Optional[datetime] = None
        self._max_task_summaries = max_task_summaries
        self._jwt_token: Optional[str] = None
        self._device_id: Optional[str] = None

    @property
    def name(self) -> str:
        return "memory_summary"

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        return {
            PluginEventType.TASK_START,
            PluginEventType.TASK_END,
        }

    async def initialize(self) -> None:
        """Initialize the plugin."""
        await super().initialize()
        logger.debug("Memory summary plugin initialized")

    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        self._task_id = None
        self._goal = None
        self._user_id = None
        self._start_time = None
        await super().shutdown()
        logger.debug("Memory summary plugin shutdown")

    async def handle_event(self, event: PluginEvent) -> None:
        """Handle memory-related events."""
        try:
            if event.event_type == PluginEventType.TASK_START:
                await self._handle_task_start(event.data)
            elif event.event_type == PluginEventType.TASK_END:
                await self._handle_task_end(event.data)
        except Exception as e:
            logger.warning(f"Memory summary plugin error: {e}")

    async def _handle_task_start(self, data: Dict[str, Any]) -> None:
        """Capture task start information for later summarization."""
        self._task_id = data.get("task_id")
        self._goal = data.get("goal", "")
        self._user_id = data.get("user_id")
        self._jwt_token = data.get("jwt_token")
        self._device_id = data.get("device_id")
        self._start_time = datetime.now()
        logger.debug(f"Memory summary tracking task: {self._task_id}")

    async def _handle_task_end(self, data: Dict[str, Any]) -> None:
        """Generate and save task summary to user memory."""
        # Skip if no user_id (can't save memory without a user)
        if not self._user_id:
            logger.debug("Skipping memory summary - no user_id")
            return

        from droiduse_backend.db.helpers import (
            append_to_user_memory,
            get_task_with_steps,
        )

        try:
            # Get task details with steps
            task_data = None
            if self._task_id:
                task_data = await get_task_with_steps(
                    self._task_id,
                    auth_token=self._jwt_token,
                    device_id_header=self._device_id,
                )

            # Generate the summary
            summary = self._generate_summary(data, task_data)

            # Save to user memory
            await append_to_user_memory(
                user_id=self._user_id,
                type=self.TASK_HISTORY_KEY,
                new_value=summary,
                max_entries=self._max_task_summaries,
                description="History of completed agent tasks and their outcomes",
                auth_token=self._jwt_token,
                device_id_header=self._device_id,
            )

            logger.info(f"Saved task summary to user memory for user: {self._user_id}")

        except Exception as e:
            logger.warning(f"Failed to save task summary: {e}")

    def _generate_summary(
        self,
        end_data: Dict[str, Any],
        task_data: Optional[Dict[str, Any]],
    ) -> str:
        """
        Generate a concise summary of the task execution.

        Args:
            end_data: Data from TASK_END event
            task_data: Full task data with steps from database

        Returns:
            Formatted summary string
        """
        # Determine status
        status = end_data.get("status", "UNKNOWN")
        success = end_data.get("success", status == "COMPLETED")
        error = end_data.get("error")
        reason = end_data.get("reason", "")

        # Get timing info
        completed_at = datetime.now()
        duration_str = ""
        if self._start_time:
            duration = completed_at - self._start_time
            duration_str = f" (duration: {duration.total_seconds():.1f}s)"

        # Get goal and steps info
        goal = self._goal or (task_data.get("goal") if task_data else "Unknown task")
        total_steps = end_data.get("total_steps") or (
            task_data.get("total_steps") if task_data else 0
        )

        # Build summary parts
        parts = []

        # Header with timestamp
        parts.append(f"[{completed_at.strftime('%Y-%m-%d %H:%M:%S')}]")

        # Goal
        parts.append(f"Task: {goal}")

        # Outcome
        outcome = "Completed successfully" if success else f"Failed ({status})"
        parts.append(f"Outcome: {outcome}{duration_str}")

        # Steps summary
        if total_steps:
            parts.append(f"Steps taken: {total_steps}")

        # Key actions (if available from task_data)
        if task_data and task_data.get("steps"):
            key_actions = self._extract_key_actions(task_data["steps"])
            if key_actions:
                parts.append(f"Key actions: {key_actions}")

        # Error or completion reason
        if error:
            parts.append(f"Error: {error}")
        elif reason:
            parts.append(f"Result: {reason}")

        return "\n".join(parts)

    def _extract_key_actions(self, steps: list[Dict[str, Any]], max_actions: int = 3) -> str:
        """
        Extract the most significant actions from task steps.

        Args:
            steps: List of step dictionaries
            max_actions: Maximum number of actions to include

        Returns:
            Comma-separated string of key actions
        """
        key_actions = []

        for step in steps:
            # Prefer description, then subgoal, then extract from actions array
            action = step.get("description") or step.get("subgoal")
            if action and action not in key_actions:
                key_actions.append(action)
                if len(key_actions) >= max_actions:
                    break

        # If no descriptions, fall back to action types from actions array
        if not key_actions:
            action_types = set()
            for step in steps:
                actions = step.get("actions")
                if actions and isinstance(actions, list):
                    for action in actions:
                        if isinstance(action, dict):
                            action_type = action.get("type")
                            if action_type and action_type != "unknown":
                                action_types.add(action_type)
            key_actions = list(action_types)[:max_actions]

        return ", ".join(key_actions) if key_actions else ""

    @property
    def task_id(self) -> Optional[str]:
        """Get the current task ID."""
        return self._task_id
