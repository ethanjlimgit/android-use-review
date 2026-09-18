"""
Local logging plugin for recording agent tasks and steps via HTTP API.

This plugin handles all logging operations in fire-and-forget mode,
ensuring that HTTP I/O never blocks the main agent workflow.
Sends task/step data to the web API server for database storage.

Supports multiple concurrent WebSocket connections by tracking task context
per connection (identified by randomly generated connection_id).

Race condition handling: Task steps wait for task creation to complete
using asyncio.Event synchronization with a 5-second timeout.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Dict

from droiduse_backend.db.helpers import (
    create_task,
    create_task_step,
    update_task,
)
from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins.local_logging")


@dataclass
class TaskContext:
    """Context for a single task/connection."""

    task_id: str
    connection_id: str
    jwt_token: str
    device_id: str
    task_created: asyncio.Event = field(default_factory=asyncio.Event)
    step_id_cache: Dict[int, str] = field(default_factory=dict)


class LocalLoggingPlugin(Plugin):
    """
    Plugin for recording agent execution via HTTP API.

    Handles TASK_START, TASK_END, and TASK_STEP events,
    persisting them to the web API server asynchronously.

    Supports multiple concurrent connections by tracking task context
    per connection using connection_id as the key.
    """

    def __init__(self, enabled: bool = True):
        super().__init__(enabled=enabled, priority=PluginPriority.NORMAL)
        # Map connection_id -> TaskContext
        self._active_tasks: Dict[str, TaskContext] = {}

    @property
    def name(self) -> str:
        return "local_logging"

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        return {
            PluginEventType.TASK_START,
            PluginEventType.TASK_END,
            PluginEventType.TASK_STEP,
        }

    async def initialize(self) -> None:
        """Initialize HTTP client connection."""
        await super().initialize()
        logger.debug("Local logging plugin initialized")

    async def shutdown(self) -> None:
        """Clean up HTTP client resources."""
        self._active_tasks.clear()
        await super().shutdown()
        logger.debug("Local logging plugin shutdown")

    async def handle_event(self, event: PluginEvent) -> None:
        """Handle logging-related events."""
        try:
            if event.event_type == PluginEventType.TASK_START:
                await self._handle_task_start(event)
            elif event.event_type == PluginEventType.TASK_END:
                await self._handle_task_end(event)
            elif event.event_type == PluginEventType.TASK_STEP:
                await self._handle_task_step(event)
        except Exception as e:
            logger.warning(f"Local logging plugin error: {e}")

    async def _handle_task_start(self, event: PluginEvent) -> None:
        """Handle TASK_START event."""
        connection_id = event.connection_id
        jwt_token = event.jwt_token
        device_id = event.device_id
        data = event.data

        # Validate required fields
        if not connection_id:
            logger.warning("TASK_START event missing connection_id, skipping logging")
            return

        if not jwt_token or not device_id:
            logger.warning("TASK_START event missing jwt_token or device_id, skipping logging")
            return

        # If there's already an active task for this connection, log a warning
        if connection_id in self._active_tasks:
            logger.warning(
                f"Connection {connection_id} already has an active task, "
                f"it will be replaced with new task"
            )

        # Create placeholder context immediately to handle race conditions
        task_ctx = TaskContext(
            task_id="",  # Will be set after creation
            connection_id=connection_id,
            jwt_token=jwt_token,
            device_id=device_id,
        )
        self._active_tasks[connection_id] = task_ctx

        try:
            # Create task in database with RUNNING status
            task_id = await create_task(
                goal=data.get("goal", ""),
                user_id=data.get("user_id"),
                run_type=data.get("run_type", "developer"),
                is_reasoning=data.get("is_reasoning", False),
                max_steps=data.get("max_steps"),
                timeout_sec=data.get("timeout_sec"),
                device_id=device_id,
                status="RUNNING",
                auth_token=jwt_token,
                device_id_header=device_id,
            )

            # Update task_id and signal completion
            task_ctx.task_id = task_id
            task_ctx.task_created.set()

            logger.debug(
                f"Started logging for task {task_id} (connection_id: {connection_id}, "
                f"device: {device_id}, active tasks: {len(self._active_tasks)})"
            )
        except Exception as e:
            logger.error(
                f"Failed to create task for connection {connection_id}: {e}. "
                f"Task steps will not be logged. Check API connectivity and authentication."
            )
            # Clean up task context if creation failed
            self._active_tasks.pop(connection_id, None)

    async def _handle_task_end(self, event: PluginEvent) -> None:
        """Handle TASK_END event."""
        connection_id = event.connection_id
        data = event.data

        # Validate required fields
        if not connection_id:
            logger.warning("TASK_END event missing connection_id, skipping logging")
            return

        task_ctx = self._active_tasks.get(connection_id)

        if not task_ctx:
            logger.debug(
                f"No active task found for connection_id {connection_id}, "
                f"skipping task_end. This is expected if task creation failed."
            )
            return

        # Wait for task creation to complete (with timeout)
        try:
            await asyncio.wait_for(task_ctx.task_created.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning(
                f"Timeout waiting for task creation for connection_id {connection_id}, "
                f"skipping task_end"
            )
            self._active_tasks.pop(connection_id, None)
            return

        try:
            await update_task(
                task_id=task_ctx.task_id,
                status=data.get("status", "COMPLETED"),
                error=data.get("error"),
                response=data.get("reason"),  # Agent's completion/failure message
                total_steps=data.get("total_steps"),
                profiling_summary=data.get("profiling_summary"),
                auth_token=task_ctx.jwt_token,
                device_id_header=task_ctx.device_id,
            )
            logger.debug(
                f"Finished logging for task {task_ctx.task_id} (connection_id: {connection_id}, "
                f"device: {task_ctx.device_id}, remaining tasks: {len(self._active_tasks) - 1})"
            )
        except Exception as e:
            logger.warning(f"Failed to finish logging: {e}")
        finally:
            # Clean up task context
            self._active_tasks.pop(connection_id, None)

    async def _handle_task_step(self, event: PluginEvent) -> None:
        """Handle TASK_STEP event for HTTP logging."""
        connection_id = event.connection_id
        data = event.data

        # Validate required fields
        if not connection_id:
            logger.warning("TASK_STEP event missing connection_id, skipping logging")
            return

        task_ctx = self._active_tasks.get(connection_id)

        if not task_ctx:
            logger.debug(
                f"No active task found for connection_id {connection_id}, "
                f"skipping task_step. This is expected if task creation failed."
            )
            return

        # Wait for task creation to complete (with timeout to avoid blocking)
        try:
            await asyncio.wait_for(task_ctx.task_created.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning(
                f"Timeout waiting for task creation for connection_id {connection_id}, "
                f"skipping task_step"
            )
            return

        try:
            step_number = data.get("step_number", 0)
            step_id = await create_task_step(
                task_id=task_ctx.task_id,
                step_number=step_number,
                agent_type=data.get("agent_type", "unknown"),
                actions=data.get("actions"),
                thought=data.get("thought"),
                description=data.get("description"),
                subgoal=data.get("subgoal"),
                confidence=data.get("confidence"),
                status=data.get("status", "PENDING"),
                error=data.get("error"),
                summary=data.get("summary"),
                full_response=data.get("full_response"),
                a11y_tree=data.get("a11y_tree"),
                phone_state=data.get("phone_state"),
                formatted_text=data.get("formatted_text"),
                auth_token=task_ctx.jwt_token,
                device_id_header=task_ctx.device_id,
            )
            task_ctx.step_id_cache[step_number] = step_id
            logger.debug(
                f"Recorded step {step_number} for task {task_ctx.task_id} "
                f"(connection_id: {connection_id}, device: {task_ctx.device_id})"
            )
        except Exception as e:
            logger.warning(f"Failed to record step: {e}")
