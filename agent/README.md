<div align="center">

# DroidUse Backend

Backend service for device automation through LLM agents

[![Docs](https://img.shields.io/badge/Docs-📕-0D9373?style=for-the-badge)](https://docs.droiduse.ai)
[![Cloud](https://img.shields.io/badge/Cloud-☁️-0D9373?style=for-the-badge)](https://cloud.droiduse.ai/sign-in?waitlist=true)


[![GitHub stars](https://img.shields.io/github/stars/droiduse/droiduse-backend?style=social)](https://github.com/droiduse/droiduse-backend/stargazers)
[![droiduse.ai](https://img.shields.io/badge/droiduse.ai-white)](https://droiduse.ai)
[![Discord](https://img.shields.io/discord/1360219330318696488?color=white&label=Discord&logo=discord&logoColor=white)](https://discord.gg/ZZbKEZZkwK)



</div>

## Overview

DroidUse Backend is a powerful backend service for controlling devices through LLM agents. It provides a robust API for automating device interactions using natural language commands.

## Features

- 🤖 Control devices with natural language commands
- 🔀 Supports multiple LLM providers (OpenAI, Anthropic, Gemini, Ollama, DeepSeek)
- 🧠 Planning capabilities for complex multi-step tasks
- 🐍 Extendable Python API for custom automations
- 📸 Screenshot analysis for visual understanding
- 🫆 Execution tracing with Arize Phoenix and Langfuse
- 🔌 WebSocket server for phone-initiated connections
- 💾 Database persistence with Prisma ORM

## 📦 Installation

```bash
pip install 'droiduse-backend[google,anthropic,openai,deepseek,ollama,dev]'
```

## 🚀 Quickstart
Read the documentation at [docs.droiduse.ai](https://docs.droiduse.ai) to get started.


## 💡 Example Use Cases

- Automated UI testing of applications
- Creating guided workflows for non-technical users
- Automating repetitive tasks
- Remote assistance and automation
- Exploring UIs with natural language commands

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Checks

To ensure the security of the codebase, we have integrated security checks using `bandit` and `safety`. These tools help identify potential security issues in the code and dependencies.

### Running Security Checks

Before submitting any code, please run the following security checks:

1. **Bandit**: A tool to find common security issues in Python code.
   ```bash
   bandit -r droiduse_backend
   ```

2. **Safety**: A tool to check your installed dependencies for known security vulnerabilities.
   ```bash
   safety scan
   ```

## CLI Commands

### WebSocket Server

The backend provides a WebSocket server that accepts phone-initiated connections for executing automation tasks:

```bash
# Start the WebSocket server
droiduse-backend serve --host 0.0.0.0 --port 8000

# Enable debug logging to see all client messages
droiduse-backend serve --debug

# Start with custom config (merged with base config.yaml)
droiduse-backend serve --config custom_config.yaml

# Combine options
droiduse-backend serve --host 0.0.0.0 --port 8000 --config custom_config.yaml --debug
```

The phone connects to the server and sends task requests. The server orchestrates the LLM agents to execute tasks and communicates with the phone via WebSocket.

#### Configuration Merging

When you provide a custom config file with `--config`, the system automatically:
1. **Loads config.yaml as the base** - All default settings from config.yaml are preserved
2. **Merges your custom config** - Only the entries you specify are overwritten
3. **Deep merges nested dictionaries** - You can override individual nested values without duplicating entire sections

**Example:**

If your `config.yaml` has:
```yaml
agent:
  max_steps: 15
  reasoning: false
llm_profiles:
  manager:
    provider: "Anthropic"
    model: "claude-sonnet-4-5"
```

And your `custom_config.yaml` has:
```yaml
agent:
  max_steps: 20
```

The final merged config will be:
```yaml
agent:
  max_steps: 20          # From custom_config.yaml
  reasoning: false       # Preserved from config.yaml
llm_profiles:
  manager:
    provider: "Anthropic"  # Preserved from config.yaml
    model: "claude-sonnet-4-5"
```

See [config_override_example.yaml](droiduse_backend/config_override_example.yaml) for a complete example.

See the [WebSocket server tests](tests/README.md) for detailed API usage and examples.

### Configuration Management

```bash
# Validate configuration file
droiduse-backend validate-config -c path/to/config.yaml

# Test LLM connectivity with all profiles
droiduse-backend test-llm

# Test specific LLM profile
droiduse-backend test-llm -p manager

# Test with custom config and verbose output
droiduse-backend test-llm -c config.yaml -v
```

The `test-llm` command helps verify your LLM configuration is correct by:
- Loading your configuration file
- Testing connectivity with each configured LLM profile
- Sending a simple test message to verify the API keys work
- Displaying provider info, model names, and token usage
- Showing success/failure status for each profile

### Display Information

```bash
# Show backend version and available commands
droiduse-backend info
```
