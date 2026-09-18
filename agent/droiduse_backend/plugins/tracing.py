"""
Tracing plugin for Langfuse screenshot and span handling.

This plugin handles screenshot uploads to Langfuse in fire-and-forget mode,
ensuring that tracing operations never block the main agent workflow.
"""

import base64
import logging
from typing import Any, Dict, Optional

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins.tracing")


class TracingPlugin(Plugin):
    """
    Plugin for tracing operations including Langfuse screenshot uploads.

    Handles SCREENSHOT_CAPTURED events and uploads them to Langfuse
    as span attachments when tracing is enabled.
    """

    def __init__(
        self,
        enabled: bool = True,
        screenshots_enabled: bool = False,
    ):
        super().__init__(enabled=enabled, priority=PluginPriority.NORMAL)
        self._screenshots_enabled = screenshots_enabled
        self._tracing_initialized = False
        self._tracing_provider: Optional[str] = None

    @property
    def name(self) -> str:
        return "tracing"

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        return {
            PluginEventType.SCREENSHOT_CAPTURED,
        }

    async def initialize(self) -> None:
        """Initialize tracing plugin."""
        await super().initialize()

        # Check if tracing is already set up
        from droiduse_backend.observability.tracing_setup import (
            _tracing_initialized,
            _tracing_provider,
        )

        self._tracing_initialized = _tracing_initialized
        self._tracing_provider = _tracing_provider

        if not self._tracing_initialized:
            logger.debug("Tracing not initialized, plugin will be passive")

        logger.debug(f"Tracing plugin initialized (provider={self._tracing_provider})")

    async def shutdown(self) -> None:
        """Shutdown tracing plugin."""
        await super().shutdown()
        logger.debug("Tracing plugin shutdown")

    async def handle_event(self, event: PluginEvent) -> None:
        """Handle tracing-related events."""
        if not self._tracing_initialized:
            return

        try:
            if event.event_type == PluginEventType.SCREENSHOT_CAPTURED:
                await self._handle_screenshot(event.data)
        except Exception as e:
            logger.warning(f"Tracing plugin error: {e}")

    async def _handle_screenshot(self, data: Dict[str, Any]) -> None:
        """Handle SCREENSHOT_CAPTURED event by uploading to Langfuse."""
        if self._tracing_provider != "langfuse":
            return

        screenshot = data.get("screenshot")
        if not screenshot:
            return

        screenshots_enabled = data.get("screenshots_enabled", self._screenshots_enabled)
        vision_enabled = data.get("vision_enabled", False)

        # Skip if screenshots disabled or vision already uploads images
        if not screenshots_enabled or vision_enabled:
            return

        try:
            from opentelemetry import trace

            from droiduse_backend.telemetry.langfuse_processor import (
                get_last_step_span_context,
                get_root_span_context,
            )

            tracer = trace.get_tracer("androiduse.screenshot")
            mime_type = data.get("mime_type", "image/png")
            image_b64 = base64.b64encode(screenshot).decode()

            # Find parent context
            current_span = trace.get_current_span()
            if current_span and current_span.get_span_context().is_valid:
                parent_ctx = trace.set_span_in_context(current_span)
            else:
                parent_ctx = get_last_step_span_context() or get_root_span_context()

            if parent_ctx is None:
                return

            # Create screenshot span
            span = tracer.start_span("androiduse.screenshot", context=parent_ctx)
            try:
                span.set_attribute("androiduse.screenshot.image_base64", image_b64)
                span.set_attribute("androiduse.screenshot.mime_type", mime_type)
            finally:
                span.end()

            logger.debug("Recorded Langfuse screenshot span")
        except Exception as e:
            logger.debug(f"Failed to record Langfuse screenshot span: {e}")

    def configure(
        self,
        screenshots_enabled: Optional[bool] = None,
    ) -> None:
        """
        Update tracing plugin configuration.

        Args:
            screenshots_enabled: Whether to upload screenshots to Langfuse
        """
        if screenshots_enabled is not None:
            self._screenshots_enabled = screenshots_enabled
