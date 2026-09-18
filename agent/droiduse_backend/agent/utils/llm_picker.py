"""
LLM loading via litellm.

Provides unified LLM loading for all supported providers using litellm.
Replaces the previous dynamic LlamaIndex module loading approach.
"""

import logging
import os
from typing import TYPE_CHECKING, Any

from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient

if TYPE_CHECKING:
    from droiduse_backend.config_manager.config_manager import LLMProfile

# Configure logging
logger = logging.getLogger("androiduse")

# Mapping of provider names to their default environment variable names for API keys
PROVIDER_API_KEY_ENV_VARS = {
    "GoogleGenAI": "GOOGLE_API_KEY",
    "OpenAI": "OPENAI_API_KEY",
    "OpenAILike": "OPENAI_API_KEY",
    "Anthropic": "ANTHROPIC_API_KEY",
    "DeepSeek": "DEEPSEEK_API_KEY",
    "Gemini": "GOOGLE_API_KEY",
    "Groq": "GROQ_API_KEY",
    "OpenRouter": "OPENROUTER_API_KEY",
    "Ollama": None,  # Ollama typically doesn't need an API key
}


def _resolve_api_key(provider_name: str, kwargs: dict[str, Any], config: Any = None) -> None:
    """
    Resolve API key for the given provider.

    Checks in order: kwargs (from profile), config.api_keys, environment variables.
    Updates kwargs in-place if an API key is found.

    Args:
        provider_name: The provider name (e.g., "OpenAI", "GoogleGenAI")
        kwargs: The kwargs dictionary to update with api_key if found
        config: Optional AndroidUseConfig instance to get API keys from
    """
    # If api_key is already in kwargs, use it (from profile kwargs)
    if "api_key" in kwargs and kwargs["api_key"] is not None:
        logger.debug(f"Using API key from profile kwargs for {provider_name}")
        return

    # Try to get API key from config.api_keys
    if config and hasattr(config, "api_keys"):
        api_key = config.api_keys.get_llm_api_key(provider_name)
        if api_key:
            kwargs["api_key"] = api_key
            logger.info(
                f"✅ Using API key from config.api_keys.{provider_name.lower()}_api_key for {provider_name}"
            )
            return
        else:
            logger.debug(f"No API key found in config.api_keys for {provider_name}")

    # Try to get API key from environment variable
    env_var = PROVIDER_API_KEY_ENV_VARS.get(provider_name)
    if env_var:
        api_key = os.getenv(env_var)
        if api_key:
            kwargs["api_key"] = api_key
            logger.debug(f"Using API key from environment variable {env_var} for {provider_name}")
        else:
            logger.debug(f"No API key found in {env_var} for {provider_name}")
    else:
        logger.debug(f"No default API key environment variable mapping for {provider_name}")


def load_llm(
    provider_name: str, model: str | None = None, config: Any = None, **kwargs: Any
) -> LiteLLMClient:
    """
    Load an LLM client using litellm.

    Args:
        provider_name: The provider name (e.g., "OpenAI", "Anthropic", "GoogleGenAI")
        model: The model name to use (e.g., "gpt-4", "claude-sonnet-4-20250514")
        config: Optional AndroidUseConfig instance to get API keys from
        **kwargs: Additional keyword arguments for the LLM client:
            - api_key: API key (resolved from config/env if not provided)
            - api_base: Custom API base URL (for OpenAILike)
            - temperature: Sampling temperature
            - max_tokens: Maximum tokens in response
            - timeout: Request timeout in seconds

    Returns:
        LiteLLMClient instance configured for the specified provider

    Example:
        >>> llm = load_llm("Anthropic", model="claude-sonnet-4-20250514")
        >>> response = await llm.achat([{"role": "user", "content": [{"text": "Hello"}]}])
    """
    if not provider_name:
        raise ValueError("provider_name cannot be empty.")

    # Resolve API key from config or environment variables
    _resolve_api_key(provider_name, kwargs, config=config)

    # Extract parameters for LiteLLMClient
    api_key = kwargs.pop("api_key", None)
    api_base = kwargs.pop("api_base", kwargs.pop("base_url", None))
    temperature = kwargs.pop("temperature", 0.1)
    max_tokens = kwargs.pop("max_tokens", None)
    timeout = kwargs.pop("timeout", 600.0)

    # Filter out None values and unsupported kwargs
    # Some kwargs from LlamaIndex profiles may not be relevant for litellm
    supported_kwargs = {}
    unsupported_keys = {"is_chat_model", "callback_manager"}
    for k, v in kwargs.items():
        if v is not None and k not in unsupported_keys:
            supported_kwargs[k] = v

    # Log configuration
    api_key_status = "present" if api_key else "missing"
    logger.debug(
        f"Loading LLM: provider={provider_name}, model={model}, "
        f"api_key={api_key_status}, temperature={temperature}"
    )

    # Create LiteLLMClient
    client = LiteLLMClient(
        provider=provider_name,
        model=model or "default",
        api_key=api_key,
        api_base=api_base,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        **supported_kwargs,
    )

    logger.debug(f"✅ Successfully loaded LLM: {provider_name}/{model}")
    return client


