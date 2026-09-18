"""
Task Cancellation Utilities

This module provides centralized utilities for handling task cancellation throughout
the agent workflow. Cancellation works by setting an asyncio.Event that is checked
at strategic points during task execution.

Cancellation Flow:
1. Client sends {"type": "cancel_task", "task_id": "..."} via WebSocket
2. Server sets the cancellation event for that task
3. Agent checks for cancellation at key points:
   - Before executing actions
   - During sleep/wait operations
   - In code execution loops
4. When detected, asyncio.CancelledError is raised and propagates up
5. Main workflow catches it and returns a cancelled result

Key Functions:
- check_cancellation(): Check if task is cancelled and raise if so
- cancellable_sleep(): Sleep while checking for cancellation every 100ms
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger("androiduse")


async def check_cancellation(cancellation_event: Optional[asyncio.Event]) -> None:
    """
    Check if task cancellation has been requested and raise CancelledError if so.

    This is a lightweight check that should be called at strategic points:
    - Before executing actions
    - At the start of long-running operations
    - Between workflow steps

    Args:
        cancellation_event: Optional event that signals cancellation request

    Raises:
        asyncio.CancelledError: If cancellation has been requested
    """
    if cancellation_event and cancellation_event.is_set():
        raise asyncio.CancelledError()


async def cancellable_sleep(
    duration: float,
    cancellation_event: Optional[asyncio.Event] = None,
    check_interval: float = 0.1,
) -> None:
    """
    Sleep for a duration while checking for cancellation at regular intervals.

    This replaces regular asyncio.sleep() to make sleep operations cancellable.
    The function sleeps in small chunks and checks for cancellation between chunks,
    providing responsive cancellation even during long waits.

    Args:
        duration: Total sleep duration in seconds
        cancellation_event: Optional event that signals cancellation request
        check_interval: How often to check for cancellation (default: 0.1 = 100ms)

    Raises:
        asyncio.CancelledError: If cancellation is detected during sleep

    Example:
        >>> # Sleep for 2 seconds, cancellable every 100ms
        >>> await cancellable_sleep(2.0, cancellation_event=event)
    """
    if duration <= 0:
        return

    if not cancellation_event:
        # No cancellation support, just sleep normally
        await asyncio.sleep(duration)
        return

    # Sleep in chunks, checking for cancellation between each chunk
    elapsed = 0.0
    chunks_completed = 0
    while elapsed < duration:
        # Check if cancelled before sleeping
        if cancellation_event.is_set():
            logger.debug(
                f"💤 Sleep cancelled after {elapsed:.2f}s / {duration:.2f}s ({chunks_completed} chunks)"
            )
            raise asyncio.CancelledError()

        # Sleep for the smaller of: remaining time or check interval
        sleep_time = min(check_interval, duration - elapsed)
        await asyncio.sleep(sleep_time)
        elapsed += sleep_time
        chunks_completed += 1


def is_cancellation_error(exc: BaseException) -> bool:
    """
    Check if an exception is a cancellation error.

    Handles both asyncio.CancelledError and concurrent.futures.CancelledError
    since code execution in threads may raise the latter.

    Args:
        exc: Exception to check

    Returns:
        True if the exception is a cancellation error
    """
    import concurrent.futures

    return isinstance(exc, (asyncio.CancelledError, concurrent.futures.CancelledError))


def should_propagate_cancellation(exc: BaseException) -> bool:
    """
    Determine if an exception should propagate up (not be caught).

    Cancellation errors should always propagate to stop the workflow.
    This is a convenience function for exception handlers.

    Args:
        exc: Exception to check

    Returns:
        True if the exception should be re-raised

    Example:
        >>> try:
        ...     await some_operation()
        ... except Exception as e:
        ...     if should_propagate_cancellation(e):
        ...         raise
        ...     handle_error(e)
    """
    return is_cancellation_error(exc)
