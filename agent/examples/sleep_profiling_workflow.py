"""
Real-world example of sleep profiling during a task workflow.

This example simulates a typical automation task and shows how
sleep profiling helps identify optimization opportunities.
"""

import asyncio

from droiduse_backend.agent.utils.timing import adaptive_sleep
from droiduse_backend.observability import get_profiler, profile_sleep


async def simulate_task():
    """Simulate a typical task: Open app -> Navigate -> Fill form -> Submit"""

    profiler = get_profiler()
    profiler.start()

    print("📱 Starting automation task: Fill login form\n")

    # Step 1: Open the app
    print("1. Opening app...")
    await adaptive_sleep("open_app", base_delay=0.3)

    # Step 2: Tap on username field
    print("2. Tapping username field...")
    await adaptive_sleep("tap", base_delay=0.3)

    # Step 3: Type username
    print("3. Typing username...")
    await adaptive_sleep("input_text", base_delay=0.3)

    # Step 4: Tap on password field
    print("4. Tapping password field...")
    await adaptive_sleep("tap", base_delay=0.3)

    # Step 5: Type password
    print("5. Typing password...")
    await adaptive_sleep("input_text", base_delay=0.3)

    # Step 6: Swipe to reveal submit button
    print("6. Scrolling down...")
    await adaptive_sleep("swipe", base_delay=0.3)

    # Step 7: Tap submit button
    print("7. Tapping submit...")
    await adaptive_sleep("tap", base_delay=0.3)

    # Step 8: Wait for login to complete
    print("8. Waiting for login...")
    await profile_sleep(3.0, sleep_type="wait")

    # Step 9: Go back to home
    print("9. Going home...")
    await adaptive_sleep("go_home", base_delay=0.3)

    profiler.stop()

    # Print results
    print("\n" + "=" * 70)
    print("TASK COMPLETED")
    print("=" * 70)
    print(profiler.format_summary())

    # Analyze sleep breakdown
    print("\n" + "=" * 70)
    print("SLEEP ANALYSIS")
    print("=" * 70)

    sleep_breakdown = profiler.get_sleep_breakdown()
    total_sleep_ms = sum(s["total_ms"] for s in sleep_breakdown.values())

    print(f"\nTotal sleep time: {total_sleep_ms:.0f}ms")
    print(f"Total task time: {profiler.total_time_ms:.0f}ms")
    print(f"Sleep percentage: {(total_sleep_ms/profiler.total_time_ms*100):.1f}%\n")

    print("Top 3 sleep types by duration:")
    for i, (sleep_type, stats) in enumerate(list(sleep_breakdown.items())[:3], 1):
        print(
            f"  {i}. {sleep_type}: {stats['total_ms']:.0f}ms "
            f"({stats['percentage']:.1f}% of sleep time)"
        )

    # Optimization suggestions
    print("\n" + "=" * 70)
    print("OPTIMIZATION SUGGESTIONS")
    print("=" * 70)

    if "wait" in sleep_breakdown:
        wait_pct = sleep_breakdown["wait"]["percentage"]
        if wait_pct > 40:
            print(f"⚠️  Explicit waits account for {wait_pct:.1f}% of sleep time.")
            print("   Consider reducing wait durations or using state-based waits.")

    if "open_app" in sleep_breakdown:
        app_pct = sleep_breakdown["open_app"]["percentage"]
        if app_pct > 30:
            print(f"⚠️  App launch accounts for {app_pct:.1f}% of sleep time.")
            print("   Consider optimizing app startup or using deep links.")

    # Calculate efficiency
    action_sleeps = sum(
        s["total_ms"]
        for t, s in sleep_breakdown.items()
        if t in ["tap", "swipe", "input_text", "click"]
    )
    if action_sleeps < total_sleep_ms * 0.5:
        print(
            f"✅ Good efficiency: Action-related sleeps are only "
            f"{(action_sleeps/total_sleep_ms*100):.1f}% of total sleep."
        )

    print("\n")


async def compare_configurations():
    """Compare different sleep configurations to show tuning effects"""

    print("\n" + "=" * 70)
    print("CONFIGURATION COMPARISON")
    print("=" * 70)

    configs = [
        ("Fast (0.15)", 0.15),
        ("Default (0.3)", 0.3),
        ("Slow (0.6)", 0.6),
    ]

    for config_name, base_delay in configs:
        profiler = get_profiler()
        profiler.clear()
        profiler.start()

        # Simulate quick task
        await adaptive_sleep("open_app", base_delay=base_delay)
        await adaptive_sleep("tap", base_delay=base_delay)
        await adaptive_sleep("tap", base_delay=base_delay)

        profiler.stop()

        print(f"\n{config_name} config:")
        print(f"  Total time: {profiler.total_time_ms:.0f}ms")

        sleep_breakdown = profiler.get_sleep_breakdown()
        for sleep_type, stats in sleep_breakdown.items():
            print(f"  - {sleep_type}: {stats['total_ms']:.0f}ms (avg {stats['avg_ms']:.0f}ms)")


if __name__ == "__main__":
    asyncio.run(simulate_task())
    asyncio.run(compare_configurations())
