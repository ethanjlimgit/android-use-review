import { Gemini, BaseLlm, type LlmRequest, type LlmResponse, type BaseLlmConnection } from '@google/adk';
import { OpenAiLlm } from './openai-llm.js';
import { AnthropicLlm } from './anthropic-llm.js';
import type { LlmProfile, ApiKeysConfig } from '../config/schema.js';
import { getApiKeyForProvider } from '../config/loader.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('models');

/**
 * Wraps a Gemini LLM to add logging for requests/responses.
 * We can't modify ADK's Gemini class, so this proxy adds observability.
 */
class LoggingGemini extends BaseLlm {
  private inner: Gemini;

  constructor(options: { model: string; apiKey: string }) {
    super({ model: options.model });
    this.inner = new Gemini(options);
  }

  async connect(llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    return this.inner.connect(llmRequest);
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
  ): AsyncGenerator<LlmResponse, void> {
    const msgCount = llmRequest.contents?.length ?? 0;
    const toolCount = Object.keys(llmRequest.toolsDict ?? {}).length;
    log.info(
      `LLM call: model=${this.model}, messages=${msgCount}, tools=${toolCount}, stream=${!!stream}`,
    );

    const startTime = performance.now();
    let chunkCount = 0;

    for await (const response of this.inner.generateContentAsync(llmRequest, stream)) {
      chunkCount++;
      // Log function calls and text on each response chunk
      const parts = response.content?.parts ?? [];
      for (const part of parts) {
        if (part.functionCall) {
          log.info(`  tool_call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args)})`);
        }
        if (part.text && !response.partial) {
          log.debug(`  response text: ${part.text.slice(0, 200)}...`);
        }
      }
      yield response;
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    log.info(`LLM complete: model=${this.model}, chunks=${chunkCount}, elapsed=${elapsed}s`);
  }
}

export { OpenAiLlm } from './openai-llm.js';
export { AnthropicLlm } from './anthropic-llm.js';

/**
 * Create a BaseLlm instance from an LlmProfile and API keys config.
 * This is the central factory for creating LLM instances across all providers.
 */
export function createLlm(
  profile: LlmProfile,
  apiKeys: ApiKeysConfig,
): BaseLlm {
  const apiKey = getApiKeyForProvider(apiKeys, profile.provider);

  switch (profile.provider) {
    case 'Gemini':
    case 'GoogleGenAI': {
      // ADK's built-in Gemini connector wrapped with logging.
      // Must pass apiKey explicitly — the Gemini SDK only checks
      // GOOGLE_GENAI_API_KEY / GEMINI_API_KEY env vars, not our config.
      if (!apiKey)
        throw new Error(
          'API key must be provided via config google_api_key or ' +
            'GOOGLE_GENAI_API_KEY / GEMINI_API_KEY environment variable.',
        );
      return new LoggingGemini({
        model: profile.model,
        apiKey,
      });
    }

    case 'OpenAI':
      if (!apiKey) throw new Error('OpenAI API key not configured');
      return new OpenAiLlm({
        model: profile.model,
        apiKey,
        temperature: profile.temperature,
        ...(profile.kwargs.max_tokens
          ? { maxTokens: profile.kwargs.max_tokens as number }
          : {}),
      });

    case 'OpenAILike':
      if (!apiKey && !profile.kwargs.api_key)
        throw new Error('API key not configured for OpenAI-compatible endpoint');
      return new OpenAiLlm({
        model: profile.model,
        apiKey: (profile.kwargs.api_key as string) ?? apiKey ?? '',
        baseUrl: profile.baseUrl ?? profile.apiBase,
        temperature: profile.temperature,
        ...(profile.kwargs.max_tokens
          ? { maxTokens: profile.kwargs.max_tokens as number }
          : {}),
      });

    case 'Anthropic':
      if (!apiKey) throw new Error('Anthropic API key not configured');
      return new AnthropicLlm({
        model: profile.model,
        apiKey,
        temperature: profile.temperature,
        ...(profile.kwargs.max_tokens
          ? { maxTokens: profile.kwargs.max_tokens as number }
          : {}),
      });

    case 'DeepSeek':
      if (!apiKey) throw new Error('DeepSeek API key not configured');
      return new OpenAiLlm({
        model: profile.model,
        apiKey,
        baseUrl: profile.baseUrl ?? 'https://api.deepseek.com',
        temperature: profile.temperature,
      });

    case 'Groq':
      if (!apiKey) throw new Error('Groq API key not configured');
      return new OpenAiLlm({
        model: profile.model,
        apiKey,
        baseUrl: profile.baseUrl ?? 'https://api.groq.com/openai/v1',
        temperature: profile.temperature,
      });

    case 'Ollama':
      return new OpenAiLlm({
        model: profile.model,
        apiKey: 'ollama', // Ollama doesn't need a real key
        baseUrl: profile.baseUrl ?? 'http://localhost:11434/v1',
        temperature: profile.temperature,
      });

    case 'OpenRouter':
      if (!apiKey && !profile.kwargs.api_key)
        throw new Error('OpenRouter API key not configured');
      return new OpenAiLlm({
        model: profile.model,
        apiKey: (profile.kwargs.api_key as string) ?? apiKey ?? '',
        baseUrl: profile.baseUrl ?? 'https://openrouter.ai/api/v1',
        temperature: profile.temperature,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${profile.provider}`);
  }
}

/**
 * Create LLM instances for all agent profiles.
 */
export function createLlmMap(
  llmProfiles: Record<string, LlmProfile>,
  apiKeys: ApiKeysConfig,
): Record<string, BaseLlm> {
  const map: Record<string, BaseLlm> = {};
  for (const [name, profile] of Object.entries(llmProfiles)) {
    try {
      map[name] = createLlm(profile, apiKeys);
      log.info(`LLM created for profile "${name}": ${profile.provider}/${profile.model}`);
    } catch (err) {
      log.warn(`Failed to create LLM for profile "${name}": ${(err as Error).message}`);
    }
  }
  return map;
}
