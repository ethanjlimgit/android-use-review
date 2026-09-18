"""
Anonymous telemetry tracking using PostHog.

This module handles opt-in telemetry collection to help improve AndroidUse.
All data is anonymized and can be disabled by setting ANDROIDUSE_TELEMETRY_ENABLED=false.
"""

import asyncio
import logging
import os
from pathlib import Path
from uuid import UUID, uuid4

from posthog import Posthog

from droiduse_backend.telemetry.events import TelemetryEvent

logger = logging.getLogger("androiduse-telemetry")
androiduse_logger = logging.getLogger("androiduse")

# Default PostHog configuration (used if not overridden in config)
DEFAULT_PROJECT_API_KEY = "phc_XyD3HKIsetZeRkmnfaBughs8fXWYArSUFc30C0HmRiO"
DEFAULT_HOST = "https://eu.i.posthog.com"

USER_ID_PATH = Path.home() / ".androiduse" / "user_id"
RUN_ID = str(uuid4())

TELEMETRY_ENABLED_MESSAGE = "Anonymized telemetry enabled. See https://docs.androiduse.ai/v3/guides/telemetry for more information."
TELEMETRY_DISABLED_MESSAGE = "🛑 Anonymized telemetry disabled. Consider setting the ANDROIDUSE_TELEMETRY_ENABLED environment variable to 'true' to enable telemetry and help us improve AndroidUse."

# Global posthog instance (initialized lazily)
_posthog: Posthog | None = None


def get_posthog(api_key: str | None = None, host: str | None = None) -> Posthog:
    """
    Get or create PostHog instance with configurable API key and host.

    Args:
        api_key: PostHog API key (defaults to env var or DEFAULT_PROJECT_API_KEY if None)
        host: PostHog host URL (defaults to env var or DEFAULT_HOST if None)

    Returns:
        PostHog instance
    """
    global _posthog

    # Use provided values, then env vars, then defaults
    project_api_key = api_key or os.getenv("POSTHOG_API_KEY") or DEFAULT_PROJECT_API_KEY
    posthog_host = host or os.getenv("POSTHOG_HOST") or DEFAULT_HOST

    # Always create new instance to support config changes
    _posthog = Posthog(
        project_api_key=project_api_key,
        host=posthog_host,
        disable_geoip=False,
    )

    return _posthog


def is_telemetry_enabled():
    """
    Check if telemetry is enabled via environment variable.

    Returns:
        True if ANDROIDUSE_TELEMETRY_ENABLED is set to true/1/yes/y (case-insensitive),
        or if the environment variable is not set (default is enabled).
    """
    telemetry_enabled = os.environ.get("ANDROIDUSE_TELEMETRY_ENABLED", "true")
    enabled = telemetry_enabled.lower() in ["true", "1", "yes", "y"]
    logger.debug(f"Telemetry enabled: {enabled}")
    return enabled


def print_telemetry_message():
    """
    Print telemetry status message to the logger.

    Displays enabled or disabled message based on ANDROIDUSE_TELEMETRY_ENABLED setting.
    """
    if is_telemetry_enabled():
        androiduse_logger.debug(TELEMETRY_ENABLED_MESSAGE)

    else:
        androiduse_logger.debug(TELEMETRY_DISABLED_MESSAGE)


# Print telemetry message on import
print_telemetry_message()


def _is_valid_uuid(value: str) -> bool:
    """Check if string is a valid UUID format."""
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def get_user_id() -> str:
    """
    Get or create persistent anonymous user ID.

    The user ID is stored in ~/.androiduse/user_id and persists across sessions.
    If the file doesn't exist or contains an invalid UUID, a new one is generated.

    Returns:
        User UUID string, or "unknown" if an error occurs.
    """
    try:
        # Ensure directory exists
        USER_ID_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Read existing ID if valid
        if USER_ID_PATH.exists():
            user_id = USER_ID_PATH.read_text().strip()

            # Validate UUID format
            if user_id and _is_valid_uuid(user_id):
                logger.debug(f"User ID: {user_id}")
                return user_id
            else:
                logger.debug(f"Invalid user ID found in {USER_ID_PATH}, regenerating")

        # Generate new UUID (file missing or invalid)
        user_id = str(uuid4())
        USER_ID_PATH.write_text(user_id)
        logger.debug(f"Generated new user ID: {user_id}")
        return user_id

    except Exception as e:
        logger.error(f"Error getting user ID: {e}")
        return "unknown"


def capture(
    event: TelemetryEvent,
    user_id: str | None = None,
    api_key: str | None = None,
    host: str | None = None,
):
    """
    Capture and send a telemetry event to PostHog.

    Args:
        event: Telemetry event to capture (must be a TelemetryEvent subclass)
        user_id: Optional user ID to use instead of the default persistent ID
        api_key: Optional PostHog API key (overrides config/env)
        host: Optional PostHog host URL (overrides config/env)

    Note:
        This function is a no-op if telemetry is disabled.
    """
    try:
        if not is_telemetry_enabled():
            logger.debug(f"Telemetry disabled, skipping capture of {event}")
            return
        event_name = type(event).__name__
        event_data = event.model_dump()
        properties = {
            "run_id": RUN_ID,
            **event_data,
        }

        posthog_instance = get_posthog(api_key=api_key, host=host)
        posthog_instance.capture(
            event_name, distinct_id=user_id or get_user_id(), properties=properties
        )
        logger.debug(f"Captured event: {event_name} with properties: {event}")
    except Exception as e:
        logger.error(f"Error capturing event: {e}")


async def flush():
    try:
        if not is_telemetry_enabled():
            return

        if _posthog is not None:
            await asyncio.wait_for(asyncio.to_thread(_posthog.flush), timeout=10)
    except asyncio.TimeoutError:
        logger.warning("PostHog flush timed out after 10 seconds")
    except Exception as e:
        logger.error(f"Error flushing data: {e}")
