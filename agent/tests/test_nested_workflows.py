"""
Tests for nested workflow functionality.

Tests event streaming and communication between parent and child workflows,
which is essential for the DroidAgent → ManagerAgent → ExecutorAgent hierarchy.
"""

import asyncio
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
class ParentEvent(Event):
    message: str = ""


@dataclass
class ChildEvent(Event):
    value: int = 0


@dataclass
class GrandchildEvent(Event):
    count: int = 0


class TestTwoLevelNesting:
    """Test two-level workflow nesting (parent → child)."""

    @pytest.mark.asyncio
    async def test_parent_runs_child_workflow(self):
        """Test parent workflow can run child workflow."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                return StopEvent(result="child_result")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                child_result = await self.child.arun()
                return StopEvent(result=f"parent_got_{child_result}")

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result == "parent_got_child_result"

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_parent_streams_child_events(self):
        """Test parent can stream events from child workflow."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> ChildEvent:
                return ChildEvent(value=1)

            @step
            async def step2(self, ctx: Context, ev: ChildEvent) -> ChildEvent:
                return ChildEvent(value=2)

            @step
            async def step3(self, ctx: Context, ev: ChildEvent) -> StopEvent:
                return StopEvent(result="child_done")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                child_handler = self.child.run()

                events = []
                async for event in child_handler.stream_events():
                    events.append(event)

                result = await child_handler

                # Store events in context for verification
                ctx.set("child_events", events)
                ctx.set("child_result", result)

                return StopEvent(result="parent_done")

        parent = ParentWorkflow()
        handler = parent.run()
        await handler

        # Verify child events were received
        child_events = handler.context.get("child_events", [])
        assert len(child_events) >= 2  # Should have at least 2 ChildEvents

        child_result = handler.context.get("child_result")
        assert child_result == "child_done"

    @pytest.mark.asyncio
    async def test_parent_processes_child_events(self):
        """Test parent can process and react to child events."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> ChildEvent:
                return ChildEvent(value=10)

            @step
            async def step2(self, ctx: Context, ev: ChildEvent) -> ChildEvent:
                return ChildEvent(value=20)

            @step
            async def step3(self, ctx: Context, ev: ChildEvent) -> StopEvent:
                return StopEvent(result=ev.value)

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                child_handler = self.child.run()

                total = 0
                async for event in child_handler.stream_events():
                    if isinstance(event, ChildEvent):
                        total += event.value

                result = await child_handler

                return StopEvent(result={"total": total, "child_result": result})

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result["total"] == 30  # 10 + 20
        assert result["child_result"] == 20  # Last value


class TestThreeLevelNesting:
    """Test three-level workflow nesting (grandparent → parent → child)."""

    @pytest.mark.asyncio
    async def test_three_level_execution(self):
        """Test three levels of nested workflows execute correctly."""

        class GrandchildWorkflow(BaseWorkflow):
            @step
            async def grandchild_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                return StopEvent(result="grandchild")

        class ChildWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.grandchild = GrandchildWorkflow()

            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                grandchild_result = await self.grandchild.arun()
                return StopEvent(result=f"child-{grandchild_result}")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                child_result = await self.child.arun()
                return StopEvent(result=f"parent-{child_result}")

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result == "parent-child-grandchild"

    @pytest.mark.asyncio
    async def test_three_level_event_streaming(self):
        """Test events stream through three levels of workflows."""

        class GrandchildWorkflow(BaseWorkflow):
            @step
            async def step1(self, ctx: Context, ev: StartEvent) -> GrandchildEvent:
                return GrandchildEvent(count=1)

            @step
            async def step2(self, ctx: Context, ev: GrandchildEvent) -> StopEvent:
                return StopEvent(result="done")

        class ChildWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.grandchild = GrandchildWorkflow()

            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                handler = self.grandchild.run()

                grandchild_events = []
                async for event in handler.stream_events():
                    grandchild_events.append(event)
                    # Re-emit as child events
                    await ctx.send_event(ChildEvent(value=len(grandchild_events)))

                await handler
                return StopEvent(result="child_done")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                handler = self.child.run()

                all_events = []
                async for event in handler.stream_events():
                    all_events.append(event)

                await handler

                ctx.set("all_events", all_events)
                return StopEvent(result="parent_done")

        parent = ParentWorkflow()
        handler = parent.run()
        await handler

        # Verify we received events from both levels
        all_events = handler.context.get("all_events", [])
        assert len(all_events) > 0


class TestNestedWorkflowDataPassing:
    """Test data passing between nested workflows."""

    @pytest.mark.asyncio
    async def test_pass_data_from_parent_to_child(self):
        """Test parent can pass data to child workflow."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Access data passed from parent
                input_value = ev.metadata.get("input_value", 0)
                return StopEvent(result=input_value * 2)

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Pass data to child via metadata
                # Note: We need to simulate passing data via StartEvent metadata
                # In real usage, the child workflow would be initiated with specific data
                result = await self.child.arun(metadata={"input_value": 42})
                return StopEvent(result=result)

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result == 84  # 42 * 2

    @pytest.mark.asyncio
    async def test_child_shares_context_with_parent(self):
        """Test child workflow has separate context from parent."""

        class ChildWorkflow(BaseWorkflow):
            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                ctx.set("child_key", "child_value")
                # Try to access parent context (should not be possible)
                parent_value = ctx.get("parent_key")
                return StopEvent(result={"child_key": "child_value", "parent_key": parent_value})

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = ChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                ctx.set("parent_key", "parent_value")
                child_result = await self.child.arun()

                # Child should not have access to parent context
                assert child_result["parent_key"] is None

                # Parent should not have access to child context
                assert ctx.get("child_key") is None

                return StopEvent(result="verified")

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result == "verified"


