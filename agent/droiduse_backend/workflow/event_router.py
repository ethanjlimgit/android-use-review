"""
Event routing system for workflow steps.

This module provides the EventRouter class which routes events to appropriate
step handlers based on event types.
"""

import logging
from typing import Optional, Type

from .events import Event
from .exceptions import EventRoutingError, StepNotFoundError
from .step_registry import StepInfo, StepRegistry

logger = logging.getLogger(__name__)


class EventRouter:
    """
    Routes events to appropriate step handlers.

    Uses type-based routing to match events with registered steps.
    """

    def __init__(self, registry: StepRegistry):
        """
        Initialize event router.

        Args:
            registry: The step registry to use for routing
        """
        self.registry = registry

    def route(self, event: Event) -> StepInfo:
        """
        Route an event to an appropriate step handler.

        Args:
            event: The event to route

        Returns:
            StepInfo for the handler

        Raises:
            StepNotFoundError: If no handler found for this event type
            EventRoutingError: If there's an error during routing
        """
        try:
            # Look up step by event type
            step_info = self.registry.get_step_for_event(event)

            if step_info is None:
                raise StepNotFoundError(type(event))

            logger.debug(f"Routing {event.__class__.__name__} to step '{step_info.name}'")

            return step_info

        except StepNotFoundError:
            # Re-raise step not found errors
            raise
        except Exception as e:
            # Wrap other exceptions in EventRoutingError
            raise EventRoutingError(f"Error routing event {event.__class__.__name__}: {e}") from e

    def can_route(self, event: Event) -> bool:
        """
        Check if an event can be routed to a handler.

        Args:
            event: The event to check

        Returns:
            True if a handler exists, False otherwise
        """
        try:
            step_info = self.registry.get_step_for_event(event)
            return step_info is not None
        except Exception:
            return False

    def get_handler_for_type(self, event_type: Type[Event]) -> Optional[StepInfo]:
        """
        Get the handler for a specific event type.

        Args:
            event_type: The event type to look up

        Returns:
            StepInfo or None if no handler found
        """
        # Create a dummy event instance to use for lookup
        try:
            # Try to create instance with no args
            dummy_event = event_type()
        except TypeError:
            # If that fails, try with empty metadata
            try:
                dummy_event = event_type(metadata={})
            except Exception:
                # Can't create instance, just return None
                return None

        return self.registry.get_step_for_event(dummy_event)

    def __repr__(self) -> str:
        """String representation of router."""
        return f"EventRouter(registry={self.registry})"
