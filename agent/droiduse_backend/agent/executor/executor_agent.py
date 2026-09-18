"""
ExecutorAgent - Action execution workflow.

This agent is responsible for:
- Taking a specific subgoal from the Manager
- Analyzing the current UI state
- Selecting and executing appropriate actions
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Optional

from droiduse_backend.agent.executor.events import (
    ExecutorActionEvent,
    ExecutorActionResultEvent,
    ExecutorContextEvent,
    ExecutorResponseEvent,
)
from droiduse_backend.agent.executor.prompts import parse_executor_response
from droiduse_backend.agent.usage import get_usage_from_response
from droiduse_backend.agent.utils.inference import acall_with_retries
from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient
from droiduse_backend.agent.utils.prompt_resolver import PromptResolver
from droiduse_backend.agent.utils.timing import adaptive_sleep
from droiduse_backend.agent.utils.tools import (
    ATOMIC_ACTION_SIGNATURES,
    click,
    long_press,
    long_press_element,
    open_app,
    swipe,
    system_button,
    tap_element,
    type,
    type_element,
    wait,
)
from droiduse_backend.config_manager.config_manager import AgentConfig
from droiduse_backend.config_manager.prompt_loader import PromptLoader
from droiduse_backend.plugins import emit_task_step
from droiduse_backend.workflow import Context, StartEvent, StopEvent, Workflow, step

if TYPE_CHECKING:
    from droiduse_backend.agent.droid import DroidAgentState

logger = logging.getLogger("androiduse")


class ExecutorAgent(Workflow):
    """
    Action execution agent that performs specific actions.

    Single-turn agent: receives subgoal, selects action, executes it.
    Uses dict messages, converts to ChatMessage at LLM call time.
    """

    def __init__(
        self,
        llm: LiteLLMClient,
        tools_instance,
        shared_state: "DroidAgentState",
        agent_config: AgentConfig,
        custom_tools: dict = None,
        atomic_tools: dict = None,
        prompt_resolver: Optional[PromptResolver] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.llm = llm
        self.agent_config = agent_config
        self.config = agent_config.executor
        self.vision = agent_config.executor.vision
        self.tools_instance = tools_instance
        self.shared_state = shared_state
        self.prompt_resolver = prompt_resolver or PromptResolver()

        self.custom_tools = custom_tools if custom_tools is not None else {}
        self.atomic_tools = atomic_tools if atomic_tools is not None else ATOMIC_ACTION_SIGNATURES

        logger.debug("ExecutorAgent initialized.")

    @step
    async def prepare_context(self, ctx: Context, ev: StartEvent) -> ExecutorContextEvent:
        """Prepare executor context and prompt."""
        self.tools_instance._set_context(ctx)

        subgoal = ev.get("subgoal", "")
        logger.debug(f"🧠 Executor thinking about action for: {subgoal}")

        # Build action history (last 5)
        action_history = []
        if self.shared_state.action_history:
            n = min(5, len(self.shared_state.action_history))
            action_history = [
                {"action": act, "summary": summ, "outcome": outcome, "error": err}
                for act, summ, outcome, err in zip(
                    self.shared_state.action_history[-n:],
                    self.shared_state.summary_history[-n:],
                    self.shared_state.action_outcomes[-n:],
                    self.shared_state.error_descriptions[-n:],
                    strict=True,
                )
            ]

        # Get available secrets
        available_secrets = []
        if (
            hasattr(self.tools_instance, "credential_manager")
            and self.tools_instance.credential_manager
        ):
            available_secrets = await self.tools_instance.credential_manager.get_keys()

        # Build prompt variables
        variables = {
            "instruction": self.shared_state.instruction,
            "app_card": "",
            "device_state": self.shared_state.formatted_device_state,
            "plan": self.shared_state.plan,
            "subgoal": subgoal,
            "progress_status": self.shared_state.progress_summary,
            "atomic_actions": {**self.atomic_tools, **self.custom_tools},
            "action_history": action_history,
            "available_secrets": available_secrets,
            "variables": self.shared_state.custom_variables,
        }

        custom_prompt = self.prompt_resolver.get_prompt("executor_system")
        if custom_prompt:
            prompt_text = PromptLoader.render_template(custom_prompt, variables)
        else:
            prompt_text = await PromptLoader.load_prompt(
                self.agent_config.get_executor_system_prompt_path(),
                variables,
            )

        # Build message as dict
        messages = [{"role": "user", "content": [{"text": prompt_text}]}]

        # Add screenshot if vision enabled
        if self.vision:
            screenshot = self.shared_state.screenshot
            if screenshot is not None:
                messages[0]["content"].append({"image": screenshot})
                logger.debug("📸 Using screenshot for Executor")
            else:
                logger.warning("⚠️ Vision enabled but no screenshot available")
        # Store messages in context for next step
        await ctx.store.set("executor_messages", messages)
        return ExecutorContextEvent(subgoal=subgoal)

    @step
    async def get_response(self, ctx: Context, ev: ExecutorContextEvent) -> ExecutorResponseEvent:
        """Get LLM response."""
        logger.debug("Executor getting LLM response...")

        # Get messages from context
        messages = await ctx.store.get("executor_messages")

        try:
            logger.debug("[green]Executor response:[/green]")
            response = await acall_with_retries(
                self.llm,
                messages,
                stream=self.agent_config.streaming,
                agent_type="executor",
            )
            response_text = response.content
        except Exception as e:
            raise RuntimeError(f"Error calling LLM in executor: {e}") from e

        # Extract usage
        usage = None
        try:
            usage = get_usage_from_response(self.llm.class_name(), response)
        except Exception as e:
            logger.warning(f"Could not get usage: {e}")

        return ExecutorResponseEvent(response=response_text, usage=usage)

    @step
    async def process_response(
        self, ctx: Context, ev: ExecutorResponseEvent
    ) -> ExecutorActionEvent:
        """Parse LLM response and extract action."""
        logger.debug("⚙️ Processing executor response...")

        response_text = ev.response

        try:
            parsed = parse_executor_response(response_text)
        except Exception as e:
            logger.error(f"❌ Failed to parse executor response: {e}")
            return ExecutorActionEvent(
                action_json=json.dumps({"action": "invalid"}),
                thought=f"Failed to parse response: {str(e)}",
                description="Invalid response format from LLM",
                full_response=response_text,
            )

        # Update unified state
        self.shared_state.last_thought = parsed["thought"]

        event = ExecutorActionEvent(
            action_json=parsed["action"],
            thought=parsed["thought"],
            description=parsed["description"],
            full_response=response_text,
        )

        ctx.write_event_to_stream(event)
        return event

    @step
    async def execute(self, ctx: Context, ev: ExecutorActionEvent) -> ExecutorActionResultEvent:
        """Execute the action."""
        logger.info(f"⚡ Executing action: {ev.description}")
        logger.info(f"⚡ Executing action: {ev.action_json}")

        try:
            action_dict = json.loads(ev.action_json)
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse action JSON: {e}")
            return ExecutorActionResultEvent(
                action={"action": "invalid"},
                success=False,
                error=f"Invalid action JSON: {str(e)}",
                summary="Failed to parse action",
                thought=ev.thought,
                full_response=ev.full_response,
            )

        # Time the action execution
        import time

        # Clear device command log before executing so we only capture this step's commands
        if self.tools_instance:
            self.tools_instance.clear_device_commands()

        action_start = time.perf_counter()
        success, error, summary = await self._execute_action(action_dict, ev.description)
        action_duration = time.perf_counter() - action_start

        # Get device state after action
        formatted_text = None
        phone_state = None
        a11y_tree = None
        if self.tools_instance:
            try:
                (
                    formatted_text,
                    focused_text,
                    a11y_tree,
                    phone_state,
                ) = await self.tools_instance.get_state()
            except Exception as e:
                logger.warning(f"⚠️ Failed to get device state after action: {e}")

        # Record step with device state to database (fire-and-forget via plugin)
        # Send full content without truncation to web API
        step_status = "SUCCESS" if success else "FAILED"
        # Use actual device commands sent to phone (for replay), not intermediate action format
        device_cmds = self.tools_instance.get_device_commands() if self.tools_instance else []
        actions = device_cmds if device_cmds else None
        emit_task_step(
            step_number=self.shared_state.step_number,
            agent_type="executor",
            actions=actions,
            thought=ev.thought,
            description=ev.description,
            subgoal=self.shared_state.current_subgoal,
            status=step_status,
            error=error,
            summary=summary,
            full_response=ev.full_response,
            formatted_text=formatted_text,  # Full text without truncation
            phone_state=phone_state,
            a11y_tree=a11y_tree,  # Full tree without truncation
            jwt_token=self.shared_state.jwt_token,
            device_id=self.shared_state.device_id,
            connection_id=self.shared_state.connection_id,
        )

        # Use adaptive sleep based on action type
        # Pass the action duration so we can reduce sleep time accordingly
        action_type = action_dict.get("action", "default")
        await adaptive_sleep(
            action_type=action_type,
            base_delay=self.agent_config.after_sleep_action,
            previous_action_failed=not success,
            action_duration_sec=action_duration,
            cancellation_event=self.shared_state.cancellation_event if self.shared_state else None,
        )

        logger.debug(f"{'✅' if success else '❌'} Execution complete: {summary}")

        return ExecutorActionResultEvent(
            action=action_dict,
            success=success,
            error=error,
            summary=summary,
            thought=ev.thought,
            full_response=ev.full_response,
        )

    async def _execute_action(self, action_dict: dict, description: str) -> tuple[bool, str, str]:
        """Execute action and return (success, error, summary)."""
        action_type = action_dict.get("action", "unknown")

        # Check custom tools first
        if action_type in self.custom_tools:
            return await self._execute_custom_tool(action_type, action_dict)

        try:
            if action_type == "click":
                index = action_dict.get("index")
                if index is None:
                    return (
                        False,
                        "Missing 'index' parameter",
                        "Failed: click requires index",
                    )
                await click(index, tools=self.tools_instance)
                return True, "", f"Clicked element at index {index}"

            elif action_type == "long_press":
                index = action_dict.get("index")
                if index is None:
                    return (
                        False,
                        "Missing 'index' parameter",
                        "Failed: long_press requires index",
                    )
                success = await long_press(index, tools=self.tools_instance)
                if success:
                    return True, "", f"Long pressed element at index {index}"
                return (
                    False,
                    "Long press failed",
                    f"Failed to long press at index {index}",
                )

            elif action_type == "type":
                text = action_dict.get("text")
                index = action_dict.get("index", -1)
                if text is None:
                    return (
                        False,
                        "Missing 'text' parameter",
                        "Failed: type requires text",
                    )
                await type(text, index, tools=self.tools_instance)
                return True, "", f"Typed '{text}' into element at index {index}"

            elif action_type == "system_button":
                button = action_dict.get("button")
                if button is None:
                    return (
                        False,
                        "Missing 'button' parameter",
                        "Failed: system_button requires button",
                    )
                result = await system_button(button, tools=self.tools_instance)
                if "Error" in result:
                    return False, result, f"Failed to press {button} button"
                return True, "", f"Pressed {button} button"

            elif action_type == "swipe":
                coordinate = action_dict.get("coordinate")
                coordinate2 = action_dict.get("coordinate2")
                duration = action_dict.get("duration", 1.0)

                if coordinate is None or coordinate2 is None:
                    return (
                        False,
                        "Missing coordinate parameters",
                        "Failed: swipe requires coordinates",
                    )

                if not isinstance(coordinate, list) or len(coordinate) != 2:
                    return (
                        False,
                        f"Invalid coordinate: {coordinate}",
                        "Failed: coordinate must be [x, y]",
                    )
                if not isinstance(coordinate2, list) or len(coordinate2) != 2:
                    return (
                        False,
                        f"Invalid coordinate2: {coordinate2}",
                        "Failed: coordinate2 must be [x, y]",
                    )

                success = await swipe(coordinate, coordinate2, duration, tools=self.tools_instance)
                if success:
                    return True, "", f"Swiped from {coordinate} to {coordinate2}"
                return (
                    False,
                    "Swipe failed",
                    f"Failed to swipe from {coordinate} to {coordinate2}",
                )

            elif action_type == "wait":
                duration = action_dict.get("duration")
                if duration is None:
                    return (
                        False,
                        "Missing 'duration' parameter",
                        "Failed: wait requires duration",
                    )
                await wait(duration)
                return True, "", f"Waited for {duration} seconds"

            elif action_type == "open_app":
                text = action_dict.get("text")
                if text is None:
                    return (
                        False,
                        "Missing 'text' parameter",
                        "Failed: open_app requires text",
                    )
                await open_app(text, tools=self.tools_instance)
                return True, "", f"Opened app: {text}"

            elif action_type == "tap_element":
                by = action_dict.get("by")
                pattern = action_dict.get("pattern")
                if not by or not pattern:
                    return (
                        False,
                        "Missing 'by' or 'pattern' parameter",
                        "Failed: tap_element requires by and pattern",
                    )
                result = await tap_element(by, pattern, tools=self.tools_instance)
                if "Failed" in result or "error" in result.lower():
                    return False, result, f"Failed to tap element by {by}='{pattern}'"
                return True, "", f"Tapped element matching {by}='{pattern}'"

            elif action_type == "type_element":
                text = action_dict.get("text")
                by = action_dict.get("by")
                pattern = action_dict.get("pattern")
                clear = action_dict.get("clear", False)
                if not text or not by or not pattern:
                    return (
                        False,
                        "Missing required parameters (text, by, pattern)",
                        "Failed: type_element requires text, by, and pattern",
                    )
                result = await type_element(
                    text, by, pattern, clear=clear, tools=self.tools_instance
                )
                if "Failed" in result or "error" in result.lower():
                    return False, result, f"Failed to type into element by {by}='{pattern}'"
                return True, "", f"Typed '{text}' into element matching {by}='{pattern}'"

            elif action_type == "long_press_element":
                by = action_dict.get("by")
                pattern = action_dict.get("pattern")
                if not by or not pattern:
                    return (
                        False,
                        "Missing 'by' or 'pattern' parameter",
                        "Failed: long_press_element requires by and pattern",
                    )
                result = await long_press_element(by, pattern, tools=self.tools_instance)
                if "Failed" in result or "error" in result.lower():
                    return False, result, f"Failed to long press element by {by}='{pattern}'"
                return True, "", f"Long pressed element matching {by}='{pattern}'"

            else:
                return (
                    False,
                    f"Unknown action type: {action_type}",
                    f"Failed: unknown action '{action_type}'",
                )

        except Exception as e:
            # Re-raise cancellation errors to stop the workflow
            from droiduse_backend.agent.utils.cancellation import is_cancellation_error

            if is_cancellation_error(e):
                raise
            logger.error(f"Exception during action execution: {e}", exc_info=True)
            return (
                False,
                f"Exception: {str(e)}",
                f"Failed to execute {action_type}: {str(e)}",
            )

    async def _execute_custom_tool(
        self, action_type: str, action_dict: dict
    ) -> tuple[bool, str, str]:
        """Execute custom tool."""
        try:
            tool_spec = self.custom_tools[action_type]
            tool_func = tool_spec["function"]

            tool_args = {k: v for k, v in action_dict.items() if k != "action"}

            if asyncio.iscoroutinefunction(tool_func):
                result = await tool_func(
                    **tool_args,
                    tools=self.tools_instance,
                    shared_state=self.shared_state,
                )
            else:
                result = tool_func(
                    **tool_args,
                    tools=self.tools_instance,
                    shared_state=self.shared_state,
                )

            summary = f"Executed custom tool '{action_type}'"
            if result is not None:
                summary += f": {str(result)}"

            return True, "", summary

        except TypeError as e:
            error_msg = f"Invalid arguments for custom tool '{action_type}': {str(e)}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg, f"Failed: {action_type}"

        except Exception as e:
            # Re-raise cancellation errors to stop the workflow
            from droiduse_backend.agent.utils.cancellation import is_cancellation_error

            if is_cancellation_error(e):
                raise
            error_msg = f"Error executing custom tool '{action_type}': {str(e)}"
            logger.error(f"❌ {error_msg}", exc_info=True)
            return False, error_msg, f"Failed: {action_type}"

    @step
    async def finalize(self, ctx: Context, ev: ExecutorActionResultEvent) -> StopEvent:
        """Return executor results to parent workflow."""
        logger.debug("✅ Executor execution complete")

        return StopEvent(
            result={
                "action": ev.action,
                "outcome": ev.success,
                "error": ev.error,
                "summary": ev.summary,
                "thought": ev.thought,
            }
        )
