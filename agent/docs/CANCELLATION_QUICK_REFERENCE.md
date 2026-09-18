# Task Cancellation - Quick Reference

## 📋 Overview

Task cancellation is now centralized in `agent/utils/cancellation.py` with three simple utilities.

## 🎯 Quick Start

### Check for Cancellation
```python
from droiduse_backend.agent.utils.cancellation import check_cancellation

async def my_function(cancellation_event=None):
    # Check before starting work
    await check_cancellation(cancellation_event)
    # ... do work
```

### Sleep with Cancellation
```python
from droiduse_backend.agent.utils.cancellation import cancellable_sleep

async def my_function(cancellation_event=None):
    # Sleep for 2 seconds (cancellable every 100ms)
    await cancellable_sleep(2.0, cancellation_event=cancellation_event)
```

### Handle Exceptions
```python
from droiduse_backend.agent.utils.cancellation import is_cancellation_error

try:
    await operation()
except Exception as e:
    if is_cancellation_error(e):
        raise  # Let cancellation propagate
    # Handle other errors
    logger.error(f"Error: {e}")
```

## 🔄 Cancellation Flow

```
1. Client Request
   ↓
   {"type": "cancel_task", "task_id": "abc123"}

2. Server (websocket_server.py)
   ↓
   self.active_tasks[task_id].set()  # Set event
   Send acknowledgment

3. Agent Checks (every 100ms during sleeps)
   ↓
   cancellable_sleep() → checks event → raises CancelledError

4. Exception Handling
   ↓
   is_cancellation_error() → re-raise → propagates up

5. Main Handler (websocket_server.py)
   ↓
   Catches CancelledError → returns cancelled result

6. Client Response
   ↓
   {"status": "completed", "result": {"success": false, "reason": "cancelled"}}
```

## 📁 File Organization

```
droiduse_backend/
├── agent/utils/
│   └── cancellation.py          ← NEW: Central utilities
│
├── api/
│   └── websocket_server.py      ← Creates events, handles requests
│
├── agent/droid/
│   ├── droid_agent.py           ← Uses check_cancellation()
│   └── state.py                 ← Stores cancellation_event
│
├── agent/
│   ├── codeact/
│   │   └── codeact_agent.py     ← Uses is_cancellation_error()
│   ├── executor/
│   │   └── executor_agent.py    ← Uses is_cancellation_error()
│   └── utils/
│       ├── executer.py          ← Uses is_cancellation_error()
│       └── timing.py            ← Passes event to sleep
│
├── observability/
│   └── profiler.py              ← Uses cancellable_sleep()
│
└── docs/
    ├── TASK_CANCELLATION.md          ← Architecture docs
    ├── CANCELLATION_REFACTORING.md   ← Refactoring summary
    └── CANCELLATION_QUICK_REFERENCE.md ← This file
```

## 🛠️ API Reference

### `check_cancellation(event)`
Check if cancellation requested and raise if so.

**Args:**
- `event`: Optional[asyncio.Event] - Cancellation event

**Raises:**
- `asyncio.CancelledError` - If cancelled

**Example:**
```python
await check_cancellation(self.shared_state.cancellation_event)
```

---

### `cancellable_sleep(duration, event, interval)`
Sleep while checking for cancellation.

**Args:**
- `duration`: float - Sleep duration in seconds
- `event`: Optional[asyncio.Event] - Cancellation event
- `interval`: float = 0.1 - Check interval (default: 100ms)

**Raises:**
- `asyncio.CancelledError` - If cancelled during sleep

**Example:**
```python
# Sleep 5 seconds, check every 100ms
await cancellable_sleep(5.0, cancellation_event=event)
```

---

### `is_cancellation_error(exc)`
Check if exception is a cancellation error.

**Args:**
- `exc`: BaseException - Exception to check

**Returns:**
- `bool` - True if cancellation error

**Example:**
```python
except Exception as e:
    if is_cancellation_error(e):
        raise
```

## 📊 Before & After Comparison

### Cancellation Check

**Before:**
```python
if self.shared_state.cancellation_event and \
   self.shared_state.cancellation_event.is_set():
    logger.info("🛑 Task cancelled")
    raise asyncio.CancelledError()
```

**After:**
```python
await check_cancellation(self.shared_state.cancellation_event)
```

---

### Exception Handling

**Before:**
```python
except asyncio.CancelledError:
    logger.info("🛑 Operation cancelled")
    raise
except concurrent.futures.CancelledError:
    logger.info("🛑 Operation cancelled")
    raise
except Exception as e:
    # Handle errors
```

**After:**
```python
except Exception as e:
    if is_cancellation_error(e):
        logger.info("🛑 Operation cancelled")
        raise
    # Handle errors
```

---

### Sleep with Cancellation

**Before:**
```python
if cancellation_event:
    elapsed = 0.0
    while elapsed < duration:
        if cancellation_event.is_set():
            raise asyncio.CancelledError()
        sleep_time = min(0.1, duration - elapsed)
        await asyncio.sleep(sleep_time)
        elapsed += sleep_time
else:
    await asyncio.sleep(duration)
```

**After:**
```python
await cancellable_sleep(duration, cancellation_event=cancellation_event)
```

## ⚡ Key Points

✅ **One source of truth** - All cancellation logic in `cancellation.py`

✅ **Simple API** - Three functions cover all use cases

✅ **Consistent pattern** - Same approach everywhere

✅ **Fast response** - 100ms maximum delay

✅ **Well documented** - Clear docs with examples

✅ **Easy to test** - Utilities can be unit tested

✅ **Backward compatible** - No API changes for clients

## 🧪 Testing

```python
import asyncio
import pytest
from droiduse_backend.agent.utils.cancellation import (
    check_cancellation,
    cancellable_sleep,
    is_cancellation_error
)

@pytest.mark.asyncio
async def test_check_cancellation_when_set():
    event = asyncio.Event()
    event.set()
    with pytest.raises(asyncio.CancelledError):
        await check_cancellation(event)

@pytest.mark.asyncio
async def test_cancellable_sleep_interruption():
    event = asyncio.Event()

    async def cancel_after_delay():
        await asyncio.sleep(0.1)
        event.set()

    asyncio.create_task(cancel_after_delay())

    with pytest.raises(asyncio.CancelledError):
        await cancellable_sleep(10.0, cancellation_event=event)

def test_is_cancellation_error():
    assert is_cancellation_error(asyncio.CancelledError())
    assert not is_cancellation_error(ValueError())
```

## 📚 See Also

- **Architecture Details:** `docs/TASK_CANCELLATION.md`
- **Refactoring Summary:** `docs/CANCELLATION_REFACTORING.md`
- **Source Code:** `droiduse_backend/agent/utils/cancellation.py`
