"""
Test script to demonstrate action execution time consideration in sleep timing.

This shows how the adaptive sleep system accounts for action execution time,
reducing unnecessary wait when actions take longer due to network latency.
"""

import asyncio
import time

from droiduse_backend.agent.utils.timing import adaptive_sleep


async def simulate_fast_action(action_type: str):
    """Simulate a fast action (e.g., local tap)"""
    print(f"\n🏃 Simulating fast {action_type} (50ms execution)...")
    action_start = time.perf_counter()
    await asyncio.sleep(0.05)  # Simulate 50ms action
    action_duration = time.perf_counter() - action_start

    print(f"  Action took: {action_duration*1000:.0f}ms")
    sleep_start = time.perf_counter()
    await adaptive_sleep(action_type, base_delay=0.3, action_duration_sec=action_duration)
    sleep_duration = time.perf_counter() - sleep_start
    print(f"  Sleep time: {sleep_duration*1000:.0f}ms")
    print(f"  Total: {(action_duration + sleep_duration)*1000:.0f}ms")


async def simulate_slow_action(action_type: str):
    """Simulate a slow action (e.g., network call)"""
    print(f"\n🐌 Simulating slow {action_type} (300ms execution due to network)...")
    action_start = time.perf_counter()
    await asyncio.sleep(0.3)  # Simulate 300ms action (network latency)
    action_duration = time.perf_counter() - action_start

    print(f"  Action took: {action_duration*1000:.0f}ms")
    sleep_start = time.perf_counter()
    await adaptive_sleep(action_type, base_delay=0.3, action_duration_sec=action_duration)
    sleep_duration = time.perf_counter() - sleep_start
    print(f"  Sleep time: {sleep_duration*1000:.0f}ms")
    print(f"  Total: {(action_duration + sleep_duration)*1000:.0f}ms")


async def compare_with_without_timing():
    """Compare behavior with and without action timing consideration"""

    print("=" * 70)
    print("COMPARISON: Fast vs Slow Actions")
    print("=" * 70)

    # Test 1: Fast tap (50ms execution)
    await simulate_fast_action("tap")

    # Test 2: Slow tap (300ms execution due to network)
    await simulate_slow_action("tap")

    print("\n" + "=" * 70)
    print("KEY INSIGHT")
    print("=" * 70)
    print("The slow action (300ms) required less additional sleep because")
    print("the UI had time to update during the action execution itself.")
    print("Expected tap sleep: 100ms (0.1s base * 0.3/0.3 scale)")
    print("  - Fast action: ~100ms sleep")
    print("  - Slow action: ~0ms sleep (100ms - 300ms = 0, clamped)")

    # Test 3: Multiple action types
    print("\n" + "=" * 70)
    print("DIFFERENT ACTION TYPES")
    print("=" * 70)

    print("\n🔘 Click actions (reduced from 200ms to 100ms):")
    await simulate_fast_action("click")

    print("\n⌨️  Type actions (reduced from 200ms to 100ms):")
    await simulate_fast_action("type")

    print("\n📱 Open app actions (800ms base):")
    await simulate_fast_action("open_app")


async def demonstrate_improvement():
    """Demonstrate the improvement in total execution time"""

    print("\n" + "=" * 70)
    print("IMPROVEMENT DEMONSTRATION")
    print("=" * 70)

    # Simulate a typical task: tap, type, tap, type, tap
    actions = [
        ("tap", 0.05),  # Fast tap
        ("type", 0.05),  # Fast type
        ("tap", 0.25),  # Slow tap (network delay)
        ("type", 0.15),  # Moderate type (network delay)
        ("tap", 0.05),  # Fast tap
    ]

    print("\nTask: 5 actions (tap, type, tap with delay, type with delay, tap)")
    print("Base sleep times: tap=100ms, type=100ms")

    total_action_time = 0
    total_sleep_time = 0

    for i, (action_type, exec_time) in enumerate(actions, 1):
        action_start = time.perf_counter()
        await asyncio.sleep(exec_time)
        action_duration = time.perf_counter() - action_start
        total_action_time += action_duration

        sleep_start = time.perf_counter()
        await adaptive_sleep(action_type, base_delay=0.3, action_duration_sec=action_duration)
        sleep_duration = time.perf_counter() - sleep_start
        total_sleep_time += sleep_duration

        print(
            f"  {i}. {action_type}: action={action_duration*1000:.0f}ms, sleep={sleep_duration*1000:.0f}ms"
        )

    total_time = total_action_time + total_sleep_time
    print("\nResults:")
    print(f"  Total action time: {total_action_time*1000:.0f}ms")
    print(f"  Total sleep time: {total_sleep_time*1000:.0f}ms")
    print(f"  Total time: {total_time*1000:.0f}ms")

    # Calculate what it would have been without timing consideration
    static_sleep = 0.1 * 5  # 100ms * 5 actions
    old_total = total_action_time + static_sleep
    improvement = old_total - total_time

    print("\nWithout timing consideration:")
    print(f"  Total time would be: {old_total*1000:.0f}ms")
    print(f"  Time saved: {improvement*1000:.0f}ms ({improvement/old_total*100:.1f}%)")


async def main():
    print("\n" + "=" * 70)
    print("ACTION TIMING IMPROVEMENT TEST")
    print("=" * 70)
    print("\nThis demonstrates two improvements:")
    print("1. Reduced base sleep for click/type actions (200ms → 100ms)")
    print("2. Sleep reduction based on action execution time")

    await compare_with_without_timing()
    await demonstrate_improvement()

    print("\n" + "=" * 70)
    print("CONCLUSION")
    print("=" * 70)
    print("✅ Fast actions with low latency get appropriate short sleeps")
    print("✅ Slow actions with network delays skip unnecessary additional sleep")
    print("✅ Click and type actions are now faster (100ms vs 200ms)")
    print("✅ Overall task execution time is significantly reduced")
    print()


if __name__ == "__main__":
    asyncio.run(main())
