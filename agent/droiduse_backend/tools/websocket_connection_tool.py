"""
WebSocket Connection Tool - Uses an existing WebSocket connection for device control.

This tool is used when the phone initiates a connection to the backend.
All device commands are sent through the existing connection instead of
creating a new client connection.
"""

import asyncio
import base64
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from websockets.server import WebSocketServerProtocol

from droiduse_backend.observability.profiler import Profiler, get_profiler
from droiduse_backend.tools.device import Device
from droiduse_backend.tools.filters import ConciseFilter, DetailedFilter, TreeFilter
from droiduse_backend.tools.formatters import IndexedFormatter, TreeFormatter
from droiduse_backend.tools.tools import Tools

logger = logging.getLogger("androiduse")


class WebSocketConnectionTool(Tools):
    """
    Tool implementation that uses an existing WebSocket connection.

    Used when the phone initiates the connection to the backend server.
    All communication happens through the shared WebSocket connection.
    """

    def __init__(
        self,
        websocket: WebSocketServerProtocol,
        app_opener_llm=None,
        text_manipulator_llm=None,
        credential_manager=None,
        tree_filter: TreeFilter = None,
        tree_formatter: TreeFormatter = None,
        vision_enabled: bool = True,
        streaming: bool = False,
        cancellation_event: "asyncio.Event | None" = None,
    ) -> None:
        """
        Initialize WebSocket connection tool.

        Args:
            websocket: Active WebSocket connection from the phone
            app_opener_llm: LLM instance for app opening workflow (optional)
            text_manipulator_llm: LLM instance for text manipulation (optional)
            credential_manager: CredentialManager instance for secret handling (optional)
            tree_filter: Filter for accessibility tree (default: based on vision_enabled)
            tree_formatter: Formatter for filtered tree (default: IndexedFormatter)
            vision_enabled: Whether vision is enabled (default: True)
            streaming: Whether to stream LLM responses to console (default: False)
            cancellation_event: Optional event to signal task cancellation
        """
        self.websocket = websocket
        self.device = Device(address="websocket-connection", name="phone")
        self._connected = True

        # Request/response tracking
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._request_lock = asyncio.Lock()

        self._ctx = None
        self.cancellation_event = cancellation_event
        # Instance-level cache for clickable elements
        self.clickable_elements_cache: List[Dict[str, Any]] = []
        self.reason = None
        self.success = None
        self.finished = False
        self.memory: List[str] = []
        self.save_trajectories = "none"

        # LLM instances
        self.app_opener_llm = app_opener_llm
        self.text_manipulator_llm = text_manipulator_llm
        self.streaming = streaming

        # Credential manager
        self.credential_manager = credential_manager

        # Tree filter/formatter
        if tree_filter:
            self.tree_filter = tree_filter
        else:
            self.tree_filter = ConciseFilter() if vision_enabled else DetailedFilter()
            logger.debug(
                f"Selected {self.tree_filter.__class__.__name__} (vision_enabled={vision_enabled})"
            )

        self.tree_formatter = tree_formatter or IndexedFormatter()

        # Caches
        self.raw_tree_cache = None
        self.filtered_tree_cache = None
        self._last_state_update: Optional[float] = None  # Timestamp of last state update
        self._cached_formatted_state: Optional[
            Tuple[str, str, List[Dict[str, Any]], Dict[str, Any]]
        ] = None

        # Date caching - fetch from device only once, then calculate on server
        self._initial_device_date: Optional[str] = None
        self._initial_server_time: Optional[float] = None

        # Device command tracking for replay recording
        self._device_commands: List[Dict[str, Any]] = []

    async def cleanup(self) -> None:
        """Cancel all pending request futures and clear the tracking dict.

        Should be called when a task ends (success, failure, or timeout) to
        prevent orphaned futures from accumulating.
        """
        async with self._request_lock:
            pending_count = len(self._pending_requests)
            if pending_count > 0:
                logger.info(f"Cleaning up {pending_count} pending request(s)")
            for _request_id, future in self._pending_requests.items():
                if not future.done():
                    future.cancel()
            self._pending_requests.clear()

    async def connect(self) -> None:
        """Connection already established (phone connected to us)."""
        logger.debug("Using existing WebSocket connection from phone")

    async def _ensure_connected(self) -> None:
        """Check if WebSocket is still connected."""
        # The websocket is provided externally and managed by the server
        if self.websocket is None:
            raise ConnectionError("WebSocket is not initialized")

        # Check if connection is closed
        if self.websocket.closed:
            raise ConnectionError("WebSocket connection is closed. Phone may have disconnected.")

    async def _wait_with_cancellation(self, future: asyncio.Future, timeout: float) -> Any:
        """
        Wait for a future with timeout, while also checking for cancellation.

        This allows cancellation to be detected immediately instead of waiting
        for the full timeout period.

        Args:
            future: Future to wait for
            timeout: Maximum time to wait in seconds

        Returns:
            Result from the future

        Raises:
            asyncio.CancelledError: If cancellation is requested
            asyncio.TimeoutError: If timeout expires before response
        """
        # Use instance cancellation event
        if not self.cancellation_event:
            # No cancellation support, just use regular wait_for
            return await asyncio.wait_for(future, timeout=timeout)

        # Create a task that completes when cancellation is requested
        async def wait_for_cancellation():
            while not self.cancellation_event.is_set():
                await asyncio.sleep(0.1)  # Check every 100ms
            logger.debug("🛑 Cancellation detected during WebSocket request wait")
            raise asyncio.CancelledError()

        cancellation_task = asyncio.create_task(wait_for_cancellation())
        response_task = asyncio.create_task(asyncio.wait_for(future, timeout=timeout))

        try:
            # Wait for either response or cancellation
            done, pending = await asyncio.wait(
                {response_task, cancellation_task}, return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel pending tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            # Return result from completed task (this will raise if it's the cancellation)
            completed_task = done.pop()
            return await completed_task

        except Exception:
            # Clean up tasks on any error
            for task in [response_task, cancellation_task]:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            raise

    def _set_context(self, ctx):
        """Set the workflow context for event emission."""
        self._ctx = ctx

    def _update_state_cache(self, state_data: Dict[str, Any]) -> None:
        """
        Update state caches from action response data.

        Args:
            state_data: State data containing a11y_tree and phone_state
        """
        if not isinstance(state_data, dict):
            logger.warning(f"Invalid state data type: {type(state_data)}")
            return

        # Check if response has required keys
        if "a11y_tree" not in state_data or "phone_state" not in state_data:
            logger.warning(
                f"State data missing required keys. Available: {list(state_data.keys())}"
            )
            return

        # Use device_context if available
        device_context = state_data.get("device_context", {})

        # Update raw tree cache
        self.raw_tree_cache = state_data["a11y_tree"]

        # Filter tree
        self.filtered_tree_cache = self.tree_filter.filter(self.raw_tree_cache, device_context)

        # Format tree
        formatted_text, focused_text, a11y_tree, phone_state = self.tree_formatter.format(
            self.filtered_tree_cache, state_data["phone_state"]
        )
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("Formatted state:\n%s", formatted_text)

        # Cache clickable elements for tap_by_index
        self.clickable_elements_cache = a11y_tree

        # Cache the formatted state tuple
        self._cached_formatted_state = (formatted_text, focused_text, a11y_tree, phone_state)

        # Update cache timestamp
        self._last_state_update = time.perf_counter()

        logger.debug("State cache updated from action response")

    # Methods that are read-only queries (not recorded for replay)
    _READ_ONLY_METHODS = frozenset(
        {
            "state_full",
            "screenshot",
            "apps",
            "packages",
            "date",
            "time",
            "version",
            "overlay_offset",
        }
    )

    # Semantic methods that find elements by text/description (retryable during replay)
    _SEMANTIC_METHODS = frozenset(
        {
            "find_and_click",
            "find_and_input",
            "find_and_long_press",
            "open_app",
        }
    )

    async def _send_request(self, method: str, params: dict = None) -> Any:
        """
        Send JSON-RPC request through WebSocket and await response.

        Args:
            method: Method name (e.g., "click", "screenshot", "state_full")
            params: Parameters dictionary

        Returns:
            Response data
        """
        await self._ensure_connected()
        profiler = get_profiler()

        if params is None:
            params = {}

        # Record action commands for replay (skip read-only queries)
        if method not in self._READ_ONLY_METHODS:
            action_type = "semantic" if method in self._SEMANTIC_METHODS else "coordinate"
            self._device_commands.append(
                {
                    "method": method,
                    "params": dict(params),  # shallow copy to avoid mutation
                    "type": action_type,
                }
            )

        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Build JSON-RPC request
        request = {"id": request_id, "method": method, "params": params}

        # Create future for response
        future = asyncio.Future()
        async with self._request_lock:
            self._pending_requests[request_id] = future

        start_time = time.perf_counter()
        try:
            # Send request
            await self.websocket.send(json.dumps(request))
            logger.debug("Sent command: %s params=%s", method, params)

            # Wait for response with timeout
            # Longer timeouts for operations that can be slow
            if method == "screenshot":
                timeout = 15.0
            elif method in ("app/start", "apps", "app/stop"):
                timeout = 20.0  # App operations can be slow on some devices
            else:
                timeout = 10.0

            # Wait for response while also checking for cancellation
            result = await self._wait_with_cancellation(future, timeout)

            # Record network latency
            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(
                Profiler.CATEGORY_NETWORK,
                f"ws_{method}",
                duration_ms,
                {"method": method, "timeout": timeout},
            )

            return result

        except asyncio.TimeoutError as e:
            async with self._request_lock:
                self._pending_requests.pop(request_id, None)

            # Log diagnostic info to help debug
            pending_count = len(self._pending_requests)
            is_connected = self.websocket and not self.websocket.closed
            logger.error(
                f"Request '{method}' timed out after {timeout}s. "
                f"Pending requests: {pending_count}, WebSocket connected: {is_connected}"
            )

            raise TimeoutError(
                f"Request '{method}' timed out after {timeout}s. "
                f"Phone may not be responding or command not implemented."
            ) from e

        except Exception:
            async with self._request_lock:
                self._pending_requests.pop(request_id, None)
            raise

    async def handle_response(self, message: str) -> None:
        """
        Handle response message from phone.

        Args:
            message: JSON string response from phone
        """
        try:
            data = json.loads(message)

            # Log response for debugging (truncated if too long)
            if logger.isEnabledFor(logging.DEBUG):
                msg_preview = message[:500] if len(message) > 500 else message
                logger.debug(f"📥 Received phone response: {msg_preview}")

            # Check if it's a response (has 'id' field)
            if "id" in data:
                request_id = data["id"]

                # Find pending request
                async with self._request_lock:
                    future = self._pending_requests.pop(request_id, None)

                if future and not future.done():
                    # Check status
                    status = data.get("status")

                    if status == "success":
                        # Extract result, handle None case
                        result = data.get("result")
                        if result is None:
                            logger.warning(
                                f"Response has status=success but result is None. Full data: {data}"
                            )
                            # Still set the result, let caller handle None
                        future.set_result(result)
                        logger.debug(f"Response received for request {request_id[:8]}...")

                    elif status == "error":
                        error = data.get("error", "Unknown error")
                        future.set_exception(RuntimeError(f"Phone error: {error}"))
                        logger.error(f"Error response: {error}")

                    else:
                        # No status field or unknown status
                        # Android might send data directly without status wrapper
                        # Return the entire data object for caller to parse
                        logger.debug("Response without status field, returning full data object")
                        future.set_result(data)
                else:
                    logger.warning(f"No pending request found for response {request_id[:8]}...")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Invalid JSON: {message[:200]}")

        except Exception as e:
            logger.error(f"Error handling response: {e}", exc_info=True)

    async def handle_binary_response(self, data: bytes) -> None:
        """
        Handle binary response (e.g., screenshot).

        Args:
            data: Binary data with UUID prefix (36 bytes) + payload
        """
        if len(data) < 36:
            logger.warning(f"Binary response too short: {len(data)} bytes")
            return

        try:
            # Extract request ID (first 36 bytes)
            request_id = data[:36].decode("utf-8")
            binary_payload = data[36:]

            # Find pending request
            async with self._request_lock:
                future = self._pending_requests.pop(request_id, None)

            if future and not future.done():
                future.set_result(binary_payload)
                logger.debug(f"Binary response received for request {request_id[:8]}...")
            else:
                # This can happen when late audio packets arrive after transcription ends
                # or when binary data arrives for an already-completed request
                logger.debug(f"No pending request found for binary response {request_id[:8]}...")

        except Exception as e:
            logger.error(f"Error handling binary response: {e}")

    # Implement Tools interface methods

    async def get_state(
        self, force_fresh: bool = False
    ) -> Tuple[str, str, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Get device state with filtering and formatting.

        Args:
            force_fresh: If True, bypass cache and fetch fresh state

        Returns:
            Tuple of (formatted_text, focused_text, a11y_tree, phone_state)
        """
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        # Check if we have a recent cached state from auto-reply (within 500ms)
        CACHE_TTL_SECONDS = 0.5  # 500ms cache TTL
        if (
            not force_fresh
            and self._cached_formatted_state is not None
            and self._last_state_update is not None
        ):
            cache_age = time.perf_counter() - self._last_state_update
            if cache_age < CACHE_TTL_SECONDS:
                logger.debug(f"Using cached state from auto-reply (age: {cache_age*1000:.0f}ms)")
                # Still record profiling time (though it's negligible)
                duration_ms = (time.perf_counter() - start_time) * 1000
                profiler.record(Profiler.CATEGORY_TOOL, "get_state_cached", duration_ms)
                return self._cached_formatted_state

        # Cache miss or stale - fetch fresh state with retry for transient errors.
        # "No active window" can happen during activity transitions; waiting
        # a short time and retrying usually resolves it.
        MAX_STATE_RETRIES = 3
        RETRY_DELAY = 1.0  # seconds

        result = None
        for attempt in range(1, MAX_STATE_RETRIES + 1):
            try:
                logger.debug(
                    "Fetching fresh state from device (attempt %d/%d)", attempt, MAX_STATE_RETRIES
                )
                result = await self._send_request("state_full", {})
                break  # success
            except RuntimeError as e:
                if "No active window" in str(e) and attempt < MAX_STATE_RETRIES:
                    logger.warning(
                        "No active window on attempt %d/%d, retrying in %.1fs...",
                        attempt,
                        MAX_STATE_RETRIES,
                        RETRY_DELAY,
                    )
                    await asyncio.sleep(RETRY_DELAY)
                else:
                    raise

        logger.debug(f"get_state received result type: {type(result)}")
        logger.debug(
            f"get_state result keys: {result.keys() if isinstance(result, dict) else 'not a dict'}"
        )

        # Handle None result
        if result is None:
            raise Exception(
                "Received None response from state_full request. Check Android side implementation."
            )

        # Parse nested response format
        combined_data = result

        # Case 1: Response has nested "result" field (wrapped format)
        if isinstance(result, dict) and "result" in result:
            logger.debug("Response has nested 'result' field")
            if isinstance(result["result"], str):
                logger.debug("Nested result is a JSON string, parsing...")
                combined_data = json.loads(result["result"])
            else:
                logger.debug("Nested result is a dict, using directly")
                combined_data = result["result"]

        # Case 2: Response is the data directly (no wrapper)
        elif isinstance(result, dict):
            logger.debug("Response is a dict without 'result' wrapper, using directly")
            combined_data = result

        # Case 3: Unexpected format
        else:
            raise Exception(
                f"Unexpected response format. Type: {type(result)}, Value: {str(result)[:200]}"
            )

        logger.debug(
            f"combined_data keys: {combined_data.keys() if isinstance(combined_data, dict) else 'not a dict'}"
        )

        # Validate response has required keys
        if not isinstance(combined_data, dict):
            raise Exception(f"Expected combined_data to be dict, got {type(combined_data)}")

        if "a11y_tree" not in combined_data or "phone_state" not in combined_data:
            raise Exception(
                f"Missing a11y_tree or phone_state in response. Available keys: {list(combined_data.keys())}"
            )

        # Use device_context if available, otherwise empty dict
        device_context = combined_data.get("device_context", {})

        # Cache raw tree
        self.raw_tree_cache = combined_data["a11y_tree"]

        # Filter tree
        self.filtered_tree_cache = self.tree_filter.filter(self.raw_tree_cache, device_context)

        # Format tree
        formatted_text, focused_text, a11y_tree, phone_state = self.tree_formatter.format(
            self.filtered_tree_cache, combined_data["phone_state"]
        )
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("Formatted state:\n%s", formatted_text)

        # Cache clickable elements for tap_by_index
        self.clickable_elements_cache = a11y_tree

        # Cache the formatted state tuple
        self._cached_formatted_state = (formatted_text, focused_text, a11y_tree, phone_state)
        self._last_state_update = time.perf_counter()

        # Record tool execution time
        duration_ms = (time.perf_counter() - start_time) * 1000
        profiler.record(Profiler.CATEGORY_TOOL, "get_state", duration_ms)

        return (formatted_text, focused_text, a11y_tree, phone_state)

    async def input_text(self, text: str, index: int = -1, clear: bool = False) -> str:
        """Input text via keyboard.

        Args:
            text: The text to input
            index: Element index to tap before typing (-1 to skip tap)
            clear: Whether to clear existing text before typing

        Returns:
            Result message
        """
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            # Tap the element first if index is provided (no state cache update needed)
            if index >= 0:
                try:
                    x, y = self._extract_element_coordinates_by_index(index)
                    await self._send_request("click", {"x": x, "y": y})
                    logger.debug(f"Tapped element at index {index} at ({x}, {y}) before typing")
                except ValueError as e:
                    return f"Error: {str(e)}"

            encoded = base64.b64encode(text.encode()).decode()
            params = {"base64_text": encoded, "clear": clear}

            result = await self._send_request("keyboard/input", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from keyboard/input action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "input_text", duration_ms)

            logger.debug("Text input successful")
            return f"Text '{text}' input successfully"

        except Exception as e:
            logger.error(f"Input text error: {e}")
            return f"Failed to input text: {e}"

    async def take_screenshot(self, hide_overlay: bool = True) -> Tuple[str, bytes]:
        """Take screenshot of device."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {"hideOverlay": hide_overlay}

            binary_data = await self._send_request("screenshot", params)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "take_screenshot", duration_ms)

            # If response is base64-encoded JSON (dict with "data" key)
            if isinstance(binary_data, dict):
                if binary_data.get("status") == "success" and "data" in binary_data:
                    image_bytes = base64.b64decode(binary_data["data"])
                    logger.debug("Screenshot captured (base64 dict)")
                    return ("PNG", image_bytes)

            # If response is raw binary
            if isinstance(binary_data, bytes):
                logger.debug("Screenshot captured (binary)")
                return ("PNG", binary_data)

            # If response is a base64-encoded string directly
            if isinstance(binary_data, str):
                image_bytes = base64.b64decode(binary_data)
                logger.debug("Screenshot captured (base64 string)")
                return ("PNG", image_bytes)

            raise ValueError(f"Invalid screenshot response format: {type(binary_data)}")

        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            raise

    async def tap(self, x: int, y: int) -> bool:
        """Tap at coordinates."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {"x": x, "y": y}
            result = await self._send_request("click", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from tap action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "tap", duration_ms)

            logger.debug(f"Tap successful at ({x}, {y})")
            return True

        except Exception as e:
            logger.error(f"Tap error: {e}")
            return False

    async def swipe(
        self,
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        duration_ms: int = 1000,
    ) -> bool:
        """Swipe from start to end coordinates."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {
                "startX": start_x,
                "startY": start_y,
                "endX": end_x,
                "endY": end_y,
                "duration": duration_ms / 1000.0,  # Convert to seconds
            }

            result = await self._send_request("swipe", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from swipe action")
                self._update_state_cache(result)

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "swipe", elapsed_ms)

            logger.debug(f"Swipe successful from ({start_x}, {start_y}) to ({end_x}, {end_y})")
            return True

        except Exception as e:
            logger.error(f"Swipe error: {e}")
            return False

    async def press_key(self, keycode: int) -> str:
        """Press a key by keycode."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {"keycode": keycode}
            result = await self._send_request("keyevent", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from keyevent action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "press_key", duration_ms)

            logger.debug(f"Keyevent successful: {keycode}")
            return f"Key {keycode} pressed successfully"

        except Exception as e:
            logger.error(f"Keyevent error: {e}")
            return f"Failed to press key: {e}"

    async def start_app(self, package: str, activity: str = "") -> str:
        """Start an app."""
        await self._ensure_connected()

        try:
            params = {"package": package}
            if activity:
                params["activity"] = activity

            result = await self._send_request("app/start", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from app/start action")
                self._update_state_cache(result)

            logger.debug(f"App start successful: {package}")
            return f"Started app: {package}"

        except Exception as e:
            logger.error(f"App start error: {e}")
            return f"Failed to start app: {e}"

    async def get_installed_apps(self, include_system: bool = False) -> List[Dict[str, str]]:
        """Get installed apps."""
        await self._ensure_connected()

        try:
            result = await self._send_request("apps", {})

            apps = result.get("apps", []) if isinstance(result, dict) else result

            if not include_system:
                apps = [app for app in apps if not app.get("isSystemApp", False)]

            return [
                {
                    "package": app.get("packageName", ""),
                    "label": app.get("label", ""),
                }
                for app in apps
            ]

        except Exception as e:
            logger.error(f"Error getting apps: {e}")
            return []

    # Additional required methods for Tools interface

    async def get_apps(self, include_system: bool = True) -> List[Dict[str, str]]:
        """Get installed apps (alias for get_installed_apps)."""
        return await self.get_installed_apps(include_system)

    async def get_date(self) -> str:
        """
        Get device date/time.

        Fetches the date from the device only once on first call,
        then calculates subsequent times on the server to reduce
        WebSocket calls.
        """
        # If we already have the initial date, calculate current time on server
        if self._initial_device_date is not None and self._initial_server_time is not None:
            elapsed_seconds = time.time() - self._initial_server_time
            try:
                # Parse the initial device date
                initial_dt = datetime.fromisoformat(
                    self._initial_device_date.replace("Z", "+00:00")
                )
                current_dt = initial_dt + timedelta(seconds=elapsed_seconds)
                return current_dt.isoformat()
            except (ValueError, AttributeError) as e:
                logger.warning(f"Failed to calculate date from cache: {e}, fetching fresh")
                # Reset cache and fetch fresh
                self._initial_device_date = None
                self._initial_server_time = None

        # First call - fetch from device and cache
        await self._ensure_connected()

        try:
            result = await self._send_request("date", {})

            if isinstance(result, dict):
                if "data" in result:
                    device_date = result["data"]
                else:
                    device_date = result.get("status", "unknown")
            else:
                device_date = str(result) if result else "unknown"

            # Cache the initial date and server time
            if device_date and device_date != "unknown":
                self._initial_device_date = device_date
                self._initial_server_time = time.time()
                logger.debug(f"Cached initial device date: {device_date}")

            return device_date

        except Exception as e:
            logger.warning(f"Failed to get date from device: {e}")
            return "unknown"

    async def list_packages(self, include_system_apps: bool = False) -> List[str]:
        """List installed packages."""
        await self._ensure_connected()

        try:
            params = {}
            if include_system_apps:
                params["includeSystem"] = True

            result = await self._send_request("packages", params)

            packages = result.get("packages", []) if isinstance(result, dict) else result

            return sorted(packages) if isinstance(packages, list) else []

        except Exception as e:
            logger.error(f"Error listing packages: {e}")
            return []

    async def back(self) -> str:
        """Press the back button."""
        await self._ensure_connected()

        try:
            result = await self._send_request("keyevent", {"keycode": 4})

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from back keyevent")
                self._update_state_cache(result)

            logger.debug("Pressed key BACK")
            return "Pressed key BACK"

        except Exception as e:
            logger.error(f"Back button error: {e}")
            return f"Error: {str(e)}"

    async def drag(
        self, start_x: int, start_y: int, end_x: int, end_y: int, duration: float = 3
    ) -> bool:
        """Drag gesture (implemented as long swipe)."""
        await self._ensure_connected()

        try:
            params = {
                "startX": start_x,
                "startY": start_y,
                "endX": end_x,
                "endY": end_y,
                "duration": duration,
            }

            result = await self._send_request("swipe", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from drag/swipe")
                self._update_state_cache(result)

            logger.debug(f"Drag from ({start_x}, {start_y}) to ({end_x}, {end_y})")
            return True

        except Exception as e:
            logger.error(f"Drag error: {e}")
            return False

    def remember(self, information: str) -> str:
        """Store important information in memory."""
        if not information or not isinstance(information, str):
            return "Error: Please provide valid information to remember."

        # Add to memory
        self.memory.append(information.strip())

        # Limit memory size
        max_memory_items = 10
        if len(self.memory) > max_memory_items:
            self.memory = self.memory[-max_memory_items:]

        return f"Remembered: {information}"

    async def get_memory(self) -> List[str]:
        """Retrieve all stored memory items."""
        return self.memory.copy()

    async def complete(self, success: bool, reason: str = "") -> None:
        """Mark the task as finished."""
        if success:
            self.success = True
            self.reason = reason or "Task completed successfully."
            self.finished = True
        else:
            self.success = False
            if not reason:
                raise ValueError("Reason for failure is required if success is False.")
            self.reason = reason
            self.finished = True

    def _extract_element_coordinates_by_index(self, index: int) -> Tuple[int, int]:
        """
        Extract center coordinates from an element by its index.

        Args:
            index: Index of the element to find

        Returns:
            Tuple of (x, y) coordinates
        """

        def find_element_by_index(elements, target_index):
            """Recursively find an element with the given index."""
            for item in elements:
                if item.get("index") == target_index:
                    return item
                # Check children if present
                children = item.get("children", [])
                result = find_element_by_index(children, target_index)
                if result:
                    return result
            return None

        # Check if we have cached elements
        if not self.clickable_elements_cache:
            raise ValueError("No UI elements cached. Call get_state first.")

        # Find the element with the given index
        element = find_element_by_index(self.clickable_elements_cache, index)

        if not element:
            raise ValueError(f"No element found with index {index}")

        # Get the bounds of the element
        bounds_str = element.get("bounds")
        if not bounds_str:
            raise ValueError(f"Element with index {index} has no bounds")

        # Parse the bounds (format: "left,top,right,bottom")
        try:
            left, top, right, bottom = map(int, bounds_str.split(","))
        except ValueError as e:
            raise ValueError(f"Invalid bounds format: {bounds_str}") from e

        # Calculate the center
        x = (left + right) // 2
        y = (top + bottom) // 2

        return x, y

    async def tap_by_index(self, index: int) -> str:
        """
        Tap on a UI element by its index.

        Args:
            index: Index of the element to tap

        Returns:
            Result message
        """
        await self._ensure_connected()

        try:
            # Extract coordinates
            x, y = self._extract_element_coordinates_by_index(index)

            # Tap at coordinates
            success = await self.tap(x, y)
            if not success:
                return f"Error: Failed to tap at coordinates ({x}, {y})"

            logger.debug(f"Tapped element with index {index} at ({x}, {y})")
            return f"Tapped element with index {index} at coordinates ({x}, {y})"

        except ValueError as e:
            return f"Error: {str(e)}"

    async def tap_element(self, by: str, pattern: str) -> str:
        """Find and tap an element matching criteria via the phone's live accessibility tree."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {"by": by, "pattern": pattern}
            result = await self._send_request("find_and_click", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from find_and_click action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "tap_element", duration_ms)

            # Extract message from result
            if isinstance(result, dict):
                msg = result.get("data", result.get("message", str(result)))
            else:
                msg = str(result) if result else "Tap element completed"

            logger.debug(f"tap_element successful: by={by}, pattern={pattern}")
            return f"Tapped element matching {by}='{pattern}': {msg}"

        except Exception as e:
            logger.error(f"tap_element error: {e}")
            return f"Failed to tap element (by={by}, pattern='{pattern}'): {e}"

    async def input_text_element(
        self, text: str, by: str, pattern: str, clear: bool = False
    ) -> str:
        """Find an element matching criteria and type text into it via the phone."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            encoded = base64.b64encode(text.encode()).decode()
            params = {
                "by": by,
                "pattern": pattern,
                "base64_text": encoded,
                "clear": clear,
            }
            result = await self._send_request("find_and_input", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from find_and_input action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "input_text_element", duration_ms)

            logger.debug(f"input_text_element successful: by={by}, pattern={pattern}")
            return f"Typed '{text}' into element matching {by}='{pattern}'"

        except Exception as e:
            logger.error(f"input_text_element error: {e}")
            return f"Failed to type into element (by={by}, pattern='{pattern}'): {e}"

    async def long_press_element(self, by: str, pattern: str) -> str:
        """Find and long press an element matching criteria via the phone."""
        await self._ensure_connected()
        profiler = get_profiler()
        start_time = time.perf_counter()

        try:
            params = {"by": by, "pattern": pattern}
            result = await self._send_request("find_and_long_press", params)

            # Check if response contains state data (auto-reply from client)
            if isinstance(result, dict) and "a11y_tree" in result and "phone_state" in result:
                logger.debug("Received auto-state reply from find_and_long_press action")
                self._update_state_cache(result)

            duration_ms = (time.perf_counter() - start_time) * 1000
            profiler.record(Profiler.CATEGORY_TOOL, "long_press_element", duration_ms)

            if isinstance(result, dict):
                msg = result.get("data", result.get("message", str(result)))
            else:
                msg = str(result) if result else "Long press completed"

            logger.debug(f"long_press_element successful: by={by}, pattern={pattern}")
            return f"Long pressed element matching {by}='{pattern}': {msg}"

        except Exception as e:
            logger.error(f"long_press_element error: {e}")
            return f"Failed to long press element (by={by}, pattern='{pattern}'): {e}"
