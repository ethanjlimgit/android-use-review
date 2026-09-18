"""
Trajectory plugin for background trajectory writing.

This plugin wraps the TrajectoryWriter to provide fire-and-forget
trajectory persistence without blocking the main agent workflow.
"""

import logging
from typing import Any, Dict, Optional

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins.trajectory")


class TrajectoryPlugin(Plugin):
    """
    Plugin for writing trajectory data to disk.

    Handles TASK_START (init), TRAJECTORY_STEP, and TASK_END (final) events
    using the existing TrajectoryWriter infrastructure.
    """

    def __init__(
        self,
        enabled: bool = True,
        queue_size: int = 300,
        create_gifs: bool = False,
    ):
        super().__init__(enabled=enabled, priority=PluginPriority.NORMAL)
        self._queue_size = queue_size
        self._create_gifs = create_gifs
        self._writer = None
        self._started = False

    @property
    def name(self) -> str:
        return "trajectory"

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        return {
            PluginEventType.TASK_START,
            PluginEventType.TRAJECTORY_STEP,
            PluginEventType.TASK_END,
        }

    async def initialize(self) -> None:
        """Initialize the trajectory writer."""
        await super().initialize()

        from droiduse_backend.observability.trajectory import TrajectoryWriter

        self._writer = TrajectoryWriter(queue_size=self._queue_size)
        await self._writer.start()
        self._started = True

        logger.debug(f"Trajectory plugin initialized (queue_size={self._queue_size})")

    async def shutdown(self) -> None:
        """Stop the trajectory writer and wait for pending writes."""
        if self._writer and self._started:
            await self._writer.stop(timeout=30.0)
            self._started = False

        await super().shutdown()
        logger.debug("Trajectory plugin shutdown")

    async def handle_event(self, event: PluginEvent) -> None:
        """Handle trajectory-related events."""
        if not self._writer or not self._started:
            return

        try:
            if event.event_type == PluginEventType.TASK_START:
                await self._handle_init(event.data)
            elif event.event_type == PluginEventType.TRAJECTORY_STEP:
                await self._handle_step(event.data)
            elif event.event_type == PluginEventType.TASK_END:
                await self._handle_final(event.data)
        except Exception as e:
            logger.warning(f"Trajectory plugin error: {e}")

    async def _handle_init(self, data: Dict[str, Any]) -> None:
        """Handle TASK_START event for trajectory init."""
        trajectory = data.get("trajectory")
        if not trajectory:
            logger.debug("TASK_START: No trajectory provided, skipping")
            return

        logger.info(f"📁 Writing initial trajectory to: {trajectory.trajectory_folder}")
        self._writer.write(trajectory, stage="init")
        logger.debug("Wrote initial trajectory")

    async def _handle_step(self, data: Dict[str, Any]) -> None:
        """Handle TRAJECTORY_STEP event."""
        trajectory = data.get("trajectory")
        if not trajectory:
            return

        step_number = data.get("step_number", 0)
        self._writer.write(trajectory, stage=f"step_{step_number}")
        logger.debug(f"Wrote trajectory for step {step_number}")

    async def _handle_final(self, data: Dict[str, Any]) -> None:
        """Handle TASK_END event for trajectory final."""
        trajectory = data.get("trajectory")
        if not trajectory:
            return

        create_gif = data.get("create_gif", self._create_gifs)
        self._writer.write_final(trajectory, create_gif)
        logger.debug(f"Wrote final trajectory (gif={create_gif})")

    def configure(
        self,
        create_gifs: Optional[bool] = None,
    ) -> None:
        """
        Update trajectory plugin configuration.

        Args:
            create_gifs: Whether to create GIFs at finalization
        """
        if create_gifs is not None:
            self._create_gifs = create_gifs

    @property
    def writer(self):
        """Get the underlying TrajectoryWriter for direct access if needed."""
        return self._writer
