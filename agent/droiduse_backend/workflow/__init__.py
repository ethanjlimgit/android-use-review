"""
Custom workflow system for DroidUse backend.

This package provides a lightweight, cancellation-aware workflow system
that replaces LlamaIndex workflows.

Key features:
- Guarantees CancelledError always propagates (never caught)
- Type-based event routing with @step decorator
- Event streaming for nested workflows
- Drop-in replacement for LlamaIndex workflows API

Example usage:
    from droiduse_backend.workflow import BaseWorkflow, step, Event, StartEvent, StopEvent

    class MyWorkflow(BaseWorkflow):
        @step
        async def my_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
            # Do work
            return StopEvent(result="done")

    # Run workflow
    workflow = MyWorkflow()
    result = await workflow.arun()
"""

# Core classes
from .context import WorkflowContext
from .event_router import EventRouter
from .events import Event, StartEvent, StopEvent

# Exceptions
from .exceptions import (
    EventRoutingError,
    InvalidStepError,
    StepNotFoundError,
    WorkflowCancelledError,
    WorkflowError,
    WorkflowTimeoutError,
)
from .step_registry import StepInfo, StepRegistry
from .workflow import BaseWorkflow, WorkflowHandler, step

# Alias for compatibility with LlamaIndex API
Workflow = BaseWorkflow
Context = WorkflowContext

__all__ = [
    # Core classes
    "BaseWorkflow",
    "Workflow",
    "WorkflowHandler",
    "WorkflowContext",
    "Context",
    "step",
    # Events
    "Event",
    "StartEvent",
    "StopEvent",
    # Registry and routing
    "StepRegistry",
    "StepInfo",
    "EventRouter",
    # Exceptions
    "WorkflowError",
    "WorkflowCancelledError",
    "WorkflowTimeoutError",
    "StepNotFoundError",
    "InvalidStepError",
    "EventRoutingError",
]

__version__ = "1.0.0"
