"""
Profiler for tracking execution time across different operations.

Provides detailed timing breakdown for:
- LLM inference calls (chat, completion, structured predict)
- Tool execution (tap, swipe, get_state, screenshot, etc.)
- Agent steps (manager, executor, codeact)
- Sleep/wait time (with breakdown by action type: tap, open_app, swipe, wait, etc.)
- WebSocket/network latency

The profiler includes enhanced sleep profiling that tracks total duration
by sleep type, allowing you to analyze time spent waiting for different
types of operations (e.g., app launches vs. tap delays vs. explicit waits).
"""

import asyncio
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, TypeVar

logger = logging.getLogger("androiduse.profiler")

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


@dataclass
class TimingEntry:
    """Single timing measurement."""

    category: str
    operation: str
    duration_ms: float
    timestamp: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CategoryStats:
    """Aggregated statistics for a category."""

    total_ms: float = 0.0
    count: int = 0
    min_ms: float = float("inf")
    max_ms: float = 0.0
    operations: Dict[str, float] = field(default_factory=lambda: defaultdict(float))
    operation_counts: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def add(self, duration_ms: float, operation: str) -> None:
        """Add a timing measurement."""
        self.total_ms += duration_ms
        self.count += 1
        self.min_ms = min(self.min_ms, duration_ms)
        self.max_ms = max(self.max_ms, duration_ms)
        self.operations[operation] += duration_ms
        self.operation_counts[operation] += 1

    @property
    def avg_ms(self) -> float:
        """Average duration in milliseconds."""
        return self.total_ms / self.count if self.count > 0 else 0.0