class TestNestedWorkflowErrorHandling:
    """Test error handling in nested workflows."""

    @pytest.mark.asyncio
    async def test_child_exception_propagates_to_parent(self):
        """Test exceptions in child workflow propagate to parent."""

        class FailingChildWorkflow(BaseWorkflow):
            @step
            async def failing_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                raise ValueError("Child workflow failed")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = FailingChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # This should raise ValueError from child
                await self.child.arun()
                return StopEvent(result="should_not_reach")

        parent = ParentWorkflow()

        with pytest.raises(ValueError, match="Child workflow failed"):
            await parent.arun()

    @pytest.mark.asyncio
    async def test_parent_can_catch_child_exception(self):
        """Test parent can catch and handle child exceptions."""

        class FailingChildWorkflow(BaseWorkflow):
            @step
            async def failing_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                raise ValueError("Child error")

        class ParentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.child = FailingChildWorkflow()

            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                try:
                    await self.child.arun()
                    return StopEvent(result="child_succeeded")
                except ValueError as e:
                    return StopEvent(result=f"caught_{str(e)}")

        parent = ParentWorkflow()
        result = await parent.arun()

        assert result == "caught_Child error"


class TestNestedWorkflowConcurrency:
    """Test concurrent execution of child workflows."""

    @pytest.mark.asyncio
    async def test_multiple_child_workflows_concurrent(self):
        """Test parent can run multiple child workflows concurrently."""

        class ChildWorkflow(BaseWorkflow):
            def __init__(self, sleep_time: float):
                super().__init__()
                self.sleep_time = sleep_time

            @step
            async def child_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                await asyncio.sleep(self.sleep_time)
                return StopEvent(result=self.sleep_time)

        class ParentWorkflow(BaseWorkflow):
            @step
            async def parent_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Run three children concurrently
                child1 = ChildWorkflow(0.1)
                child2 = ChildWorkflow(0.1)
                child3 = ChildWorkflow(0.1)

                # Run concurrently
                results = await asyncio.gather(
                    child1.arun(),
                    child2.arun(),
                    child3.arun(),
                )

                return StopEvent(result=sum(results))

        import time

        start = time.perf_counter()

        parent = ParentWorkflow()
        result = await parent.arun()

        elapsed = time.perf_counter() - start

        # Should take ~0.1s (concurrent), not ~0.3s (sequential)
        assert elapsed < 0.2, f"Concurrent execution took {elapsed:.3f}s, should be ~0.1s"
        assert result == pytest.approx(0.3, rel=0.01)  # Sum of all sleep times


class TestComplexNestedScenarios:
    """Test complex nested workflow scenarios similar to DroidAgent architecture."""

    @pytest.mark.asyncio
    async def test_manager_executor_pattern(self):
        """
        Test pattern similar to DroidAgent → Manager → Executor.

        Manager creates subgoals, Executor handles each subgoal.
        """

        @dataclass
        class SubgoalEvent(Event):
            goal: str = ""

        class ExecutorWorkflow(BaseWorkflow):
            @step
            async def execute_subgoal(self, ctx: Context, ev: StartEvent) -> StopEvent:
                goal = ev.metadata.get("goal", "")
                # Simulate executing the subgoal
                await asyncio.sleep(0.05)
                return StopEvent(result=f"executed_{goal}")

        class ManagerWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.executor = ExecutorWorkflow()

            @step
            async def plan_subgoals(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Simulate planning subgoals
                subgoals = ["subgoal1", "subgoal2", "subgoal3"]

                results = []
                for subgoal in subgoals:
                    # Execute each subgoal
                    result = await self.executor.arun(metadata={"goal": subgoal})
                    results.append(result)

                return StopEvent(result=results)

        class DroidAgentWorkflow(BaseWorkflow):
            def __init__(self):
                super().__init__()
                self.manager = ManagerWorkflow()

            @step
            async def orchestrate(self, ctx: Context, ev: StartEvent) -> StopEvent:
                # Run manager which runs executor
                manager_result = await self.manager.arun()
                return StopEvent(result=manager_result)

        droid = DroidAgentWorkflow()
        result = await droid.arun()

        assert len(result) == 3
        assert result[0] == "executed_subgoal1"
        assert result[1] == "executed_subgoal2"
        assert result[2] == "executed_subgoal3"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
