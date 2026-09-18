"""
Event base classes for custom workflow system.

This module provides the core event types used by the workflow system.
"""

from typing import Any, Dict


class Event:
    """
    Base class for all workflow events.

    Events are the primary communication mechanism between workflow steps.
    Each step receives an event as input and may return a new event to trigger
    the next step.

    Events accept arbitrary keyword arguments which become instance attributes.
    This allows subclasses to define their own fields without using dataclasses.
    """

    def __init__(self, metadata: Dict[str, Any] = None, **kwargs):
        """
        Initialize event with metadata and arbitrary attributes.

        Args:
            metadata: Optional metadata dictionary
            **kwargs: Arbitrary keyword arguments become instance attributes
        """
        self.metadata = metadata or {}

        # Set all keyword arguments as instance attributes
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __repr__(self) -> str:
        """String representation of event."""
        attrs = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        attrs_str = ", ".join(f"{k}={v!r}" for k, v in attrs.items())
        return f"{self.__class__.__name__}({attrs_str})"

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get an attribute value (dictionary-style access).

        Args:
            key: The attribute name
            default: Default value if attribute not found

        Returns:
            The attribute value or default
        """
        return getattr(self, key, default)

    def __getitem__(self, key: str) -> Any:
        """
        Get an attribute value using bracket notation.

        Args:
            key: The attribute name

        Returns:
            The attribute value

        Raises:
            KeyError: If attribute not found
        """
        try:
            return getattr(self, key)
        except AttributeError:
            raise KeyError(key) from None

    def __setitem__(self, key: str, value: Any) -> None:
        """
        Set an attribute value using bracket notation.

        Args:
            key: The attribute name
            value: The value to set
        """
        setattr(self, key, value)

    def __contains__(self, key: str) -> bool:
        """
        Check if an attribute exists.

        Args:
            key: The attribute name

        Returns:
            True if attribute exists, False otherwise
        """
        return hasattr(self, key)


class StartEvent(Event):
    """
    Special event that triggers workflow execution.

    This event is sent to the workflow to begin execution. It typically
    contains the initial input data for the workflow.
    """

    pass


class StopEvent(Event):
    """
    Special event that signals workflow completion.

    When a step returns this event, the workflow execution stops and
    the result is returned to the caller.
    """

    def __init__(self, result: Any = None, metadata: Dict[str, Any] = None, **kwargs):
        """
        Initialize stop event with result.

        Args:
            result: The final result of the workflow
            metadata: Optional metadata dictionary
            **kwargs: Additional attributes
        """
        super().__init__(metadata=metadata, **kwargs)
        self.result = result
