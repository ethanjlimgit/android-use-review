# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DroidUse Backend is a Python backend service for controlling Android/iOS devices through LLM agents. It provides natural language device automation via WebSocket connections where phones connect to the backend server.

## Development Commands

```bash
# Install with all optional dependencies
pip install -e '.[google,anthropic,openai,deepseek,ollama,dev]'

# Start WebSocket server (phone connects to this)
droiduse-backend serve --host 0.0.0.0 --port 8000
droiduse-backend serve --debug  # Enable verbose logging

# Validate configuration
droiduse-backend validate-config -c path/to/config.yaml

# Test LLM configuration and connectivity
droiduse-backend test-llm                    # Test all profiles
droiduse-backend test-llm -p manager         # Test specific profile
droiduse-backend test-llm -c config.yaml -v  # With custom config and verbose output

# Run tests
python -m pytest tests/test_websocket_server.py -v

# Run single test
python -m pytest tests/test_websocket_server.py::test_server_accepts_connection -v

# Linting and formatting
ruff check droiduse_backend
ruff format droiduse_backend
black droiduse_backend

# Security checks
bandit -r droiduse_backend
safety scan

# Generate Prisma client (after schema changes)
prisma generate
prisma db push  # Apply schema to database
```

## Architecture

### Agent System (`droiduse_backend/agent/`)

The core uses a multi-agent architecture built on a custom workflow system (`droiduse_backend/workflow/`):

- **DroidAgent** (`agent/droid/droid_agent.py`): Main orchestrator workflow
  - `reasoning=False`: Uses CodeActAgent directly for immediate execution
  - `reasoning=True`: Uses Manager (planning) + Executor (action) workflow

- **Agent Types**:
  - `CodeActAgent` - Direct code-based action execution
  - `ManagerAgent` / `StatelessManagerAgent` - High-level planning, creates subgoals
  - `ExecutorAgent` - Executes individual actions for subgoals
  - `ScripterAgent` - Off-device Python script execution (triggered by `<script>` tags)
  - `TextManipulatorAgent` - Text manipulation tasks

- **LLM Configuration**: Agents can use different LLMs specified via `llms` dict with keys: `manager`, `executor`, `codeact`, `text_manipulator`, `app_opener`, `scripter`, `structured_output`

### Workflow System (`droiduse_backend/workflow/`)

Custom lightweight workflow engine (~1,000 LOC) that replaces LlamaIndex workflows:

- **BaseWorkflow** - Base class for all agent workflows
- **WorkflowHandler** - Execution engine that NEVER catches `CancelledError`
- **WorkflowContext** - Event queue and KV store for workflow state
- **@step decorator** - Marks workflow steps with type-based event routing

**Key features**:
- Guaranteed cancellation propagation (< 200ms response time)
- Event streaming for nested workflows
- Drop-in replacement for LlamaIndex API
- Comprehensive tests (40+ test cases)

See `docs/WORKFLOW_SYSTEM.md` for architecture details.

### Tools System (`droiduse_backend/tools/`)

- `Tools` (abstract base) - Interface for device interaction
- `DeviceTools` - Android ADB-based tools
- `IOSTools` - iOS device tools
- `MobileRunTools` - Cloud device tools (optional dependency)
- `WebSocketConnectionTool` - Tools via WebSocket to connected phone

Key tool methods: `get_state()`, `tap_by_index()`, `swipe()`, `input_text()`, `take_screenshot()`

### WebSocket Server (`droiduse_backend/api/websocket_server.py`)

Phone-initiated connections for task execution:
1. Phone connects to backend WebSocket
2. Phone sends task request with `task_id` and `command`
3. Server orchestrates LLM agents
4. Server sends device commands to phone, receives responses
5. Server returns task result

### Configuration (`droiduse_backend/config_manager/`)

- `DroidrunConfig` - Main config class, loadable from YAML
- Key subconfigs: `AgentConfig`, `DeviceConfig`, `ToolsConfig`, `TracingConfig`, `CredentialsConfig`
- See `config_example.yaml` for full configuration options

### Database (`prisma/`)

PostgreSQL via Prisma ORM. Key models:
- `Task` - Agent run records (goal, status, steps, errors)
- `TaskStep` - Individual action records with device state snapshots
- `Device`, `User`, `App`, `Knowledge` - Supporting entities

