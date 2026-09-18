import asyncio
import inspect
import logging
import time
from typing import TYPE_CHECKING, Optional, Type

from pydantic import BaseModel

from droiduse_backend.agent.codeact.events import (
    CodeActCodeEvent,
    CodeActEndEvent,
    CodeActInputEvent,
    CodeActOutputEvent,
    CodeActResponseEvent,
)
from droiduse_backend.agent.common.constants import LLM_HISTORY_LIMIT
from droiduse_backend.agent.common.events import RecordUIStateEvent, ScreenshotEvent
from droiduse_backend.agent.usage import get_usage_from_response
from droiduse_backend.agent.utils.chat_utils import (
    extract_code_and_thought,
    limit_history,
)
from droiduse_backend.agent.utils.executer import ExecuterState, SimpleCodeExecutor
from droiduse_backend.agent.utils.inference import acall_with_retries
from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient
from droiduse_backend.agent.utils.prompt_resolver import PromptResolver
from droiduse_backend.agent.utils.timing import (
    adaptive_sleep,
    extract_action_type_from_code,
)
from droiduse_backend.agent.utils.tools import (
    ATOMIC_ACTION_SIGNATURES,
    build_custom_tool_descriptions,
)
from droiduse_backend.config_manager.config_manager import (
    AgentConfig,
    TracingPluginConfig,
)
from droiduse_backend.config_manager.prompt_loader import PromptLoader
from droiduse_backend.plugins import emit_screenshot, emit_task_step
from droiduse_backend.tools import Tools
from droiduse_backend.workflow import Context, StartEvent, StopEvent, Workflow, step

if TYPE_CHECKING:
    from droiduse_backend.agent.droid import DroidAgentState

logger = logging.getLogger("androiduse")


