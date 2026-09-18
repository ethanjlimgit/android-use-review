"""
Core workflow execution engine.

This module provides the BaseWorkflow and WorkflowHandler classes which form
the foundation of the custom workflow system.

CRITICAL DESIGN PRINCIPLE:
This module NEVER catches asyncio.CancelledError. All methods that might
encounter CancelledError MUST re-raise it immediately to ensure proper
cancellation propagation through the agent hierarchy.
"""

import asyncio
import logging
from typing import Any, AsyncIterator, Optional

from .context import WorkflowContext
from .event_router import EventRouter
from .events import Event, StartEvent, StopEvent
from .exceptions import (
    StepNotFoundError,
    WorkflowTimeoutError,
)
from .step_registry import StepRegistry
from .step_registry import step as step_decorator

logger = logging.getLogger(__name__)


class WorkflowHandler:
    """
    Handles workflow execution and event streaming.

    CRITICAL: This class NEVER catches asyncio.CancelledError.
    All methods that might encounter CancelledError MUST re-raise it immediately.

    This is the core component that ensures proper cancellation propagation.
    """

    def __init__(
        self,
        workflow: "BaseWorkflow",
        context: WorkflowContext,
        start_event: Event,
    ):
        """
        Initialize workflow handler.

        Args:
            workflow: The workflow instance to execute
            context: The workflow context
            start_event: The event that triggered this workflow
        """
        self.workflow = workflow
        self.context = context
        self.start_event = start_event

        # Task that runs the workflow
        self._task: Optional[asyncio.Task] = None

        # Event to signal when workflow is done
        self._done_event = asyncio.Event()

        # Store the final result
        self._result: Any = None

        # Store any exception that occurred
        self._exception: Optional[Exception] = None

    def run(self) -> "WorkflowHandler":
        """
        Start the workflow execution in the background.

        Returns:
            Self for chaining
        """
        # Mark context as running
        self.context.mark_running()

        # Create and start the background task
        self._task = asyncio.create_task(self._execute())

        return self

    async def _execute(self) -> None:
        """
        Execute the workflow steps.

        This is the main execution loop that routes events to steps.

        CRITICAL: This method NEVER catches CancelledError.
        """
        try:
            current_event = self.start_event
            router = EventRouter(self.workflow._registry)

            while True:
                # Check if we've received a StopEvent
                if isinstance(current_event, StopEvent):
                    self._result = current_event.result
                    break

                # Route event to appropriate step
                try:
                    step_info = router.route(current_event)
                except StepNotFoundError as e:
                    logger.error(f"No step found for event: {current_event}")
                    self._exception = e
                    break

                # Execute the step
                try:
                    logger.debug(
                        f"Executing step '{step_info.name}' with event "
                        f"{current_event.__class__.__name__}"
                    )

                    # Call the step function
                    # CRITICAL: If CancelledError occurs here, it will propagate
                    # naturally and we will NOT catch it
                    # Note: step_info.func is already a bound method (has self)
                    next_event = await step_info.func(
                        self.context,
                        current_event,
                    )

                    # If step returned None, we're done
                    if next_event is None:
                        break

                    # Send event to parent workflow (if any)
                    await self.context.send_event(next_event)

                    # Move to next event
                    current_event = next_event

                except asyncio.CancelledError:
                    # CRITICAL: Never catch CancelledError - always re-raise
                    raise
                except Exception as e:
                    logger.error(
                        f"Error in step '{step_info.name}': {e}",
                        exc_info=True,
                    )
                    self._exception = e
                    break

        except asyncio.CancelledError as e:
            # CRITICAL: Store the exception then re-raise
            # This allows __await_impl to detect cancellation and propagate it
            logger.debug(f"Workflow {self.context.workflow_id} was cancelled")
            self._exception = e
            raise
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}", exc_info=True)
            self._exception = e
        finally:
            # Mark workflow as stopped and signal completion
            self.context.mark_stopped()
            self._done_event.set()

    async def stream_events(self) -> AsyncIterator[Event]:
        """
        Stream events from the workflow execution.

        This allows parent workflows to receive events from child workflows
        in real-time.

        Yields:
            Events from the workflow

        CRITICAL: This method NEVER catches CancelledError.
        """
        try:
            # Stream events from context (will drain queue after workflow stops)
            async for event in self.context.stream_events():
                yield event

        except asyncio.CancelledError:
            # CRITICAL: Never catch CancelledError - always re-raise
            raise

    async def __await_impl(self):
        """
        Implementation of await behavior.

        CRITICAL: This method NEVER catches CancelledError.
        """
        try:
            # Wait for workflow to complete
            await self._done_event.wait()

            # If there was an exception, raise it
            if self._exception is not None:
                raise self._exception

            return self._result

        except asyncio.CancelledError:
            # CRITICAL: Cancel the workflow task, then re-raise
            if self._task and not self._task.done():
                self._task.cancel()
                # Wait for task to actually cancel
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass

            # Always re-raise CancelledError
            raise

    def __await__(self):
        """Make WorkflowHandler awaitable."""
        return self.__await_impl().__await__()


