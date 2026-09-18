"""
TaskSuggesterAgent - Analyzes screen state and suggests actionable tasks.

This is a lightweight one-shot agent that:
1. Takes the full phone state (accessibility tree + phone state + device context)
2. Analyzes what the user is currently viewing
3. Returns a list of suggested tasks the user might want to perform
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient
from droiduse_backend.workflow import Context, StartEvent, StopEvent, Workflow, step

logger = logging.getLogger("droiduse-backend.suggester")


class TaskSuggestion(BaseModel):
    """A single task suggestion."""

    title: str = Field(description="Short, action-oriented title (3-6 words)")
    description: str = Field(description="Brief description of what this task will do")
    command: str = Field(description="The natural language command to execute this task")


class TaskSuggestions(BaseModel):
    """Collection of task suggestions."""

    suggestions: List[TaskSuggestion] = Field(
        default_factory=list,
        description="List of suggested tasks (3-5 suggestions)",
    )
    context_summary: str = Field(
        default="",
        description="Brief summary of what the user is currently viewing",
    )


SUGGESTER_SYSTEM_PROMPT = """You are an intelligent assistant that analyzes Android device state and suggests helpful, COMPLEX tasks the user might want to perform.

You will receive the full device state including:
1. **Accessibility Tree**: JSON describing the current screen's UI elements (buttons, text, etc.)
2. **Phone State**: Current app, battery level, WiFi/cellular status, time, notifications, etc.
3. **Device Context**: Device model, screen size, Android version, installed apps, etc.
4. Optionally, a **screenshot** of the current screen

Based on this information, suggest 3-5 relevant, MULTI-STEP tasks that would take 5-10 actions to complete.

Guidelines:
- **Suggest COMPLEX workflows** that involve multiple steps, not simple one-click actions
- Analyze the current app context and suggest meaningful workflows within that app
- Consider cross-app workflows (e.g., copy from one app, paste in another)
- Think about realistic user goals that require several actions to accomplish
- Suggest tasks that provide real value and save the user significant time
- Commands should describe the END GOAL, not individual steps
- Keep titles concise (3-6 words) but make commands detailed enough to be unambiguous
- Use natural language that describes what the user wants to ACHIEVE

IMPORTANT: Avoid simple tasks like "Open app X" or "Click button Y". Instead, suggest complete workflows.

IMPORTANT: Return your response as valid JSON with the following structure:
{
  "context_summary": "Brief description of current screen and state",
  "suggestions": [
    {
      "title": "Short action title",
      "description": "What this multi-step task will accomplish",
      "command": "Detailed natural language command describing the goal"
    }
  ]
}

Example COMPLEX suggestions for a home screen:
- "Schedule meeting for tomorrow" → "Open Calendar, create a new event for tomorrow at 2pm titled 'Team Sync', set it for 30 minutes, and add a reminder"
- "Check weather and dress recommendation" → "Open the weather app, check today's forecast, and tell me what to wear based on the temperature"
- "Morning news briefing" → "Open Google News, read the top 3 headlines, and summarize them for me"

Example COMPLEX suggestions for Gmail inbox:
- "Process unread emails" → "Go through my unread emails, archive newsletters, and flag any that need a response"
- "Send meeting follow-up" → "Find the last email from my manager, reply with a thank you for the meeting, and ask about next steps"
- "Clean up promotions" → "Go to the Promotions tab, select all emails older than a week, and delete them"

Example COMPLEX suggestions for a messaging app:
- "Reply to unread messages" → "Check all my unread conversations and send a quick reply to each one"
- "Share my location with friend" → "Open the chat with Mom, send her my current location, and let her know I'll be home in 30 minutes"
- "Forward photo to group" → "Find the photo I received yesterday, forward it to the Family group chat with a caption"

Example COMPLEX suggestions for browser:
- "Research and bookmark" → "Search for the best restaurants near me, open the top 3 results, and bookmark any that look interesting"
- "Compare prices" → "Search for iPhone 15 cases, compare prices from the first 3 results, and tell me the cheapest option"

