"""
Tracing setup utility for DroidAgent.

This module provides a centralized way to configure tracing providers
(Phoenix, Langfuse, etc.) based on the TracingPluginConfig.
"""

import base64
import logging
import os
from typing import Optional
from uuid import uuid4

from droiduse_backend.config_manager.config_manager import TracingPluginConfig

logger = logging.getLogger("androiduse")

_default_session_id: str = str(uuid4())
_session_id: str = _default_session_id
_tracing_initialized: bool = False
_tracing_provider: Optional[str] = None
_user_id: str = "anonymous"


def setup_tracing(tracing_config: TracingPluginConfig, agent: Optional[object] = None) -> None:
    global _tracing_initialized, _tracing_provider, _session_id, _user_id

    if not tracing_config.enabled:
        return

    provider = tracing_config.provider.lower()

    if tracing_config.langfuse_session_id:
        _session_id = tracing_config.langfuse_session_id
    else:
        _session_id = _default_session_id

    if tracing_config.langfuse_user_id:
        _user_id = tracing_config.langfuse_user_id
    else:
        _user_id = "anonymous"

    if _tracing_initialized:
        logger.debug(f"🔍 Tracing already initialized with {_tracing_provider}, skipping setup")
        if provider == "langfuse" and agent:
            from droiduse_backend.telemetry.langfuse_processor import set_current_agent

            set_current_agent(agent)
        return

    if provider == "phoenix":
        _setup_phoenix_tracing()
        _tracing_initialized = True
        _tracing_provider = "phoenix"
    elif provider == "langfuse":
        _setup_langfuse_tracing(tracing_config, agent)
        _tracing_initialized = True
        _tracing_provider = "langfuse"
        logger.debug(f"🔍 Langfuse tracing enabled | Session: {_session_id}")
    else:
        logger.warning(
            f"⚠️  Unknown tracing provider: {provider}. Supported providers: phoenix, langfuse"
        )


def _setup_phoenix_tracing() -> None:
    """Set up Arize Phoenix tracing via OpenTelemetry."""
    try:
        from droiduse_backend.telemetry.phoenix import arize_phoenix_callback_handler

        handler = arize_phoenix_callback_handler()
        logger.debug("🔍 Arize Phoenix tracing enabled")
    except ImportError:
        logger.warning(
            "⚠️  Arize Phoenix is not installed.\n"
            "    To enable Phoenix integration, install with:\n"
            "    • If installed via tool: `uv tool install androiduse[phoenix]`"
            "    • If installed via pip: `uv pip install androiduse[phoenix]`\n"
        )


