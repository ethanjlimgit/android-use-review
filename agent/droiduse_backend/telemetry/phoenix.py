"""
Arize Phoenix tracing integration for AndroidUse.

This module provides Phoenix instrumentation for tracing LLM calls and agent execution.
It includes utilities for creating custom spans with clean names and context management.

Note: This module now uses pure OpenTelemetry without LlamaIndex dependencies.
LLM call tracing is handled via litellm's native callback system.
"""

import functools
import inspect
import os
from typing import Any, Callable

from opentelemetry import trace
from opentelemetry.trace import Tracer


def arize_phoenix_callback_handler(**kwargs: Any) -> Tracer:
    """
    Create and configure Arize Phoenix tracing via OpenTelemetry.

    This function sets up OpenTelemetry tracing with Phoenix backend for monitoring
    agent execution. LLM call tracing is handled separately via litellm callbacks.

    Args:
        **kwargs: Optional configuration overrides
            - endpoint: Phoenix server URL (default: http://0.0.0.0:6006 or PHOENIX_URL env var)
            - tracer_provider: Custom tracer provider

    Returns:
        Configured OpenTelemetry tracer instance

    Environment Variables:
        - PHOENIX_URL: Phoenix server URL
        - PHOENIX_PROJECT_NAME: Project name for organizing traces
    """
    from openinference.semconv.resource import ResourceAttributes
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
        OTLPSpanExporter,
    )
    from opentelemetry.sdk import trace as trace_sdk
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor

    endpoint = (
        kwargs.get("endpoint", os.getenv("phoenix_url", "http://0.0.0.0:6006")) + "/v1/traces"
    )

    resource_attributes = {}
    phoenix_project_name = os.getenv("phoenix_project_name", "")
    if phoenix_project_name.strip():
        resource_attributes[ResourceAttributes.PROJECT_NAME] = phoenix_project_name
    resource = Resource(attributes=resource_attributes)

    tracer_provider = kwargs.get("tracer_provider") or trace_sdk.TracerProvider(resource=resource)
    tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

    # Set as global tracer provider if not already set
    existing_provider = trace.get_tracer_provider()
    if not hasattr(existing_provider, "add_span_processor"):
        trace.set_tracer_provider(tracer_provider)

    return trace.get_tracer("androiduse.phoenix")


def clean_span(span_name: str):
    """
    Create a span with a clean name (without class prefix).

    This function returns a decorator that creates spans with custom names
    using OpenTelemetry's native span API.

    Args:
        span_name: The desired name for the span

    Returns:
        A decorator function
    """

    def decorator(func: Callable) -> Callable:
        tracer = trace.get_tracer("androiduse.spans")

        # Support both sync and async callables
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(span_name) as span:
                    try:
                        result = await func(*args, **kwargs)
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return async_wrapper
        else:

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                with tracer.start_as_current_span(span_name) as span:
                    try:
                        result = func(*args, **kwargs)
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return wrapper

    return decorator
