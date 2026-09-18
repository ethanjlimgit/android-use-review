"""
Manager Agent - Planning and reasoning workflow.

Two variants available:
- ManagerAgent: Stateful, maintains chat history
- StatelessManagerAgent: Stateless, rebuilds context each turn
"""

from droiduse_backend.agent.droid.events import ManagerInputEvent, ManagerPlanEvent
from droiduse_backend.agent.manager.events import (
    ManagerContextEvent,
    ManagerPlanDetailsEvent,
    ManagerResponseEvent,
)
from droiduse_backend.agent.manager.manager_agent import ManagerAgent
from droiduse_backend.agent.manager.prompts import parse_manager_response
from droiduse_backend.agent.manager.stateless_manager_agent import StatelessManagerAgent

__all__ = [
    "ManagerAgent",
    "StatelessManagerAgent",
    "ManagerInputEvent",
    "ManagerPlanEvent",
    "ManagerContextEvent",
    "ManagerResponseEvent",
    "ManagerPlanDetailsEvent",
    "parse_manager_response",
]
