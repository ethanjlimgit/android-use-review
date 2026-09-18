# Droiduse Backend Dockerfile
# Multi-stage build for optimized production image

# ==============================================================================
# Stage 1: Builder - Install dependencies and build the package
# ==============================================================================
FROM python:3.12-slim AS builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /build

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock* README.md ./

# Copy source code (needed for installation)
COPY droiduse_backend ./droiduse_backend

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install package with all dependencies (non-editable install for Docker)
# Using non-editable install ensures the package is properly installed in site-packages
RUN uv pip install --no-cache-dir ".[google,anthropic,openai,deepseek,ollama,openrouter,langfuse]"

# Copy config_example.yaml as config.yaml for production use
RUN cp droiduse_backend/config_example.yaml droiduse_backend/config.yaml

# ==============================================================================
# Stage 2: Runtime - Minimal production image
# ==============================================================================
FROM python:3.12-slim AS runtime

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    android-tools-adb \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -g 1000 androiduse \
    && useradd -m -u 1000 -g 1000 -s /bin/bash androiduse

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set environment variables
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create app directory
WORKDIR /app

# Copy application code
COPY --from=builder /build/droiduse_backend ./droiduse_backend
COPY --from=builder /build/pyproject.toml ./

# Change ownership to non-root user
RUN chown -R androiduse:androiduse /app

# Switch to non-root user
USER androiduse

# Expose the default port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command - run the backend server
ENTRYPOINT ["droiduse-backend"]
CMD ["serve", "--host", "0.0.0.0", "--port", "8000"]
