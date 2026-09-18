"""
Unit tests for custom workflow system.

Tests basic workflow functionality including:
- Event routing
- Step execution
- Context management
- Result handling
"""

import asyncio
from dataclasses import dataclass

import pytest

from droiduse_backend.workflow import (
    BaseWorkflow,
    Context,
    Event,
    StartEvent,
    StepNotFoundError,
    StopEvent,
    WorkflowTimeoutError,
    step,
)


# Test events
@dataclass
class TestEvent(Event):
    """Test event with data."""

    value: int = 0


@dataclass
class SecondEvent(Event):
    """Another test event."""

    message: str = ""


@dataclass
class ThirdEvent(Event):
    """Third test event."""

    count: int = 0


class SimpleWorkflow(BaseWorkflow):
    """Simple workflow for testing."""

    @step
    async def start_step(self, ctx: Context, ev: StartEvent) -> TestEvent:
        """Handle start event."""
        ctx.set("started", True)
        return TestEvent(value=42)

    @step
    async def test_step(self, ctx: Context, ev: TestEvent) -> StopEvent:
        """Handle test event."""
        ctx.set("test_value", ev.value)
        return StopEvent(result=ev.value * 2)


class MultiStepWorkflow(BaseWorkflow):
    """Workflow with multiple steps."""

    @step
    async def start_step(self, ctx: Context, ev: StartEvent) -> TestEvent:
        """First step."""
        ctx.set("step_count", 1)
        return TestEvent(value=10)

    @step
    async def second_step(self, ctx: Context, ev: TestEvent) -> SecondEvent:
        """Second step."""
        count = ctx.get("step_count", 0)
        ctx.set("step_count", count + 1)
        return SecondEvent(message=f"value={ev.value}")

    @step
    async def third_step(self, ctx: Context, ev: SecondEvent) -> ThirdEvent:
        """Third step."""
        count = ctx.get("step_count", 0)
        ctx.set("step_count", count + 1)
        return ThirdEvent(count=count + 1)

    @step
    async def final_step(self, ctx: Context, ev: ThirdEvent) -> StopEvent:
        """Final step."""
        final_count = ctx.get("step_count", 0) + 1
        ctx.set("step_count", final_count)
        return StopEvent(result={"count": ev.count, "final_count": final_count})


class TestBasicWorkflow:
    """Test basic workflow functionality."""

    @pytest.mark.asyncio
    async def test_simple_workflow_execution(self):
        """Test simple workflow runs and returns result."""
        workflow = SimpleWorkflow()
        result = await workflow.arun()

        assert result == 84  # 42 * 2

    @pytest.mark.asyncio
    async def test_workflow_context_storage(self):
        """Test context stores values correctly."""
        workflow = SimpleWorkflow()
        handler = workflow.run()

        # Wait for completion
        result = await handler

        # Check context has expected values
        assert handler.context.get("started") is True
        assert handler.context.get("test_value") == 42

    @pytest.mark.asyncio
    async def test_multi_step_workflow(self):
        """Test workflow with multiple steps."""
        workflow = MultiStepWorkflow()
        result = await workflow.arun()

        assert result["count"] == 3
        assert result["final_count"] == 4

    @pytest.mark.asyncio
    async def test_workflow_with_timeout(self):
        """Test workflow timeout."""

        class SlowWorkflow(BaseWorkflow):
            @step
            async def slow_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)  # Very slow
                return StopEvent(result="done")

        workflow = SlowWorkflow(timeout=0.1)

        with pytest.raises(WorkflowTimeoutError):
            await workflow.arun()


class TestEventRouting:
    """Test event routing functionality."""

    @pytest.mark.asyncio
    async def test_event_routed_to_correct_step(self):
        """Test events are routed to correct handlers."""
        workflow = MultiStepWorkflow()
        handler = workflow.run()

        await handler

        # Verify all steps were executed in order
        assert handler.context.get("step_count") == 4

    @pytest.mark.asyncio
    async def test_missing_step_handler(self):
        """Test error when no step handles an event."""

        @dataclass
        class UnhandledEvent(Event):
            pass

        class IncompleteWorkflow(BaseWorkflow):
            @step
            async def start_step(self, ctx: Context, ev: StartEvent) -> UnhandledEvent:
                return UnhandledEvent()

        workflow = IncompleteWorkflow()
        handler = workflow.run()

        # Should fail because no step handles UnhandledEvent
        with pytest.raises(StepNotFoundError):
            await handler


