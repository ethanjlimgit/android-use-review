"""Search for similar completed tasks via the Next.js API."""

import logging
from typing import Any, Dict, Optional

from droiduse_backend.db.http_client import _api_auth_secret, _get_http_client

logger = logging.getLogger("droiduse-backend.task_memory")


async def search_similar_task(
    goal_text: str,
    auth_token: Optional[str] = None,
    device_id_header: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Search for a similar completed task that can be replayed.

    Calls GET /api/tasks?similarGoal=<goal> to find a completed task
    with a stored embedding close enough to the new goal.

    Args:
        goal_text: The goal/command text to search for.
        auth_token: JWT token for authenticating with the Next.js API.
        device_id_header: Device ID to include in the X-Device-Id header.

    Returns:
        A dict with replay_actions, similarity, source_task_id, and original_goal
        if a match is found, else None.
    """
    client = _get_http_client()

    # Build custom headers for per-request authentication
    # Fall back to service-level token when user token is unavailable
    # (consistent with create_task/update_task in http_client.py)
    headers: Dict[str, str] = {}
    token = auth_token or _api_auth_secret
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if device_id_header:
        headers["X-Device-Id"] = device_id_header

    # Use a generous timeout: the endpoint calls OpenAI embedding API
    # (1-5s) then runs a pgvector similarity query
    response = await client.get(
        "/tasks",
        params={"similarGoal": goal_text},
        headers=headers,
        timeout=15.0,
    )
    response.raise_for_status()
    results = response.json()

    if results and len(results) > 0:
        match = results[0]
        replay_actions = match["replay_actions"]
        similarity = match["similarity"]
        original_goal = match["goal"]
        source_task_id = match["id"]

        logger.info(
            f"🧠 Similar task found:\n"
            f"  Original goal: {original_goal}\n"
            f"  Similarity:    {similarity:.3f}\n"
            f"  Source task:    {source_task_id}\n"
            f"  Actions ({len(replay_actions)}):"
        )
        for i, action in enumerate(replay_actions, 1):
            method = action.get("method", "unknown")
            params = action.get("params", {})
            action_type = action.get("type", "unknown")
            logger.info(f"    [{i}] {method} ({action_type}) -> {params}")

        return {
            "replay_actions": replay_actions,
            "similarity": similarity,
            "source_task_id": source_task_id,
            "original_goal": original_goal,
        }

    logger.info(f"🧠 No similar task found for goal: {goal_text}")
    return None