def load_llms_from_profiles(
    profiles: dict[str, "LLMProfile"],
    profile_names: list[str] | None = None,
    config: Any = None,
    **override_kwargs_per_profile,
) -> dict[str, LiteLLMClient]:
    """
    Load multiple LLMs from LLMProfile objects.

    Args:
        profiles: Dict of profile_name -> LLMProfile objects
        profile_names: List of profile names to load. If None, loads all profiles
        config: Optional AndroidUseConfig instance to get API keys from
        **override_kwargs_per_profile: Dict of profile-specific overrides
            Example: manager={'temperature': 0.1}, executor={'max_tokens': 8000}

    Returns:
        Dict mapping profile names to LiteLLMClient instances

    Example:
        >>> config = AndroidUseConfig.from_yaml("config.yaml")
        >>> llms = load_llms_from_profiles(config.llm_profiles)
        >>> manager_llm = llms['manager']

        >>> # Load specific profiles with overrides
        >>> llms = load_llms_from_profiles(
        ...     config.llm_profiles,
        ...     profile_names=['manager', 'executor'],
        ...     manager={'temperature': 0.1}
        ... )
    """
    if profile_names is None:
        profile_names = list(profiles.keys())

    llms = {}
    for profile_name in profile_names:
        logger.debug(f"Loading LLM for profile: {profile_name}")

        if profile_name not in profiles:
            raise KeyError(
                f"Profile '{profile_name}' not found. Available profiles: {list(profiles.keys())}"
            )

        profile = profiles[profile_name]

        # Get base kwargs from profile
        kwargs = profile.to_load_llm_kwargs()

        # Extract model from kwargs to pass it explicitly (avoid duplicate argument)
        model = kwargs.pop("model", profile.model)

        logger.debug(
            f"Profile {profile_name}: provider={profile.provider}, model={model}, "
            f"temperature={profile.temperature}, kwargs_keys={list(kwargs.keys())}"
        )

        # Apply profile-specific overrides if provided
        if profile_name in override_kwargs_per_profile:
            logger.debug(
                f"Applying overrides for {profile_name}: {override_kwargs_per_profile[profile_name]}"
            )
            # Remove model from overrides if present (we pass it explicitly)
            overrides = override_kwargs_per_profile[profile_name].copy()
            overrides.pop("model", None)
            kwargs.update(overrides)

        # Load the LLM
        llms[profile_name] = load_llm(
            provider_name=profile.provider, model=model, config=config, **kwargs
        )
        logger.debug(f"Successfully loaded {profile_name} LLM: {profile.provider}/{profile.model}")

    return llms


# --- Example Usage ---
if __name__ == "__main__":
    import asyncio

    async def test_providers():
        providers = [
            {"name": "Anthropic", "model": "claude-sonnet-4-20250514"},
            {"name": "GoogleGenAI", "model": "gemini-2.0-flash"},
            {"name": "OpenAI", "model": "gpt-4o"},
        ]

        messages = [
            {
                "role": "system",
                "content": [{"text": "You are a helpful assistant. Be brief."}],
            },
            {"role": "user", "content": [{"text": "Say hello in one word."}]},
        ]

        for provider in providers:
            print(f"\n{'#' * 35} Testing {provider['name']} {'#' * 35}")
            print("-" * 80)

            try:
                llm = load_llm(provider["name"], model=provider["model"])
                print(f"Loaded LLM: {llm}")
                print(f"Model: {llm.metadata}")
                print("-" * 80)

                response = await llm.achat(messages)
                print(f"Response: {response.content}")
                print(f"Usage: {response.usage}")
                print("-" * 80)

            except Exception as e:
                print(f"Failed to test {provider['name']}: {e}")

    asyncio.run(test_providers())
