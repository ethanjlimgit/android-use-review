"""
Plugin manager for coordinating plugin lifecycle and event dispatch.

The manager handles:
- Plugin registration and initialization
- Fire-and-forget event dispatch to all registered plugins
- Background task management for async operations
- Graceful shutdown with configurable timeout
"""

import asyncio
import logging
from typing import Dict, Optional, Set

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins")

# Global plugin manager instance
_plugin_manager: Optional["PluginManager"] = None


def get_plugin_manager() -> "PluginManager":
    """Get the global plugin manager instance."""
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = PluginManager()
    return _plugin_manager


def reset_plugin_manager() -> None:
    """Reset the global plugin manager. Useful for testing."""
    global _plugin_manager
    _plugin_manager = None


class PluginManager:
    """
    Manages plugin lifecycle and event dispatch.

    Events are dispatched to plugins in fire-and-forget mode using background
    tasks. The manager tracks all pending tasks and provides graceful shutdown.
    """

    def __init__(self, max_pending_tasks: int = 1000):
        """
        Initialize the plugin manager.

        Args:
            max_pending_tasks: Maximum number of pending background tasks.
                               If exceeded, oldest tasks may be dropped.
        """
        self._plugins: Dict[str, Plugin] = {}
        self._pending_tasks: Set[asyncio.Task] = set()
        self._max_pending_tasks = max_pending_tasks
        self._shutdown_event = asyncio.Event()
        self._initialized = False
        self._task_id: Optional[str] = None

    @property
    def plugins(self) -> Dict[str, Plugin]:
        """Get all registered plugins."""
        return self._plugins.copy()

    @property
    def task_id(self) -> Optional[str]:
        """Get the current task ID."""
        return self._task_id

    @task_id.setter
    def task_id(self, value: Optional[str]) -> None:
        """Set the current task ID."""
        self._task_id = value

    def register(self, plugin: Plugin) -> None:
        """
        Register a plugin with the manager.

        Args:
            plugin: Plugin instance to register
        """
        if plugin.name in self._plugins:
            logger.warning(f"Plugin {plugin.name} already registered, replacing")

        self._plugins[plugin.name] = plugin
        logger.debug(f"Registered plugin: {plugin.name} (priority={plugin.priority.name})")

    def unregister(self, plugin_name: str) -> Optional[Plugin]:
        """
        Unregister a plugin by name.

        Args:
            plugin_name: Name of the plugin to remove

        Returns:
            The removed plugin, or None if not found
        """
        plugin = self._plugins.pop(plugin_name, None)
        if plugin:
            logger.debug(f"Unregistered plugin: {plugin_name}")
        return plugin

    def get_plugin(self, plugin_name: str) -> Optional[Plugin]:
        """Get a plugin by name."""
        return self._plugins.get(plugin_name)

    async def initialize(self) -> None:
        """Initialize all registered plugins."""
        if self._initialized:
            return

        # Sort plugins by priority for initialization
        sorted_plugins = sorted(self._plugins.values(), key=lambda p: p.priority.value)

        for plugin in sorted_plugins:
            try:
                await plugin.initialize()
                logger.debug(f"Initialized plugin: {plugin.name}")
            except Exception as e:
                logger.error(f"Failed to initialize plugin {plugin.name}: {e}")
                plugin.enabled = False

        self._initialized = True

    async def shutdown(self, timeout: float = 10.0) -> None:
        """
        Shutdown all plugins and wait for pending tasks.

        Args:
            timeout: Maximum seconds to wait for pending tasks
        """
        self._shutdown_event.set()

        # Wait for pending tasks with timeout
        if self._pending_tasks:
            pending_count = len(self._pending_tasks)
            logger.debug(f"Waiting for {pending_count} pending plugin tasks...")

            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._pending_tasks, return_exceptions=True),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                remaining = len([t for t in self._pending_tasks if not t.done()])
                logger.warning(
                    f"Plugin shutdown timeout after {timeout}s, {remaining} tasks still pending"
                )
                # Cancel remaining tasks
                for task in self._pending_tasks:
                    if not task.done():
                        task.cancel()

        # Shutdown plugins in reverse priority order
        sorted_plugins = sorted(
            self._plugins.values(), key=lambda p: p.priority.value, reverse=True
        )

        for plugin in sorted_plugins:
            try:
                await plugin.shutdown()
                logger.debug(f"Shutdown plugin: {plugin.name}")
            except Exception as e:
                logger.error(f"Error shutting down plugin {plugin.name}: {e}")

        self._plugins.clear()
        self._pending_tasks.clear()
        self._initialized = False

    def emit(
        self,
        event_type: PluginEventType,
        data: Optional[dict] = None,
        step_number: Optional[int] = None,
        priority: PluginPriority = PluginPriority.NORMAL,
        source: str = "droidagent",
        connection_id: Optional[str] = None,
        jwt_token: Optional[str] = None,
        device_id: Optional[str] = None,
    ) -> None:
        """
        Emit an event to all registered plugins (fire-and-forget).

        This method returns immediately. Events are processed asynchronously
        in background tasks.

        Args:
            event_type: Type of event to emit
            data: Event data dictionary
            step_number: Optional step number for step-related events
            priority: Event priority
            source: Source component name
            connection_id: Unique connection identifier (pre-computed)
            jwt_token: User's JWT token (for task-related events)
            device_id: Device identifier (for task-related events)
        """
        event = PluginEvent(
            event_type=event_type,
            data=data or {},
            task_id=self._task_id,
            step_number=step_number,
            connection_id=connection_id,
            jwt_token=jwt_token,
            device_id=device_id,
            source=source,
            priority=priority,
        )
        self._dispatch(event)

    def _dispatch(self, event: PluginEvent) -> None:
        """
        Dispatch an event to all interested plugins.

        Creates background tasks for each plugin that wants to handle the event.
        Tasks are tracked for graceful shutdown.
        """
        if self._shutdown_event.is_set():
            return

        # Get plugins sorted by priority that should handle this event
        handlers = [
            p
            for p in sorted(self._plugins.values(), key=lambda p: p.priority.value)
            if p.should_handle(event)
        ]

        if not handlers:
            return

        # Cleanup completed tasks periodically
        self._cleanup_completed_tasks()

        # Check if we're at capacity
        if len(self._pending_tasks) >= self._max_pending_tasks:
            logger.warning(
                f"Plugin task queue full ({self._max_pending_tasks}), "
                f"dropping event: {event.event_type.name}"
            )
            return

        # Create background tasks for each handler
        for plugin in handlers:
            task = asyncio.create_task(
                self._safe_handle(plugin, event),
                name=f"plugin-{plugin.name}-{event.event_type.name}",
            )
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)

    async def _safe_handle(self, plugin: Plugin, event: PluginEvent) -> None:
        """
        Safely handle an event, catching all exceptions.

        Plugin failures should never affect the main agent workflow.
        """
        try:
            await plugin.handle_event(event)
        except Exception as e:
            logger.error(
                f"Plugin {plugin.name} failed handling {event.event_type.name}: {e}",
                exc_info=True,
            )

    def _cleanup_completed_tasks(self) -> None:
        """Remove completed tasks from the pending set."""
        completed = {t for t in self._pending_tasks if t.done()}
        self._pending_tasks -= completed


