"""
Plugin system for database, tracing, and monitoring operations.

This module provides a fire-and-forget plugin architecture for background operations
during agent execution. All plugins execute asynchronously without blocking the main
agent workflow.
"""

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)
from droiduse_backend.plugins.local_logging import LocalLoggingPlugin
from droiduse_backend.plugins.manager import (
    PluginManager,
    emit_agent_finalize,
    emit_agent_init,
    emit_package_visit,
    emit_screenshot,
    emit_task_end,
    emit_task_start,
    emit_task_step,
    emit_trajectory_step,
    get_plugin_manager,
    reset_plugin_manager,
)
from droiduse_backend.plugins.memory_summary import MemorySummaryPlugin
from droiduse_backend.plugins.posthog_telemetry import PostHogTelemetryPlugin
from droiduse_backend.plugins.tracing import TracingPlugin
from droiduse_backend.plugins.trajectory import TrajectoryPlugin

__all__ = [
    # Base classes
    "Plugin",
    "PluginEvent",
    "PluginEventType",
    "PluginPriority",
    # Manager
    "PluginManager",
    "get_plugin_manager",
    "reset_plugin_manager",
    # Event emitters
    "emit_task_start",
    "emit_task_end",
    "emit_task_step",
    "emit_trajectory_step",
    "emit_screenshot",
    "emit_agent_init",
    "emit_agent_finalize",
    "emit_package_visit",
    # Plugins
    "LocalLoggingPlugin",
    "MemorySummaryPlugin",
    "PostHogTelemetryPlugin",
    "TracingPlugin",
    "TrajectoryPlugin",
]
