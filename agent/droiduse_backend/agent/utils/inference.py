"""
LLM call wrappers with retry logic.

Provides async functions for calling LLMs with automatic retries,
timeout handling, and profiling integration.
"""

import asyncio
import logging
import time
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient, LLMResponse
from droiduse_backend.observability.profiler import Profiler, get_profiler

logger = logging.getLogger("androiduse")

T = TypeVar("T", bound=BaseModel)


async def acall_with_retries(
    llm: LiteLLMClient,
    messages: list[dict],
    retries: int = 3,
    timeout: float = 600.0,
    delay: float = 1.0,
    stream: bool = False,
    agent_type: Optional[str] = None,
) -> LLMResponse:
    """
    Call LLM with retries and timeout handling.

    Args:
        llm: The LiteLLMClient instance
        messages: List of message dicts with 'role' and 'content'
        retries: Number of retry attempts
        timeout: Timeout in seconds for each attempt
        delay: Base delay between retries (multiplied by attempt number)
        stream: If True, stream response chunks to console in real-time
        agent_type: Optional agent type for profiling (e.g., "manager", "executor")

    Returns:
        LLMResponse with content and usage info
    """
    last_exception: Optional[Exception] = None
    profiler = get_profiler()
    model_name = getattr(llm, "model", "unknown")
    operation = f"{agent_type}_chat" if agent_type else "chat"

    for attempt in range(1, retries + 1):
        try:
            start_time = time.perf_counter()

            if stream:
                response = await _stream_response(llm, messages, timeout)
            else:
                response = await asyncio.wait_for(
                    llm.achat(messages),
                    timeout=timeout,
                )

            duration_ms = (time.perf_counter() - start_time) * 1000

            # Validate response has content
            if response is not None and response.content:
                profiler.record(
                    Profiler.CATEGORY_LLM,
                    operation,
                    duration_ms,
                    {
                        "model": model_name,
                        "attempt": attempt,
                        "stream": stream,
                        "agent_type": agent_type,
                    },
                )
                if not stream:
                    content_preview = response.content[:200] if response.content else ""
                    logger.debug(f"LLM response: {content_preview}...")
                return response
            else:
                logger.warning(f"Attempt {attempt} returned empty content")
                last_exception = ValueError("Empty response content")

        except asyncio.TimeoutError:
            logger.warning(f"Attempt {attempt} timed out after {timeout} seconds")
            last_exception = TimeoutError("Timed out")

        except Exception as e:
            logger.warning(f"Attempt {attempt} failed with error: {e!r}")
            last_exception = e

        if attempt < retries:
            await asyncio.sleep(delay * attempt)

    if last_exception:
        raise last_exception
    raise ValueError("All attempts returned empty response content")


async def _stream_response(
    llm: LiteLLMClient,
    messages: list[dict],
    timeout: float,
) -> LLMResponse:
    """
    Stream LLM response chunks to console and return accumulated response.

    Args:
        llm: The LiteLLMClient instance
        messages: List of message dicts
        timeout: Timeout in seconds for the entire stream

    Returns:
        LLMResponse with accumulated content
    """
    content = ""
    final_response: Optional[LLMResponse] = None

    async def stream_chunks():
        nonlocal content, final_response
        chunk_count = 0

        async for chunk in llm.astream_chat(messages):
            chunk_count += 1
            if isinstance(chunk, str):
                # Delta chunk - accumulate without printing
                content += chunk
            elif isinstance(chunk, LLMResponse):
                # Final response with usage
                final_response = chunk
                content = chunk.content

        if not content:
            logger.warning(f"Streaming produced no content after {chunk_count} chunks")

    await asyncio.wait_for(stream_chunks(), timeout=timeout)

    # Return final response or construct one from accumulated content
    if final_response:
        return final_response

    return LLMResponse(content=content, raw=None, usage=None)


async def astructured_predict_with_retries(
    llm: LiteLLMClient,
    output_cls: Type[T],
    prompt: str,
    retries: int = 3,
    timeout: float = 600.0,
    delay: float = 1.0,
    agent_type: Optional[str] = None,
    **prompt_args,
) -> T:
    """
    Call LLM structured predict with retries and timeout handling.

    Args:
        llm: The LiteLLMClient instance
        output_cls: The Pydantic model class for structured output
        prompt: Prompt template string with {variables}
        retries: Number of retry attempts
        timeout: Timeout in seconds for each attempt
        delay: Base delay between retries (multiplied by attempt number)
        agent_type: Optional agent type for profiling
        **prompt_args: Values for template variables

    Returns:
        Instance of the output_cls Pydantic model
    """
    last_exception: Optional[Exception] = None
    profiler = get_profiler()
    model_name = getattr(llm, "model", "unknown")
    operation = f"{agent_type}_structured" if agent_type else "structured_predict"

    for attempt in range(1, retries + 1):
        try:
            start_time = time.perf_counter()

            result = await asyncio.wait_for(
                llm.astructured_predict(output_cls, prompt, **prompt_args),
                timeout=timeout,
            )

            duration_ms = (time.perf_counter() - start_time) * 1000

            if result is not None:
                profiler.record(
                    Profiler.CATEGORY_LLM,
                    operation,
                    duration_ms,
                    {
                        "model": model_name,
                        "attempt": attempt,
                        "output_cls": output_cls.__name__,
                        "agent_type": agent_type,
                    },
                )
                logger.info(f"{result}")
                return result
            else:
                logger.warning(f"Attempt {attempt} returned None")
                last_exception = ValueError("Empty response")

        except asyncio.TimeoutError:
            logger.warning(f"Attempt {attempt} timed out after {timeout} seconds")
            last_exception = TimeoutError("Timed out")

        except Exception as e:
            logger.warning(f"Attempt {attempt} failed with error: {e!r}")
            last_exception = e

        if attempt < retries:
            await asyncio.sleep(delay * attempt)

    if last_exception:
        raise last_exception
    raise ValueError("All attempts returned empty response")