def _setup_langfuse_tracing(
    tracing_config: TracingPluginConfig, agent: Optional[object] = None
) -> None:
    """
    Set up Langfuse tracing with litellm native callbacks.

    Args:
        tracing_config: TracingPluginConfig instance containing Langfuse credentials
        agent: Optional DroidAgent instance to pass to span processor
    """

    try:
        # Get API keys from tracing_config (already has env var fallbacks from __post_init__)
        secret_key = tracing_config.langfuse_secret_key or None
        public_key = tracing_config.langfuse_public_key or None
        host = tracing_config.langfuse_host or None

        if secret_key:
            os.environ["LANGFUSE_SECRET_KEY"] = secret_key
        if public_key:
            os.environ["LANGFUSE_PUBLIC_KEY"] = public_key
        if host:
            os.environ["LANGFUSE_HOST"] = host
        else:
            # Default to US cloud if not set
            if "LANGFUSE_HOST" not in os.environ:
                os.environ["LANGFUSE_HOST"] = "https://us.cloud.langfuse.com"

        # Verify credentials
        from langfuse import Langfuse

        langfuse = Langfuse()
        try:
            if not langfuse.auth_check():
                logger.error("❌ Langfuse authentication failed. Please check your credentials.")
                return
        except Exception as e:
            logger.error(
                f"Error checking Langfuse authentication: {e}\nLikely a network issue or credentials are incorrect"
            )
            return

        # Set up litellm callbacks for Langfuse
        import litellm

        litellm.success_callback = ["langfuse"]
        litellm.failure_callback = ["langfuse"]

        # Set up OpenTelemetry tracer for custom spans
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider

        # Check if there's already a tracer provider
        existing_provider = trace.get_tracer_provider()
        if hasattr(existing_provider, "add_span_processor"):
            # Use existing provider
            tracer_provider = existing_provider
            logger.debug("🔍 Using existing TracerProvider")
        else:
            # Create new provider
            tracer_provider = TracerProvider()
            trace.set_tracer_provider(tracer_provider)
            logger.debug("🔍 Created new TracerProvider")

        # Add custom span processor for screenshots
        from droiduse_backend.telemetry.langfuse_processor import (
            LangfuseSpanProcessor,
            set_current_agent,
        )

        if agent:
            set_current_agent(agent)

        span_processor = LangfuseSpanProcessor(
            public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
            secret_key=os.environ["LANGFUSE_SECRET_KEY"],
            base_url=os.environ["LANGFUSE_HOST"],
        )
        tracer_provider.add_span_processor(span_processor)

        logger.debug("🔍 Langfuse tracing configured with litellm callbacks")

    except ImportError as e:
        logger.warning(
            "⚠️  Langfuse dependencies are not installed.\n"
            "    To enable Langfuse integration, install with:\n"
            "    • If installed via tool: `uv tool install androiduse[langfuse]`\n"
            "    • If installed via pip: `uv pip install androiduse[langfuse]`\n"
            f"    Missing: {e.name if hasattr(e, 'name') else str(e)}\n"
        )


def apply_session_context() -> None:
    """Apply session context for tracing. Only active when Langfuse tracing is enabled."""
    if not _tracing_initialized or _tracing_provider != "langfuse":
        return

    try:
        from opentelemetry.context import attach, get_current, set_value

        try:
            from openinference.semconv.trace import SpanAttributes

            session_key = SpanAttributes.SESSION_ID
            user_key = SpanAttributes.USER_ID
        except ImportError:
            # Fallback if openinference-semconv is not installed
            session_key = "session.id"
            user_key = "user.id"

        ctx = get_current()
        ctx = set_value(session_key, _session_id, ctx)
        ctx = set_value(user_key, _user_id, ctx)
        attach(ctx)
    except Exception as e:
        logger.debug(f"Failed to apply session context: {e}")


def record_langfuse_screenshot(
    screenshot: bytes,
    mime_type: str = "image/png",
    parent_span=None,
    screenshots_enabled: bool = False,
    vision_enabled: bool = False,
) -> None:
    """
    Emit a tracing span that carries a screenshot for Langfuse uploads.

    Only active when Langfuse tracing is enabled and screenshots are enabled.
    """
    if (
        not _tracing_initialized
        or _tracing_provider != "langfuse"
        or not screenshot
        or not screenshots_enabled
        or vision_enabled  # avoid duplicate uploads when vision already embeds images in LLM spans
    ):
        return

    try:
        from opentelemetry import trace

        from droiduse_backend.telemetry.langfuse_processor import (
            get_last_step_span_context,
            get_root_span_context,
        )

        tracer = trace.get_tracer("androiduse.screenshot")
        image_b64 = base64.b64encode(screenshot).decode()

        # Attach to the provided span if valid; otherwise use current span; else root; skip if none.
        candidate = parent_span if parent_span and parent_span.get_span_context().is_valid else None
        if candidate is None:
            current_span = trace.get_current_span()
            if current_span and current_span.get_span_context().is_valid:
                candidate = current_span

        parent_ctx = (
            trace.set_span_in_context(candidate)
            if candidate is not None
            else (get_last_step_span_context() or get_root_span_context())
        )

        if parent_ctx is None:
            return

        span = tracer.start_span("androiduse.screenshot", context=parent_ctx)
        try:
            span.set_attribute("androiduse.screenshot.image_base64", image_b64)
            span.set_attribute("androiduse.screenshot.mime_type", mime_type)
        finally:
            span.end()
    except Exception as e:
        logger.debug(f"Failed to record Langfuse screenshot span: {e}")
