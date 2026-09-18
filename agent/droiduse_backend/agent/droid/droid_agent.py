"""
DroidAgent - A wrapper class that coordinates the planning and execution of tasks
to achieve a user's goal on an Android device.

Architecture:
- When reasoning=False: Uses CodeActAgent directly
- When reasoning=True: Uses Manager (planning) + Executor (action) workflows
"""

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Type, Union

from pydantic import BaseModel

from droiduse_backend.agent.codeact import CodeActAgent
from droiduse_backend.agent.codeact.events import CodeActOutputEvent
from droiduse_backend.agent.common.events import (
    MacroEvent,
    RecordUIStateEvent,
    ScreenshotEvent,
)
from droiduse_backend.agent.droid.events import (
    CodeActExecuteEvent,
    CodeActResultEvent,
    ExecutorInputEvent,
    ExecutorResultEvent,
    FinalizeEvent,
    ManagerInputEvent,
    ManagerPlanEvent,
    ResultEvent,
    ScripterExecutorInputEvent,
    ScripterExecutorResultEvent,
    TextManipulatorInputEvent,
    TextManipulatorResultEvent,
)
from droiduse_backend.agent.droid.state import DroidAgentState
from droiduse_backend.agent.executor import ExecutorAgent
from droiduse_backend.agent.external import load_agent
from droiduse_backend.agent.manager import ManagerAgent, StatelessManagerAgent
from droiduse_backend.agent.oneflows.structured_output_agent import (
    StructuredOutputAgent,
)
from droiduse_backend.agent.oneflows.text_manipulator import run_text_manipulation_agent
from droiduse_backend.agent.scripter import ScripterAgent
from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient
from droiduse_backend.agent.utils.llm_loader import (
    load_agent_llms,
    merge_llms_with_config,
)
from droiduse_backend.agent.utils.prompt_resolver import PromptResolver
from droiduse_backend.agent.utils.tools import (
    ATOMIC_ACTION_SIGNATURES,
    SEMANTIC_ACTION_SIGNATURES,
    build_custom_tools,
    filter_atomic_actions,
    filter_custom_tools,
    filter_semantic_actions,
    resolve_tools_instance,
)
from droiduse_backend.agent.utils.trajectory import Trajectory
from droiduse_backend.config_manager.config_manager import (
    AgentConfig,
    AndroidUseConfig,
    ApiKeysConfig,
    CredentialsConfig,
    DeviceConfig,
    LoggingConfig,
    PluginsConfig,
    SafeExecutionConfig,
    ToolsConfig,
)
from droiduse_backend.credential_manager import CredentialManager, FileCredentialManager
from droiduse_backend.observability.profiler import (
    Profiler,
    get_profiler,
    reset_profiler,
)
from droiduse_backend.observability.tracing_setup import (
    apply_session_context,
    setup_tracing,
)
from droiduse_backend.plugins import (
    emit_agent_finalize,
    emit_agent_init,
    emit_screenshot,
    emit_task_end,
    emit_task_start,
    emit_trajectory_step,
    get_plugin_manager,
)
from droiduse_backend.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    WorkflowHandler,
    step,
)

if TYPE_CHECKING:
    from droiduse_backend.tools import Tools

logger = logging.getLogger("androiduse")


