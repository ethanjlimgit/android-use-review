"""
TaskSuggester - Suggests relevant tasks based on current screen state.

This module provides a lightweight agent that analyzes the current screen
(accessibility tree + optional screenshot) and suggests actionable tasks
the user might want to perform.
"""

from droiduse_backend.agent.suggester.suggester_agent import (
    TaskSuggesterAgent,
    TaskSuggestion,
    TaskSuggestions,
    suggest_tasks,
)

__all__ = ["TaskSuggesterAgent", "TaskSuggestion", "TaskSuggestions", "suggest_tasks"]