class Profiler:
    """
    Task execution profiler for tracking time spent on different operations.

    Usage:
        profiler = Profiler()
        profiler.start()

        # Using context manager
        async with profiler.track("llm", "chat"):
            await llm.achat(messages)

        # Using decorator
        @profiler.profile("tool", "tap")
        async def tap_element(...):
            ...

        # Get summary
        summary = profiler.get_summary()
        profiler.print_summary()
    """

    # Predefined categories
    CATEGORY_LLM = "llm"
    CATEGORY_TOOL = "tool"
    CATEGORY_AGENT = "agent"
    CATEGORY_SLEEP = "sleep"
    CATEGORY_NETWORK = "network"
    CATEGORY_OTHER = "other"

    # Categories to exclude from summary (tools and agent are excluded as they overlap with other timings)
    # Agent time includes LLM time, so showing both would be double-counting
    EXCLUDED_CATEGORIES = {"tool", "agent"}

    def __init__(self, enabled: bool = True):
        """
        Initialize the profiler.

        Args:
            enabled: Whether profiling is enabled (default: True)
        """
        self.enabled = enabled
        self._entries: List[TimingEntry] = []
        self._stats: Dict[str, CategoryStats] = defaultdict(CategoryStats)
        self._start_time: Optional[float] = None
        self._end_time: Optional[float] = None
        self._active_timers: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    def start(self) -> None:
        """Start the profiler (marks task start time)."""
        self._start_time = time.perf_counter()
        self._entries.clear()
        self._stats.clear()
        logger.debug("Profiler started")

    def stop(self) -> None:
        """Stop the profiler (marks task end time)."""
        self._end_time = time.perf_counter()
        logger.debug("Profiler stopped")

    @property
    def total_time_ms(self) -> float:
        """Total elapsed time in milliseconds."""
        if self._start_time is None:
            return 0.0
        end = self._end_time or time.perf_counter()
        return (end - self._start_time) * 1000

    def record(
        self,
        category: str,
        operation: str,
        duration_ms: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Record a timing measurement.

        Args:
            category: Category (e.g., "llm", "tool", "agent")
            operation: Specific operation (e.g., "chat", "tap", "manager_step")
            duration_ms: Duration in milliseconds
            metadata: Optional additional data
        """
        if not self.enabled:
            return

        entry = TimingEntry(
            category=category,
            operation=operation,
            duration_ms=duration_ms,
            timestamp=time.time(),
            metadata=metadata or {},
        )
        self._entries.append(entry)
        self._stats[category].add(duration_ms, operation)

    @asynccontextmanager
    async def track(
        self,
        category: str,
        operation: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Async context manager for timing a block of code.

        Args:
            category: Category (e.g., "llm", "tool")
            operation: Specific operation name
            metadata: Optional additional data

        Usage:
            async with profiler.track("llm", "chat"):
                await llm.achat(messages)
        """
        if not self.enabled:
            yield
            return

        start = time.perf_counter()
        try:
            yield
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            self.record(category, operation, duration_ms, metadata)

    @contextmanager
    def track_sync(
        self,
        category: str,
        operation: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Sync context manager for timing a block of code.

        Args:
            category: Category (e.g., "llm", "tool")
            operation: Specific operation name
            metadata: Optional additional data
        """
        if not self.enabled:
            yield
            return

        start = time.perf_counter()
        try:
            yield
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            self.record(category, operation, duration_ms, metadata)

    def profile(
        self,
        category: str,
        operation: Optional[str] = None,
    ) -> Callable[[F], F]:
        """
        Decorator for profiling a function.

        Args:
            category: Category for the timing
            operation: Operation name (defaults to function name)

        Usage:
            @profiler.profile("tool", "tap")
            async def tap_element(...):
                ...
        """

        def decorator(func: F) -> F:
            op_name = operation or func.__name__

            if asyncio.iscoroutinefunction(func):

                @wraps(func)
                async def async_wrapper(*args, **kwargs):
                    if not self.enabled:
                        return await func(*args, **kwargs)

                    start = time.perf_counter()
                    try:
                        return await func(*args, **kwargs)
                    finally:
                        duration_ms = (time.perf_counter() - start) * 1000
                        self.record(category, op_name, duration_ms)

                return async_wrapper  # type: ignore
            else:

                @wraps(func)
                def sync_wrapper(*args, **kwargs):
                    if not self.enabled:
                        return func(*args, **kwargs)

                    start = time.perf_counter()
                    try:
                        return func(*args, **kwargs)
                    finally:
                        duration_ms = (time.perf_counter() - start) * 1000
                        self.record(category, op_name, duration_ms)

                return sync_wrapper  # type: ignore

        return decorator

    def get_summary(self) -> Dict[str, Any]:
        """
        Get profiling summary as a dictionary.

        Returns:
            Dictionary with timing breakdown by category and operation
            (excludes tool category as it overlaps with other timings)
        """
        total_ms = self.total_time_ms
        # Exclude tool category from tracked time calculation
        tracked_ms = sum(
            stats.total_ms
            for cat, stats in self._stats.items()
            if cat not in self.EXCLUDED_CATEGORIES
        )
        untracked_ms = max(0, total_ms - tracked_ms)

        summary = {
            "total_time_ms": round(total_ms, 2),
            "tracked_time_ms": round(tracked_ms, 2),
            "untracked_time_ms": round(untracked_ms, 2),
            "categories": {},
        }

        for category, stats in sorted(self._stats.items()):
            # Skip excluded categories
            if category in self.EXCLUDED_CATEGORIES:
                continue
            cat_data = {
                "total_ms": round(stats.total_ms, 2),
                "percentage": (round(stats.total_ms / total_ms * 100, 1) if total_ms > 0 else 0),
                "count": stats.count,
                "avg_ms": round(stats.avg_ms, 2),
                "min_ms": round(stats.min_ms, 2) if stats.min_ms != float("inf") else 0,
                "max_ms": round(stats.max_ms, 2),
                "operations": {},
            }

            for op, op_time in sorted(stats.operations.items(), key=lambda x: -x[1]):
                cat_data["operations"][op] = {
                    "total_ms": round(op_time, 2),
                    "count": stats.operation_counts[op],
                    "avg_ms": round(op_time / stats.operation_counts[op], 2),
                    "percentage": (
                        round(op_time / stats.total_ms * 100, 1) if stats.total_ms > 0 else 0
                    ),
                }

            summary["categories"][category] = cat_data

        return summary

    def format_summary(self) -> str:
        """
        Format profiling summary as a readable string.

        Returns:
            Formatted summary string
        """
        summary = self.get_summary()
        total_ms = summary["total_time_ms"]

        lines = [
            "",
            "=" * 70,
            "PROFILING SUMMARY",
            "=" * 70,
            f"Total Time: {self._format_duration(total_ms)}",
            (
                f"Tracked:    {self._format_duration(summary['tracked_time_ms'])} ({summary['tracked_time_ms'] / total_ms * 100:.1f}%)"
                if total_ms > 0
                else "Tracked: 0ms"
            ),
            (
                f"Untracked:  {self._format_duration(summary['untracked_time_ms'])} ({summary['untracked_time_ms'] / total_ms * 100:.1f}%)"
                if total_ms > 0
                else "Untracked: 0ms"
            ),
            "-" * 70,
        ]

        for category, cat_data in summary["categories"].items():
            lines.append(f"\n{category.upper()} ({cat_data['percentage']:.1f}% of total)")
            lines.append(
                f"  Total: {self._format_duration(cat_data['total_ms'])} | "
                f"Count: {cat_data['count']} | "
                f"Avg: {self._format_duration(cat_data['avg_ms'])}"
            )

            if cat_data["operations"]:
                # Special formatting for sleep category to show type breakdown
                if category == self.CATEGORY_SLEEP:
                    lines.append("  Sleep Types (by duration):")
                    # Sort by total time descending
                    sorted_ops = sorted(
                        cat_data["operations"].items(),
                        key=lambda x: x[1]["total_ms"],
                        reverse=True,
                    )
                    for op, op_data in sorted_ops:
                        lines.append(
                            f"    - {op}: {self._format_duration(op_data['total_ms'])} "
                            f"({op_data['percentage']:.1f}% of sleep) | "
                            f"x{op_data['count']} | "
                            f"avg {self._format_duration(op_data['avg_ms'])}"
                        )
                else:
                    lines.append("  Operations:")
                    for op, op_data in cat_data["operations"].items():
                        lines.append(
                            f"    - {op}: {self._format_duration(op_data['total_ms'])} "
                            f"({op_data['percentage']:.1f}%) | "
                            f"x{op_data['count']} | "
                            f"avg {self._format_duration(op_data['avg_ms'])}"
                        )

        lines.extend(["", "=" * 70])
        return "\n".join(lines)

    def print_summary(self) -> None:
        """Print the profiling summary to logger."""
        logger.info(self.format_summary())

    @staticmethod
    def _format_duration(ms: float) -> str:
        """Format duration in human-readable format."""
        if ms < 1000:
            return f"{ms:.0f}ms"
        elif ms < 60000:
            return f"{ms / 1000:.2f}s"
        else:
            minutes = int(ms // 60000)
            seconds = (ms % 60000) / 1000
            return f"{minutes}m {seconds:.1f}s"

    def get_entries(self) -> List[TimingEntry]:
        """Get all timing entries."""
        return self._entries.copy()

    def get_sleep_breakdown(self) -> Dict[str, Dict[str, float]]:
        """
        Get detailed breakdown of sleep time by type.

        Returns:
            Dictionary mapping sleep types to their statistics:
            {
                "open_app": {"total_ms": 1500, "count": 3, "avg_ms": 500},
                "tap": {"total_ms": 800, "count": 4, "avg_ms": 200},
                ...
            }
        """
        if self.CATEGORY_SLEEP not in self._stats:
            return {}

        sleep_stats = self._stats[self.CATEGORY_SLEEP]
        breakdown = {}

        for sleep_type, total_ms in sleep_stats.operations.items():
            count = sleep_stats.operation_counts[sleep_type]
            breakdown[sleep_type] = {
                "total_ms": round(total_ms, 2),
                "count": count,
                "avg_ms": round(total_ms / count, 2) if count > 0 else 0,
                "percentage": (
                    round(total_ms / sleep_stats.total_ms * 100, 1)
                    if sleep_stats.total_ms > 0
                    else 0
                ),
            }

        # Sort by total_ms descending
        return dict(sorted(breakdown.items(), key=lambda x: x[1]["total_ms"], reverse=True))

    def clear(self) -> None:
        """Clear all profiling data."""
        self._entries.clear()
        self._stats.clear()
        self._start_time = None
        self._end_time = None


# Global profiler instance
_profiler: Optional[Profiler] = None


def get_profiler() -> Profiler:
    """Get the global profiler instance."""
    global _profiler
    if _profiler is None:
        _profiler = Profiler()
    return _profiler


def reset_profiler() -> None:
    """Reset the global profiler."""
    global _profiler
    _profiler = None


# Convenience functions for common profiling patterns
async def profile_llm_call(
    operation: str,
    coro,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Profile an LLM call.

    Args:
        operation: LLM operation (e.g., "chat", "completion", "structured_predict")
        coro: Coroutine to execute
        metadata: Optional metadata (e.g., model name, token count)
    """
    profiler = get_profiler()
    async with profiler.track(Profiler.CATEGORY_LLM, operation, metadata):
        return await coro


async def profile_tool_call(
    operation: str,
    coro,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Profile a tool call.

    Args:
        operation: Tool operation (e.g., "tap", "swipe", "get_state")
        coro: Coroutine to execute
        metadata: Optional metadata
    """
    profiler = get_profiler()
    async with profiler.track(Profiler.CATEGORY_TOOL, operation, metadata):
        return await coro


async def profile_sleep(
    duration: float, sleep_type: str = "generic", cancellation_event: asyncio.Event | None = None
) -> None:
    """
    Profile an asyncio.sleep call with type classification and cancellation support.

    This function wraps sleep operations with profiling and cancellation support.
    For cancellable sleeps, it uses the centralized cancellation utility.

    Args:
        duration: Sleep duration in seconds
        sleep_type: Type of sleep (e.g., "open_app", "tap", "wait", "generic")
        cancellation_event: Optional event to check for cancellation during sleep
    """
    from droiduse_backend.agent.utils.cancellation import cancellable_sleep

    profiler = get_profiler()
    async with profiler.track(Profiler.CATEGORY_SLEEP, sleep_type, {"duration_sec": duration}):
        # Use centralized cancellable sleep utility
        await cancellable_sleep(duration, cancellation_event=cancellation_event)
