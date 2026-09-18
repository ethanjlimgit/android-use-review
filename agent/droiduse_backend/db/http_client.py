"""
HTTP client for database operations via Next.js API.

This module provides functions to interact with the database through HTTP requests
to the Next.js frontend API, removing the need for direct database access.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("androiduse.db.http_client")

# Global configuration
_api_base_url: str = "http://localhost:3000/api"
_api_auth_secret: str = ""

# Global HTTP client with connection pooling
_http_client: Optional[httpx.AsyncClient] = None


def configure_http_client(base_url: str, auth_secret: str = "") -> None:
    """
    Configure the HTTP client with API URL and NextAuth secret.

    This should be called once at application startup before making any API requests.

    Args:
        base_url: Base URL for the API (e.g., "http://localhost:3000/api")
        auth_secret: NextAuth secret for authentication (optional)
    """
    global _api_base_url, _api_auth_secret, _http_client
    _api_base_url = base_url
    _api_auth_secret = auth_secret

    # Close existing client if it exists
    if _http_client is not None:
        # Synchronously close (will be recreated on next request)
        import asyncio

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_http_client.aclose())
        except RuntimeError:
            # No running loop, use sync close
            pass
        _http_client = None

    logger.info(f"HTTP client configured with base_url: {base_url}")


def _get_http_client() -> httpx.AsyncClient:
    """Get or create a global HTTP client instance with auth headers."""
    global _http_client
    if _http_client is None:
        headers = {}
        if _api_auth_secret:
            headers["Authorization"] = f"Bearer {_api_auth_secret}"

        _http_client = httpx.AsyncClient(
            base_url=_api_base_url,
            timeout=httpx.Timeout(30.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            headers=headers,
        )
    return _http_client


async def close_http_client() -> None:
    """Close the global HTTP client."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


# ============================================================================
# Task Operations
# ============================================================================


