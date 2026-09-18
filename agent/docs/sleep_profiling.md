# Sleep Profiling

The DroidUse backend includes comprehensive sleep profiling to track and analyze time spent waiting for UI animations, app launches, and other asynchronous operations.

## Overview

Sleep profiling helps you understand where your automation tasks spend time waiting, allowing you to:

- Identify bottlenecks caused by excessive waiting
- Optimize sleep durations for different action types
- Understand the distribution of wait times across action types
- Compare time spent in active operations vs. waiting

## Sleep Types

The profiler tracks sleep time categorized by the type of action that triggered the sleep:

### Action-Related Sleep Types

- **`open_app`**: Sleep after launching an application (typically ~800ms)
- **`tap`** / **`click`**: Sleep after tapping UI elements (typically ~200ms)
- **`swipe`** / **`scroll`**: Sleep after swipe/scroll gestures (typically ~300ms)
- **`long_press`**: Sleep after long press actions (typically ~300ms)
- **`type`** / **`input_text`**: Sleep after text input (typically ~200ms)
- **`go_home`**: Sleep after pressing home button (typically ~500ms)
- **`go_back`**: Sleep after back navigation (typically ~300ms)
- **`system_button`**: Sleep after system button presses (typically ~400ms)
- **`drag`**: Sleep after drag operations (typically ~400ms)

### Other Sleep Types

- **`wait`**: Explicit wait operations called by the agent
- **`generic`**: Unclassified sleep operations

Sleep durations are automatically determined by the `adaptive_sleep` system based on action types, with the ability to scale based on configuration.

## Usage

### Automatic Profiling

Sleep profiling is enabled by default when using the profiler. All `profile_sleep()` calls automatically track the sleep type:

```python
from droiduse_backend.observability import profile_sleep

# Profile sleep with type classification
await profile_sleep(0.8, sleep_type="open_app")
await profile_sleep(0.2, sleep_type="tap")
await profile_sleep(2.0, sleep_type="wait")
```

### With Adaptive Sleep

The `adaptive_sleep` function automatically profiles sleep with the appropriate type:

```python
from droiduse_backend.agent.utils.timing import adaptive_sleep

# Automatically determines sleep duration and profiles it
await adaptive_sleep(action_type="tap")
await adaptive_sleep(action_type="open_app")
```

### Accessing Sleep Statistics

#### Summary Report

The profiler summary includes a dedicated sleep section showing breakdown by type:

```python
from droiduse_backend.observability import get_profiler

profiler = get_profiler()
profiler.start()

# ... execute actions ...

profiler.stop()
profiler.print_summary()
```

Output:
```
======================================================================
PROFILING SUMMARY
======================================================================
Total Time: 6.51s
Tracked:    6.51s (100.0%)
Untracked:  0ms (0.0%)
----------------------------------------------------------------------

SLEEP (100.0% of total)
  Total: 6.51s | Count: 12 | Avg: 543ms
  Sleep Types (by duration):
    - open_app: 2.40s (36.9% of sleep) | x3 | avg 801ms
    - wait: 2.00s (30.7% of sleep) | x1 | avg 2.00s
    - tap: 1.01s (15.4% of sleep) | x5 | avg 201ms
    - swipe: 602ms (9.2% of sleep) | x2 | avg 301ms
    - generic: 501ms (7.7% of sleep) | x1 | avg 501ms

======================================================================
```

#### Programmatic Access

Get sleep breakdown programmatically for analysis:

```python
profiler = get_profiler()

# Get detailed sleep breakdown
sleep_breakdown = profiler.get_sleep_breakdown()

for sleep_type, stats in sleep_breakdown.items():
    print(f"{sleep_type}:")
    print(f"  Total: {stats['total_ms']}ms ({stats['percentage']}%)")
    print(f"  Count: {stats['count']}")
    print(f"  Avg: {stats['avg_ms']}ms")
```

Returns:
```python
{
    "open_app": {
        "total_ms": 2403.0,
        "count": 3,
        "avg_ms": 801.0,
        "percentage": 36.9
    },
    "tap": {
        "total_ms": 1005.0,
        "count": 5,
        "avg_ms": 201.0,
        "percentage": 15.4
    },
    # ...
}
```

## Configuration

Sleep durations can be tuned via the agent configuration:

```yaml
agent:
  after_sleep_action: 0.3  # Base sleep multiplier (default: 0.3)
  wait_for_stable_ui: 0.3  # Additional wait for UI stabilization
```

The `after_sleep_action` parameter acts as a multiplier for all adaptive sleep durations. For example:
- Setting it to 0.6 will double all sleep times
- Setting it to 0.15 will halve all sleep times

## Best Practices

1. **Monitor Sleep Distribution**: Regularly check sleep breakdown to identify excessive waiting
2. **Optimize Long Sleeps**: If `open_app` or `wait` dominate your execution time, consider optimizing app launch times or reducing explicit waits
3. **Tune Durations**: Adjust `after_sleep_action` based on device performance:
   - Faster devices: reduce to 0.2 or lower
   - Slower devices: increase to 0.4-0.5
4. **Avoid Generic Sleep**: Always specify a sleep_type for better profiling insights

## Example

See `examples/test_sleep_profiling.py` for a complete working example:

```bash
python examples/test_sleep_profiling.py
```

## Related

- [Profiler Documentation](profiler.md)
- [Timing Utilities](../droiduse_backend/agent/utils/timing.py)
- [Adaptive Sleep Configuration](../droiduse_backend/config_manager/config_manager.py)
