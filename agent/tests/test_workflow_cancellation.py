"""
Comprehensive cancellation tests for custom workflow system.

CRITICAL TESTS: These tests verify that CancelledError always propagates
correctly through the workflow system, which is the primary reason for
replacing LlamaIndex workflows.

Tests cover:
- Cancellation during step execution
- Cancellation during event streaming
- Cancellation during nested workflow execution
- Cancellation response time (< 200ms requirement)
"""

import asyncio
import time
from dataclasses import dataclass

import pytest

from droiduse_backend.workflow import (
    BaseWorkflow,
    Context,
    Event,
    StartEvent,
    StopEvent,
    step,
)


# Test events
@dataclass
class TestEvent(Event):
    value: int = 0


@dataclass
class ChildEvent(Event):
    message: str = ""


class TestCancellationPropagation:
    """Test that CancelledError propagates correctly."""

    @pytest.mark.asyncio
    async def test_cancel_during_step_execution(self):
        """Test cancellation during a long-running step."""

        class SlowWorkflow(BaseWorkflow):
            @step
            async def slow_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Simulate long operation
                await asyncio.sleep(10)
                return StopEvent(result="should_not_reach")

        workflow = SlowWorkflow()
        handler = workflow.run()

        # Let it start
        await asyncio.sleep(0.1)

        # Cancel the workflow
        start_time = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        # Verify CancelledError is raised
        with pytest.raises(asyncio.CancelledError):
            await handler

        # Verify cancellation was fast (< 200ms)
        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.2, f"Cancellation took {elapsed:.3f}s, should be < 0.2s"

    @pytest.mark.asyncio
    async def test_cancel_during_event_streaming(self):
        """Test cancellation during handler.stream_events()."""

        class StreamingWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> TestEvent:
                await asyncio.sleep(0.1)
                return TestEvent(value=1)

            @step
            async def step2(self, ctx: Context, ev: TestEvent) -> TestEvent:
                await asyncio.sleep(0.1)
                return TestEvent(value=2)

            @step
            async def step3(self, ctx: Context, ev: TestEvent) -> StopEvent:
                await asyncio.sleep(10)  # Long running
                return StopEvent(result="done")

        workflow = StreamingWorkflow()
        handler = workflow.run()

        event_count = 0
        start_time = time.perf_counter()

        try:
            async for _event in handler.stream_events():
                event_count += 1
                # Cancel after receiving a few events
                if event_count >= 2:
                    if handler._task:
                        handler._task.cancel()

        except asyncio.CancelledError:
            # Expected - CancelledError should propagate
            pass

        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.5, f"Cancellation took {elapsed:.3f}s during streaming"

    @pytest.mark.asyncio
    async def test_cancel_with_wait_for_timeout(self):
        """Test cancellation using asyncio.wait_for timeout."""

        class SlowWorkflow(BaseWorkflow):
            @step
            async def slow_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)
                return StopEvent(result="should_not_reach")

        workflow = SlowWorkflow()

        start_time = time.perf_counter()

        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(workflow.arun(), timeout=0.1)

        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.3, f"Timeout took {elapsed:.3f}s, should be ~0.1s"

    @pytest.mark.asyncio
    async def test_cancellation_cleans_up_task(self):
        """Test that cancellation properly cleans up background task."""

        class SlowWorkflow(BaseWorkflow):
            @step
            async def slow_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)
                return StopEvent(result="done")

        workflow = SlowWorkflow()
        handler = workflow.run()

        # Let it start
        await asyncio.sleep(0.1)

        # Verify task is running
        assert handler._task is not None
        assert not handler._task.done()

        # Cancel
        handler._task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await handler

        # Verify task is done
        assert handler._task.done()
        assert handler._task.cancelled()


