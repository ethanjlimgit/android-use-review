"""
Workflow context and event queue management.

This module provides the WorkflowContext class which manages:
- Event queues for communication between workflows
- Key-value store for sharing data between steps
- Cancellation awareness
"""

import asyncio
from typing import Any, AsyncIterator, Dict, Optional

from .events import Event


class AsyncStore:
    """
    Async key-value store for workflow context.

    Provides async get/set methods compatible with LlamaIndex workflows API.
    """

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize store with reference to context data.

        Args:
            data: The dictionary to use for storage
        """
        self._data = data

    async def get(self, key: str, default: Any = None) -> Any:
        """
        Get a value from the store.

        Args:
            key: The key to retrieve
            default: Default value if key not found

        Returns:
            The stored value or default
        """
        return self._data.get(key, default)

    async def set(self, key: str, value: Any) -> None:
        """
        Set a value in the store.

        Args:
            key: The key to store under
            value: The value to store
        """
        self._data[key] = value

    async def delete(self, key: str) -> None:
        """
        Delete a value from the store.

        Args:
            key: The key to delete
        """
        self._data.pop(key, None)


class WorkflowContext:
    """
    Context object passed to all workflow steps.

    Provides:
    - Event queue for streaming events to parent workflows
    - Key-value store for sharing data between steps
    - Workflow metadata and configuration
    """

    def __init__(
        self,
        workflow_id: Optional[str] = None,
        parent_context: Optional["WorkflowContext"] = None,
    ):
        """
        Initialize workflow context.

        Args:
            workflow_id: Unique identifier for this workflow instance
            parent_context: Context of parent workflow (for nested workflows)
        """
        self.workflow_id = workflow_id or self._generate_id()
        self.parent_context = parent_context

        # Event queue for streaming events to parent workflows
        # This must be cancellation-aware (asyncio.Queue handles this correctly)
        self._event_queue: asyncio.Queue[Event] = asyncio.Queue()

        # Key-value store for sharing data between steps
        self._data: Dict[str, Any] = {}

        # Async store interface (LlamaIndex compatibility)
        self.store = AsyncStore(self._data)

        # Track if workflow is running
        self._running = False

    @staticmethod
    def _generate_id() -> str:
        """Generate a unique workflow ID."""
        import uuid

        return f"wf_{uuid.uuid4().hex[:8]}"

    def set(self, key: str, value: Any) -> None:
        """
        Store a value in the context.

        Args:
            key: The key to store the value under
            value: The value to store
        """
        self._data[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """
        Retrieve a value from the context.

        Args:
            key: The key to retrieve
            default: Default value if key not found

        Returns:
            The stored value or default
        """
        return self._data.get(key, default)

    def has(self, key: str) -> bool:
        """
        Check if a key exists in the context.

        Args:
            key: The key to check

        Returns:
            True if key exists, False otherwise
        """
        return key in self._data

    def delete(self, key: str) -> None:
        """
        Remove a value from the context.

        Args:
            key: The key to remove
        """
        self._data.pop(key, None)

    def clear(self) -> None:
        """Clear all data from the context."""
        self._data.clear()

    async def send_event(self, event: Event) -> None:
        """
        Send an event to the event queue (async version).

        This is used to stream events from child workflows to parent workflows.

        Args:
            event: The event to send

        Note:
            This method NEVER catches CancelledError - it will propagate naturally
            through asyncio.Queue.put() if the task is cancelled.
        """
        await self._event_queue.put(event)

    def write_event_to_stream(self, event: Event) -> None:
        """
        Write an event to the stream synchronously.

        This is a compatibility method for LlamaIndex workflows API.
        It adds the event to the queue without blocking.

        Args:
            event: The event to write to the stream
        """
        try:
            self._event_queue.put_nowait(event)
        except asyncio.QueueFull:
            # If queue is full, log warning but don't block
            import logging

            logging.getLogger(__name__).warning(
                f"Event queue full, dropping event: {event.__class__.__name__}"
            )

    async def stream_events(self) -> AsyncIterator[Event]:
        """
        Stream events from the event queue.

        This is used by parent workflows to receive events from child workflows.

        Yields:
            Events from the queue until the workflow completes

        Note:
            This method NEVER catches CancelledError - it will propagate naturally
            through asyncio.Queue.get() if the task is cancelled.
        """
        while self._running:
            try:
                # Wait for event with timeout to allow checking _running flag
                event = await asyncio.wait_for(self._event_queue.get(), timeout=0.1)
                yield event
            except asyncio.TimeoutError:
                # No event available, continue loop to check _running
                continue
            except asyncio.CancelledError:
                # CRITICAL: Never catch CancelledError - always re-raise
                raise

        # After workflow stops, drain any remaining events from queue
        while not self._event_queue.empty():
            try:
                event = self._event_queue.get_nowait()
                yield event
            except asyncio.QueueEmpty:
                break
            except asyncio.CancelledError:
                # CRITICAL: Never catch CancelledError - always re-raise
                raise

    def mark_running(self) -> None:
        """Mark the workflow as running."""
        self._running = True

    def mark_stopped(self) -> None:
        """Mark the workflow as stopped."""
        self._running = False

    def is_running(self) -> bool:
        """Check if workflow is running."""
        return self._running

    def get_queue_size(self) -> int:
        """
        Get current event queue size.

        Returns:
            Number of events in the queue
        """
        return self._event_queue.qsize()

    def __repr__(self) -> str:
        """String representation of context."""
        return (
            f"WorkflowContext(id={self.workflow_id}, "
            f"running={self._running}, "
            f"queue_size={self.get_queue_size()}, "
            f"data_keys={list(self._data.keys())})"
        )
