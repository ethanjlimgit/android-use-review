# Timing and Profiling Examples

This directory contains examples demonstrating sleep profiling and action timing improvements.

## Examples

### 1. `test_action_timing.py`
**Action execution time awareness demonstration**

Shows how the adaptive sleep system accounts for action execution time:
- Fast vs slow action comparison
- Sleep reduction based on network latency
- Overall performance improvement (up to 33% faster)
- Reduced base durations for click/type actions

**Run:**
```bash
python examples/test_action_timing.py
```

**Key Features:**
- Demonstrates action timing capture
- Shows sleep duration adjustment
- Calculates time savings
- Compares old vs new approach

**Output Example:**
```
Fast tap (50ms): action=50ms + sleep=50ms = 100ms
Slow tap (300ms): action=300ms + sleep=0ms = 300ms
Time saved: 33.1%
```

### 2. `test_sleep_profiling.py`
**Basic sleep profiling demonstration**

Shows fundamental usage of sleep profiling:
- Recording different sleep types
- Viewing formatted summary
- Accessing programmatic breakdown

**Run:**
```bash
python examples/test_sleep_profiling.py
```

**Output:**
- Shows sleep breakdown by type (open_app, tap, swipe, wait, etc.)
- Displays total/count/avg for each type
- Percentage distribution

### 2. `sleep_profiling_workflow.py`
**Real-world automation workflow**

Simulates a complete task (login form) with:
- Multiple action types (open app, tap, input text, swipe, wait)
- Sleep analysis and optimization suggestions
- Configuration comparison (fast/default/slow modes)
- Efficiency metrics

**Run:**
```bash
python examples/sleep_profiling_workflow.py
```

**Features:**
- Task simulation with realistic sleep patterns
- Automatic optimization suggestions
- Configuration impact analysis
- Efficiency scoring

## Key Insights from Examples

### Before Enhancement
```
SLEEP (25.0% of total)
  Total: 5.61s | Count: 9 | Avg: 623ms
  Operations:
    - sleep: 5.61s (100.0%) | x9 | avg 623ms
```
❌ No visibility into what types of operations caused the sleep

### After Enhancement
```
SLEEP (25.0% of total)
  Total: 5.61s | Count: 9 | Avg: 623ms
  Sleep Types (by duration):
    - wait: 3.00s (53.5% of sleep) | x1 | avg 3.00s
    - open_app: 801ms (14.3% of sleep) | x1 | avg 801ms
    - tap: 602ms (10.7% of sleep) | x3 | avg 201ms
    - go_home: 500ms (8.9% of sleep) | x1 | avg 500ms
    - input_text: 402ms (7.2% of sleep) | x2 | avg 201ms
    - swipe: 301ms (5.4% of sleep) | x1 | avg 301ms
```
✅ Clear breakdown showing where time is spent waiting

## Use Cases

1. **Performance Optimization**: Identify which sleep types dominate your task execution
2. **Configuration Tuning**: Compare different `after_sleep_action` values
3. **Workflow Analysis**: Understand the time distribution across different actions
4. **Debugging**: Spot excessive waits or bottlenecks quickly

## API Reference

### Recording Sleep
```python
from droiduse_backend.observability import profile_sleep

# With type classification
await profile_sleep(0.8, sleep_type="open_app")
await profile_sleep(0.2, sleep_type="tap")
await profile_sleep(2.0, sleep_type="wait")
```

### Automatic Classification
```python
from droiduse_backend.agent.utils.timing import adaptive_sleep

# Automatically determines duration and classifies
await adaptive_sleep("tap")
await adaptive_sleep("open_app")
```

### Getting Results
```python
from droiduse_backend.observability import get_profiler

profiler = get_profiler()

# Formatted summary
profiler.print_summary()

# Programmatic access
sleep_breakdown = profiler.get_sleep_breakdown()
# Returns: {"open_app": {"total_ms": 800, "count": 1, "avg_ms": 800, ...}, ...}
```

## Key Improvements

### Action Duration Awareness (New)

The adaptive sleep system now considers action execution time:

**Before:**
- Action takes 300ms (network delay) + 200ms sleep = 500ms total
- Fixed sleep regardless of action duration

**After:**
- Action takes 300ms + 0ms sleep = 300ms total
- Sleep reduced by action execution time
- **Result: 33% faster in typical scenarios**

### Reduced Base Durations (New)

| Action | Before | After | Improvement |
|--------|--------|-------|-------------|
| tap/click | 200ms | 100ms | 50% faster |
| type/input | 200ms | 100ms | 50% faster |
| default | 200ms | 150ms | 25% faster |

### Sleep Type Tracking

All sleep operations are tracked by type for detailed profiling:
- See exactly which action types consume the most wait time
- Identify optimization opportunities
- Compare different configurations

## More Information

- Action timing improvements: `../docs/action_timing_improvement.md`
- Sleep profiling guide: `../docs/sleep_profiling.md`
- Configuration options: `../droiduse_backend/agent/utils/timing.py`