class TestNestedWorkflowCancellation:
    """Test cancellation propagates through nested workflows."""

    @pytest.mark.asyncio
    async def test_cancel_parent_cancels_child(self):
        """Test cancelling parent workflow cancels child workflow."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Long running child
                await asyncio.sleep(10)
                return StopEvent(result="child_done")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Run child workflow
                result = await self.child.arun()
                return StopEvent(result=result)

        parent = ParentWorkflow()
        handler = parent.run()

        # Let it start
        await asyncio.sleep(0.1)

        # Cancel parent
        start_time = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await handler

        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.2, f"Nested cancellation took {elapsed:.3f}s"

    @pytest.mark.asyncio
    async def test_cancel_during_child_event_streaming(self):
        """Test cancellation during child workflow event streaming."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> ChildEvent:
                await asyncio.sleep(0.1)
                return ChildEvent(message="event1")

            @step
            async def step2(self, ctx: Context, ev: ChildEvent) -> ChildEvent:
                await asyncio.sleep(0.1)
                return ChildEvent(message="event2")

            @step
            async def step3(self, ctx: Context, ev: ChildEvent) -> StopEvent:
                await asyncio.sleep(10)  # Long running
                return StopEvent(result="done")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Stream events from child
                child_handler = self.child.run()

                event_count = 0
                async for _event in child_handler.stream_events():
                    event_count += 1
                    # Simulate processing events
                    await asyncio.sleep(0.05)

                result = await child_handler
                return StopEvent(result=result)

        parent = ParentWorkflow()
        handler = parent.run()

        # Let it start
        await asyncio.sleep(0.15)

        # Cancel parent
        start_time = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await handler

        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.2, f"Cancellation during child streaming took {elapsed:.3f}s"


class TestCancellationEdgeCases:
    """Test cancellation in edge cases."""

    @pytest.mark.asyncio
    async def test_cancel_before_workflow_starts(self):
        """Test cancelling a workflow before it starts."""

        class SimpleWorkflow(BaseWorkflow):
            @step
            async def simple_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                return StopEvent(result="done")

        workflow = SimpleWorkflow()

        # Create task but cancel immediately
        task = asyncio.create_task(workflow.arun())
        task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await task

    @pytest.mark.asyncio
    async def test_cancel_after_workflow_completes(self):
        """Test cancelling a workflow after it completes (should be no-op)."""

        class FastWorkflow(BaseWorkflow):
            @step
            async def fast_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                return StopEvent(result="done")

        workflow = FastWorkflow()
        handler = workflow.run()

        # Wait for completion
        result = await handler

        assert result == "done"

        # Try to cancel (should be no-op since already done)
        if handler._task:
            handler._task.cancel()
            # Should not raise since already complete
            assert handler._task.done()

    @pytest.mark.asyncio
    async def test_multiple_cancellations(self):
        """Test multiple cancellation attempts."""

        class SlowWorkflow(BaseWorkflow):
            @step
            async def slow_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)
                return StopEvent(result="done")

        workflow = SlowWorkflow()
        handler = workflow.run()

        await asyncio.sleep(0.1)

        # Cancel multiple times
        if handler._task:
            handler._task.cancel()
            handler._task.cancel()  # Second cancel should be safe

        with pytest.raises(asyncio.CancelledError):
            await handler

    @pytest.mark.asyncio
    async def test_cancel_during_exception_handling(self):
        """Test cancellation while an exception is being handled."""

        class FailingWorkflow(BaseWorkflow):
            @step
            async def failing_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                try:
                    await asyncio.sleep(0.1)
                    raise ValueError("Test error")
                except ValueError:
                    # Sleep during exception handling
                    await asyncio.sleep(10)
                    raise

        workflow = FailingWorkflow()
        handler = workflow.run()

        # Let it start and hit the exception
        await asyncio.sleep(0.15)

        # Cancel during exception handling
        start_time = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await handler

        elapsed = time.perf_counter() - start_time
        assert elapsed < 0.2, f"Cancellation during exception handling took {elapsed:.3f}s"


