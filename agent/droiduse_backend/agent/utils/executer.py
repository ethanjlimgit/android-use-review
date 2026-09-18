import asyncio
import contextlib
import contextvars
import io
import logging
import threading
import traceback
from typing import Any, Dict, Optional, Set

from pydantic import BaseModel, ConfigDict

from droiduse_backend.agent.utils.cancellation import is_cancellation_error
from droiduse_backend.config_manager.safe_execution import (
    create_safe_builtins,
    create_safe_import,
)

logger = logging.getLogger("androiduse")


class ExecuterState(BaseModel):
    """State object for the code executor."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    ui_state: Optional[Any] = None


class SimpleCodeExecutor:
    """
    A simple code executor that runs Python code with state persistence.

    This executor maintains a global and local state between executions,
    allowing for variables to persist across multiple code runs.

    NOTE: not safe for production use! Use with caution.
    """

    def __init__(
        self,
        locals: Dict[str, Any] = None,
        globals: Dict[str, Any] = None,
        tools=None,
        use_same_scope: bool = True,
        safe_mode: bool = False,
        allowed_modules: Optional[Set[str]] = None,
        blocked_modules: Optional[Set[str]] = None,
        allowed_builtins: Optional[Set[str]] = None,
        blocked_builtins: Optional[Set[str]] = None,
        event_loop=None,
        track_actions: bool = False,
    ):
        """
        Initialize the code executor.

        Args:
            locals: Local variables to use in the execution context
            globals: Global variables to use in the execution context
            tools: Dict or list of tools available for execution
            use_same_scope: Whether to use the same scope for globals and locals
            safe_mode: Enable restricted execution (limited builtins/imports)
            allowed_modules: Set of allowed modules (None = allow all, empty = allow none)
            blocked_modules: Set of blocked modules (takes precedence)
            allowed_builtins: Set of allowed builtins (None = allow all, empty = use defaults)
            blocked_builtins: Set of blocked builtins (takes precedence)
            event_loop: Event loop for async tool execution
            track_actions: Whether to track tool calls during execution
        """
        if locals is None:
            locals = {}
        if globals is None:
            globals = {}
        if tools is None:
            tools = {}

        self.safe_mode = safe_mode
        self.track_actions = track_actions
        self._thread_local = threading.local()
        self._event_loop = event_loop
        self._action_calls = []  # Track tool calls during execution

        # Setup builtins based on safe mode
        if safe_mode:
            logger.debug("🔒 Safe execution mode enabled")
            if allowed_modules is not None and not allowed_modules:
                logger.debug("   No imports allowed (allowed_modules is empty)")
            elif allowed_modules is not None:
                logger.debug(f"   Allowed modules: {allowed_modules}")
            else:
                logger.debug("   All imports allowed (except blocked)")
            logger.debug(f"   Blocked modules: {blocked_modules or 'none'}")
            logger.debug(f"   Blocked builtins: {blocked_builtins or 'none'}")

            # Create restricted builtins
            safe_builtins_dict = create_safe_builtins(allowed_builtins, blocked_builtins)

            # Add safe import function
            safe_builtins_dict["__import__"] = create_safe_import(allowed_modules, blocked_modules)

            globals["__builtins__"] = safe_builtins_dict
        else:
            # No restrictions - current behavior
            globals["__builtins__"] = __builtins__

        # Add tools to globals (always allowed, even in safe mode)
        if isinstance(tools, dict):
            logger.debug(f"🔧 Initializing SimpleCodeExecutor with tools: {list(tools.keys())}")
            wrapped_tools = self._wrap_tools_dict(tools)
            globals.update(wrapped_tools)
        elif isinstance(tools, list):
            logger.debug(f"🔧 Initializing SimpleCodeExecutor with {len(tools)} tools")
            wrapped_tools = self._wrap_tools_list(tools)
            for tool in wrapped_tools:
                globals[tool.__name__] = tool
        else:
            raise ValueError("Tools must be a dictionary or a list of functions.")

        self.globals = globals
        self.locals = locals
        self.use_same_scope = use_same_scope

        if self.use_same_scope:
            # If using the same scope, merge globals and locals
            self.globals = self.locals = {
                **self.locals,
                **{k: v for k, v in self.globals.items() if k not in self.locals},
            }

    def _wrap_tools_dict(self, tools_dict: dict) -> dict:
        """Wrap async tools in dict format."""
        wrapped = {}
        for name, func in tools_dict.items():
            wrapped[name] = self._wrap_single_tool(func, name)
        return wrapped

    def _wrap_tools_list(self, tools_list: list) -> list:
        """Wrap async tools in list format."""
        return [self._wrap_single_tool(tool, tool.__name__) for tool in tools_list]

    def _wrap_single_tool(self, func, tool_name: str = None):
        """Wrap a single tool function if async, and optionally track calls."""
        # Get the original function name if not provided
        if tool_name is None:
            tool_name = getattr(func, "__name__", "unknown")

        if not asyncio.iscoroutinefunction(func):
            # Synchronous function
            if not self.track_actions:
                return func

            def sync_tracked_wrapper(*args, **kwargs):
                result = func(*args, **kwargs)
                # Track the call
                self._action_calls.append(
                    {
                        "type": tool_name,
                        "args": args,
                        "kwargs": kwargs,
                    }
                )
                return result

            return sync_tracked_wrapper

        # Async function - needs wrapping
        def sync_wrapper(*args, **kwargs):
            def create_and_schedule():
                async def run_with_context():
                    try:
                        result = await func(*args, **kwargs)
                        # Track the call if enabled
                        if self.track_actions:
                            self._action_calls.append(
                                {
                                    "type": tool_name,
                                    "args": args,
                                    "kwargs": kwargs,
                                }
                            )
                        return result
                    except Exception as e:
                        raise

                if self._event_loop is None:
                    raise RuntimeError(
                        "Event loop not set on executor. Call executor._event_loop = loop before execution."
                    )
                future = asyncio.run_coroutine_threadsafe(run_with_context(), self._event_loop)
                try:
                    result = future.result()
                    logger.debug(f"✓ Tool {tool_name}() completed successfully")
                    return result
                except Exception as e:
                    raise

            ctx = self.get_current_context()
            if ctx is not None:
                return ctx.run(create_and_schedule)
            else:
                return create_and_schedule()

        return sync_wrapper

    def get_current_context(self) -> Optional[contextvars.Context]:
        """Get context for current execution."""
        return getattr(self._thread_local, "context", None)

    def _execute_in_thread(self, code: str, ui_state: Any, ctx: contextvars.Context = None) -> str:
        """Execute code in thread with context propagation."""
        self.globals["ui_state"] = ui_state

        if ctx is not None:
            self._thread_local.context = ctx

        stdout = io.StringIO()
        stderr = io.StringIO()

        output = ""
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                exec(code, self.globals, self.locals)

            output = stdout.getvalue()
            if stderr.getvalue():
                output += "\n" + stderr.getvalue()

        except Exception as e:
            # Re-raise cancellation errors so they propagate up to stop the workflow
            if is_cancellation_error(e):
                if ctx is not None:
                    self._thread_local.context = None
                raise
            # Handle other exceptions
            logger.debug(f"Exception in _execute_in_thread: {type(e).__name__}: {str(e)}")
            output = f"Error: {type(e).__name__}: {str(e)}\n"
            output += traceback.format_exc()
        finally:
            if ctx is not None:
                self._thread_local.context = None

        return output

    def clear_action_calls(self):
        """Clear tracked action calls."""
        self._action_calls = []

    def get_action_calls(self) -> list[dict]:
        """Get all tracked action calls."""
        return self._action_calls.copy()

    async def execute(self, state: ExecuterState, code: str, timeout: float = 50.0) -> str:
        """Execute code in thread and return output."""
        # Clear previous action calls if tracking is enabled
        if self.track_actions:
            self.clear_action_calls()

        loop = asyncio.get_running_loop()
        ui_state = state.ui_state
        ctx = contextvars.copy_context()

        if self._event_loop is None:
            self._event_loop = loop

        try:
            logger.debug("⏳ About to await executor...")
            output = await asyncio.wait_for(
                loop.run_in_executor(None, self._execute_in_thread, code, ui_state, ctx),
                timeout=timeout,
            )
            logger.debug(f"✓ Code execution completed, output length: {len(output)}")
            return output
        except BaseException as e:  # Catch ALL exceptions including CancelledError
            # Re-raise cancellation errors to stop the workflow
            if is_cancellation_error(e):
                raise
            # Handle specific exception types
            if isinstance(e, asyncio.TimeoutError):
                logger.warning(f"⏰ Execution timed out after {timeout} seconds")
                return f"Error: Execution timed out after {timeout} seconds"
            # Re-raise other exceptions
            logger.error(f"❌ Unexpected error in execute(): {type(e).__name__}: {str(e)[:100]}")
            raise
