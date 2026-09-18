"""
Exception classes for custom workflow system.

This module defines all exceptions that can be raised by the workflow system.
"""


class WorkflowError(Exception):
    """
    Base exception for all workflow-related errors.
    """

    pass


class WorkflowCancelledError(WorkflowError):
    """
    Raised when a workflow is cancelled.

    This is a wrapper around asyncio.CancelledError to provide workflow-specific
    context while still being treated as a cancellation.
    """

    pass


class WorkflowTimeoutError(WorkflowError):
    """
    Raised when a workflow execution exceeds its timeout.
    """

    pass


class StepNotFoundError(WorkflowError):
    """
    Raised when no step is found to handle a given event type.
    """

    def __init__(self, event_type: type):
        self.event_type = event_type
        super().__init__(f"No step found to handle event type: {event_type}")


class InvalidStepError(WorkflowError):
    """
    Raised when a step is improperly defined or configured.
    """

    pass


class EventRoutingError(WorkflowError):
    """
    Raised when there's an error routing an event to a step.
    """

    pass