class CodeActAgent(Workflow):
    """
    Agent that generates and executes Python code using atomic actions.

    Uses ReAct cycle: Thought -> Code -> Observation -> repeat until complete().
    Messages stored as list[dict], converted to ChatMessage only for LLM calls.
    """

    def __init__(
        self,
        llm: LiteLLMClient,
        agent_config: AgentConfig,
        tools_instance: Tools,
        custom_tools: dict = None,
        atomic_tools: dict = None,
        debug: bool = False,
        shared_state: Optional["DroidAgentState"] = None,
        safe_execution_config=None,
        output_model: Type[BaseModel] | None = None,
        prompt_resolver: Optional[PromptResolver] = None,
        tracing_config: TracingPluginConfig | None = None,
        *args,
        **kwargs,
    ):
        assert llm, "llm must be provided."
        super().__init__(*args, **kwargs)

        self.llm = llm
        self.agent_config = agent_config
        self.config = agent_config.codeact
        self.max_steps = agent_config.max_steps
        self.max_time = agent_config.max_time
        self.vision = agent_config.codeact.vision
        self.debug = debug
        self.tools = tools_instance
        self.shared_state = shared_state
        self.output_model = output_model
        self.prompt_resolver = prompt_resolver or PromptResolver()
        self.tracing_config = tracing_config

        self.system_prompt: dict | None = None
        self.code_exec_counter = 0
        self.remembered_info: list[str] | None = None

        # Build tool list from atomic + custom tools
        if atomic_tools is None:
            atomic_tools = ATOMIC_ACTION_SIGNATURES

        merged_signatures = {**atomic_tools, **(custom_tools or {})}

        self.tool_list = {}
        for action_name, signature in merged_signatures.items():
            func = signature["function"]
            if inspect.iscoroutinefunction(func):

                async def async_wrapper(
                    *args, f=func, ti=tools_instance, ss=shared_state, **kwargs
                ):
                    return await f(*args, tools=ti, shared_state=ss, **kwargs)

                self.tool_list[action_name] = async_wrapper
            else:

                def sync_wrapper(*args, f=func, ti=tools_instance, ss=shared_state, **kwargs):
                    return f(*args, tools=ti, shared_state=ss, **kwargs)

                self.tool_list[action_name] = sync_wrapper

        self.tool_list["remember"] = tools_instance.remember
        self.tool_list["complete"] = tools_instance.complete

        # Build tool descriptions
        self.tool_descriptions = build_custom_tool_descriptions(atomic_tools)
        custom_descriptions = build_custom_tool_descriptions(custom_tools or {})
        if custom_descriptions:
            self.tool_descriptions += "\n" + custom_descriptions
        self.tool_descriptions += (
            "\n- remember(information: str): Remember information for later use"
        )
        self.tool_descriptions += "\n- complete(success: bool, reason: str): Mark task as complete"

        self._available_secrets = []
        self._output_schema = None
        if self.output_model is not None:
            self._output_schema = self.output_model.model_json_schema()

        # Initialize code executor
        safe_mode = self.config.safe_execution
        safe_config = safe_execution_config

        self.executor = SimpleCodeExecutor(
            locals={},
            tools=self.tool_list,
            globals={"__builtins__": __builtins__},
            safe_mode=safe_mode,
            allowed_modules=(
                safe_config.get_allowed_modules() if safe_config and safe_mode else None
            ),
            blocked_modules=(
                safe_config.get_blocked_modules() if safe_config and safe_mode else None
            ),
            allowed_builtins=(
                safe_config.get_allowed_builtins() if safe_config and safe_mode else None
            ),
            blocked_builtins=(
                safe_config.get_blocked_builtins() if safe_config and safe_mode else None
            ),
            event_loop=None,
            track_actions=True,  # Enable action tracking
        )

        logger.debug("CodeActAgent initialized.")

    async def _capture_screenshot_if_needed(self) -> bytes | None:
        """Helper to capture screenshot, returns None if not needed or failed."""
        if not self.vision:
            return None

        try:
            result = await self.tools.take_screenshot()
            if isinstance(result, tuple):
                success, screenshot = result
                if not success:
                    logger.warning("Screenshot capture failed")
                    return None
                return screenshot
            return result
        except Exception as e:
            logger.warning(f"Failed to capture screenshot: {e}")
            return None

    async def _build_system_prompt(self) -> dict:
        """Build system prompt message."""
        custom_system_prompt = self.prompt_resolver.get_prompt("codeact_system")
        if custom_system_prompt:
            system_text = PromptLoader.render_template(
                custom_system_prompt,
                {
                    "tool_descriptions": self.tool_descriptions,
                    "available_secrets": self._available_secrets,
                    "variables": (self.shared_state.custom_variables if self.shared_state else {}),
                    "output_schema": self._output_schema,
                },
            )
        else:
            system_text = await PromptLoader.load_prompt(
                self.agent_config.get_codeact_system_prompt_path(),
                {
                    "tool_descriptions": self.tool_descriptions,
                    "available_secrets": self._available_secrets,
                    "variables": (self.shared_state.custom_variables if self.shared_state else {}),
                    "output_schema": self._output_schema,
                },
            )
        return {"role": "system", "content": [{"text": system_text}]}

    async def _build_user_prompt(self, goal: str) -> dict:
        """Build initial user prompt message."""
        custom_user_prompt = self.prompt_resolver.get_prompt("codeact_user")
        if custom_user_prompt:
            user_text = PromptLoader.render_template(
                custom_user_prompt,
                {
                    "goal": goal,
                    "variables": (self.shared_state.custom_variables if self.shared_state else {}),
                },
            )
        else:
            user_text = await PromptLoader.load_prompt(
                self.agent_config.get_codeact_user_prompt_path(),
                {
                    "goal": goal,
                    "variables": (self.shared_state.custom_variables if self.shared_state else {}),
                },
            )
        return {"role": "user", "content": [{"text": user_text}]}

    @step
    async def prepare_chat(self, ctx: Context, ev: StartEvent) -> CodeActInputEvent:
        """Initialize message history with goal."""
        self.tools._set_context(ctx)
        logger.debug("Preparing chat for task execution...")

        # Get available secrets
        if hasattr(self.tools, "credential_manager") and self.tools.credential_manager:
            self._available_secrets = await self.tools.credential_manager.get_keys()

        # Build system prompt (lazy load)
        if self.system_prompt is None:
            self.system_prompt = await self._build_system_prompt()

        # Get goal and build user message
        user_input = ev.get("input", default=None)
        assert user_input, "User input cannot be empty."

        user_message = await self._build_user_prompt(user_input)
        self.shared_state.message_history.clear()
        self.shared_state.message_history.append(user_message)

        # Store remembered info if provided
        remembered_info = ev.get("remembered_info", default=None)
        if remembered_info:
            self.remembered_info = remembered_info
            memory_text = "\n### Remembered Information:\n"
            for idx, item in enumerate(remembered_info, 1):
                memory_text += f"{idx}. {item}\n"
            # Append to first user message
            self.shared_state.message_history[0]["content"].append({"text": memory_text})

        return CodeActInputEvent()

    @step
    async def handle_llm_input(
        self, ctx: Context, ev: CodeActInputEvent
    ) -> CodeActResponseEvent | CodeActEndEvent:
        """Get device state, call LLM, return response."""
        ctx.write_event_to_stream(ev)

        # Check max steps
        if self.shared_state.step_number + 1 > self.max_steps:
            end_event = CodeActEndEvent(
                success=False,
                reason=f"Reached max step count of {self.max_steps} steps",
                code_executions=self.code_exec_counter,
            )
            ctx.write_event_to_stream(end_event)
            return StopEvent(
                result={
                    "success": False,
                    "reason": f"Reached max step count of {self.max_steps} steps",
                    "code_executions": self.code_exec_counter,
                }
            )

        # Check max time
        elapsed_time = time.perf_counter() - self.shared_state.task_start_time
        if elapsed_time >= self.max_time:
            logger.warning(
                f"⚠️ Reached maximum time ({self.max_time}s, elapsed: {elapsed_time:.1f}s)"
            )
            end_event = CodeActEndEvent(
                success=False,
                reason=f"Reached maximum time limit ({self.max_time}s)",
                code_executions=self.code_exec_counter,
            )
            ctx.write_event_to_stream(end_event)
            return StopEvent(
                result={
                    "success": False,
                    "reason": f"Reached maximum time limit ({self.max_time}s)",
                    "code_executions": self.code_exec_counter,
                }
            )

        logger.info(f"🔄 Step {self.shared_state.step_number + 1}/{self.max_steps}")

        # Parallelize screenshot and state capture for faster execution
        screenshot_task = self._capture_screenshot_if_needed()
        state_task = self.tools.get_state()

        # Wait for both to complete
        results = await asyncio.gather(screenshot_task, state_task, return_exceptions=True)

        screenshot, state_result = results

        # Handle screenshot result
        if isinstance(screenshot, Exception):
            logger.warning(f"Screenshot capture failed: {screenshot}")
            screenshot = None
        elif screenshot:
            ctx.write_event_to_stream(ScreenshotEvent(screenshot=screenshot))
            # Emit screenshot to plugins (fire-and-forget)
            emit_screenshot(
                screenshot,
                screenshots_enabled=bool(
                    self.tracing_config and self.tracing_config.langfuse_screenshots
                ),
                vision_enabled=self.vision,
            )
            await ctx.store.set("screenshot", screenshot)
            logger.debug("📸 Screenshot captured for CodeAct")

        # Handle state result
        if isinstance(state_result, Exception):
            logger.warning(f"⚠️ Error retrieving state from the connected device: {state_result}")
            if self.debug:
                logger.error("State retrieval error details:", exc_info=True)
        else:
            formatted_text, focused_text, a11y_tree, phone_state = state_result

            # Update shared state
            self.shared_state.formatted_device_state = formatted_text
            self.shared_state.focused_text = focused_text
            self.shared_state.a11y_tree = a11y_tree
            self.shared_state.phone_state = phone_state

            # Extract and store package/app name (using unified update method)
            self.shared_state.update_current_app(
                package_name=phone_state.get("packageName", "Unknown"),
                activity_name=phone_state.get("currentApp", "Unknown"),
            )

            # Stream formatted state for trajectory
            ctx.write_event_to_stream(RecordUIStateEvent(ui_state=a11y_tree))

            # Add device state to last user message
            self.shared_state.message_history[-1]["content"].append(
                {"text": f"\n{formatted_text}\n"}
            )

        # Add screenshot to message if vision enabled
        if self.vision and screenshot:
            self.shared_state.message_history[-1]["content"].append({"image": screenshot})

        # Check for pending voice instructions before calling LLM
        # This catches instructions that came in during previous execution or state capture
        if self.shared_state:
            voice_instructions = []
            while self.shared_state.has_pending_voice_instructions():
                instruction = await self.shared_state.get_pending_voice_instruction()
                if instruction:
                    voice_instructions.append(instruction)

            if voice_instructions:
                if len(voice_instructions) == 1:
                    voice_text = f"\n🎤 Voice instruction from user: {voice_instructions[0]}"
                else:
                    voice_text = "\n🎤 Voice instructions from user:\n" + "\n".join(
                        f"  - {instr}" for instr in voice_instructions
                    )
                self.shared_state.message_history[-1]["content"].append({"text": voice_text})
                logger.info(
                    f"🎤 Incorporated {len(voice_instructions)} voice instruction(s) before LLM call"
                )

        # Limit history and prepare for LLM
        limited_history = limit_history(
            self.shared_state.message_history,
            LLM_HISTORY_LIMIT * 2,
            preserve_first=True,
        )

        # Build final messages: system + history
        messages_to_send = [self.system_prompt] + limited_history

        # Call LLM
        logger.info("[yellow]CodeAct response:[/yellow]")
        response = await acall_with_retries(
            self.llm,
            messages_to_send,
            stream=self.agent_config.streaming,
            agent_type="codeact",
        )

        if response is None:
            end_event = CodeActEndEvent(
                success=False,
                reason="LLM response is None. This is a critical error.",
                code_executions=self.code_exec_counter,
            )
            ctx.write_event_to_stream(end_event)
            return StopEvent(
                result={
                    "success": False,
                    "reason": "LLM response is None. This is a critical error.",
                    "code_executions": self.code_exec_counter,
                }
            )

        # Extract usage
        usage = None
        try:
            usage = get_usage_from_response(self.llm.class_name(), response)
        except Exception as e:
            logger.warning(f"Could not get usage: {e}")

        # Store assistant response
        response_text = response.content
        self.shared_state.message_history.append(
            {"role": "assistant", "content": [{"text": response_text}]}
        )
        self.shared_state.step_number += 1

        # Extract thought and code
        code, thought = extract_code_and_thought(response_text)

        # Update unified state
        self.shared_state.last_thought = thought

        return CodeActResponseEvent(thought=thought, code=code, usage=usage)

    @step
    async def handle_llm_output(
        self, ctx: Context, ev: CodeActResponseEvent
    ) -> CodeActCodeEvent | CodeActInputEvent:
        """Route to execution or request code if missing."""
        if not ev.thought:
            logger.warning("LLM provided code without thoughts.")
            # Add reminder to get thoughts
            goal = self.shared_state.message_history[0]["content"][0].get("text", "")[:200]
            no_thoughts_text = (
                "Your previous response provided code without explaining your reasoning first. "
                "Remember to always describe your thought process and plan *before* providing the code block.\n\n"
                "The code you provided will be executed below.\n\n"
                "Now, describe the next step you will take to address the original goal."
            )
            self.shared_state.message_history.append(
                {"role": "user", "content": [{"text": no_thoughts_text}]}
            )
        else:
            logger.debug(f"Reasoning: {ev.thought}")

        if ev.code:
            return CodeActCodeEvent(code=ev.code)
        else:
            # No code - ask for it
            no_code_text = (
                "No code was provided. If you want to mark task as complete "
                "(whether it failed or succeeded), use complete(success: bool, reason: str) "
                "function within a code block ```python\n```."
            )
            self.shared_state.message_history.append(
                {"role": "user", "content": [{"text": no_code_text}]}
            )
            return CodeActInputEvent()

    @step
    async def execute_code(
        self, ctx: Context, ev: CodeActCodeEvent
    ) -> CodeActOutputEvent | CodeActEndEvent:
        """Execute the code and return result."""
        code = ev.code
        logger.debug(f"Executing:\n```\n{code}\n```")

        success = False
        error = None
        summary = None
        actions = []

        try:
            self.code_exec_counter += 1

            # Time the action execution
            import time

            # Clear device command log before executing so we only capture this step's commands
            if self.tools:
                self.tools.clear_device_commands()

            action_start = time.perf_counter()
            result = await self.executor.execute(
                ExecuterState(ui_state=await ctx.store.get("ui_state", None)), code
            )
            action_duration = time.perf_counter() - action_start

            logger.info("[dim]💡 Execution result:[/dim]")
            logger.info(f"{result}")

            # Get actual device commands sent to phone (for replay recording)
            actions = self.tools.get_device_commands() if self.tools else []

            success = True
            summary = str(result) if result else "Code executed successfully"

            # Use adaptive sleep based on the action type in the code
            # Pass the action duration so we can reduce sleep time accordingly
            action_type = extract_action_type_from_code(code) or "default"
            await adaptive_sleep(
                action_type=action_type,
                base_delay=self.agent_config.after_sleep_action,
                action_duration_sec=action_duration,
                cancellation_event=self.shared_state.cancellation_event
                if self.shared_state
                else None,
            )

            # Check if complete() was called
            if self.tools.finished:
                logger.debug("✅ Task marked as complete via complete() function")

                # Validate completion state
                completion_success = self.tools.success if self.tools.success is not None else False
                reason = self.tools.reason if self.tools.reason else "Task completed without reason"
                self.tools.finished = False

                # Update variables for task step recording
                success = completion_success
                summary = reason

                end_event = CodeActEndEvent(
                    success=completion_success,
                    reason=reason,
                    code_executions=self.code_exec_counter,
                )
                ctx.write_event_to_stream(end_event)
                return StopEvent(
                    result={
                        "success": completion_success,
                        "reason": reason,
                        "code_executions": self.code_exec_counter,
                    }
                )

            # Update remembered info
            self.remembered_info = self.tools.memory

            return CodeActOutputEvent(output=str(result))

        except BaseException as e:  # Catch ALL exceptions including CancelledError
            # Re-raise cancellation errors to stop the workflow
            from droiduse_backend.agent.utils.cancellation import is_cancellation_error

            if is_cancellation_error(e):
                raise
            # If we get here, it's not a cancellation error
            logger.debug(f"Non-cancellation exception in execute_code: {type(e).__name__}")
            # Handle other exceptions (only Exception subclasses)
            if not isinstance(e, Exception):
                logger.error(f"❌ Non-Exception BaseException raised: {type(e).__name__}")
                raise  # Re-raise non-Exception BaseExceptions
            logger.debug(f"Exception in execute_code: {type(e).__name__}: {str(e)[:100]}")
            logger.error(f"💥 Action failed: {e}")
            if self.debug:
                logger.error("Exception details:", exc_info=True)
            error_message = f"Error during execution: {e}"

            success = False
            error = error_message
            summary = None
            actions = (
                self.tools.get_device_commands() if self.tools else []
            )  # Get actions even on error

            return CodeActOutputEvent(output=error_message)

        finally:
            # Reuse device state that was already captured before execution (in handle_llm_input)
            # No need to call get_state() again - it's expensive and redundant
            formatted_text = self.shared_state.formatted_device_state if self.shared_state else None
            a11y_tree = self.shared_state.a11y_tree if self.shared_state else None
            phone_state = self.shared_state.phone_state if self.shared_state else None

            # Record step with device state to database (fire-and-forget via plugin)
            step_status = "SUCCESS" if success else "FAILED"

            # Get the thought from the last assistant message
            thought = (
                self.shared_state.last_thought
                if hasattr(self.shared_state, "last_thought")
                else None
            )

            # Create a description from the code if no thought
            description = (
                f"Executed code with {len(actions)} action(s)" if actions else "Executed code"
            )

            # Prepare a11y_tree for storage (convert to JSON if it's a dict/object)
            a11y_tree_for_db = None
            if a11y_tree:
                if isinstance(a11y_tree, (dict, list)):
                    a11y_tree_for_db = a11y_tree  # Pass as-is, API will handle JSON serialization
                else:
                    a11y_tree_for_db = str(a11y_tree)

            emit_task_step(
                step_number=self.shared_state.step_number,
                agent_type="codeact",
                actions=actions if actions else None,
                thought=thought,
                description=description,
                subgoal=None,  # CodeAct doesn't have explicit subgoals
                status=step_status,
                error=error,
                summary=summary,
                full_response=code,  # Store the executed code
                formatted_text=formatted_text,  # Send full text, API/DB can handle size limits
                phone_state=phone_state,
                a11y_tree=a11y_tree_for_db,
                jwt_token=self.shared_state.jwt_token if self.shared_state else None,
                device_id=self.shared_state.device_id if self.shared_state else None,
                connection_id=self.shared_state.connection_id if self.shared_state else None,
            )

    @step
    async def handle_execution_result(
        self, _ctx: Context, ev: CodeActOutputEvent
    ) -> CodeActInputEvent:
        """Add execution result to history and loop back."""
        output = ev.output or "Code executed, but produced no output."

        # Add execution output as user message
        observation_text = f"Execution Result:\n```\n{output}\n```"
        self.shared_state.message_history.append(
            {"role": "user", "content": [{"text": observation_text}]}
        )

        # Check for pending voice instructions from real-time transcription
        # Process all pending instructions (user may have spoken multiple times during execution)
        if self.shared_state:
            voice_instructions = []
            while self.shared_state.has_pending_voice_instructions():
                instruction = await self.shared_state.get_pending_voice_instruction()
                if instruction:
                    voice_instructions.append(instruction)

            if voice_instructions:
                # Combine all voice instructions into a single message
                if len(voice_instructions) == 1:
                    voice_text = f"\n🎤 Voice instruction from user: {voice_instructions[0]}"
                else:
                    voice_text = "\n🎤 Voice instructions from user:\n" + "\n".join(
                        f"  - {instr}" for instr in voice_instructions
                    )
                # Append to the last user message so context stays together
                self.shared_state.message_history[-1]["content"].append({"text": voice_text})
                logger.info(
                    f"🎤 Incorporated {len(voice_instructions)} voice instruction(s): "
                    f"{voice_instructions[0][:60]}..."
                )

        return CodeActInputEvent()

    @step
    async def finalize(self, ev: CodeActEndEvent, _ctx: Context) -> StopEvent:
        """Finalize the workflow."""
        self.tools.finished = False

        return StopEvent(
            result={
                "success": ev.success,
                "reason": ev.reason,
                "code_executions": ev.code_executions,
            }
        )
