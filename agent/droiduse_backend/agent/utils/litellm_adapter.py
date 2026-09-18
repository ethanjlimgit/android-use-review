"""
litellm adapter providing unified LLM interface.

Replaces llama_index.llms.* providers with litellm.acompletion().
Supports all major providers: OpenAI, Anthropic, Google, DeepSeek, Ollama, Groq, OpenRouter.
"""

import base64
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Optional, Type, TypeVar, Union

import litellm
from pydantic import BaseModel

logger = logging.getLogger("androiduse")

T = TypeVar("T", bound=BaseModel)

# Map provider names to litellm model prefixes
PROVIDER_TO_LITELLM_PREFIX = {
    "OpenAI": "",
    "OpenAILike": "",  # Uses api_base for custom endpoints
    "Anthropic": "anthropic/",
    "GoogleGenAI": "gemini/",
    "Gemini": "gemini/",
    "DeepSeek": "deepseek/",
    "Ollama": "ollama/",
    "Groq": "groq/",
    "OpenRouter": "openrouter/",
}


@dataclass
class UsageInfo:
    """Token usage information from LLM response."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class LLMResponse:
    """
    Unified response object for LLM calls.

    Attributes:
        content: The text content of the response
        raw: The raw response object from litellm
        usage: Token usage information if available
    """

    content: str
    raw: Any = None
    usage: Optional[UsageInfo] = None


class LiteLLMClient:
    """
    LLM client wrapping litellm for unified provider access.

    Provides async methods compatible with the existing agent codebase:
    - achat(): Async chat completion
    - astream_chat(): Async streaming chat
    - astructured_predict(): Structured output with Pydantic models

    Example:
        >>> client = LiteLLMClient(provider="Anthropic", model="claude-sonnet-4-20250514")
        >>> response = await client.achat([{"role": "user", "content": [{"text": "Hello"}]}])
        >>> print(response.content)
    """

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None,
        timeout: float = 600.0,
        **kwargs,
    ):
        """
        Initialize LiteLLM client.

        Args:
            provider: Provider name (OpenAI, Anthropic, GoogleGenAI, etc.)
            model: Model name/identifier
            api_key: Optional API key (can also use env vars)
            api_base: Optional custom API base URL (for OpenAILike)
            temperature: Sampling temperature (default 0.1)
            max_tokens: Maximum tokens in response
            timeout: Request timeout in seconds
            **kwargs: Additional parameters passed to litellm
        """
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.api_base = api_base
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.extra_kwargs = kwargs

        # Build litellm model string with provider prefix
        prefix = PROVIDER_TO_LITELLM_PREFIX.get(provider, "")
        self.litellm_model = f"{prefix}{model}"

        # Handle OpenAILike (custom endpoints)
        if provider == "OpenAILike" and api_base:
            self.litellm_model = f"openai/{model}"
            self.extra_kwargs["api_base"] = api_base

        logger.debug(f"Initialized LiteLLMClient: {provider}/{model} -> {self.litellm_model}")

    def class_name(self) -> str:
        """Return provider name for usage tracking compatibility."""
        return self.provider

    @property
    def metadata(self) -> dict:
        """Return model metadata for compatibility."""
        return {
            "provider": self.provider,
            "model": self.model,
            "litellm_model": self.litellm_model,
        }

    async def achat(self, messages: list[dict]) -> LLMResponse:
        """
        Async chat completion.

        Args:
            messages: List of message dicts with 'role' and 'content'.
                     Content can be string or list of content blocks:
                     [{"text": "..."}, {"image": bytes}]

        Returns:
            LLMResponse with content, raw response, and usage info
        """
        formatted_messages = self._format_messages(messages)

        try:
            response = await litellm.acompletion(
                model=self.litellm_model,
                messages=formatted_messages,
                api_key=self.api_key,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=self.timeout,
                **self.extra_kwargs,
            )
            return self._parse_response(response)

        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise

    async def astream_chat(
        self, messages: list[dict]
    ) -> AsyncGenerator[Union[str, LLMResponse], None]:
        """
        Async streaming chat completion.

        Yields content deltas as they arrive, then yields final LLMResponse.

        Args:
            messages: List of message dicts

        Yields:
            str: Content delta chunks
            LLMResponse: Final response with usage (last yield)
        """
        formatted_messages = self._format_messages(messages)
        accumulated_content = ""
        last_chunk = None

        try:
            response = await litellm.acompletion(
                model=self.litellm_model,
                messages=formatted_messages,
                api_key=self.api_key,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=self.timeout,
                stream=True,
                **self.extra_kwargs,
            )

            async for chunk in response:
                last_chunk = chunk
                if chunk.choices and chunk.choices[0].delta.content:
                    delta = chunk.choices[0].delta.content
                    accumulated_content += delta
                    yield delta

            # Yield final response with usage
            usage = None
            if last_chunk and hasattr(last_chunk, "usage") and last_chunk.usage:
                usage = UsageInfo(
                    prompt_tokens=getattr(last_chunk.usage, "prompt_tokens", 0),
                    completion_tokens=getattr(last_chunk.usage, "completion_tokens", 0),
                    total_tokens=getattr(last_chunk.usage, "total_tokens", 0),
                )

            yield LLMResponse(content=accumulated_content, raw=last_chunk, usage=usage)

        except Exception as e:
            logger.error(f"Streaming LLM call failed: {e}")
            raise

    async def astructured_predict(
        self,
        output_cls: Type[T],
        prompt_template: str,
        **template_vars,
    ) -> T:
        """
        Structured output prediction using Pydantic model.

        Uses litellm's response_format for providers that support it,
        falls back to JSON mode with manual parsing otherwise.

        Args:
            output_cls: Pydantic model class for output
            prompt_template: Template string with {variables}
            **template_vars: Values for template variables

        Returns:
            Instance of output_cls
        """
        # Format prompt
        if template_vars:
            prompt = prompt_template.format(**template_vars)
        else:
            prompt = prompt_template

        try:
            response = await litellm.acompletion(
                model=self.litellm_model,
                messages=[{"role": "user", "content": prompt}],
                api_key=self.api_key,
                temperature=self.temperature,
                timeout=self.timeout,
                response_format=output_cls,
                **self.extra_kwargs,
            )

            content = response.choices[0].message.content
            return output_cls.model_validate_json(content)

        except Exception as e:
            logger.error(f"Structured prediction failed: {e}")
            raise

    def _format_messages(self, messages: list[dict]) -> list[dict]:
        """
        Convert internal message format to litellm/OpenAI format.

        Internal format:
            {"role": "user", "content": [{"text": "..."}, {"image": bytes}]}

        litellm format:
            {"role": "user", "content": [
                {"type": "text", "text": "..."},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
            ]}
        """
        formatted = []

        for msg in messages:
            role = msg["role"]
            content = msg.get("content", [])

            # Handle list content (text + images)
            if isinstance(content, list):
                litellm_content = []
                for item in content:
                    if "text" in item:
                        litellm_content.append({"type": "text", "text": item["text"]})
                    elif "image" in item:
                        image_data = item["image"]
                        # Handle different image input types
                        if isinstance(image_data, bytes):
                            b64 = base64.b64encode(image_data).decode()
                        elif isinstance(image_data, str):
                            # Already base64 or URL
                            if image_data.startswith("data:") or image_data.startswith("http"):
                                litellm_content.append(
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": image_data},
                                    }
                                )
                                continue
                            b64 = image_data
                        else:
                            # Try to encode as bytes
                            b64 = base64.b64encode(bytes(image_data)).decode()

                        litellm_content.append(
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{b64}"},
                            }
                        )

                formatted.append({"role": role, "content": litellm_content})
            else:
                # String content - pass through
                formatted.append({"role": role, "content": content})

        return formatted

    def _parse_response(self, response) -> LLMResponse:
        """Parse litellm response to unified LLMResponse format."""
        content = response.choices[0].message.content or ""

        usage = None
        if response.usage:
            usage = UsageInfo(
                prompt_tokens=response.usage.prompt_tokens or 0,
                completion_tokens=response.usage.completion_tokens or 0,
                total_tokens=response.usage.total_tokens or 0,
            )

        return LLMResponse(content=content, raw=response, usage=usage)

    def __repr__(self) -> str:
        return f"LiteLLMClient(provider={self.provider!r}, model={self.model!r})"