class TestEventStreaming:
    """Test event streaming functionality."""

    @pytest.mark.asyncio
    async def test_stream_events_from_workflow(self):
        """Test streaming events from workflow execution."""
        workflow = MultiStepWorkflow()
        handler = workflow.run()

        events = []
        async for event in handler.stream_events():
            events.append(event)

        # Should have received all intermediate events
        assert len(events) >= 3  # TestEvent, SecondEvent, ThirdEvent

        # Verify event types
        event_types = [type(e).__name__ for e in events]
        assert "TestEvent" in event_types
        assert "SecondEvent" in event_types
        assert "ThirdEvent" in event_types

    @pytest.mark.asyncio
    async def test_stream_events_while_running(self):
        """Test streaming events while workflow is still running."""

        class StreamingWorkflow(BaseWorkflow):
            @step
            async def start_step(self, ctx: Context, ev: StartEvent) -> TestEvent:
                await asyncio.sleep(0.1)
                return TestEvent(value=1)

            @step
            async def test_step(self, ctx: Context, ev: TestEvent) -> SecondEvent:
                await asyncio.sleep(0.1)
                return SecondEvent(message="test")

            @step
            async def final_step(self, ctx: Context, ev: SecondEvent) -> StopEvent:
                await asyncio.sleep(0.1)
                return StopEvent(result="done")

        workflow = StreamingWorkflow()
        handler = workflow.run()

        events = []
        async for event in handler.stream_events():
            events.append(event)
            # Events should arrive while workflow is still running

        assert len(events) >= 2


class TestWorkflowContext:
    """Test workflow context functionality."""

    @pytest.mark.asyncio
    async def test_context_set_and_get(self):
        """Test context set and get operations."""
        ctx = Context()

        ctx.set("key1", "value1")
        ctx.set("key2", 42)

        assert ctx.get("key1") == "value1"
        assert ctx.get("key2") == 42
        assert ctx.get("key3") is None
        assert ctx.get("key3", "default") == "default"

    @pytest.mark.asyncio
    async def test_context_has_and_delete(self):
        """Test context has and delete operations."""
        ctx = Context()

        ctx.set("key1", "value1")
        assert ctx.has("key1") is True
        assert ctx.has("key2") is False

        ctx.delete("key1")
        assert ctx.has("key1") is False

    @pytest.mark.asyncio
    async def test_context_clear(self):
        """Test context clear operation."""
        ctx = Context()

        ctx.set("key1", "value1")
        ctx.set("key2", "value2")

        ctx.clear()

        assert ctx.has("key1") is False
        assert ctx.has("key2") is False

    @pytest.mark.asyncio
    async def test_context_shared_across_steps(self):
        """Test context is shared across all steps."""

        class ContextSharingWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> TestEvent:
                ctx.set("shared_value", 100)
                return TestEvent(value=1)

            @step
            async def step2(self, ctx: Context, ev: TestEvent) -> StopEvent:
                shared = ctx.get("shared_value")
                return StopEvent(result=shared)

        workflow = ContextSharingWorkflow()
        result = await workflow.arun()

        assert result == 100


class TestStepDecorator:
    """Test @step decorator functionality."""

    @pytest.mark.asyncio
    async def test_step_without_event_types(self):
        """Test @step decorator infers event types from annotations."""

        class InferredWorkflow(BaseWorkflow):
            @step
            async def handle_start(self, ctx: Context, ev: StartEvent) -> TestEvent:
                return TestEvent(value=42)

            @step
            async def handle_test(self, ctx: Context, ev: TestEvent) -> StopEvent:
                return StopEvent(result=ev.value)

        workflow = InferredWorkflow()
        result = await workflow.arun()

        assert result == 42

    @pytest.mark.asyncio
    async def test_step_with_explicit_event_types(self):
        """Test @step decorator with explicit event types."""

        class ExplicitWorkflow(BaseWorkflow):
            @step(event_types=[StartEvent])
            async def handle_start(self, ctx: Context, ev: Event) -> StopEvent:
                # Note: ev is typed as Event but we handle StartEvent
                return StopEvent(result="explicit")

        workflow = ExplicitWorkflow()
        result = await workflow.arun()

        assert result == "explicit"


class TestErrorHandling:
    """Test error handling in workflows."""

    @pytest.mark.asyncio
    async def test_exception_in_step_propagates(self):
        """Test exceptions in steps propagate to caller."""

        class FailingWorkflow(BaseWorkflow):
            @step
            async def failing_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                raise ValueError("Step failed")

        workflow = FailingWorkflow()
        handler = workflow.run()

        with pytest.raises(ValueError, match="Step failed"):
            await handler

    @pytest.mark.asyncio
    async def test_exception_stored_in_handler(self):
        """Test exceptions are stored in handler._exception."""

        class FailingWorkflow(BaseWorkflow):
            @step
            async def failing_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                raise RuntimeError("Test error")

        workflow = FailingWorkflow()
        handler = workflow.run()

        try:
            await handler
        except RuntimeError:
            pass

        assert handler._exception is not None
        assert isinstance(handler._exception, RuntimeError)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
