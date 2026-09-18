"""
Adaptive timing utilities for agent execution.

Provides intelligent sleep delays based on action types to optimize execution speed
while maintaining reliability.
"""

import asyncio
import logging
from typing import Optional

from droiduse_backend.observability import profile_sleep

logger = logging.getLogger("androiduse")

# Action type to sleep duration mapping (in seconds)
# These values are tuned for typical device response times
ACTION_SLEEP_DURATIONS = {
    # Navigation actions - need time for app transitions and animations
    "open_app": 0.8,
    "go_home": 0.5,
    "go_back": 0.3,
    "system_button": 0.4,
    # Input actions - minimal wait needed (reduced from 0.2)
    "click": 0.1,
    "tap": 0.1,
    "long_press": 0.3,
    "type": 0.1,
    "input_text": 0.1,
    # Scroll/swipe actions - animation settling time
    "swipe": 0.3,
    "scroll": 0.3,
    "drag": 0.4,
    # State observation - no wait needed
    "get_state": 0.0,
    "take_screenshot": 0.0,
    # Wait action - already handles its own delay
    "wait": 0.0,
    # Unknown/other actions - use conservative default
    "default": 0.15,
}


def get_adaptive_sleep_duration(
    action_type: str,
    base_delay: float = 0.3,
    previous_action_failed: bool = False,
    action_duration_sec: float = 0.0,
) -> float:
    """
    Get adaptive sleep duration based on action type, accounting for action execution time.

    Args:
        action_type: The type of action that was executed (e.g., "click", "open_app")
        base_delay: Base delay from config (used as multiplier for custom tuning)
        previous_action_failed: If True, adds extra delay for retry scenarios
        action_duration_sec: How long the action took to execute (network/processing time).
                            This time is subtracted from the sleep duration since the UI
                            had time to update during action execution.

    Returns:
        Sleep duration in seconds
    """
    # Normalize action type
    action_type_lower = action_type.lower().strip()

    # Get base duration for action type
    duration = ACTION_SLEEP_DURATIONS.get(action_type_lower, ACTION_SLEEP_DURATIONS["default"])

    # Scale by base_delay ratio (if config has different default)
    # Default base_delay is 0.3, so this allows config to tune all delays
    scale_factor = base_delay / 0.3 if base_delay > 0 else 1.0
    duration *= scale_factor

    # Subtract action execution time - if the action took time (e.g., network latency),
    # the UI likely had time to update during that period
    if action_duration_sec > 0:
        duration = max(0, duration - action_duration_sec)
        logger.debug(f"⏱️ Action took {action_duration_sec:.2f}s, reducing sleep by that amount")

    # Add extra delay if previous action failed (helps with timing issues)
    if previous_action_failed:
        duration += 0.3

    return duration


async def adaptive_sleep(
    action_type: str,
    base_delay: float = 0.3,
    previous_action_failed: bool = False,
    action_duration_sec: float = 0.0,
    min_delay: float = 0.0,
    max_delay: float = 2.0,
    cancellation_event: "asyncio.Event | None" = None,
) -> None:
    """
    Sleep for an adaptive duration based on action type, accounting for action execution time.

    Args:
        action_type: The type of action that was executed
        base_delay: Base delay from config
        previous_action_failed: If True, adds extra delay
        action_duration_sec: How long the action took to execute (network/processing time).
                            This is subtracted from sleep time since UI had time to update.
        min_delay: Minimum sleep duration
        max_delay: Maximum sleep duration
        cancellation_event: Optional event to check for cancellation during sleep
    """
    duration = get_adaptive_sleep_duration(
        action_type=action_type,
        base_delay=base_delay,
        previous_action_failed=previous_action_failed,
        action_duration_sec=action_duration_sec,
    )

    # Clamp to min/max
    duration = max(min_delay, min(duration, max_delay))

    if duration > 0:
        logger.debug(f"⏱️ Adaptive sleep: {duration:.2f}s after {action_type}")
        await profile_sleep(duration, sleep_type=action_type, cancellation_event=cancellation_event)
    else:
        logger.debug(f"⏱️ Skipping sleep after {action_type} (action took sufficient time)")


def extract_action_type_from_code(code: str) -> Optional[str]:
    """
    Extract the primary action type from executed code.

    Looks for known action function calls in the code string.

    Args:
        code: The Python code that was executed

    Returns:
        The detected action type, or None if not found
    """
    if not code:
        return None

    code_lower = code.lower()

    # Check for known action patterns (order matters - check specific first)
    action_patterns = [
        ("open_app(", "open_app"),
        ("long_press(", "long_press"),
        ("input_text(", "input_text"),
        ("system_button(", "system_button"),
        ("go_home(", "go_home"),
        ("go_back(", "go_back"),
        ("swipe(", "swipe"),
        ("scroll(", "scroll"),
        ("drag(", "drag"),
        ("click(", "click"),
        ("tap(", "tap"),
        ("type(", "type"),
        ("wait(", "wait"),
        ("take_screenshot(", "take_screenshot"),
        ("get_state(", "get_state"),
    ]

    for pattern, action_type in action_patterns:
        if pattern in code_lower:
            return action_type

    return None
