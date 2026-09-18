"""
Token usage tracking for LLM calls.

Provides utilities for extracting and accumulating token usage from LLM responses.
Compatible with litellm responses via the LiteLLMClient adapter.
"""

import logging

from pydantic import BaseModel

from droiduse_backend.agent.utils.litellm_adapter import (
    LiteLLMClient,
    LLMResponse,
)

logger = logging.getLogger("androiduse")


class UsageResult(BaseModel):
    """Token usage result from an LLM call."""

    request_tokens: int = 0
    response_tokens: int = 0
    total_tokens: int = 0
    requests: int = 0

    def __add__(self, other: "UsageResult") -> "UsageResult":
        """Add two usage results together."""
        return UsageResult(
            request_tokens=self.request_tokens + other.request_tokens,
            response_tokens=self.response_tokens + other.response_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
            requests=self.requests + other.requests,
        )


def get_usage_from_response(provider: str, response: LLMResponse) -> UsageResult:
    """
    Extract usage information from an LLMResponse.

    Args:
        provider: Provider name (for logging, not needed for extraction)
        response: LLMResponse from LiteLLMClient

    Returns:
        UsageResult with token counts

    Note:
        litellm normalizes usage across all providers, so we just read from response.usage
    """
    if response.usage is None:
        logger.debug(f"No usage info in response from {provider}")
        return UsageResult(requests=1)

    usage = response.usage
    return UsageResult(
        request_tokens=usage.prompt_tokens,
        response_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        requests=1,
    )


class UsageTracker:
    """
    Accumulates token usage across multiple LLM calls.

    Unlike the previous LlamaIndex callback-based approach, this tracker
    must be updated manually after each LLM call using add_usage().
    """

    def __init__(self, provider: str = "unknown"):
        self.provider = provider
        self._usage = UsageResult()

    @property
    def usage(self) -> UsageResult:
        """Get accumulated usage statistics."""
        return self._usage

    def add_usage(self, response: LLMResponse) -> None:
        """
        Add usage from an LLM response to the accumulated total.

        Args:
            response: LLMResponse with usage info
        """
        if response.usage:
            self._usage = self._usage + UsageResult(
                request_tokens=response.usage.prompt_tokens,
                response_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
                requests=1,
            )
        else:
            self._usage.requests += 1

    def reset(self) -> None:
        """Reset accumulated usage to zero."""
        self._usage = UsageResult()


def create_tracker(llm: LiteLLMClient) -> UsageTracker:
    """
    Create a usage tracker for an LLM client.

    Args:
        llm: LiteLLMClient instance

    Returns:
        UsageTracker that can accumulate usage across calls
    """
    return UsageTracker(provider=llm.provider)
