"""
Events for the CodeActAgent workflow.

Internal events for streaming to frontend/logging.
"""

from typing import Optional

from droiduse_backend.agent.usage import UsageResult
from droiduse_backend.workflow import Event


class CodeActInputEvent(Event):
    """Input ready for LLM."""

    pass


class CodeActResponseEvent(Event):
    """LLM response received."""

    thought: str
    code: Optional[str] = None
    usage: Optional[UsageResult] = None


class CodeActCodeEvent(Event):
    """Code ready to execute (internal event)."""

    code: str


class CodeActOutputEvent(Event):
    """Code execution result (internal event)."""

    output: str


class CodeActEndEvent(Event):
    """CodeAct finished."""

    success: bool
    reason: str
    code_executions: int = 0
