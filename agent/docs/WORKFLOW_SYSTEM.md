# Custom Workflow System

## Overview

The DroidUse backend uses a custom lightweight workflow system (`droiduse_backend/workflow/`) that replaces LlamaIndex workflows. This system was created to guarantee proper task cancellation propagation through the agent hierarchy.

**Key Feature**: The workflow system **NEVER** catches `asyncio.CancelledError`, ensuring cancellation always propagates correctly from parent to child workflows.

## Architecture

### Core Components

The workflow system consists of 7 main modules (~1,000 LOC total):

```
droiduse_backend/workflow/
├── __init__.py                 # Public API exports
├── workflow.py                 # BaseWorkflow + WorkflowHandler (CRITICAL)
├── context.py                  # WorkflowContext + event queue
├── step_registry.py            # @step decorator + StepRegistry
├── event_router.py             # Type-based event routing
├── events.py                   # Event, StartEvent, StopEvent
└── exceptions.py               # WorkflowError, etc.
```

### Critical Component: WorkflowHandler

The `WorkflowHandler` class is the heart of the system. It ensures cancellation propagates correctly:

```python
class WorkflowHandler:
    """
    CRITICAL DESIGN PRINCIPLE:
    This class NEVER catches asyncio.CancelledError.
    All methods explicitly re-raise it immediately.
    """

    async def _execute(self):
        """Main execution loop."""
        try:
            # Execute steps...
        except asyncio.CancelledError as e:
            # Store exception, then ALWAYS re-raise
            self._exception = e
            raise

    async def stream_events(self):
        """Stream events from child workflows."""
        try:
            async for event in self.context.stream_events():
                yield event
        except asyncio.CancelledError:
            # NEVER catch - always re-raise
            raise
```

## Usage

### Basic Workflow

```python
from droiduse_backend.workflow import BaseWorkflow, step, Context, StartEvent, StopEvent

class MyWorkflow(BaseWorkflow):
    @step
    async def my_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
        # Do work
        ctx.set("result", "done")
        return StopEvent(result="done")

# Run workflow
workflow = MyWorkflow()
result = await workflow.arun()
```

### Event Features

Events accept arbitrary keyword arguments and support dictionary-like access:

```python
# Create event with custom fields
event = StartEvent(instruction="Open YouTube", user_id="123")

# Access via attribute
print(event.instruction)  # "Open YouTube"

# Access via get() method (with default)
user_id = event.get("user_id")
missing = event.get("missing_key", "default")

# Dictionary-style access
event["new_field"] = "value"
if "instruction" in event:
    print(event["instruction"])

# All events have metadata
event.metadata["trace_id"] = "abc123"
```

This flexible design allows events to work seamlessly with existing agent code that expects dictionary-like behavior.

### Multi-Step Workflow

```python
@dataclass
class ProcessEvent(Event):
    data: str

class MultiStepWorkflow(BaseWorkflow):
    @step
    async def start_step(self, ctx: Context, ev: StartEvent) -> ProcessEvent:
        # First step
        return ProcessEvent(data="processed")

    @step
    async def process_step(self, ctx: Context, ev: ProcessEvent) -> StopEvent:
        # Second step
        return StopEvent(result=ev.data)

result = await MultiStepWorkflow().arun()
```

### Terminal Event Pattern

When a workflow step completes the workflow, it should:
1. **Emit a custom event** for streaming (so clients can see it)
2. **Return StopEvent** with a result dict for workflow termination

This pattern is used in CodeActAgent, ScripterAgent, and DroidAgent:

```python
@step
async def final_step(self, ctx: Context, ev: SomeEvent) -> StopEvent:
    # Build result dictionary
    result_dict = {
        "success": True,
        "reason": "Task completed",
        "steps": 5,
    }

    # Emit custom event for streaming (optional)
    end_event = MyEndEvent(success=True, reason="Task completed")
    ctx.write_event_to_stream(end_event)

    # Return StopEvent with result dict for workflow termination
    return StopEvent(result=result_dict)
```

**Important**: The result dict is what gets returned when you `await handler`. Access it as a dictionary:
```python
result = await workflow.arun()
print(result["success"])  # Access as dict
print(result["reason"])
```

### Nested Workflows

```python
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
        # Run child workflow
        child_result = await self.child.arun()
        return StopEvent(result=f"parent_{child_result}")

result = await ParentWorkflow().arun()
```

### Event Streaming

```python
workflow = MyWorkflow()
handler = workflow.run()

# Stream events from workflow
async for event in handler.stream_events():
    print(f"Event: {event}")

# Get final result
result = await handler
```

## Cancellation Guarantees

### The Problem with LlamaIndex

LlamaIndex workflows caught `CancelledError` in their internal event loop, preventing proper cancellation:

```python
# LlamaIndex (problematic)
try:
    result = await handler
except Exception as e:  # This catches CancelledError!
    # Handle error
```

### Our Solution

The custom workflow system **explicitly re-raises** `CancelledError` at every level:

```python
# Custom workflow (correct)
try:
    result = await handler
except asyncio.CancelledError:
    # ALWAYS re-raise - never handle
    raise
except Exception as e:
    # Only handle non-cancellation errors
```