# Convenience functions for common event emissions


def emit_task_start(
    goal: str,
    user_id: Optional[str] = None,
    run_type: str = "developer",
    is_reasoning: bool = False,
    max_steps: Optional[int] = None,
    timeout_sec: Optional[int] = None,
    device_id: Optional[str] = None,
    jwt_token: Optional[str] = None,
    connection_id: Optional[str] = None,
    trajectory: Optional[any] = None,
) -> None:
    """Emit a TASK_START event (includes trajectory init)."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.TASK_START,
        data={
            "goal": goal,
            "user_id": user_id,
            "run_type": run_type,
            "is_reasoning": is_reasoning,
            "max_steps": max_steps,
            "timeout_sec": timeout_sec,
            "device_id": device_id,
            "jwt_token": jwt_token,
            "trajectory": trajectory,
        },
        priority=PluginPriority.HIGH,
        connection_id=connection_id,
        jwt_token=jwt_token,
        device_id=device_id,
    )


def emit_task_end(
    status: str,
    success: bool = False,
    reason: str = "",
    error: Optional[str] = None,
    total_steps: Optional[int] = None,
    trajectory_path: Optional[str] = None,
    trajectory: Optional[any] = None,
    create_gif: bool = False,
    profiling_summary: Optional[dict] = None,
    jwt_token: Optional[str] = None,
    device_id: Optional[str] = None,
    connection_id: Optional[str] = None,
) -> None:
    """Emit a TASK_END event (includes trajectory final)."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.TASK_END,
        data={
            "status": status,
            "success": success,
            "reason": reason,
            "error": error,
            "total_steps": total_steps,
            "trajectory_path": trajectory_path,
            "trajectory": trajectory,
            "create_gif": create_gif,
            "profiling_summary": profiling_summary,
            "jwt_token": jwt_token,
            "device_id": device_id,
        },
        priority=PluginPriority.HIGH,
        connection_id=connection_id,
        jwt_token=jwt_token,
        device_id=device_id,
    )


