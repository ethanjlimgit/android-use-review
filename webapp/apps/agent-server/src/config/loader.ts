import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createChildLogger } from '../logger.js';
import {
  androidUseConfigSchema,
  type AndroidUseConfig,
  type ApiKeysConfig,
  type LlmProfile,
} from './schema.js';

const log = createChildLogger('config');

/**
 * Deep merge two objects. Override values take precedence.
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const k = key as keyof T;
    if (
      k in result &&
      typeof result[k] === 'object' &&
      result[k] !== null &&
      !Array.isArray(result[k]) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[k] = deepMerge(
        result[k] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[k] = value as T[keyof T];
    }
  }
  return result;
}

/**
 * Convert snake_case YAML-style keys to camelCase for TypeScript config.
 */
function snakeToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c: string) =>
        c.toUpperCase(),
      );
      result[camelKey] = snakeToCamel(value);
    }
    return result;
  }
  return obj;
}

/**
 * Load config from a JSON file.
 */
export function loadConfig(configPath: string): AndroidUseConfig {
  const absPath = resolve(configPath);
  if (!existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`);
  }

  const raw = readFileSync(absPath, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const camelData = snakeToCamel(data);
  const config = androidUseConfigSchema.parse(camelData);

  // Backfill API keys from environment variables
  fillApiKeysFromEnv(config.apiKeys);

  // Ensure default LLM profiles exist
  if (Object.keys(config.llmProfiles).length === 0) {
    config.llmProfiles = getDefaultLlmProfiles();
  }

  log.info('Config loaded from %s', absPath);
  return config;
}

/**
 * Load config with base + override merging.
 */
export function loadConfigWithBase(
  basePath: string,
  overridePath: string,
): AndroidUseConfig {
  const baseRaw = JSON.parse(
    readFileSync(resolve(basePath), 'utf-8'),
  ) as Record<string, unknown>;
  const overrideRaw = JSON.parse(
    readFileSync(resolve(overridePath), 'utf-8'),
  ) as Record<string, unknown>;

  const merged = deepMerge(baseRaw, overrideRaw);
  const camelData = snakeToCamel(merged);
  const config = androidUseConfigSchema.parse(camelData);

  fillApiKeysFromEnv(config.apiKeys);
  if (Object.keys(config.llmProfiles).length === 0) {
    config.llmProfiles = getDefaultLlmProfiles();
  }

  log.info('Config loaded from %s + %s', basePath, overridePath);
  return config;
}

/**
 * Create a default config (no file needed).
 */
export function createDefaultConfig(): AndroidUseConfig {
  const config = androidUseConfigSchema.parse({});
  fillApiKeysFromEnv(config.apiKeys);
  config.llmProfiles = getDefaultLlmProfiles();
  return config;
}

/**
 * Default config file paths, checked in order.
 */
const DEFAULT_CONFIG_PATHS = [
  'config.json',
  'config.local.json',
];

/**
 * Load config from default file (config.json) if it exists,
 * otherwise fall back to createDefaultConfig().
 */
export function loadDefaultConfig(): AndroidUseConfig {
  for (const p of DEFAULT_CONFIG_PATHS) {
    const absPath = resolve(p);
    if (existsSync(absPath)) {
      log.info(`Auto-loading config from ${absPath}`);
      return loadConfig(absPath);
    }
  }
  return createDefaultConfig();
}

/**
 * Fill API keys from environment variables if not set in config.
 */
function fillApiKeysFromEnv(apiKeys: ApiKeysConfig): void {
  if (!apiKeys.googleApiKey)
    apiKeys.googleApiKey =
      process.env.GOOGLE_API_KEY ??
      process.env.GOOGLE_GENAI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      '';
  if (!apiKeys.openaiApiKey)
    apiKeys.openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKeys.anthropicApiKey)
    apiKeys.anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKeys.deepseekApiKey)
    apiKeys.deepseekApiKey = process.env.DEEPSEEK_API_KEY ?? '';
  if (!apiKeys.groqApiKey) apiKeys.groqApiKey = process.env.GROQ_API_KEY ?? '';
}

/**
 * Get the API key for a given LLM provider.
 */
export function getApiKeyForProvider(
  apiKeys: ApiKeysConfig,
  provider: string,
): string | undefined {
  const keyMap: Record<string, string> = {
    Gemini: apiKeys.googleApiKey,
    GoogleGenAI: apiKeys.googleApiKey,
    OpenAI: apiKeys.openaiApiKey,
    OpenAILike: apiKeys.openaiApiKey,
    Anthropic: apiKeys.anthropicApiKey,
    DeepSeek: apiKeys.deepseekApiKey,
    Groq: apiKeys.groqApiKey,
  };
  const key = keyMap[provider];
  return key && key.trim() !== '' ? key : undefined;
}

function getDefaultLlmProfiles(): Record<string, LlmProfile> {
  return {
    manager: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      kwargs: {},
    },
    executor: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      kwargs: {},
    },
    codeact: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      kwargs: {},
    },
    textManipulator: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      kwargs: {},
    },
    appOpener: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.0,
      kwargs: {},
    },
    scripter: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      kwargs: {},
    },
    structuredOutput: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.0,
      kwargs: {},
    },
  };
}
