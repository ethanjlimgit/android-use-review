"""
Test script to demonstrate sleep profiling by type.

This example shows how the profiler tracks different types of sleep
and provides a breakdown of time spent on each type.
"""

import asyncio

from droiduse_backend.observability import get_profiler, profile_sleep


async def main():
    # Initialize profiler
    profiler = get_profiler()
    profiler.start()

    print("Simulating task execution with different sleep types...\n")

    # Simulate various action types with different sleep durations
    # Open app (typically longer sleep)
    await profile_sleep(0.8, sleep_type="open_app")
    await profile_sleep(0.8, sleep_type="open_app")
    await profile_sleep(0.8, sleep_type="open_app")

    # Taps (shorter sleep)
    await profile_sleep(0.2, sleep_type="tap")
    await profile_sleep(0.2, sleep_type="tap")
    await profile_sleep(0.2, sleep_type="tap")
    await profile_sleep(0.2, sleep_type="tap")
    await profile_sleep(0.2, sleep_type="tap")

    # Swipes (medium sleep)
    await profile_sleep(0.3, sleep_type="swipe")
    await profile_sleep(0.3, sleep_type="swipe")

    # Explicit wait
    await profile_sleep(2.0, sleep_type="wait")

    # Some generic sleep
    await profile_sleep(0.5, sleep_type="generic")

    # Stop profiler
    profiler.stop()

    # Print summary
    print("\nProfiler Summary:")
    print(profiler.format_summary())

    # Get programmatic access to sleep breakdown
    print("\nSleep Breakdown (programmatic access):")
    sleep_breakdown = profiler.get_sleep_breakdown()
    for sleep_type, stats in sleep_breakdown.items():
        print(f"  {sleep_type}:")
        print(f"    Total: {stats['total_ms']:.0f}ms ({stats['percentage']}%)")
        print(f"    Count: {stats['count']}")
        print(f"    Avg: {stats['avg_ms']:.0f}ms")


if __name__ == "__main__":
    asyncio.run(main())
