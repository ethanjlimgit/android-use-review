"""
Events for the ScripterAgent workflow.

Internal events for streaming to frontend/logging.
"""

from typing import Optional

from droiduse_backend.agent.usage import UsageResult
from droiduse_backend.workflow import Event


class ScripterInputEvent(Event):
    """Input ready for LLM."""

    pass


class ScripterThinkingEvent(Event):
    """LLM response received."""

    thought: str
    code: Optional[str] = None
    full_response: str = ""
    usage: Optional[UsageResult] = None


class ScripterExecutionEvent(Event):
    """Code ready to execute."""

    code: str


class ScripterExecutionResultEvent(Event):
    """Code execution result."""

    output: str


class ScripterEndEvent(Event):
    """Scripter finished."""

    message: str  # Message to Manager
    success: bool  # True if response() called, False if max_steps
    code_executions: int = 0