def emit_task_step(
    step_number: int,
    agent_type: str,
    actions: Optional[list[dict]] = None,
    thought: Optional[str] = None,
    description: Optional[str] = None,
    subgoal: Optional[str] = None,
    confidence: Optional[float] = None,
    status: str = "PENDING",
    error: Optional[str] = None,
    summary: Optional[str] = None,
    full_response: Optional[str] = None,
    screenshot_path: Optional[str] = None,
    a11y_tree: Optional[any] = None,
    phone_state: Optional[dict] = None,
    formatted_text: Optional[str] = None,
    jwt_token: Optional[str] = None,
    device_id: Optional[str] = None,
    connection_id: Optional[str] = None,
) -> None:
    """Emit a TASK_STEP event for database recording."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.TASK_STEP,
        data={
            "step_number": step_number,
            "agent_type": agent_type,
            "actions": actions,
            "thought": thought,
            "description": description,
            "subgoal": subgoal,
            "confidence": confidence,
            "status": status,
            "error": error,
            "summary": summary,
            "full_response": full_response,
            "screenshot_path": screenshot_path,
            "a11y_tree": a11y_tree,
            "phone_state": phone_state,
            "formatted_text": formatted_text,
            "jwt_token": jwt_token,
            "device_id": device_id,
        },
        step_number=step_number,
        connection_id=connection_id,
        jwt_token=jwt_token,
        device_id=device_id,
    )


def emit_trajectory_step(trajectory: any, step_number: int) -> None:
    """Emit a TRAJECTORY_STEP event for trajectory writing."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.TRAJECTORY_STEP,
        data={"trajectory": trajectory, "step_number": step_number},
        step_number=step_number,
    )


def emit_screenshot(
    screenshot: bytes,
    mime_type: str = "image/png",
    vision_enabled: bool = False,
    screenshots_enabled: bool = False,
) -> None:
    """Emit a SCREENSHOT_CAPTURED event."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.SCREENSHOT_CAPTURED,
        data={
            "screenshot": screenshot,
            "mime_type": mime_type,
            "vision_enabled": vision_enabled,
            "screenshots_enabled": screenshots_enabled,
        },
    )


def emit_agent_init(
    goal: str,
    llms: dict,
    tools: str,
    max_steps: int,
    timeout: int,
    vision: dict,
    reasoning: bool,
    enable_tracing: bool,
    debug: bool,
    save_trajectories: str,
    runtype: str,
    user_id: Optional[str] = None,
    custom_prompts: Optional[dict] = None,
) -> None:
    """Emit an AGENT_INIT event for telemetry."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.AGENT_INIT,
        data={
            "goal": goal,
            "llms": llms,
            "tools": tools,
            "max_steps": max_steps,
            "timeout": timeout,
            "vision": vision,
            "reasoning": reasoning,
            "enable_tracing": enable_tracing,
            "debug": debug,
            "save_trajectories": save_trajectories,
            "runtype": runtype,
            "user_id": user_id,
            "custom_prompts": custom_prompts,
        },
        priority=PluginPriority.LOW,
    )


def emit_agent_finalize(
    success: bool,
    reason: str,
    steps: int,
    unique_packages_count: int,
    unique_activities_count: int,
    user_id: Optional[str] = None,
) -> None:
    """Emit an AGENT_FINALIZE event for telemetry."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.AGENT_FINALIZE,
        data={
            "success": success,
            "reason": reason,
            "steps": steps,
            "unique_packages_count": unique_packages_count,
            "unique_activities_count": unique_activities_count,
            "user_id": user_id,
        },
        priority=PluginPriority.LOW,
    )


def emit_package_visit(
    package_name: str,
    activity_name: str,
    user_id: Optional[str] = None,
) -> None:
    """Emit a PACKAGE_VISIT event for telemetry."""
    manager = get_plugin_manager()
    manager.emit(
        PluginEventType.PACKAGE_VISIT,
        data={
            "package_name": package_name,
            "activity_name": activity_name,
            "user_id": user_id,
        },
        priority=PluginPriority.LOW,
    )