Set `DATABASE_URL` env var for PostgreSQL connection.

### Plugin System (`droiduse_backend/plugins/`)

Fire-and-forget plugin architecture for background operations. Plugins never block the main agent workflow.

- **Base Classes** (`plugins/base.py`):
  - `Plugin` - Abstract base class for all plugins
  - `PluginEvent` - Event passed to plugins
  - `PluginEventType` - Event types (TASK_START, TASK_STEP, TASK_END, TRAJECTORY_STEP, etc.)

- **Plugin Manager** (`plugins/manager.py`):
  - Manages plugin lifecycle and event dispatch
  - `get_plugin_manager()` - Get global singleton instance
  - `emit_*` functions for firing events

- **Built-in Plugins**:
  - `DatabasePlugin` - Records tasks/steps to PostgreSQL
  - `PostHogTelemetryPlugin` - Anonymous usage analytics
  - `TracingPlugin` - Langfuse screenshot uploads
  - `TrajectoryPlugin` - Writes trajectory data to disk

- **Event Types**:
  - `TASK_START` - Task begins (includes trajectory init)
  - `TASK_STEP` - Database step recording
  - `TRAJECTORY_STEP` - Trajectory step writing
  - `TASK_END` - Task ends (includes trajectory final)
  - `SCREENSHOT_CAPTURED` - Screenshot for tracing
  - `AGENT_INIT`, `AGENT_FINALIZE`, `PACKAGE_VISIT` - Telemetry events

## Key Patterns

### Event-Driven Workflow
Agents communicate via events (`ManagerInputEvent`, `ExecutorResultEvent`, etc.) and share state through `DroidAgentState`.

### Tool Filtering
Tools can be disabled via `config.tools.disabled_tools`. Custom tools are built dynamically from credentials.

### Trajectory Recording
When `config.logging.save_trajectory` is set, screenshots and UI states are captured per step via `TrajectoryWriter`.

### Tracing
Supports Arize Phoenix and Langfuse for execution tracing via `config.tracing`.

### Profiling and Sleep Tracking

The backend includes a comprehensive profiler (`observability/profiler.py`) for tracking execution time:

- **Categories Tracked**: LLM calls, tool execution, agent steps, sleep/wait time, network operations
- **Sleep Profiling**: Enhanced tracking of sleep duration by action type:
  - `open_app`, `tap`, `swipe`, `wait`, `go_home`, `go_back`, etc.
  - Tracks total duration, count, and average for each sleep type
  - Helps identify time spent waiting vs. active operations
- **Usage**:
  ```python
  from droiduse_backend.observability import get_profiler, profile_sleep

  profiler = get_profiler()
  profiler.start()

  # Sleep profiling with type classification
  await profile_sleep(0.8, sleep_type="open_app")

  # Get sleep breakdown by type
  sleep_breakdown = profiler.get_sleep_breakdown()
  profiler.print_summary()  # Shows detailed breakdown including sleep types
  ```
- **Configuration**: Tune sleep durations via `config.agent.after_sleep_action` (multiplier for all sleep times)
- **Documentation**: See `docs/sleep_profiling.md` for detailed guide

### Adaptive Timing and Action Duration Awareness

The adaptive sleep system (`agent/utils/timing.py`) intelligently reduces wait times:

- **Action Duration Awareness**: Accounts for action execution time (including network latency)
  - If an action takes 300ms to execute, it needs less additional sleep
  - Reduces unnecessary waiting by up to 33% in typical scenarios
- **Optimized Base Durations**:
  - Click/tap actions: 100ms (reduced from 200ms)
  - Type/input actions: 100ms (reduced from 200ms)
  - Default actions: 150ms (reduced from 200ms)
- **Automatic Network Adaptation**: Slow network calls automatically skip additional sleep
- **Usage** (automatic in agents):
  ```python
  from droiduse_backend.agent.utils.timing import adaptive_sleep

  action_start = time.perf_counter()
  result = await execute_action(...)
  action_duration = time.perf_counter() - action_start

  # Sleep is automatically reduced by action execution time
  await adaptive_sleep("tap", base_delay=0.3, action_duration_sec=action_duration)
  ```
- **Documentation**: See `docs/action_timing_improvement.md` for detailed guide
