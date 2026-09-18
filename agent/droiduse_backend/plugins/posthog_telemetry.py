"""
PostHog telemetry plugin for anonymous event tracking.

This plugin handles telemetry capture for agent events in fire-and-forget
mode, ensuring that analytics never blocks the main agent workflow.
"""

import asyncio
import logging
import os
from typing import Any, Dict, Optional

from droiduse_backend.plugins.base import (
    Plugin,
    PluginEvent,
    PluginEventType,
    PluginPriority,
)

logger = logging.getLogger("androiduse.plugins.posthog")


class PostHogTelemetryPlugin(Plugin):
    """
    Plugin for anonymous telemetry collection via PostHog.

    Handles AGENT_INIT, AGENT_FINALIZE, and PACKAGE_VISIT events asynchronously.
    Telemetry can be disabled via ANDROIDUSE_TELEMETRY_ENABLED environment variable.

    The plugin manages its own API key and host configuration, and decides
    when to flush events (on finalize and shutdown).
    """

    # Default PostHog configuration
    DEFAULT_PROJECT_API_KEY = "phc_XyD3HKIsetZeRkmnfaBughs8fXWYArSUFc30C0HmRiO"
    DEFAULT_HOST = "https://eu.i.posthog.com"

    def __init__(
        self,
        enabled: bool = True,
        api_key: Optional[str] = None,
        host: Optional[str] = None,
    ):
        super().__init__(enabled=enabled, priority=PluginPriority.LOW)
        self._api_key = api_key
        self._host = host
        self._posthog = None
        self._user_id: Optional[str] = None
        self._run_id: Optional[str] = None

    @property
    def name(self) -> str:
        return "posthog_telemetry"

    @property
    def subscribed_events(self) -> set[PluginEventType]:
        return {
            PluginEventType.AGENT_INIT,
            PluginEventType.AGENT_FINALIZE,
            PluginEventType.PACKAGE_VISIT,
        }

    def _is_telemetry_enabled(self) -> bool:
        """Check if telemetry is enabled via environment variable."""
        telemetry_enabled = os.environ.get("ANDROIDUSE_TELEMETRY_ENABLED", "true")
        return telemetry_enabled.lower() in ["true", "1", "yes", "y"]

    async def initialize(self) -> None:
        """Initialize PostHog client."""
        await super().initialize()

        if not self._is_telemetry_enabled():
            logger.debug("Telemetry disabled via environment variable")
            self.enabled = False
            return

        try:
            from uuid import uuid4

            from posthog import Posthog

            # Resolve API key and host from config, env vars, or defaults
            project_api_key = (
                self._api_key or os.getenv("POSTHOG_API_KEY") or self.DEFAULT_PROJECT_API_KEY
            )
            posthog_host = self._host or os.getenv("POSTHOG_HOST") or self.DEFAULT_HOST

            self._posthog = Posthog(
                project_api_key=project_api_key,
                host=posthog_host,
                disable_geoip=False,
            )

            # Get or create persistent user ID
            self._user_id = self._get_user_id()
            self._run_id = str(uuid4())

            logger.debug("PostHog telemetry plugin initialized")
        except ImportError:
            logger.warning("PostHog not installed, telemetry disabled")
            self.enabled = False
        except Exception as e:
            logger.warning(f"Failed to initialize PostHog telemetry: {e}")
            self.enabled = False

    async def shutdown(self) -> None:
        """Flush and shutdown PostHog client."""
        if self._posthog:
            try:
                # Flush in background thread with timeout
                await asyncio.wait_for(asyncio.to_thread(self._posthog.flush), timeout=5.0)
                logger.debug("PostHog telemetry flushed on shutdown")
            except asyncio.TimeoutError:
                logger.warning("PostHog flush timed out during shutdown")
            except Exception as e:
                logger.warning(f"Error flushing PostHog telemetry: {e}")

        await super().shutdown()
        logger.debug("PostHog telemetry plugin shutdown")

    async def handle_event(self, event: PluginEvent) -> None:
        """Handle telemetry-related events."""
        if not self._posthog:
            return

        try:
            if event.event_type == PluginEventType.AGENT_INIT:
                await self._handle_agent_init(event.data)
            elif event.event_type == PluginEventType.AGENT_FINALIZE:
                await self._handle_agent_finalize(event.data)
            elif event.event_type == PluginEventType.PACKAGE_VISIT:
                await self._handle_package_visit(event.data)
        except Exception as e:
            logger.warning(f"PostHog telemetry plugin error: {e}")

    async def _handle_agent_init(self, data: Dict[str, Any]) -> None:
        """Handle AGENT_INIT event."""
        try:
            user_id = data.get("user_id") or self._user_id
            properties = {
                "run_id": self._run_id,
                "goal": data.get("goal", ""),
                "llms": data.get("llms", {}),
                "tools": data.get("tools", ""),
                "max_steps": data.get("max_steps", 0),
                "timeout": data.get("timeout", 0),
                "vision": data.get("vision", {}),
                "reasoning": data.get("reasoning", False),
                "enable_tracing": data.get("enable_tracing", False),
                "debug": data.get("debug", False),
                "save_trajectories": data.get("save_trajectories", "none"),
                "runtype": data.get("runtype", "developer"),
                "custom_prompts": data.get("custom_prompts"),
            }

            await asyncio.to_thread(
                self._posthog.capture,
                "DroidAgentInitEvent",
                distinct_id=user_id,
                properties=properties,
            )
            logger.debug("Captured DroidAgentInitEvent")
        except Exception as e:
            logger.warning(f"Failed to capture agent init event: {e}")

    async def _handle_agent_finalize(self, data: Dict[str, Any]) -> None:
        """Handle AGENT_FINALIZE event."""
        try:
            user_id = data.get("user_id") or self._user_id
            properties = {
                "run_id": self._run_id,
                "success": data.get("success", False),
                "reason": data.get("reason", ""),
                "steps": data.get("steps", 0),
                "unique_packages_count": data.get("unique_packages_count", 0),
                "unique_activities_count": data.get("unique_activities_count", 0),
            }

            await asyncio.to_thread(
                self._posthog.capture,
                "DroidAgentFinalizeEvent",
                distinct_id=user_id,
                properties=properties,
            )
            logger.debug("Captured DroidAgentFinalizeEvent")

            # Flush after finalize to ensure events are sent
            await self._flush()
        except Exception as e:
            logger.warning(f"Failed to capture agent finalize event: {e}")

    async def _handle_package_visit(self, data: Dict[str, Any]) -> None:
        """Handle PACKAGE_VISIT event."""
        try:
            user_id = data.get("user_id") or self._user_id
            properties = {
                "run_id": self._run_id,
                "package_name": data.get("package_name", ""),
                "activity_name": data.get("activity_name", ""),
            }

            await asyncio.to_thread(
                self._posthog.capture,
                "PackageVisitEvent",
                distinct_id=user_id,
                properties=properties,
            )
            logger.debug(f"Captured PackageVisitEvent: {data.get('package_name')}")
        except Exception as e:
            logger.warning(f"Failed to capture package visit event: {e}")

    async def _flush(self) -> None:
        """Flush PostHog events."""
        if not self._posthog:
            return

        try:
            await asyncio.wait_for(asyncio.to_thread(self._posthog.flush), timeout=10.0)
            logger.debug("PostHog telemetry flushed")
        except asyncio.TimeoutError:
            logger.warning("PostHog flush timed out")
        except Exception as e:
            logger.warning(f"Failed to flush PostHog telemetry: {e}")

    def _get_user_id(self) -> str:
        """Get or create persistent anonymous user ID."""
        from pathlib import Path
        from uuid import UUID, uuid4

        user_id_path = Path.home() / ".androiduse" / "user_id"

        try:
            user_id_path.parent.mkdir(parents=True, exist_ok=True)

            if user_id_path.exists():
                user_id = user_id_path.read_text().strip()
                try:
                    UUID(user_id)
                    return user_id
                except (ValueError, AttributeError):
                    pass

            # Generate new UUID
            user_id = str(uuid4())
            user_id_path.write_text(user_id)
            return user_id
        except Exception:
            return "unknown"