### Cancellation Through Nested Workflows

When a parent workflow is cancelled, the cancellation propagates to all child workflows:

```
DroidAgent (cancelled)
    ↓
ManagerAgent (receives CancelledError)
    ↓
ExecutorAgent (receives CancelledError)
    ↓
LLM call (cancelled)
```

**Response time**: < 200ms from cancellation trigger to full shutdown.

## Implementation Details

### Type-Based Event Routing

Events are routed to steps based on type annotations:

```python
class MyWorkflow(BaseWorkflow):
    @step
    async def handle_start(self, ctx: Context, ev: StartEvent) -> MyEvent:
        # This step handles StartEvent
        return MyEvent()

    @step
    async def handle_my_event(self, ctx: Context, ev: MyEvent) -> StopEvent:
        # This step handles MyEvent
        return StopEvent(result="done")
```

The `EventRouter` uses Python's type introspection to route events:
1. Get type annotation from step signature
2. Match incoming event type
3. Call appropriate step function

### Event Queue and Context

Each workflow has a `WorkflowContext` with:
- **Event queue**: For streaming events to parent workflows
- **Key-value store**: For sharing data between steps
- **Running flag**: For lifecycle management

```python
ctx = WorkflowContext()
ctx.set("key", "value")  # Store data
value = ctx.get("key")    # Retrieve data

await ctx.send_event(MyEvent())  # Send to queue
async for event in ctx.stream_events():  # Consume queue
    print(event)
```

### Workflow Lifecycle

1. **Create**: `workflow = MyWorkflow()`
2. **Run**: `handler = workflow.run()` (starts background task)
3. **Stream**: `async for event in handler.stream_events():`
4. **Await**: `result = await handler`
5. **Complete**: Workflow marked as stopped, event queue drained

## Differences from LlamaIndex

| Feature | LlamaIndex | Custom Workflow |
|---------|-----------|----------------|
| Cancellation | Catches `CancelledError` | **Always re-raises** |
| Event routing | Complex inheritance | Simple type-based |
| Event access | Dataclass fields | Attributes + dict-like |
| Dependencies | Large (llama-index-core) | None (pure asyncio) |
| Code size | ~10,000 LOC | ~1,000 LOC |
| Response time | > 1 second | < 200ms |
| Event streaming | Limited | Full support |

## API Compatibility

The custom workflow system provides a drop-in replacement for LlamaIndex APIs:

```python
# Before (LlamaIndex)
from workflows import Workflow, step
from workflows.context import Context
from workflows.events import StartEvent, StopEvent

# After (Custom)
from droiduse_backend.workflow import Workflow, step, Context, StartEvent, StopEvent
```

All existing agent code continues to work without changes (except imports).

## Testing

The workflow system has comprehensive test coverage:

- **Basic functionality**: `tests/test_custom_workflow.py` (16 tests)
- **Cancellation**: `tests/test_workflow_cancellation.py` (15+ tests)
- **Nested workflows**: `tests/test_nested_workflows.py` (10+ tests)

Key test scenarios:
- Cancellation during step execution
- Cancellation during event streaming
- Cancellation through 3 levels of nesting
- Cancellation response time < 200ms
- Event streaming through nested workflows

## Future Enhancements

Potential improvements:

1. **Workflow visualization**: Generate diagrams from workflow definitions
2. **Better debugging**: Add workflow execution tracing
3. **Performance monitoring**: Track workflow execution metrics
4. **Parallel step execution**: Support concurrent step execution
5. **Conditional routing**: Route based on conditions, not just types

## Migration Guide

To migrate from LlamaIndex to the custom workflow:

1. **Update imports**:
   ```python
   # Old
   from workflows import Workflow, step

   # New
   from droiduse_backend.workflow import Workflow, step
   ```

2. **Add cancellation checks** (in event loops):
   ```python
   async for event in handler.stream_events():
       await check_cancellation(cancellation_event)  # Add this
       process_event(event)
   ```

3. **Test thoroughly**: Verify cancellation works end-to-end

## Troubleshooting

### Workflow not cancelling

**Problem**: Workflow continues running after cancellation.

**Solution**: Check for:
- Missing `await check_cancellation()` calls in event loops
- Try/except blocks catching `Exception` instead of specific exceptions
- Blocking operations without timeout

### Events not streaming

**Problem**: No events received when calling `stream_events()`.

**Solution**:
- Ensure steps call `ctx.send_event()` for intermediate events
- Check that workflow is actually running (`ctx.is_running()`)
- Verify event queue is not blocked

### Type routing errors

**Problem**: `StepNotFoundError: No step found to handle event type`

**Solution**:
- Add type annotation to step parameter: `ev: MyEvent`
- Ensure event type matches step signature exactly
- Check for typos in event class names

## Summary

The custom workflow system provides:

✓ **Guaranteed cancellation propagation** (< 200ms response)
✓ **Lightweight** (~1,000 LOC, no dependencies)
✓ **Drop-in replacement** for LlamaIndex workflows
✓ **Full event streaming** support
✓ **Comprehensive tests** (40+ test cases)

This system enables reliable task cancellation across the entire agent hierarchy, solving the critical issue that motivated its creation.