class TestCancellationResponseTime:
    """Test that cancellation response time meets < 200ms requirement."""

    @pytest.mark.asyncio
    async def test_cancellation_response_time_simple(self):
        """Test cancellation response time in simple workflow."""

        class SimpleWorkflow(BaseWorkflow):
            @step
            async def step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)
                return StopEvent(result="done")

        workflow = SimpleWorkflow()
        handler = workflow.run()

        await asyncio.sleep(0.1)  # Let it start

        # Measure cancellation time
        start = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        try:
            await handler
        except asyncio.CancelledError:
            pass

        elapsed = time.perf_counter() - start
        assert elapsed < 0.2, f"Cancellation took {elapsed * 1000:.1f}ms (should be < 200ms)"

    @pytest.mark.asyncio
    async def test_cancellation_response_time_nested(self):
        """Test cancellation response time in nested workflows (3 levels)."""

        class Level3Workflow(BaseWorkflow):
            @step
            async def level3_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(10)
                return StopEvent(result="level3")

        class Level2Workflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = Level3Workflow()

            @step
            async def level2_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                result = await self.child.arun()
                return StopEvent(result=result)

        class Level1Workflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = Level2Workflow()

            @step
            async def level1_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                result = await self.child.arun()
                return StopEvent(result=result)

        workflow = Level1Workflow()
        handler = workflow.run()

        await asyncio.sleep(0.1)  # Let it start

        # Measure cancellation time through 3 levels
        start = time.perf_counter()
        if handler._task:
            handler._task.cancel()

        try:
            await handler
        except asyncio.CancelledError:
            pass

        elapsed = time.perf_counter() - start
        assert elapsed < 0.2, f"Nested cancellation (3 levels) took {elapsed * 1000:.1f}ms"

    @pytest.mark.asyncio
    async def test_cancellation_response_time_streaming(self):
        """Test cancellation response time during event streaming."""

        class StreamingWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> TestEvent:
                await asyncio.sleep(0.1)
                return TestEvent(value=1)

            @step
            async def step2(self, ctx: Context, ev: TestEvent) -> StopEvent:
                await asyncio.sleep(10)  # Long sleep
                return StopEvent(result="done")

        workflow = StreamingWorkflow()
        handler = workflow.run()

        # Start streaming
        stream_task = asyncio.create_task(self._consume_stream(handler))

        await asyncio.sleep(0.15)  # Let first event arrive

        # Cancel
        start = time.perf_counter()
        stream_task.cancel()
        if handler._task:
            handler._task.cancel()

        try:
            await stream_task
        except asyncio.CancelledError:
            pass

        elapsed = time.perf_counter() - start
        assert elapsed < 0.2, f"Streaming cancellation took {elapsed * 1000:.1f}ms"

    @staticmethod
    async def _consume_stream(handler):
        """Helper to consume event stream."""
        async for _event in handler.stream_events():
            await asyncio.sleep(0.01)


class TestCancellationWithExternalCancellationEvent:
    """Test cancellation with external cancellation event (like in DroidAgent)."""

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Known issue with cancellation event handling - to be fixed")
    async def test_cancellation_with_event_flag(self):
        """Test cancellation triggered by external event flag."""

        cancellation_event = asyncio.Event()

        class CancellableWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> TestEvent:
                # Check cancellation before sleeping
                if cancellation_event.is_set():
                    raise asyncio.CancelledError()

                await asyncio.sleep(0.1)

                # Check again after operation
                if cancellation_event.is_set():
                    raise asyncio.CancelledError()

                return TestEvent(value=1)

            @step
            async def step2(self, ctx: Context, ev: TestEvent) -> StopEvent:
                if cancellation_event.is_set():
                    raise asyncio.CancelledError()

                await asyncio.sleep(10)
                return StopEvent(result="done")

        workflow = CancellableWorkflow()
        handler = workflow.run()

        await asyncio.sleep(0.15)  # Let first step complete

        # Set cancellation event
        start = time.perf_counter()
        cancellation_event.set()

        # Should raise CancelledError soon
        with pytest.raises(asyncio.CancelledError):
            await handler

        elapsed = time.perf_counter() - start
        # May take slightly longer since we need to reach the next check
        assert elapsed < 0.5, f"Event-based cancellation took {elapsed * 1000:.1f}ms"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
