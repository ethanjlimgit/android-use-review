"""
Step registry and decorator for workflow system.

This module provides the @step decorator used to define workflow steps
and the StepRegistry class which manages step registration and lookup.
"""

import inspect
from functools import wraps
from typing import Callable, Dict, List, Optional, Type, get_type_hints

from .events import Event
from .exceptions import InvalidStepError


class StepInfo:
    """
    Information about a registered step.

    Stores metadata about a step function including its input event types
    and the function itself.
    """

    def __init__(
        self,
        func: Callable,
        event_types: Optional[List[Type[Event]]] = None,
        name: Optional[str] = None,
    ):
        """
        Initialize step info.

        Args:
            func: The step function
            event_types: Event types this step accepts (if None, infer from type hints)
            name: Optional custom name for the step
        """
        self.func = func
        self.name = name or func.__name__

        # Infer event types from function signature if not provided
        if event_types is None:
            self.event_types = self._infer_event_types(func)
        else:
            self.event_types = event_types

        # Validate that function is async
        if not inspect.iscoroutinefunction(func):
            raise InvalidStepError(f"Step function '{self.name}' must be async (use async def)")

    @staticmethod
    def _infer_event_types(func: Callable) -> List[Type[Event]]:
        """
        Infer accepted event types from function signature.

        Args:
            func: The function to inspect

        Returns:
            List of event types accepted by this function
        """
        try:
            # Get type hints for the function
            hints = get_type_hints(func)

            # Get the signature
            sig = inspect.signature(func)
            params = list(sig.parameters.values())

            # Skip 'self' or 'cls' parameter if present
            if params and params[0].name in ("self", "cls"):
                params = params[1:]

            # The second parameter (after ctx) should be the event
            if len(params) < 2:
                raise InvalidStepError(
                    f"Step function '{func.__name__}' must have at least 2 parameters: "
                    f"(ctx: Context, ev: Event)"
                )

            event_param = params[1]
            event_type = hints.get(event_param.name)

            if event_type is None:
                raise InvalidStepError(
                    f"Step function '{func.__name__}' parameter '{event_param.name}' "
                    f"must have a type annotation"
                )

            # Handle Union types (e.g., Union[EventA, EventB])
            if hasattr(event_type, "__origin__"):
                # This is a generic type like Union
                if hasattr(event_type, "__args__"):
                    # Return all union members
                    return list(event_type.__args__)

            # Single event type
            return [event_type]

        except Exception as e:
            raise InvalidStepError(
                f"Failed to infer event types for step '{func.__name__}': {e}"
            ) from e

    def __repr__(self) -> str:
        """String representation of step info."""
        event_names = [et.__name__ for et in self.event_types]
        return f"StepInfo(name={self.name}, events={event_names})"


class StepRegistry:
    """
    Registry for workflow steps.

    Manages registration and lookup of steps by event type.
    """

    def __init__(self):
        """Initialize empty registry."""
        # Map from event type to list of steps that handle it
        self._steps: Dict[Type[Event], List[StepInfo]] = {}

        # Map from step name to StepInfo
        self._steps_by_name: Dict[str, StepInfo] = {}

    def register(
        self,
        func: Callable,
        event_types: Optional[List[Type[Event]]] = None,
        name: Optional[str] = None,
    ) -> StepInfo:
        """
        Register a step function.

        Args:
            func: The step function to register
            event_types: Event types this step accepts (if None, infer from type hints)
            name: Optional custom name for the step

        Returns:
            StepInfo object for the registered step
        """
        step_info = StepInfo(func, event_types, name)

        # Register by event type
        for event_type in step_info.event_types:
            if event_type not in self._steps:
                self._steps[event_type] = []
            self._steps[event_type].append(step_info)

        # Register by name
        self._steps_by_name[step_info.name] = step_info

        return step_info

    def get_step_for_event(self, event: Event) -> Optional[StepInfo]:
        """
        Find a step to handle the given event.

        Uses type-based routing: looks up steps registered for the event's type,
        including parent classes.

        Args:
            event: The event to find a handler for

        Returns:
            StepInfo for the handler, or None if no handler found
        """
        event_type = type(event)

        # First try exact type match
        if event_type in self._steps:
            steps = self._steps[event_type]
            if steps:
                # Return first matching step
                return steps[0]

        # Try parent classes (for inheritance support)
        for base_type in inspect.getmro(event_type)[1:]:
            if base_type in self._steps:
                steps = self._steps[base_type]
                if steps:
                    return steps[0]

        return None

    def get_step_by_name(self, name: str) -> Optional[StepInfo]:
        """
        Get a step by name.

        Args:
            name: The step name

        Returns:
            StepInfo or None if not found
        """
        return self._steps_by_name.get(name)

    def get_all_steps(self) -> List[StepInfo]:
        """
        Get all registered steps.

        Returns:
            List of all StepInfo objects
        """
        return list(self._steps_by_name.values())

    def clear(self) -> None:
        """Clear all registered steps."""
        self._steps.clear()
        self._steps_by_name.clear()

    def __repr__(self) -> str:
        """String representation of registry."""
        return f"StepRegistry(steps={len(self._steps_by_name)})"


def step(
    func: Optional[Callable] = None,
    *,
    event_types: Optional[List[Type[Event]]] = None,
    name: Optional[str] = None,
):
    """
    Decorator to mark a method as a workflow step.

    Usage:
        @step
        async def my_step(self, ctx: Context, ev: MyEvent) -> NextEvent:
            # ... do work ...
            return NextEvent()

    Or with explicit event types:
        @step(event_types=[EventA, EventB])
        async def my_step(self, ctx: Context, ev: Event) -> NextEvent:
            # ... do work ...
            return NextEvent()

    Args:
        func: The function to decorate (when used without parentheses)
        event_types: Event types this step accepts (if None, infer from type hints)
        name: Optional custom name for the step
    """

    def decorator(f: Callable) -> Callable:
        # Mark the function as a step by adding metadata
        f._is_step = True
        f._step_event_types = event_types
        f._step_name = name

        @wraps(f)
        async def wrapper(*args, **kwargs):
            # Just call the original function - CancelledError will propagate naturally
            return await f(*args, **kwargs)

        # Copy metadata to wrapper
        wrapper._is_step = True
        wrapper._step_event_types = event_types
        wrapper._step_name = name

        return wrapper

    # Support both @step and @step()
    if func is not None:
        # Called without parentheses: @step
        return decorator(func)
    else:
        # Called with parentheses: @step() or @step(event_types=[...])
        return decorator
