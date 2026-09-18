"""
Helper functions for database operations via HTTP API.

These functions now use the HTTP client to communicate with the Next.js frontend API
instead of accessing the database directly via Prisma.
"""

from droiduse_backend.db.http_client import (
    append_to_user_memory,
    configure_http_client,
    create_or_update_user_memory,
    create_task,
    create_task_step,
    get_user_memories,
    get_user_memory,
    update_task,
    update_task_step,
)

# Re-export all functions for backward compatibility
__all__ = [
    "configure_http_client",
    "create_task",
    "update_task",
    "create_task_step",
    "update_task_step",
    "create_or_update_user_memory",
    "get_user_memory",
    "get_user_memories",
    "append_to_user_memory",
    "get_task_with_steps",
]


async def get_task_with_steps(task_id: str, auth_token: str = None, device_id_header: str = None):
    """
    Get a task with all its steps for summarization via HTTP API.

    Args:
        task_id: Task ID to retrieve
        auth_token: User's JWT token for authentication
        device_id_header: Device ID header

    Returns:
        Task data with steps, or None if not found
    """
    import logging

    from droiduse_backend.db.http_client import _api_auth_secret, _get_http_client

    logger = logging.getLogger("androiduse.db.helpers")

    try:
        client = _get_http_client()

        # Build custom headers for per-request authentication
        headers = {}
        token = auth_token or _api_auth_secret
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if device_id_header:
            headers["X-Device-Id"] = device_id_header

        response = await client.get(f"/tasks/{task_id}", headers=headers)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        task_data = response.json()

        # Convert camelCase to snake_case for backend compatibility
        return {
            "id": task_data.get("id"),
            "goal": task_data.get("goal"),
            "status": task_data.get("status"),
            "total_steps": task_data.get("totalSteps", 0),
            "steps": [
                {
                    "step_number": step.get("stepNumber"),
                    "description": step.get("description"),
                    "subgoal": step.get("subgoal"),
                    "actions": step.get("actions"),
                    "status": step.get("status"),
                }
                for step in task_data.get("taskSteps", [])
            ],
        }
    except Exception as e:
        logger.warning(f"Failed to get task with steps via API: {e}")
        return None