class BaseWorkflow:
    """
    Base class for all workflows.

    Subclasses should define steps using the @step decorator.

    Example:
        class MyWorkflow(BaseWorkflow):
            @step
            async def my_step(self, ctx: Context, ev: MyEvent) -> NextEvent:
                # ... do work ...
                return NextEvent()
    """

    def __init__(
        self,
        timeout: Optional[float] = None,
        verbose: bool = False,
    ):
        """
        Initialize workflow.

        Args:
            timeout: Optional timeout in seconds for workflow execution
            verbose: Enable verbose logging
        """
        self.timeout = timeout
        self.verbose = verbose

        # Step registry for this workflow
        self._registry = StepRegistry()

        # Register all steps defined in this workflow
        self._register_steps()

        # Setup logging
        if verbose:
            logging.getLogger(__name__).setLevel(logging.DEBUG)

    def _register_steps(self) -> None:
        """
        Register all methods marked with @step decorator.

        This scans the workflow class for methods decorated with @step
        and registers them in the step registry.
        """
        # Scan all methods in this class
        for name in dir(self):
            attr = getattr(self, name)

            # Check if this is a step (marked by @step decorator)
            if hasattr(attr, "_is_step") and attr._is_step:
                # Get event types and step name from decorator
                event_types = getattr(attr, "_step_event_types", None)
                step_name = getattr(attr, "_step_name", None)

                # Register the step
                self._registry.register(
                    attr,
                    event_types=event_types,
                    name=step_name,
                )

                logger.debug(f"Registered step: {step_name or name}")

    def run(
        self,
        **kwargs: Any,
    ) -> WorkflowHandler:
        """
        Run the workflow with the given input.

        Args:
            **kwargs: Arguments to pass to StartEvent

        Returns:
            WorkflowHandler that can be awaited or streamed
        """
        # Create context
        context = WorkflowContext(workflow_id=self.__class__.__name__)

        # Create start event with kwargs
        start_event = StartEvent(**kwargs)

        # Create and start handler
        handler = WorkflowHandler(self, context, start_event)
        return handler.run()

    async def arun(self, **kwargs: Any) -> Any:
        """
        Run the workflow and wait for completion.

        Args:
            **kwargs: Arguments to pass to StartEvent

        Returns:
            The workflow result

        CRITICAL: This method NEVER catches CancelledError.
        """
        try:
            # Run workflow
            handler = self.run(**kwargs)

            # Wait for completion with optional timeout
            if self.timeout is not None:
                try:
                    result = await asyncio.wait_for(handler, timeout=self.timeout)
                except asyncio.TimeoutError:
                    # Cancel the workflow
                    if handler._task:
                        handler._task.cancel()
                    raise WorkflowTimeoutError(
                        f"Workflow timed out after {self.timeout} seconds"
                    ) from None
            else:
                result = await handler

            return result

        except asyncio.CancelledError:
            # CRITICAL: Never catch CancelledError - always re-raise
            raise

    async def stream_events_from_run(
        self,
        **kwargs: Any,
    ) -> AsyncIterator[Event]:
        """
        Run the workflow and stream events.

        Args:
            **kwargs: Arguments to pass to StartEvent

        Yields:
            Events from the workflow execution

        CRITICAL: This method NEVER catches CancelledError.
        """
        try:
            # Start workflow
            handler = self.run(**kwargs)

            # Stream events
            async for event in handler.stream_events():
                yield event

        except asyncio.CancelledError:
            # CRITICAL: Never catch CancelledError - always re-raise
            raise


# Re-export step decorator for convenience
step = step_decorator
