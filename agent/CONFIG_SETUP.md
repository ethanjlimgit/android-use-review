# Configuration Setup Guide

## Overview

DroidUse Backend uses a centralized `config.yaml` file for all configuration, including API keys and database connection.

## Setup Steps

### 1. Create config.yaml

Copy the example config and customize it:

```bash
cp droiduse_backend/config_example.yaml droiduse_backend/config.yaml
```

### 2. Configure API Keys

Edit `droiduse_backend/config.yaml` and fill in your API keys:

```yaml
api_keys:
  # LLM Provider API Keys
  google_api_key: "your-google-api-key"      # For Google Gemini
  openai_api_key: "your-openai-api-key"      # For OpenAI
  anthropic_api_key: "your-anthropic-key"    # For Claude
  deepseek_api_key: "your-deepseek-key"      # For DeepSeek

  # Database
  database_url: "postgresql://user:pass@localhost:5432/dbname"

  # Optional: Telemetry
  posthog_api_key: ""
  posthog_host: ""

  # Optional: Tracing (Langfuse)
  langfuse_secret_key: ""
  langfuse_public_key: ""
  langfuse_host: ""
```

### 3. Configure Database

Set the `database_url` in the `api_keys` section:

```yaml
api_keys:
  database_url: "postgresql://username:password@host:port/database"
```

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]`

**Example**:
```
postgresql://droiduse:secret123@localhost:5432/droiduse_db
```

**Note**: The database URL is configured in `config.yaml` (not environment variables). The API server will automatically set the `DATABASE_URL` environment variable from the config when it starts, so Prisma can use it.

### 4. Configure Device Settings

```yaml
device:
  serial: null                    # Device IP:port (set via API request)
  use_tcp: true                   # Use TCP communication
  platform: android               # android or ios
  token: "your-portal-token"      # Portal authentication token
```

### 5. Configure LLM Profiles

Choose your LLM provider and models:

```yaml
llm_profiles:
  manager:
    provider: Anthropic           # GoogleGenAI, OpenAI, Anthropic, DeepSeek, Ollama
    model: claude-sonnet-4-0
    temperature: 0.2

  executor:
    provider: Anthropic
    model: claude-sonnet-4-0
    temperature: 0.1

  codeact:
    provider: Anthropic
    model: claude-sonnet-4-0
    temperature: 0.2
```

## Configuration Loading

### Priority Order

The config loading follows this priority:

1. **config.yaml** - Values set in the file
2. **Environment Variables** - Falls back to env vars if config value is empty
3. **Defaults** - Built-in defaults if neither is set

### Config File Locations

The system looks for `config.yaml` in these locations (in order):

1. `droiduse_backend/config.yaml` (relative to current working directory)
2. `<package-root>/config.yaml` (bundled with the package)

### Environment Variable Fallback

If an API key is not set in `config.yaml`, the system will check environment variables:

- `GOOGLE_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `DATABASE_URL`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_HOST`

## Validation

Validate your configuration:

```bash
droiduse-backend validate-config
```

Or specify a custom config file:

```bash
droiduse-backend validate-config --config path/to/config.yaml
```

## Security Best Practices

1. **Never commit config.yaml** - It's in `.gitignore` by default
2. **Use strong passwords** for database
3. **Keep API keys secret** - Don't share or expose them
4. **Rotate tokens** periodically
5. **Use environment variables** in production for sensitive values

## Database Setup

### 1. Create PostgreSQL Database

```sql
CREATE DATABASE droiduse_db;
CREATE USER droiduse WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE droiduse_db TO droiduse;
```

### 2. Run Migrations

```bash
cd prisma
prisma migrate dev
```

### 3. Generate Prisma Client

```bash
prisma generate
```

## Starting the Server

Once configured, start the backend:

```bash
droiduse-backend serve
```

The server will:
1. Load `config.yaml`
2. Set `DATABASE_URL` environment variable from config
3. Initialize Prisma with the database connection
4. Start the WebSocket server on port 8000

## Troubleshooting

### Config Not Found

If you see "Could not load config.yaml: Using defaults":

1. Check the file exists: `ls droiduse_backend/config.yaml`
2. Check the path is correct relative to where you're running the command
3. Try using an absolute path in the config loader

### Database Connection Failed

1. Verify the `database_url` format is correct
2. Check PostgreSQL is running: `pg_isready`
3. Test the connection: `psql "postgresql://user:pass@host:port/db"`
4. Check firewall rules allow the connection

### API Keys Not Working

1. Verify the key is correctly set in config.yaml
2. Check for extra spaces or quotes
3. Try setting the environment variable instead
4. Validate with: `droiduse-backend validate-config`

## Example Complete Configuration

```yaml
api_keys:
  anthropic_api_key: ""
  database_url: ""

agent:
  max_steps: 15
  reasoning: true
  streaming: true

llm_profiles:
  manager:
    provider: Anthropic
    model: claude-sonnet-4-0
    temperature: 0.2
  executor:
    provider: Anthropic
    model: claude-sonnet-4-0
    temperature: 0.1

device:
  use_tcp: true
  platform: android

telemetry:
  enabled: true

tracing:
  enabled: false
  provider: phoenix

logging:
  debug: false
  save_trajectory: none
```