Example COMPLEX suggestions for settings/system:
- "Optimize battery life" → "Go to Settings, check which apps are using the most battery, force stop any that are draining excessively, and enable battery saver mode"
- "Free up storage" → "Open Settings, go to Storage, find the largest apps I haven't used recently, and clear their cache"
- "Setup Do Not Disturb" → "Enable Do Not Disturb mode, schedule it from 10pm to 7am, but allow calls from favorites"
"""


def _truncate_content(content_str: str, max_chars: int = 30000) -> str:
    """Truncate content if too large."""
    if len(content_str) <= max_chars:
        return content_str
    return content_str[:max_chars] + "\n... (truncated)"


def _parse_suggestions_response(response_text: str) -> TaskSuggestions:
    """Parse LLM response into TaskSuggestions model."""
    # Try to extract JSON from the response
    # First, try to parse the whole response as JSON
    try:
        data = json.loads(response_text)
        return TaskSuggestions(**data)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in the response
    json_match = re.search(r"\{[\s\S]*\}", response_text)
    if json_match:
        try:
            data = json.loads(json_match.group())
            return TaskSuggestions(**data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Fallback: return empty suggestions
    logger.warning("Failed to parse suggestions response, returning empty")
    return TaskSuggestions(
        suggestions=[],
        context_summary="Unable to parse screen context",
    )


class TaskSuggesterAgent(Workflow):
    """
    Agent that suggests tasks based on current device state.

    Takes full phone state and optional screenshot, returns task suggestions.
    """

    def __init__(
        self,
        llm: LiteLLMClient,
        state_full: Dict[str, Any],
        screenshot_base64: Optional[str] = None,
        max_suggestions: int = 5,
        **kwargs,
    ):
        """
        Initialize the task suggester agent.

        Args:
            llm: LLM client for generating suggestions
            state_full: Full device state containing:
                - a11y_tree: Accessibility tree JSON
                - phone_state: Phone state (app, battery, wifi, etc.)
                - device_context: Device info (model, screen, apps, etc.)
            screenshot_base64: Optional base64-encoded screenshot
            max_suggestions: Maximum number of suggestions to return
        """
        super().__init__(**kwargs)
        self.llm = llm
        self.state_full = state_full
        self.screenshot_base64 = screenshot_base64
        self.max_suggestions = max_suggestions

    @step
    async def generate_suggestions(self, ctx: Context, ev: StartEvent) -> StopEvent:
        """Generate task suggestions based on device state."""
        logger.debug("Generating task suggestions from full device state")

        try:
            # Extract components from state
            a11y_tree = self.state_full.get("a11y_tree", {})
            phone_state = self.state_full.get("phone_state", {})
            device_context = self.state_full.get("device_context", {})

            # Build state description
            state_parts = []

            # Add accessibility tree (most important for UI context)
            if a11y_tree:
                tree_str = json.dumps(a11y_tree, indent=2)
                tree_str = _truncate_content(tree_str, max_chars=25000)
                state_parts.append(
                    f"## Accessibility Tree (Current Screen UI)\n```json\n{tree_str}\n```"
                )

            # Add phone state (battery, wifi, notifications, etc.)
            if phone_state:
                phone_str = json.dumps(phone_state, indent=2)
                phone_str = _truncate_content(phone_str, max_chars=3000)
                state_parts.append(f"## Phone State\n```json\n{phone_str}\n```")

            # Add device context (model, apps, etc.) - summarized
            if device_context:
                # Only include key info to save tokens
                context_summary = {
                    "device_model": device_context.get("device_model"),
                    "android_version": device_context.get("android_version"),
                    "screen_width": device_context.get("screen_width"),
                    "screen_height": device_context.get("screen_height"),
                }
                # Remove None values
                context_summary = {k: v for k, v in context_summary.items() if v is not None}
                if context_summary:
                    context_str = json.dumps(context_summary, indent=2)
                    state_parts.append(f"## Device Context\n```json\n{context_str}\n```")

            full_state_str = "\n\n".join(state_parts)

            # Build user content in LiteLLMClient format
            user_content = []

            # Add text content
            user_text = f"Analyze this device state and suggest {self.max_suggestions} relevant tasks:\n\n{full_state_str}"
            user_content.append({"text": user_text})

            # Add screenshot if available and LLM supports vision
            if self.screenshot_base64:
                # Ensure proper base64 data URL format
                if self.screenshot_base64.startswith("data:image"):
                    image_url = self.screenshot_base64
                else:
                    image_url = f"data:image/png;base64,{self.screenshot_base64}"
                user_content.append({"image": image_url})

            messages = [
                {"role": "system", "content": SUGGESTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]

            # Call LLM using achat method
            response = await self.llm.achat(messages)
            response_text = response.content if hasattr(response, "content") else str(response)

            logger.debug(f"Suggester raw response: {response_text[:500]}...")

            # Parse response
            suggestions = _parse_suggestions_response(response_text)

            # Limit suggestions
            if len(suggestions.suggestions) > self.max_suggestions:
                suggestions.suggestions = suggestions.suggestions[: self.max_suggestions]

            logger.info(
                f"Generated {len(suggestions.suggestions)} task suggestions for "
                f"context: {suggestions.context_summary[:50]}..."
            )

            return StopEvent(
                result={
                    "success": True,
                    "suggestions": suggestions.model_dump(),
                    "error_message": "",
                }
            )

        except Exception as e:
            logger.exception(f"Failed to generate suggestions: {e}")
            return StopEvent(
                result={
                    "success": False,
                    "suggestions": TaskSuggestions().model_dump(),
                    "error_message": str(e),
                }
            )


async def suggest_tasks(
    llm: LiteLLMClient,
    state_full: Dict[str, Any],
    screenshot_base64: Optional[str] = None,
    max_suggestions: int = 5,
) -> TaskSuggestions:
    """
    Convenience function to generate task suggestions.

    Args:
        llm: LLM client for generating suggestions
        state_full: Full device state containing a11y_tree, phone_state, device_context
        screenshot_base64: Optional base64-encoded screenshot
        max_suggestions: Maximum number of suggestions to return

    Returns:
        TaskSuggestions with suggested tasks
    """
    agent = TaskSuggesterAgent(
        llm=llm,
        state_full=state_full,
        screenshot_base64=screenshot_base64,
        max_suggestions=max_suggestions,
    )

    handler = agent.run()
    result = await handler

    if result.get("success"):
        return TaskSuggestions(**result["suggestions"])
    else:
        logger.error(f"Suggestion generation failed: {result.get('error_message')}")
        return TaskSuggestions()
