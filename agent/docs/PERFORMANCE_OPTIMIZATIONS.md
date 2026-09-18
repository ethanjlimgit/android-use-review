# Performance Optimizations for DroidUse Backend

This document outlines identified performance bottlenecks and optimization strategies for the agent execution flow.

## High-Impact Optimizations

### 1. Parallelize State/Screenshot Capture (Save 400-600ms per step)

**Problem**: In `manager_agent.py:355-446`, `codeact_agent.py:270-344`, state, screenshot, and app card are fetched sequentially.

```python
# Current (sequential - ~600ms total):
formatted_text, focused_text, a11y_tree, phone_state = await self.tools_instance.get_state()
app_card = await self.app_card_provider.load_app_card(...)
screenshot = await self.tools_instance.take_screenshot()

# Optimized (parallel - ~200ms total):
state_result, app_card_result, screenshot_result = await asyncio.gather(
    self.tools_instance.get_state(),
    self.app_card_provider.load_app_card(...),
    self.tools_instance.take_screenshot() if self.vision else asyncio.sleep(0),
)
```

**Status**: Implemented

---

### 2. Adaptive Sleep Delay (Save 10-15s for typical tasks)

**Problem**: `after_sleep_action` defaults to 1.0s and runs after every action, regardless of action type.

**Location**: `config_manager.py:105`, applied in `executor_agent.py:279` and `codeact_agent.py:443`

**Solution**: Implement adaptive waiting based on action type:
- Navigation actions (open_app, go_home, go_back): 0.5s (need UI transition)
- Input actions (tap, input_text): 0.2s (minimal wait)
- Scroll/swipe actions: 0.3s (animation settling)
- No action / get_state: 0s (no wait needed)

**Status**: Implemented

---

### 3. Eliminate Redundant Screenshots (Save 400-1000ms per cycle)

**Problem**: Screenshots captured multiple times per step:
- Manager captures at line 415-445
- CodeAct/Executor capture again independently
- Finalize captures again at line 994

**Solution**: Share screenshots via `shared_state` with timestamp:
```python
# In shared state
self.shared_state.last_screenshot = screenshot
self.shared_state.last_screenshot_time = time.time()

# In other agents, reuse if fresh (<1s old)
if (time.time() - self.shared_state.last_screenshot_time) < 1.0:
    screenshot = self.shared_state.last_screenshot
```

**Status**: Not yet implemented

---

### 4. Move Database Recording Off Critical Path (Save 50-200ms per step)

**Problem**: `db_recorder.record_step()` is awaited in the main execution path at `manager_agent.py:386-400`.

**Solution**: Fire-and-forget pattern:
```python
if self.db_recorder:
    asyncio.create_task(self.db_recorder.record_step(...))  # Don't await
```

**Status**: Implemented

---

### 5. Cache App Cards (Save ~2s per step for repeated packages)

**Problem**: App cards fetched every step even when package hasn't changed.

**Location**: `manager_agent.py:403-445`

**Solution**: Add LRU cache with TTL:
```python
@lru_cache(maxsize=50)
def get_cached_app_card(package_name: str) -> AppCard:
    ...
```

**Status**: Not yet implemented

---

### 6. Avoid Deep Copy of Message History (Save 5-10s for long tasks)

**Problem**: `manager_agent.py:238-239` deep copies entire message history every inference call. For long conversations with vision enabled, this can copy 10-50MB of data per step.

**Solution**: Use shallow copy or implement copy-on-write for messages that won't be modified. Only deep copy when modification is necessary.

**Status**: Implemented

---

## Configuration Tuning

Recommended settings in `config.yaml`:

```yaml
agent:
  after_sleep_action: 0.3      # Base delay, adaptive system will adjust
  max_steps: 10                # Reduce if tasks are simple

  manager:
    vision: true               # Keep for accuracy, or disable for speed

  executor:
    vision: false              # Executor can often work without vision

  codeact:
    vision: true

tools:
  app_cards:
    enabled: false             # Disable if not using app-specific knowledge
    server_timeout: 1.0        # Reduce from 2.0s
```

---

## Summary Table

| Optimization | Location | Time Saved | Status |
|-------------|----------|------------|--------|
| Parallelize state/screenshot | manager_agent.py, codeact_agent.py | 400-600ms/step | **Implemented** |
| Adaptive sleep delays | executor_agent.py, codeact_agent.py | ~12s for 15-step task | **Implemented** |
| Share screenshots via shared_state | All agents | 400-1000ms/cycle | Pending |
| Background DB recording | manager_agent.py, codeact_agent.py | 50-200ms/step | **Implemented** |
| Cache app cards | manager_agent.py:403 | 2s/step (repeated pkgs) | Pending |
| Avoid deep copy message history | manager_agent.py:238 | 5-10s for long tasks | **Implemented** |

**Total potential improvement**: 30-50% faster execution for typical 10-15 step tasks.

---

## Implementation Details

### Files Modified

1. **`droiduse_backend/agent/utils/timing.py`** (new file)
   - Adaptive sleep utility with action-type-based delays
   - `ACTION_SLEEP_DURATIONS` mapping for each action type
   - `adaptive_sleep()` async function
   - `extract_action_type_from_code()` helper for CodeAct

2. **`droiduse_backend/agent/manager/manager_agent.py`**
   - Parallelized `get_state()` and `take_screenshot()` using `asyncio.gather()`
   - Moved DB recording to background task via `asyncio.create_task()`
   - Replaced deep copy with shallow copy for message history

3. **`droiduse_backend/agent/codeact/codeact_agent.py`**
   - Parallelized `get_state()` and `take_screenshot()` using `asyncio.gather()`
   - Moved DB recording to background task
   - Replaced fixed `asyncio.sleep()` with `adaptive_sleep()`

4. **`droiduse_backend/agent/executor/executor_agent.py`**
   - Replaced fixed `asyncio.sleep()` with `adaptive_sleep()`
   - Added `previous_action_failed` parameter for retry scenarios