class DroidAgent(Workflow):
    """
    A wrapper class that coordinates between agents to achieve a user's goal.

    Reasoning modes:
    - reasoning=False: Uses CodeActAgent directly for immediate execution
    - reasoning=True: Uses ManagerAgent (planning) + ExecutorAgent (actions)
    """

    @staticmethod
    def _configure_default_logging(debug: bool = False):
        """
        Configure default logging for DroidAgent if no handlers are present.
        This ensures logs are visible when using DroidAgent directly.
        """
        # Only configure if no handlers exist (avoid duplicate configuration)
        if not logger.handlers:
            # Create a console handler
            handler = logging.StreamHandler()

            # Set format
            if debug:
                formatter = logging.Formatter("%(asctime)s %(levelname)s: %(message)s", "%H:%M:%S")
            else:
                formatter = logging.Formatter("%(message)s")

            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.DEBUG if debug else logging.INFO)
            logger.propagate = False

    def __init__(
        self,
        goal: str,
        config: AndroidUseConfig | None = None,
        llms: dict[str, LiteLLMClient] | LiteLLMClient | None = None,
        tools: "Tools | None" = None,
        custom_tools: dict = None,
        credentials: Union[dict, "CredentialManager", None] = None,
        variables: dict | None = None,
        output_model: Type[BaseModel] | None = None,
        prompts: dict[str, str] | None = None,
        timeout: int = 1000,
        *args,
        **kwargs,
    ):
        """
        Initialize the DroidAgent wrapper.

        Args:
            goal: User's goal or command
            config: Full config (required if llms not provided)
            llms: Optional dict of agent-specific LLMs or single LLM for all.
                  If not provided, LLMs will be loaded from config profiles.
            tools: Either a Tools instance (for custom/pre-configured tools) or None (use default from config).
            custom_tools: Custom tool definitions
            credentials: Dict {"SECRET_ID": "value"}, CredentialManager instance, or None (will use config.credentials if available)
            variables: Optional dict of custom variables accessible throughout execution
            output_model: Optional Pydantic model for structured output extraction from final answer
            prompts: Optional dict of custom Jinja2 prompt templates to override defaults.
                    Keys: "codeact_system", "codeact_user", "manager_system", "executor_system", "scripter_system"
                    Values: Jinja2 template strings (NOT file paths)
            timeout: Workflow timeout in seconds
        """

        self.user_id = kwargs.pop("user_id", None)
        self.runtype = kwargs.pop("runtype", "developer")
        self.device_id = kwargs.pop("device_id", None)
        self.jwt_token = kwargs.pop("jwt_token", None)
        self.connection_id = kwargs.pop("connection_id", None)
        self.cancellation_event = kwargs.pop("cancellation_event", None)
        self.shared_state = DroidAgentState(
            instruction=goal,
            err_to_manager_thresh=2,
            user_id=self.user_id,
            runtype=self.runtype,
            jwt_token=self.jwt_token,
            device_id=self.device_id,
            connection_id=self.connection_id,
            cancellation_event=self.cancellation_event,
        )
        # Initialize voice instruction queue for real-time transcription
        self.shared_state.initialize_voice_queue()
        self.output_model = output_model

        # Initialize prompt resolver for custom prompts
        self.prompt_resolver = PromptResolver(custom_prompts=prompts)

        # Store custom variables in shared state
        if variables:
            self.shared_state.custom_variables = variables

        # Check if using external agent (use config param, self.config not yet assigned)
        agent_name = config.agent.name if config else "droiduse"
        self._using_external_agent = agent_name != "droiduse"

        # Load credential manager (supports both config and direct dict)
        # Priority: explicit credentials param > base_config.credentials
        credentials_source = (
            credentials if credentials is not None else (config.credentials if config else None)
        )

        # If already a CredentialManager instance, use it. Otherwise wrap in FileCredentialManager
        if isinstance(credentials_source, CredentialManager):
            self.credential_manager = credentials_source
        elif credentials_source is not None:
            cm = FileCredentialManager(credentials_source)
            # Only assign if it actually loaded secrets (handles disabled case)
            self.credential_manager = cm if cm.secrets else None
        else:
            self.credential_manager = None

        self.tools_param = tools
        self.tools_fallback = tools if tools is not None else (config.tools if config else None)
        self.resolved_device_config = config.device if config else DeviceConfig()

        self.config = AndroidUseConfig(
            agent=config.agent if config else AgentConfig(),
            device=self.resolved_device_config,
            tools=config.tools if config else ToolsConfig(),
            logging=config.logging if config else LoggingConfig(),
            llm_profiles=config.llm_profiles if config else {},
            credentials=config.credentials if config else CredentialsConfig(),
            safe_execution=config.safe_execution if config else SafeExecutionConfig(),
            api_keys=config.api_keys if config else ApiKeysConfig(),
            plugins=config.plugins if config else PluginsConfig(),
            external_agents=config.external_agents if config else {},
        )

        self.tools_instance = None

        super().__init__(*args, timeout=timeout, **kwargs)

        self._configure_default_logging(debug=self.config.logging.debug)

        setup_tracing(self.config.plugins.tracing, agent=self)

        # Load LLMs only if not using external agent
        if llms is None and not self._using_external_agent:
            if config is None:
                raise ValueError(
                    "Either 'llms' or 'config' must be provided. "
                    "If llms is not provided, config is required to load LLMs from profiles."
                )

            logger.debug("🔄 Loading LLMs from config (llms not provided)...")

            llms = load_agent_llms(config=self.config, output_model=output_model, **kwargs)

        # Validate LLM type only if not using external agent
        if not self._using_external_agent:
            if isinstance(llms, dict):
                # allow users to provide a partial dict of LLMs. Merge any missing ones from configuration defaults.
                llms = merge_llms_with_config(
                    self.config, llms, output_model=output_model, **kwargs
                )

            elif isinstance(llms, LiteLLMClient):
                pass
            else:
                raise ValueError(f"Invalid LLM type: {type(llms)}")

        self.timeout = timeout

        # Set up LLMs only for native agents, external agents handle their own LLMs
        if self._using_external_agent:
            # External agents don't use these LLM attributes
            self.manager_llm = None
            self.executor_llm = None
            self.codeact_llm = None
            self.text_manipulator_llm = None
            self.app_opener_llm = None
            self.scripter_llm = None
            self.structured_output_llm = None
            logger.debug(f"🤖 Using external agent: {agent_name}")
        elif isinstance(llms, dict):
            self.manager_llm = llms.get("manager")
            self.executor_llm = llms.get("executor")
            self.codeact_llm = llms.get("codeact")
            self.text_manipulator_llm = llms.get("text_manipulator")
            self.app_opener_llm = llms.get("app_opener")
            self.scripter_llm = llms.get("scripter", self.codeact_llm)
            self.structured_output_llm = llms.get("structured_output", self.codeact_llm)

            logger.debug("📚 Using agent-specific LLMs from dictionary")
        else:
            logger.debug("📚 Using single LLM for all agents")
            self.manager_llm = llms
            self.executor_llm = llms
            self.codeact_llm = llms
            self.text_manipulator_llm = llms
            self.app_opener_llm = llms
            self.scripter_llm = llms
            self.structured_output_llm = llms

        self.trajectory = Trajectory(
            goal=self.shared_state.instruction,
            base_path=self.config.plugins.trajectory.trajectory_path,
        )

        # Get plugin manager (plugins are registered at server startup)
        self.plugin_manager = get_plugin_manager()

        if self.config.agent.use_semantic_actions:
            self.atomic_tools = SEMANTIC_ACTION_SIGNATURES.copy()
        else:
            self.atomic_tools = ATOMIC_ACTION_SIGNATURES.copy()

        # Store user custom tools, will build auto tools (credentials + open_app)
        self.user_custom_tools = custom_tools or {}
        self.custom_tools = {}

        if self.user_custom_tools:
            logger.debug(f"🔧 User custom tools: {list(self.user_custom_tools.keys())}")

        logger.debug("🤖 Initializing DroidAgent...")
        logger.debug(f"💾 Trajectory saving: {self.config.plugins.trajectory.save_trajectory}")

        # Only initialize Manager/Executor for native agents with reasoning enabled
        if self.config.agent.reasoning and not self._using_external_agent:
            # Choose between stateful and stateless manager
            if self.config.agent.manager.stateless:
                logger.debug("📝 Initializing StatelessManager and Executor Agents...")
                ManagerClass = StatelessManagerAgent
            else:
                logger.debug("📝 Initializing Manager and Executor Agents...")
                ManagerClass = ManagerAgent

            self.manager_agent = ManagerClass(
                llm=self.manager_llm,
                tools_instance=None,
                shared_state=self.shared_state,
                agent_config=self.config.agent,
                custom_tools=self.custom_tools,
                output_model=self.output_model,
                prompt_resolver=self.prompt_resolver,
                tracing_config=self.config.plugins.tracing,
                timeout=self.timeout,
            )
            self.executor_agent = ExecutorAgent(
                llm=self.executor_llm,
                tools_instance=None,
                shared_state=self.shared_state,
                agent_config=self.config.agent,
                custom_tools=self.custom_tools,
                prompt_resolver=self.prompt_resolver,
                timeout=self.timeout,
            )
        else:
            self.manager_agent = None
            self.executor_agent = None

        atomic_tools = list(self.atomic_tools.keys())

        # Emit agent init telemetry via plugin system (fire-and-forget)
        emit_agent_init(
            goal=self.shared_state.instruction,
            llms={
                "manager": (self.manager_llm.class_name() if self.manager_llm else "None"),
                "executor": (self.executor_llm.class_name() if self.executor_llm else "None"),
                "codeact": (self.codeact_llm.class_name() if self.codeact_llm else "None"),
                "text_manipulator": (
                    self.text_manipulator_llm.class_name() if self.text_manipulator_llm else "None"
                ),
                "app_opener": (self.app_opener_llm.class_name() if self.app_opener_llm else "None"),
            },
            tools=",".join(atomic_tools + ["remember", "complete"]),
            max_steps=self.config.agent.max_steps,
            timeout=timeout,
            vision={
                "manager": self.config.agent.manager.vision,
                "executor": self.config.agent.executor.vision,
                "codeact": self.config.agent.codeact.vision,
            },
            reasoning=self.config.agent.reasoning,
            enable_tracing=self.config.plugins.tracing.enabled,
            debug=self.config.logging.debug,
            save_trajectories=self.config.plugins.trajectory.save_trajectory,
            runtype=self.runtype,
            user_id=self.user_id,
            custom_prompts=prompts,
        )

        logger.debug("✅ DroidAgent initialized successfully.")

    def run(self, *args, **kwargs) -> WorkflowHandler:
        apply_session_context()
        handler = super().run(*args, **kwargs)  # type: ignore[assignment]
        return handler

    @step
    async def execute_task(self, ctx: Context, ev: CodeActExecuteEvent) -> CodeActResultEvent:
        """
        Execute a single task using the CodeActAgent.

        Args:
            instruction: task of what the agent shall do

        Returns:
            Tuple of (success, reason)
        """

        # Check for cancellation before executing task
        from droiduse_backend.agent.utils.cancellation import check_cancellation

        await check_cancellation(self.shared_state.cancellation_event)

        logger.debug(f"🔧 Executing task: {ev.instruction}")

        # Profile CodeAct execution
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            codeact_agent = CodeActAgent(
                llm=self.codeact_llm,
                agent_config=self.config.agent,
                tools_instance=self.tools_instance,
                custom_tools=self.custom_tools,
                atomic_tools=self.atomic_tools,
                debug=self.config.logging.debug,
                shared_state=self.shared_state,
                safe_execution_config=self.config.safe_execution,
                output_model=self.output_model,
                prompt_resolver=self.prompt_resolver,
                timeout=self.timeout,
                tracing_config=self.config.plugins.tracing,
            )

            handler = codeact_agent.run(
                input=ev.instruction,
                remembered_info=self.tools_instance.memory,
            )

            logger.debug("🔄 Starting to stream events from CodeActAgent...")
            event_count = 0
            async for nested_ev in handler.stream_events():
                event_count += 1
                logger.debug(f"📨 Received event #{event_count}: {type(nested_ev).__name__}")

                # Check for cancellation during execution
                from droiduse_backend.agent.utils.cancellation import check_cancellation

                await check_cancellation(self.shared_state.cancellation_event)

                self.handle_stream_event(nested_ev, ctx)

                if isinstance(nested_ev, CodeActOutputEvent):
                    if self.config.plugins.trajectory.save_trajectory != "none":
                        self.shared_state.step_number += 1
                        emit_trajectory_step(
                            self.trajectory,
                            step_number=self.shared_state.step_number,
                        )

            logger.debug(f"✓ Finished streaming {event_count} events, awaiting handler result...")
            result = await handler
            logger.debug(f"✓ Handler result: success={result.get('success')}")

            # Record CodeAct execution time
            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_AGENT, "codeact_step", duration_ms)

            if "success" in result and result["success"]:
                return CodeActResultEvent(
                    success=True,
                    reason=result["reason"],
                    instruction=ev.instruction,
                )

            else:
                return CodeActResultEvent(
                    success=False,
                    reason=result["reason"],
                    instruction=ev.instruction,
                )

        except BaseException as e:
            # Re-raise cancellation errors
            from droiduse_backend.agent.utils.cancellation import is_cancellation_error

            if is_cancellation_error(e):
                raise

            # Record CodeAct execution time even on error
            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_AGENT, "codeact_step", duration_ms, {"error": str(e)})

            logger.error(f"Error during task execution: {e}")
            if self.config.logging.debug:
                import traceback

                logger.error(traceback.format_exc())
            return CodeActResultEvent(
                success=False, reason=f"Error: {str(e)}", instruction=ev.instruction
            )

    @step
    async def handle_codeact_execute(self, ctx: Context, ev: CodeActResultEvent) -> FinalizeEvent:
        try:
            return FinalizeEvent(success=ev.success, reason=ev.reason)

        except BaseException as e:
            # Re-raise cancellation errors
            from droiduse_backend.agent.utils.cancellation import is_cancellation_error

            if is_cancellation_error(e):
                raise

            logger.error(f"❌ Error during DroidAgent execution: {e}")
            if self.config.logging.debug:
                import traceback

                logger.error(traceback.format_exc())
            return FinalizeEvent(
                success=False,
                reason=str(e),
            )

    @step
    async def start_handler(
        self, ctx: Context, ev: StartEvent
    ) -> CodeActExecuteEvent | ManagerInputEvent | FinalizeEvent:
        logger.info(f"🚀 Running DroidAgent to achieve goal: {self.shared_state.instruction}")
        ctx.write_event_to_stream(ev)

        # Initialize plugins (fire-and-forget background tasks)
        await self.plugin_manager.initialize()

        # Reset and start profiler for this task execution
        reset_profiler()
        self.profiler = get_profiler()
        self.profiler.start()
        logger.debug("⏱️ Profiler started for task execution")

        # Initialize task start time for max_time tracking
        self.shared_state.task_start_time = time.perf_counter()

        # Get device information - prioritize device_id from request, then try tools_instance/config
        device_id = self.device_id

        # If not provided in request, try to get from tools_instance if available
        if not device_id and self.tools_instance:
            if hasattr(self.tools_instance, "_serial") and self.tools_instance._serial:
                device_id = self.tools_instance._serial
            elif hasattr(self.tools_instance, "device_id"):
                device_id = self.tools_instance.device_id
        # Fallback to device config
        if not device_id and self.resolved_device_config:
            if (
                hasattr(self.resolved_device_config, "serial")
                and self.resolved_device_config.serial
            ):
                device_id = self.resolved_device_config.serial

        # Update shared_state with resolved device_id for child agents
        self.shared_state.device_id = device_id

        # Emit task start event with trajectory init (fire-and-forget)
        trajectory_for_start = (
            self.trajectory if self.config.plugins.trajectory.save_trajectory != "none" else None
        )
        emit_task_start(
            goal=self.shared_state.instruction,
            user_id=self.user_id,
            run_type=self.runtype,
            is_reasoning=self.config.agent.reasoning,
            max_steps=self.config.agent.max_steps,
            timeout_sec=self.timeout,
            device_id=device_id,
            jwt_token=self.jwt_token,
            connection_id=self.shared_state.connection_id,
            trajectory=trajectory_for_start,
        )

        # Build and filter tools (single source of truth for tool filtering)
        auto_custom_tools = await build_custom_tools(self.credential_manager)
        disabled_tools = (
            self.config.tools.disabled_tools
            if self.config.tools and self.config.tools.disabled_tools
            else []
        )

        if self.config.agent.use_semantic_actions:
            self.atomic_tools = filter_semantic_actions(disabled_tools)
        else:
            self.atomic_tools = filter_atomic_actions(disabled_tools)
        filtered_custom = filter_custom_tools(
            {**auto_custom_tools, **self.user_custom_tools},
            disabled_tools,
        )
        self.custom_tools.clear()
        self.custom_tools.update(filtered_custom)

        if self.tools_instance is None:
            # Determine if vision is enabled based on the active agent role
            if self.config.agent.reasoning:
                vision_enabled = self.config.agent.manager.vision
            else:
                vision_enabled = self.config.agent.codeact.vision

            tools_instance, tools_config_resolved = await resolve_tools_instance(
                tools=self.tools_fallback,
                device_config=self.resolved_device_config,
                tools_config_fallback=self.config.tools,
                credential_manager=self.credential_manager,
                vision_enabled=vision_enabled,
            )

            self.tools_instance = tools_instance
            self.config.tools = tools_config_resolved

            self.tools_instance.save_trajectories = self.config.plugins.trajectory.save_trajectory
            self.tools_instance.app_opener_llm = self.app_opener_llm
            self.tools_instance.text_manipulator_llm = self.text_manipulator_llm
            self.tools_instance.streaming = self.config.agent.streaming

        # Update sub-agents with tools (outside the if block - works for both auto-created and pre-provided)
        if self.config.agent.reasoning and self.executor_agent:
            self.manager_agent.tools_instance = self.tools_instance
            self.executor_agent.tools_instance = self.tools_instance
            self.executor_agent.atomic_tools = self.atomic_tools

        self.tools_instance._set_context(ctx)

        # Check if using external agent - route directly to external agent handler
        if self._using_external_agent:
            agent_name = self.config.agent.name

            # Load external agent module
            agent_module = load_agent(agent_name)
            if not agent_module:
                return FinalizeEvent(
                    success=False, reason=f"Failed to load external agent: {agent_name}"
                )

            # Get config from external_agents section
            agent_config = self.config.external_agents.get(agent_name)
            if not agent_config:
                return FinalizeEvent(
                    success=False,
                    reason=f"No config found for agent '{agent_name}' in external_agents section",
                )

            # Merge: module defaults + user config
            final_config = {**agent_module["config"], **agent_config}

            logger.info(f"🤖 Using external agent: {agent_name}")

            try:
                result = await agent_module["run"](
                    tools=self.tools_instance,
                    instruction=self.shared_state.instruction,
                    config=final_config,
                    max_steps=self.config.agent.max_steps,
                )

                return FinalizeEvent(
                    success=result.get("success", False),
                    reason=result.get("reason", "External agent completed"),
                )
            except Exception as e:
                logger.exception(f"External agent {agent_name} failed")
                return FinalizeEvent(success=False, reason=f"External agent error: {e}")

        # Continue with normal DroidUse agent flow
        if not self.config.agent.reasoning:
            logger.debug(
                f"🔄 Direct execution mode - executing goal: {self.shared_state.instruction}"
            )
            event = CodeActExecuteEvent(instruction=self.shared_state.instruction)
            ctx.write_event_to_stream(event)
            return event

        logger.debug("🧠 Reasoning mode - initializing Manager/Executor workflow")
        event = ManagerInputEvent()
        ctx.write_event_to_stream(event)
        return event

    # ========================================================================
    # Manager/Executor Workflow Steps
    # ========================================================================

    @step
    async def run_manager(
        self, ctx: Context, ev: ManagerInputEvent
    ) -> ManagerPlanEvent | FinalizeEvent:
        """
        Run Manager planning phase.

        Pre-flight checks for termination before running manager.
        The Manager analyzes current state and creates a plan with subgoals.
        """
        # Check max_steps limit
        if self.shared_state.step_number >= self.config.agent.max_steps:
            logger.warning(f"⚠️ Reached maximum steps ({self.config.agent.max_steps})")
            return FinalizeEvent(
                success=False,
                reason=f"Reached maximum steps ({self.config.agent.max_steps})",
            )

        # Check max_time limit
        elapsed_time = time.perf_counter() - self.shared_state.task_start_time
        if elapsed_time >= self.config.agent.max_time:
            logger.warning(
                f"⚠️ Reached maximum time ({self.config.agent.max_time}s, elapsed: {elapsed_time:.1f}s)"
            )
            return FinalizeEvent(
                success=False,
                reason=f"Reached maximum time limit ({self.config.agent.max_time}s)",
            )

        logger.info(f"🔄 Step {self.shared_state.step_number + 1}/{self.config.agent.max_steps}")

        # Run Manager workflow with profiling
        profiler = get_profiler()
        start_time = time.perf_counter()

        # Per-step timeout prevents a single LLM call from hanging forever.
        per_step_timeout = self.config.agent.per_step_timeout

        MAX_RETRIES = 2
        result = None
        for attempt in range(1, MAX_RETRIES + 1):
            handler = self.manager_agent.run()

            try:

                async def _run_manager_step(h=handler):
                    async for nested_ev in h.stream_events():
                        from droiduse_backend.agent.utils.cancellation import check_cancellation

                        await check_cancellation(self.shared_state.cancellation_event)
                        self.handle_stream_event(nested_ev, ctx)
                    return await h

                result = await asyncio.wait_for(_run_manager_step(), timeout=per_step_timeout)
                break  # Success, exit retry loop
            except asyncio.TimeoutError:
                if attempt < MAX_RETRIES:
                    logger.warning(
                        f"Manager step timed out after {per_step_timeout}s "
                        f"(attempt {attempt}/{MAX_RETRIES}), retrying..."
                    )
                else:
                    logger.error(
                        f"Manager step timed out after {per_step_timeout}s "
                        f"(attempt {attempt}/{MAX_RETRIES}), giving up"
                    )
                    return FinalizeEvent(
                        success=False,
                        reason=f"Manager step timed out after {per_step_timeout}s",
                    )

        # Record manager execution time
        duration_ms = (time.perf_counter() - start_time) * 1000
        profiler.record(Profiler.CATEGORY_AGENT, "manager_step", duration_ms)

        # Manager already updated shared_state, just return event with results
        event = ManagerPlanEvent(
            plan=result["plan"],
            current_subgoal=result["current_subgoal"],
            thought=result["thought"],
            manager_answer=result.get("manager_answer", ""),
            success=result.get("success"),
        )
        ctx.write_event_to_stream(event)
        return event

    @step
    async def handle_manager_plan(
        self, ctx: Context, ev: ManagerPlanEvent
    ) -> (
        ExecutorInputEvent | ScripterExecutorInputEvent | FinalizeEvent | TextManipulatorInputEvent
    ):
        """
        Process Manager output and decide next step.

        Checks if task is complete, if ScripterAgent should run, or if Executor should take action.
        """
        # Check for answer-type termination
        if ev.manager_answer.strip():
            # Use success field from manager, default to True if not set for backward compatibility
            success = ev.success if ev.success is not None else True
            self.shared_state.progress_summary = f"Answer: {ev.manager_answer}"

            return FinalizeEvent(success=success, reason=ev.manager_answer)

        # Check for <script> tag in current_subgoal, then extract from full plan
        if "<script>" in ev.current_subgoal:
            # Found script tag in subgoal - now search the entire plan
            start_idx = ev.plan.find("<script>")
            end_idx = ev.plan.find("</script>")

            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                # Extract content between first <script> and first </script> in plan
                task = ev.plan[start_idx + len("<script>") : end_idx].strip()
                logger.debug(f"🐍 Routing to ScripterAgent: {task[:80]}...")
                event = ScripterExecutorInputEvent(task=task)
                ctx.write_event_to_stream(event)
                return event
            else:
                # <script> found in subgoal but not properly closed in plan - log warning
                logger.warning(
                    "⚠️ Found <script> in subgoal but not properly closed in plan, treating as regular subgoal"
                )
        if "TEXT_TASK" in ev.current_subgoal:
            return TextManipulatorInputEvent(
                task=ev.current_subgoal.replace("TEXT_TASK:", "").replace("TEXT_TASK", "").strip()
            )

        # Continue to Executor with current subgoal
        logger.debug(f"▶️  Proceeding to Executor with subgoal: {ev.current_subgoal}")
        return ExecutorInputEvent(current_subgoal=ev.current_subgoal)

    @step
    async def run_text_manipulator(
        self, ctx: Context, ev: TextManipulatorInputEvent
    ) -> TextManipulatorResultEvent:
        logger.debug(f"🔍 Running TextManipulatorAgent for task: {ev.task}")

        # Profile TextManipulator execution
        profiler = get_profiler()
        start_time = time.perf_counter()

        if not self.shared_state.focused_text:
            logger.warning("⚠️ No focused text available, using empty string")
            current_text = ""
        else:
            current_text = self.shared_state.focused_text

        try:
            text_to_type, code_ran = await run_text_manipulation_agent(
                instruction=self.shared_state.instruction,
                current_subgoal=ev.task,
                current_text=current_text,
                overall_plan=self.shared_state.plan,
                llm=self.text_manipulator_llm,
                stream=self.config.agent.streaming,
            )

            # Record text manipulator execution time
            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_AGENT, "text_manipulator_step", duration_ms)

            return TextManipulatorResultEvent(
                task=ev.task, text_to_type=text_to_type, code_ran=code_ran
            )

        except Exception as e:
            # Record text manipulator execution time even on error
            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(
                Profiler.CATEGORY_AGENT,
                "text_manipulator_step",
                duration_ms,
                {"error": str(e)},
            )

            logger.error(f"❌ TextManipulator agent failed: {e}")
            if self.config.logging.debug:
                import traceback

                logger.error(traceback.format_exc())

            return TextManipulatorResultEvent(task=ev.task, text_to_type="", code_ran="")

    @step
    async def handle_text_manipulator_result(
        self, ctx: Context, ev: TextManipulatorResultEvent
    ) -> ManagerInputEvent:
        if not ev.text_to_type or not ev.text_to_type.strip():
            logger.warning("⚠️ TextManipulator returned empty text, treating as no-op")
            self.shared_state.last_summary = "Text manipulation returned empty result"
            self.shared_state.action_outcomes.append(False)
        else:
            try:
                result = await self.tools_instance.input_text(ev.text_to_type, clear=True)

                if not result or "error" in result.lower() or "failed" in result.lower():
                    logger.warning(f"⚠️ Text input may have failed: {result}")
                    self.shared_state.last_summary = (
                        f"Text manipulation attempted but may have failed: {result}"
                    )
                    self.shared_state.action_outcomes.append(False)
                else:
                    logger.debug(
                        f"✅ Text manipulator successfully typed {len(ev.text_to_type)} characters"
                    )
                    self.shared_state.last_summary = (
                        f"Text manipulation successful: typed {len(ev.text_to_type)} characters"
                    )
                    self.shared_state.action_outcomes.append(True)
            except Exception as e:
                logger.error(f"❌ Error during text input: {e}")
                self.shared_state.last_summary = f"Text manipulation error: {str(e)}"
                self.shared_state.action_outcomes.append(False)

        text_manipulation_record = {
            "task": ev.task,
            "code_ran": ev.code_ran,
            "text_length": len(ev.text_to_type) if ev.text_to_type else 0,
            "success": (
                self.shared_state.action_outcomes[-1]
                if self.shared_state.action_outcomes
                else False
            ),
        }

        self.shared_state.text_manipulation_history.append(text_manipulation_record)
        self.shared_state.last_text_manipulation_success = text_manipulation_record["success"]

        self.shared_state.step_number += 1

        if self.config.plugins.trajectory.save_trajectory != "none":
            emit_trajectory_step(
                self.trajectory,
                step_number=self.shared_state.step_number,
            )

        return ManagerInputEvent()

    @step
    async def run_executor(self, ctx: Context, ev: ExecutorInputEvent) -> ExecutorResultEvent:
        """
        Run Executor action phase.

        The Executor selects and executes a specific action for the current subgoal.
        """
        logger.debug("⚡ Running Executor for action...")

        # Run Executor workflow with profiling
        profiler = get_profiler()
        start_time = time.perf_counter()

        # Per-step timeout prevents a single LLM call from hanging forever.
        per_step_timeout = self.config.agent.per_step_timeout

        handler = self.executor_agent.run(subgoal=ev.current_subgoal)

        try:

            async def _run_executor_step():
                async for nested_ev in handler.stream_events():
                    from droiduse_backend.agent.utils.cancellation import check_cancellation

                    await check_cancellation(self.shared_state.cancellation_event)
                    self.handle_stream_event(nested_ev, ctx)
                return await handler

            result = await asyncio.wait_for(_run_executor_step(), timeout=per_step_timeout)
        except asyncio.TimeoutError:
            logger.error(f"Executor step timed out after {per_step_timeout}s")
            # Treat as a failed action so manager can re-plan
            result = {
                "action": "timeout",
                "outcome": False,
                "error": f"Executor step timed out after {per_step_timeout}s",
                "summary": "Step timed out waiting for LLM or device response",
            }

        # Record executor execution time
        duration_ms = (time.perf_counter() - start_time) * 1000
        profiler.record(Profiler.CATEGORY_AGENT, "executor_step", duration_ms)

        # Update coordination state after execution
        self.shared_state.action_history.append(result["action"])
        self.shared_state.summary_history.append(result["summary"])
        self.shared_state.action_outcomes.append(result["outcome"])
        self.shared_state.error_descriptions.append(result["error"])
        self.shared_state.last_action = result["action"]
        self.shared_state.last_summary = result["summary"]

        return ExecutorResultEvent(
            action=result["action"],
            outcome=result["outcome"],
            error=result["error"],
            summary=result["summary"],
        )

    @step
    async def handle_executor_result(
        self, ctx: Context, ev: ExecutorResultEvent
    ) -> ManagerInputEvent:
        """
        Process Executor result and continue.

        Checks for error escalation and loops back to Manager.
        Note: Max steps check is now done in run_manager pre-flight.
        """
        # Check error escalation and reset flag when errors are resolved
        err_thresh = self.shared_state.err_to_manager_thresh

        if len(self.shared_state.action_outcomes) >= err_thresh:
            latest = self.shared_state.action_outcomes[-err_thresh:]
            error_count = sum(1 for o in latest if not o)
            if error_count == err_thresh:
                logger.warning(f"⚠️ Error escalation: {err_thresh} consecutive errors")
                self.shared_state.error_flag_plan = True
            else:
                if self.shared_state.error_flag_plan:
                    logger.debug("✅ Error resolved - resetting error flag")
                self.shared_state.error_flag_plan = False

        self.shared_state.step_number += 1

        if self.config.plugins.trajectory.save_trajectory != "none":
            emit_trajectory_step(
                self.trajectory,
                step_number=self.shared_state.step_number,
            )

        return ManagerInputEvent()

    # ========================================================================
    # Script Executor Workflow Steps
    # ========================================================================

    @step
    async def run_scripter(
        self, ctx: Context, ev: ScripterExecutorInputEvent
    ) -> ScripterExecutorResultEvent:
        """
        Instantiate and run ScripterAgent for off-device operations.
        """
        logger.debug(f"🐍 Starting ScripterAgent for task: {ev.task[:2000]}...")

        # Profile ScripterAgent execution
        profiler = get_profiler()
        start_time = time.perf_counter()

        # Create fresh ScripterAgent instance for this task
        scripter_agent = ScripterAgent(
            llm=self.scripter_llm,
            agent_config=self.config.agent,
            shared_state=self.shared_state,
            task=ev.task,
            safe_execution_config=self.config.safe_execution,
            timeout=self.timeout,
        )

        # Run ScripterAgent workflow
        handler = scripter_agent.run()

        # Stream nested events
        async for nested_ev in handler.stream_events():
            # Check for cancellation
            from droiduse_backend.agent.utils.cancellation import check_cancellation

            await check_cancellation(self.shared_state.cancellation_event)

            self.handle_stream_event(nested_ev, ctx)

        result = await handler

        # Record scripter execution time
        duration_ms = (time.perf_counter() - start_time) * 1000
        profiler.record(Profiler.CATEGORY_AGENT, "scripter_step", duration_ms)

        # Store in shared state
        script_record = {
            "task": ev.task,
            "message": result["message"],
            "success": result["success"],
            "code_executions": result.get("code_executions", 0),
        }
        self.shared_state.scripter_history.append(script_record)
        self.shared_state.last_scripter_message = result["message"]
        self.shared_state.last_scripter_success = result["success"]

        return ScripterExecutorResultEvent(
            task=ev.task,
            message=result["message"],
            success=result["success"],
            code_executions=result.get("code_executions", 0),
        )

    @step
    async def handle_scripter_result(
        self, ctx: Context, ev: ScripterExecutorResultEvent
    ) -> ManagerInputEvent:
        """
        Process ScripterAgent result and loop back to Manager.
        """
        if ev.success:
            logger.debug(f"✅ Script completed successfully in {ev.code_executions} steps")
        else:
            logger.warning(f"⚠️ Script failed or reached max steps: {ev.message}")

        # Increment DroidAgent step counter
        self.shared_state.step_number += 1

        if self.config.plugins.trajectory.save_trajectory != "none":
            emit_trajectory_step(
                self.trajectory,
                step_number=self.shared_state.step_number,
            )

        # Loop back to Manager (script result in shared_state)
        return ManagerInputEvent()

    # ========================================================================
    # End Manager/Executor/Script Workflow Steps
    # ========================================================================

    @step
    async def finalize(self, ctx: Context, ev: FinalizeEvent) -> StopEvent:
        ctx.write_event_to_stream(ev)

        # Emit agent finalize telemetry via plugin system (fire-and-forget)
        # The PostHog plugin handles flushing automatically after this event
        emit_agent_finalize(
            success=ev.success,
            reason=ev.reason,
            steps=self.shared_state.step_number,
            unique_packages_count=len(self.shared_state.visited_packages),
            unique_activities_count=len(self.shared_state.visited_activities),
            user_id=self.user_id,
        )

        # Base result dictionary
        result_dict = {
            "success": ev.success,
            "reason": ev.reason,
            "steps": self.shared_state.step_number,
            "structured_output": None,
        }

        # Extract structured output if model was provided
        if self.output_model is not None and ev.reason:
            logger.debug("🔄 Running structured output extraction...")

            try:
                structured_agent = StructuredOutputAgent(
                    llm=self.structured_output_llm,
                    pydantic_model=self.output_model,
                    answer_text=ev.reason,
                    timeout=self.timeout,
                )

                handler = structured_agent.run()

                # Stream nested events
                async for nested_ev in handler.stream_events():
                    # Check for cancellation
                    from droiduse_backend.agent.utils.cancellation import check_cancellation

                    await check_cancellation(self.shared_state.cancellation_event)

                    self.handle_stream_event(nested_ev, ctx)

                extraction_result = await handler

                if extraction_result["success"]:
                    result_dict["structured_output"] = extraction_result["structured_output"]
                    logger.debug("✅ Structured output added to final result")
                else:
                    logger.warning(
                        f"⚠️  Structured extraction failed: {extraction_result['error_message']}"
                    )

            except Exception as e:
                logger.error(f"❌ Error during structured extraction: {e}")
                if self.config.logging.debug:
                    import traceback

                    logger.error(traceback.format_exc())

        # Capture final screenshot before saving trajectory
        if self.config.plugins.trajectory.save_trajectory != "none":
            try:
                screenshot_result = await self.tools_instance.take_screenshot()
                vision_any = (
                    self.config.agent.manager.vision
                    or self.config.agent.executor.vision
                    or self.config.agent.codeact.vision
                )

                if isinstance(screenshot_result, tuple):
                    success, screenshot = screenshot_result
                    if success and screenshot:
                        ctx.write_event_to_stream(ScreenshotEvent(screenshot=screenshot))
                        # Emit screenshot to plugins (fire-and-forget)
                        emit_screenshot(
                            screenshot,
                            vision_enabled=vision_any,
                            screenshots_enabled=self.config.plugins.tracing.screenshots_enabled,
                        )
                        logger.debug("📸 Final screenshot captured")
                elif screenshot_result:
                    ctx.write_event_to_stream(ScreenshotEvent(screenshot=screenshot_result))
                    # Emit screenshot to plugins (fire-and-forget)
                    emit_screenshot(
                        screenshot_result,
                        vision_enabled=vision_any,
                        screenshots_enabled=self.config.plugins.tracing.screenshots_enabled,
                    )
                    logger.debug("📸 Final screenshot captured")
            except Exception as e:
                logger.warning(f"Failed to capture final screenshot: {e}")

            logger.info(f"📁 Trajectory saved: {self.trajectory.trajectory_folder}")

        # Emit task end event with trajectory final (fire-and-forget)
        trajectory_path = None
        trajectory_for_end = None
        if self.config.plugins.trajectory.save_trajectory != "none":
            if hasattr(self.trajectory, "trajectory_folder"):
                trajectory_path = str(self.trajectory.trajectory_folder)
            trajectory_for_end = self.trajectory

        # Stop profiler and collect execution summary before emitting task end
        profiling_summary = None
        if hasattr(self, "profiler") and self.profiler:
            self.profiler.stop()
            profiling_summary = self.profiler.get_summary()
            self.profiler.print_summary()

        task_status = "COMPLETED" if ev.success else "FAILED"
        emit_task_end(
            status=task_status,
            success=ev.success,
            reason=ev.reason,
            error=ev.reason if not ev.success else None,
            total_steps=self.shared_state.step_number,
            trajectory_path=trajectory_path,
            trajectory=trajectory_for_end,
            create_gif=self.config.plugins.trajectory.create_gifs,
            profiling_summary=profiling_summary,
            jwt_token=self.jwt_token,
            device_id=self.shared_state.device_id,
            connection_id=self.shared_state.connection_id,
        )

        # Cleanup pending requests to prevent orphaned futures
        try:
            if self.tools_instance and hasattr(self.tools_instance, "cleanup"):
                await self.tools_instance.cleanup()
        except Exception as e:
            logger.warning(f"⚠️ Failed to cleanup tool pending requests: {e}")

        # Cleanup WebSocket connection
        try:
            if self.tools_instance and hasattr(self.tools_instance, "portal"):
                if hasattr(self.tools_instance.portal, "ws_client"):
                    await self.tools_instance.portal.ws_client.disconnect()
                    logger.debug("🔌 WebSocket connection closed")
        except Exception as e:
            logger.warning(f"⚠️ Failed to close WebSocket connection: {e}")

        self.tools_instance._set_context(None)

        # Shutdown plugin manager (waits for pending tasks with timeout)
        # await self.plugin_manager.shutdown(timeout=10.0)

        # Emit ResultEvent for streaming (so clients can see it)
        result_event = ResultEvent(
            success=result_dict["success"],
            reason=result_dict["reason"],
            steps=result_dict["steps"],
            structured_output=result_dict["structured_output"],
        )
        ctx.write_event_to_stream(result_event)

        # Return StopEvent with result dict for workflow termination
        return StopEvent(result=result_dict)

    def handle_stream_event(self, ev: Event, ctx: Context):
        if not isinstance(ev, StopEvent):
            ctx.write_event_to_stream(ev)

            if isinstance(ev, ScreenshotEvent):
                # Only save screenshots to trajectory if save_trajectories is enabled
                if (
                    hasattr(self, "tools_instance")
                    and hasattr(self.tools_instance, "save_trajectories")
                    and self.tools_instance.save_trajectories != "none"
                ):
                    self.trajectory.screenshot_queue.append(ev.screenshot)
                    self.trajectory.screenshot_count += 1
            elif isinstance(ev, MacroEvent):
                self.trajectory.macro.append(ev)
            elif isinstance(ev, RecordUIStateEvent):
                self.trajectory.ui_states.append(ev.ui_state)
            else:
                self.trajectory.events.append(ev)