async def create_task(
    goal: str,
    user_id: Optional[str] = None,
    run_type: str = "developer",
    is_reasoning: bool = False,
    max_steps: Optional[int] = None,
    timeout_sec: Optional[int] = None,
    device_id: Optional[str] = None,
    status: str = "PENDING",
    is_replay: bool = False,
    replay_source_id: Optional[str] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> str:
    """
    Create a new task via HTTP API.

    Args:
        goal: Task goal/instruction
        user_id: User ID (optional)
        run_type: Run type (default: "developer")
        is_reasoning: Whether task uses reasoning mode
        max_steps: Maximum steps allowed
        timeout_sec: Timeout in seconds
        device_id: Device ID for request body
        status: Initial task status (default: "PENDING")
        is_replay: Whether this task is a memory replay
        replay_source_id: ID of the source task being replayed
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        The created task ID
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        body = {
            "deviceId": device_id,
            "goal": goal,
            "userId": user_id,
            "runType": run_type,
            "isReasoning": is_reasoning,
            "maxSteps": max_steps,
            "timeoutSec": timeout_sec,
            "status": status,
        }
        if is_replay:
            body["isReplay"] = True
        if replay_source_id:
            body["replaySourceId"] = replay_source_id

        response = await client.post(
            "/tasks",
            json=body,
            headers=headers,
        )
        response.raise_for_status()
        task = response.json()
        return task["id"]
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for create_task: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to create task via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to create task via API: {e}")
        raise


async def update_task(
    task_id: str,
    run_type: Optional[str] = None,
    is_reasoning: Optional[bool] = None,
    status: Optional[str] = None,
    error: Optional[str] = None,
    response: Optional[str] = None,
    total_steps: Optional[int] = None,
    profiling_summary: Optional[Dict[str, Any]] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> None:
    """
    Update an existing task via HTTP API.

    Args:
        task_id: Task ID to update
        run_type: Run type (e.g., "developer", "production")
        is_reasoning: Whether task uses reasoning mode
        status: New status
        error: Error message
        response: Agent's completion or failure response message
        total_steps: Total number of steps
        profiling_summary: Agent profiler data (LLM time, sleep time, etc.)
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        update_data: Dict[str, Any] = {}

        if run_type is not None:
            update_data["runType"] = run_type
        if is_reasoning is not None:
            update_data["isReasoning"] = is_reasoning
        if status is not None:
            update_data["status"] = status
        if error is not None:
            update_data["error"] = error
        if response is not None:
            update_data["response"] = response
        if total_steps is not None:
            update_data["totalSteps"] = total_steps
        if profiling_summary is not None:
            update_data["profilingSummary"] = profiling_summary

        # Set timestamps based on status
        if status == "RUNNING":
            update_data["startedAt"] = datetime.now().isoformat()
        elif status in ("COMPLETED", "FAILED", "TIMED_OUT"):
            update_data["completedAt"] = datetime.now().isoformat()

        if update_data:
            response = await client.patch(
                f"/tasks/{task_id}",
                json=update_data,
                headers=headers,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for update_task: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to update task via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to update task via API: {e}")
        raise


async def create_task_step(
    task_id: str,
    step_number: int,
    agent_type: str,
    actions: Optional[list[Dict[str, Any]]] = None,
    thought: Optional[str] = None,
    description: Optional[str] = None,
    subgoal: Optional[str] = None,
    confidence: Optional[float] = None,
    status: str = "PENDING",
    error: Optional[str] = None,
    summary: Optional[str] = None,
    full_response: Optional[str] = None,
    screenshot_path: Optional[str] = None,
    a11y_tree: Optional[Dict[str, Any] | list] = None,
    phone_state: Optional[Dict[str, Any]] = None,
    formatted_text: Optional[str] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> str:
    """
    Create a new task step via HTTP API.

    Args:
        task_id: Parent task ID
        step_number: Step number in sequence
        agent_type: Type of agent executing step
        actions: Array of tool callings (e.g., [{"type": "click", "x": 100, "y": 200}])
        thought: Agent's thought process
        description: Step description
        subgoal: Subgoal for this step
        confidence: Confidence score
        status: Step status
        error: Error message
        summary: Step summary
        full_response: Full agent response
        screenshot_path: Path to screenshot
        a11y_tree: Accessibility tree snapshot
        phone_state: Phone state snapshot
        formatted_text: Formatted UI text
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        The created step ID
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        response = await client.post(
            f"/tasks/{task_id}/steps",
            json={
                "stepNumber": step_number,
                "agentType": agent_type,
                "actions": actions,
                "thought": thought,
                "description": description,
                "subgoal": subgoal,
                "confidence": confidence,
                # Extended fields for step updates
                "status": status,
                "error": error,
                "summary": summary,
                "fullResponse": full_response,
                "screenshotPath": screenshot_path,
                "a11yTree": a11y_tree,
                "phoneState": phone_state,
                "formattedText": formatted_text,
            },
            headers=headers,
        )
        response.raise_for_status()
        step = response.json()
        return step["id"]
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for create_task_step: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to create task step via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to create task step via API: {e}")
        raise


async def update_task_step(
    step_id: str,
    actions: Optional[list[Dict[str, Any]]] = None,
    status: Optional[str] = None,
    error: Optional[str] = None,
    summary: Optional[str] = None,
    screenshot_path: Optional[str] = None,
    a11y_tree: Optional[Dict[str, Any] | list] = None,
    phone_state: Optional[Dict[str, Any]] = None,
    formatted_text: Optional[str] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> None:
    """
    Update an existing task step via HTTP API.

    Args:
        step_id: Step ID to update
        actions: Array of tool callings (e.g., [{"type": "click", "x": 100, "y": 200}])
        status: New status
        error: Error message
        summary: Step summary
        screenshot_path: Path to screenshot
        a11y_tree: Accessibility tree snapshot
        phone_state: Phone state snapshot
        formatted_text: Formatted UI text
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        update_data: Dict[str, Any] = {}

        if actions is not None:
            update_data["actions"] = actions
        if status is not None:
            update_data["status"] = status
        if error is not None:
            update_data["error"] = error
        if summary is not None:
            update_data["summary"] = summary
        if screenshot_path is not None:
            update_data["screenshotPath"] = screenshot_path
        if a11y_tree is not None:
            update_data["a11yTree"] = a11y_tree
        if phone_state is not None:
            update_data["phoneState"] = phone_state
        if formatted_text is not None:
            update_data["formattedText"] = formatted_text

        # Set timestamps based on status
        if status == "EXECUTING":
            update_data["startedAt"] = datetime.now().isoformat()
        elif status in ("SUCCESS", "FAILED"):
            update_data["completedAt"] = datetime.now().isoformat()

        if update_data:
            response = await client.patch(
                f"/tasks/steps/{step_id}",
                json=update_data,
                headers=headers,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for update_task_step: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to update task step via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to update task step via API: {e}")
        raise


# ============================================================================
# User Memory Operations
# ============================================================================


async def create_or_update_user_memory(
    user_id: str,
    type: str,
    value: str,
    description: Optional[str] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> str:
    """
    Create or update a user memory entry via HTTP API.

    Args:
        user_id: User ID (for backward compatibility, not used in API call)
        type: Memory type (e.g., "task_history", "preferences")
        value: Memory value
        description: Optional description
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        The memory entry ID
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        response = await client.post(
            "/user/memories",
            json={
                "type": type,
                "value": value,
                "description": description,
            },
            headers=headers,
        )
        response.raise_for_status()
        memory = response.json()
        return memory["id"]
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for create_or_update_user_memory: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to create/update user memory via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to create/update user memory via API: {e}")
        raise


async def get_user_memory(
    user_id: str,
    type: str,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Get a user memory entry by type via HTTP API.

    Args:
        user_id: User ID (passed as query param)
        type: Memory type to lookup
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        Memory data or None if not found
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        # Query all memories and filter client-side since we removed the [key] endpoint
        response = await client.get("/user/memories", headers=headers)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        memories = response.json()

        # Find the memory with matching type
        for memory in memories:
            if memory.get("type") == type:
                return {
                    "id": memory["id"],
                    "user_id": memory["userId"],
                    "type": memory["type"],
                    "value": memory["value"],
                    "description": memory.get("description"),
                    "created_at": memory.get("createdAt"),
                    "updated_at": memory.get("updatedAt"),
                }

        return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for get_user_memory: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to get user memory via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to get user memory via API: {e}")
        raise


async def get_user_memories(
    user_id: str,
    type_prefix: Optional[str] = None,
    limit: int = 100,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> list[Dict[str, Any]]:
    """
    Get all user memories via HTTP API.

    Note: type_prefix filtering is done client-side.

    Args:
        user_id: User ID (for backward compatibility, not used in API call)
        type_prefix: Optional type prefix filter
        limit: Maximum number of results
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        List of memory entries
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        response = await client.get("/user/memories", headers=headers)
        response.raise_for_status()
        memories = response.json()

        # Convert to expected format
        result = [
            {
                "id": memory["id"],
                "user_id": memory["userId"],
                "type": memory["type"],
                "value": memory["value"],
                "description": memory.get("description"),
                "created_at": memory.get("createdAt"),
                "updated_at": memory.get("updatedAt"),
            }
            for memory in memories
        ]

        # Filter by type_prefix if provided
        if type_prefix:
            result = [m for m in result if m["type"].startswith(type_prefix)]

        # Apply limit
        return result[:limit]
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for get_user_memories: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to get user memories via API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to get user memories via API: {e}")
        raise


async def append_to_user_memory(
    user_id: str,
    type: str,
    new_value: str,
    separator: str = "\n\n---\n\n",
    max_entries: int = 50,
    description: Optional[str] = None,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> str:
    """
    Append a new value to an existing user memory via HTTP API.

    Args:
        user_id: User ID
        type: Memory type
        new_value: New value to append
        separator: Separator between entries
        max_entries: Maximum number of entries to keep
        description: Optional description
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        The memory entry ID
    """
    # Get existing memory (pass through auth)
    existing = await get_user_memory(
        user_id, type, auth_token=auth_token, device_id_header=device_id_header
    )

    if existing and existing["value"]:
        entries = existing["value"].split(separator)
        entries.append(new_value)
        # Keep only the most recent entries
        if len(entries) > max_entries:
            entries = entries[-max_entries:]
        combined_value = separator.join(entries)
    else:
        combined_value = new_value

    return await create_or_update_user_memory(
        user_id=user_id,
        type=type,
        value=combined_value,
        description=description or (existing["description"] if existing else None),
        auth_token=auth_token,
        device_id_header=device_id_header,
    )


# ============================================================================
# App Knowledge Operations
# ============================================================================


async def get_app_knowledge(
    package_name: str,
    instruction: str = "",
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> str:
    """
    Get app knowledge for a specific package via HTTP API.

    Args:
        package_name: Package name to get knowledge for
        instruction: Optional instruction context
        auth_token: User's JWT token for authentication (overrides service token)
        device_id_header: Device ID to include in X-Device-Id header

    Returns:
        Formatted app knowledge markdown string
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    headers = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    try:
        response = await client.post(
            "/app-knowledge",
            json={
                "package_name": package_name,
                "instruction": instruction,
            },
            headers=headers,
        )

        if response.status_code == 404:
            return ""

        response.raise_for_status()
        data = response.json()
        return data.get("app_knowledge", "")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return ""
        if e.response.status_code in (401, 403):
            logger.error(f"Authentication failed for get_app_knowledge: {e}")
            logger.debug(f"Token present: {bool(auth_token)}, Device ID header: {device_id_header}")
        logger.error(f"Failed to get app knowledge via API: {e}")
        return ""
    except Exception as e:
        logger.error(f"Failed to get app knowledge via API: {e}")
        return ""
