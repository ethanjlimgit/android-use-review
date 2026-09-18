# Task Cancellation Architecture

This document explains how task cancellation works in the DroidUse backend.

## Overview

Task cancellation allows clients to stop a running task at any time by sending a cancellation request. The cancellation is handled gracefully, allowing the agent to clean up resources and return a proper result.

**Note**: As of v0.5.0, the backend uses a custom workflow system (`droiduse_backend/workflow/`) that guarantees proper cancellation propagation. See `docs/WORKFLOW_SYSTEM.md` for detailed information about the workflow system architecture.

## Custom Workflow System (v0.5.0+)

The custom workflow system was built specifically to ensure `asyncio.CancelledError` always propagates correctly. Key features:

- **Guaranteed propagation**: The `WorkflowHandler` class NEVER catches `CancelledError`
- **Fast response time**: < 200ms from cancellation trigger to full shutdown
- **Nested workflow support**: Cancellation propagates through multiple levels (DroidAgent → Manager → Executor)
- **Event streaming aware**: Cancellation works correctly during `stream_events()` iteration

For implementation details, see `WORKFLOW_SYSTEM.md`.

## How It Works

### 1. Cancellation Request

The client sends a cancellation message while a task is running:

```json
{
  "type": "cancel_task",
  "task_id": "abc123"
}
```

### 2. Cancellation Event

The server maintains a registry of active tasks with their cancellation events:

```python
# In WebSocketServer
self.active_tasks: Dict[str, asyncio.Event] = {}

# When task starts
cancellation_event = asyncio.Event()
self.active_tasks[task_id] = cancellation_event

# When cancel request arrives
self.active_tasks[task_id].set()  # Signal cancellation
```

### 3. Cancellation Propagation

The cancellation event is passed down through the entire execution stack:

```
WebSocketServer
  ↓ (creates cancellation_event)
DroidAgent (via __init__ → shared_state)
  ↓
CodeActAgent / ExecutorAgent (via shared_state)
  ↓
Tools (WebSocketConnectionTool)
  ↓
Sleep operations (adaptive_sleep, profile_sleep)
```

### 4. Cancellation Checks

The agent checks for cancellation at strategic points:

**a) Before executing tasks** (`droid_agent.py:376-378`)
```python
await check_cancellation(self.shared_state.cancellation_event)
```

**b) During event loops** (`droid_agent.py:408-410`)
```python
async for nested_ev in handler.stream_events():
    await check_cancellation(self.shared_state.cancellation_event)
```

**c) During sleep operations** (`cancellation.py:43-76`)
```python
# Sleeps in 100ms chunks, checking for cancellation between chunks
await cancellable_sleep(duration, cancellation_event=event)
```

### 5. Cancellation Handling

When cancellation is detected:

1. `asyncio.CancelledError` is raised
2. Exception handlers detect it using `is_cancellation_error()`
3. The error propagates up (not caught)
4. Main workflow catches it and returns cancelled result

```python
# In exception handlers (executer.py, codeact_agent.py, executor_agent.py)
except Exception as e:
    if is_cancellation_error(e):
        logger.info("🛑 Operation cancelled")
        raise  # Let it propagate
    # Handle other errors...
```

### 6. Final Response

The client receives two messages:

**Immediate acknowledgment:**
```json
{
  "status": "cancelled",
  "task_id": "abc123",
  "message": "Task cancellation initiated"
}
```

**Final result (shortly after):**
```json
{
  "status": "completed",
  "task_id": "abc123",
  "result": {
    "success": false,
    "reason": "Task was cancelled by user",
    "steps": 5
  }
}
```

## Key Components

### `cancellation.py` - Centralized Utilities

**Location:** `droiduse_backend/agent/utils/cancellation.py`

**Key Functions:**

1. **`check_cancellation(event)`**
   - Lightweight check for cancellation
   - Raises `CancelledError` if cancelled
   - Use at strategic points (before actions, between steps)

2. **`cancellable_sleep(duration, event)`**
   - Sleep while checking for cancellation every 100ms
   - Provides responsive cancellation during waits
   - Replaces regular `asyncio.sleep()` for cancellable operations

3. **`is_cancellation_error(exc)`**
   - Check if exception is a cancellation error
   - Handles both `asyncio.CancelledError` and `concurrent.futures.CancelledError`
   - Use in exception handlers to detect cancellation

