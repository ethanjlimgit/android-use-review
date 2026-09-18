# Configuration Merging

## Overview

The droiduse-backend now supports configuration merging, allowing you to maintain a stable base `config.yaml` and override specific settings for different scenarios without duplicating the entire configuration.

## How It Works

When you provide a custom config file with `--config` or `-c` flag, the system:

1. **Loads config.yaml as the base** - All default settings are preserved
2. **Deep merges your custom config** - Only specified entries are overwritten
3. **Preserves all other settings** - Unspecified values remain from config.yaml

## Usage

```bash
# Start server with override config
droiduse-backend serve --config custom_config.yaml

# Short form
droiduse-backend serve -c custom_config.yaml

# Combine with other options
droiduse-backend serve --host 0.0.0.0 --port 8000 --config custom_config.yaml --debug
```

## Example

### Base config.yaml

```yaml
agent:
  max_steps: 15
  reasoning: false
  streaming: true
llm_profiles:
  manager:
    provider: "Anthropic"
    model: "claude-sonnet-4-5"
    temperature: 0.2
  executor:
    provider: "Anthropic"
    model: "claude-haiku-4-5"
    temperature: 0.1
websocket_server:
  ping_interval: 20
  ping_timeout: 60
  auth_enabled: true
```

### Custom override config (custom_config.yaml)

```yaml
agent:
  max_steps: 20  # Override only max_steps
llm_profiles:
  manager:
    model: "claude-opus-4-5"  # Override only the model
```

### Resulting merged config

```yaml
agent:
  max_steps: 20          # From custom_config.yaml ✅
  reasoning: false       # Preserved from config.yaml
  streaming: true        # Preserved from config.yaml
llm_profiles:
  manager:
    provider: "Anthropic"       # Preserved from config.yaml
    model: "claude-opus-4-5"    # From custom_config.yaml ✅
    temperature: 0.2            # Preserved from config.yaml
  executor:
    provider: "Anthropic"       # Preserved from config.yaml (entire profile)
    model: "claude-haiku-4-5"
    temperature: 0.1
websocket_server:
  ping_interval: 20      # Preserved from config.yaml (entire section)
  ping_timeout: 60
  auth_enabled: true
```

## Benefits

1. **Avoid duplication** - No need to copy entire config for small changes
2. **Maintainability** - Update base config.yaml once, all overrides inherit changes
3. **Flexibility** - Easily create configs for different environments (dev/staging/prod)
4. **Safety** - Changes are explicit and isolated to override files

## Use Cases

### Development vs Production

**dev_config.yaml:**
```yaml
logging:
  debug: true
plugins:
  posthog_telemetry:
    enabled: false
```

**prod_config.yaml:**
```yaml
agent:
  max_steps: 30
plugins:
  posthog_telemetry:
    enabled: true
```

### Testing Different LLMs

**gemini_test.yaml:**
```yaml
llm_profiles:
  manager:
    provider: "GoogleGenAI"
    model: "models/gemini-2.0-flash-exp"
```

**gpt4_test.yaml:**
```yaml
llm_profiles:
  manager:
    provider: "OpenAI"
    model: "gpt-4-turbo"
```

### High-Performance Mode

**fast_mode.yaml:**
```yaml
agent:
  max_steps: 25
  after_sleep_action: 0.5  # Reduce sleep times
llm_profiles:
  executor:
    model: "claude-haiku-4-5"  # Use fastest model
```

## Implementation Details

The config merging is implemented in:
- `config_manager/config_manager.py` - `from_yaml_with_base()` method and `_deep_merge()` function
- `api/websocket_server.py` - `override_config_path` parameter support
- `cli/main.py` - `--config` flag in serve command

## Testing

Run the config merging tests:

```bash
python -m pytest tests/test_websocket_config.py::TestWebSocketServerConfig::test_config_merging -v
python -m pytest tests/test_websocket_config.py::TestWebSocketServerConfig::test_config_merging_nested_dicts -v
```

## Example Override Config

See [config_override_example.yaml](../droiduse_backend/config_override_example.yaml) for a complete example with comments explaining each section.