### `websocket_server.py` - Request Handling

**Responsibilities:**
- Create cancellation events for tasks
- Handle incoming cancel requests
- Set cancellation events when requested
- Pass events to agents via tools

**Key Code:**
```python
# Create event when task starts
cancellation_event = asyncio.Event()
self.active_tasks[task_id] = cancellation_event

# Handle cancel requests during execution (handle_incoming_messages)
if message_type == "cancel_task":
    self.active_tasks[task_id].set()

# Pass to agent
tools = WebSocketConnectionTool(..., cancellation_event=cancellation_event)
droid_agent = DroidAgent(..., cancellation_event=cancellation_event)
```

### `droid_agent.py` - Agent Orchestration

**Responsibilities:**
- Store cancellation event in shared state
- Check for cancellation before task execution
- Check for cancellation in event loops

**Key Code:**
```python
# Store in shared state
self.shared_state = DroidAgentState(..., cancellation_event=cancellation_event)

# Check before execution
await check_cancellation(self.shared_state.cancellation_event)
```

### Exception Handlers

**Files:** `executer.py`, `codeact_agent.py`, `executor_agent.py`

**Pattern:**
```python
except Exception as e:
    if is_cancellation_error(e):
        logger.info("🛑 Operation cancelled")
        raise  # Propagate to stop workflow
    # Handle other errors...
```

## Cancellation Response Time

- **Sleep operations:** 100ms maximum (checked every 100ms)
- **Action execution:** Immediate (checked before each action)
- **Event loops:** Immediate (checked between events)

## Testing Cancellation

### Test Scenario 1: Cancel during sleep
```python
# Start task
task = await client.send_task("search for something")

# Cancel while agent is sleeping
await client.send_cancel(task_id)

# Should receive acknowledgment within 100ms
# Task should stop at next sleep check
```

### Test Scenario 2: Cancel during action
```python
# Start long-running task
task = await client.send_task("open many apps")

# Cancel immediately
await client.send_cancel(task_id)

# Should stop before next action
```

## Common Patterns

### Adding Cancellation to New Operations

**For async functions:**
```python
async def my_operation(cancellation_event: Optional[asyncio.Event] = None):
    # Check before starting
    await check_cancellation(cancellation_event)

    # Do work...

    # Use cancellable sleep instead of asyncio.sleep
    await cancellable_sleep(1.0, cancellation_event)

    # More work...
```

**For exception handlers:**
```python
try:
    await my_operation()
except Exception as e:
    if is_cancellation_error(e):
        raise  # Let cancellation propagate
    # Handle other errors
```

### Passing Cancellation Event

The event flows through the call stack via function parameters:

```python
# From shared state
cancellation_event = self.shared_state.cancellation_event

# To sleep operations
await adaptive_sleep(
    action_type="tap",
    cancellation_event=cancellation_event
)

# To tools
tools = WebSocketConnectionTool(
    websocket=ws,
    cancellation_event=cancellation_event
)
```

## Troubleshooting

### Cancellation not working
1. Check that cancellation event is passed through all layers
2. Verify exception handlers are re-raising CancelledError
3. Look for broad `except Exception` that might catch cancellation

### Cancellation too slow
1. Check if operations use `cancellable_sleep()` instead of `asyncio.sleep()`
2. Verify check interval is reasonable (default: 100ms)
3. Add more `check_cancellation()` calls in long-running loops

### Partial execution after cancel
1. Ensure all exception handlers check `is_cancellation_error()`
2. Verify handlers re-raise instead of returning error values
3. Check that finally blocks don't suppress exceptions

## Design Principles

1. **Centralized utilities** - All cancellation logic in `cancellation.py`
2. **Explicit propagation** - Cancellation events passed explicitly, not globals
3. **Fast response** - Check every 100ms during sleeps
4. **Clean propagation** - CancelledError always propagates up
5. **Consistent pattern** - Same exception handling pattern everywhere

## Future Improvements

1. Make check interval configurable
2. Add cancellation timeout (force-stop if not responsive)
3. Add cancellation reasons (user-requested, timeout, error threshold)
4. Track partial progress for cancelled tasks
5. Support pause/resume in addition to cancel
