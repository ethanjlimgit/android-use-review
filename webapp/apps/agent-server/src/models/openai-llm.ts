import { BaseLlm } from '@google/adk';
import type { LlmRequest, LlmResponse, BaseLlmConnection } from '@google/adk';
import type { Part, Content } from '@google/genai';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionChunk,
  ChatCompletion,
} from 'openai/resources/chat/completions.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('openai-llm');

interface OpenAiLlmOptions {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Custom BaseLlm adapter for OpenAI-compatible APIs.
 * Works with OpenAI, DeepSeek, Groq, OpenRouter, and any OpenAI-compatible endpoint.
 */
export class OpenAiLlm extends BaseLlm {
  private client: OpenAI;
  private temperature: number;
  private maxTokens?: number;

  constructor(options: OpenAiLlmOptions) {
    super({ model: options.model });
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens;
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connections not supported for OpenAI adapter');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
  ): AsyncGenerator<LlmResponse, void> {
    const messages = this.convertMessages(llmRequest);
    const tools = this.convertTools(llmRequest);

    log.info(
      `LLM call: model=${this.model}, messages=${messages.length}, tools=${tools.length}, stream=${!!stream}`,
    );

    const baseParams = {
      model: this.model,
      messages,
      temperature: this.temperature,
      ...(this.maxTokens ? { max_tokens: this.maxTokens } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    } as const;

    const startTime = performance.now();

    if (stream) {
      const response = await this.client.chat.completions.create({
        ...baseParams,
        stream: true,
      });

      let chunkCount = 0;
      for await (const chunk of response) {
        const llmResponse = this.convertStreamChunk(chunk);
        if (llmResponse) {
          chunkCount++;
          yield llmResponse;
        }
      }
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      log.info(`LLM stream complete: model=${this.model}, chunks=${chunkCount}, elapsed=${elapsed}s`);
    } else {
      const response = await this.client.chat.completions.create({
        ...baseParams,
        stream: false,
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const choice = response.choices[0];
      const toolCalls = choice?.message.tool_calls;
      const textLen = choice?.message.content?.length ?? 0;
      log.info(
        `LLM response: model=${this.model}, elapsed=${elapsed}s, textLen=${textLen}, toolCalls=${toolCalls?.length ?? 0}, finishReason=${choice?.finish_reason}`,
      );
      if (toolCalls) {
        for (const tc of toolCalls) {
          log.info(`  tool_call: ${tc.function.name}(${tc.function.arguments})`);
        }
      }
      if (choice?.message.content) {
        log.debug(`  response text: ${choice.message.content.slice(0, 200)}...`);
      }

      yield this.convertResponse(response);
    }
  }

  private convertMessages(llmRequest: LlmRequest): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];

    // System instruction
    const systemInstruction = llmRequest.config?.systemInstruction;
    if (systemInstruction) {
      const text = this.extractText(systemInstruction);
      if (text) {
        messages.push({ role: 'system', content: text });
      }
    }

    // Conversation contents
    if (llmRequest.contents) {
      for (const content of llmRequest.contents) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        const parts = content.parts ?? [];

        // Handle function calls (model -> tool_calls)
        const functionCalls = parts.filter((p) => p.functionCall);
        const functionResponses = parts.filter((p) => p.functionResponse);
        const textParts = parts.filter(
          (p) => p.text !== undefined && !p.functionCall && !p.functionResponse,
        );
        const imageParts = parts.filter((p) => p.inlineData);

        if (functionCalls.length > 0) {
          const toolCalls = functionCalls.map((fc, i) => {
            const call = fc.functionCall!;
            return {
              id: call.id ?? `call_${i}`,
              type: 'function' as const,
              function: {
                name: call.name!,
                arguments: JSON.stringify(call.args ?? {}),
              },
            };
          });
          const text = textParts.map((p) => p.text ?? '').join('');
          messages.push({
            role: 'assistant',
            content: text || null,
            tool_calls: toolCalls,
          });
        } else if (functionResponses.length > 0) {
          for (const fr of functionResponses) {
            const resp = fr.functionResponse!;
            messages.push({
              role: 'tool',
              tool_call_id: resp.id ?? resp.name ?? '',
              content: JSON.stringify(resp.response),
            });
          }
        } else if (imageParts.length > 0) {
          const contentParts: Array<
            | { type: 'text'; text: string }
            | {
                type: 'image_url';
                image_url: { url: string; detail?: string };
              }
          > = [];
          for (const p of textParts) {
            contentParts.push({ type: 'text', text: p.text ?? '' });
          }
          for (const p of imageParts) {
            const data = p.inlineData!;
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${data.mimeType};base64,${data.data}`,
              },
            });
          }
          messages.push({
            role,
            content: contentParts as ChatCompletionMessageParam['content'],
          } as ChatCompletionMessageParam);
        } else {
          const text = textParts.map((p) => p.text ?? '').join('');
          if (text) {
            messages.push({ role, content: text });
          }
        }
      }
    }

    return messages;
  }

  private extractText(contentUnion: unknown): string | undefined {
    if (typeof contentUnion === 'string') return contentUnion;
    if (contentUnion && typeof contentUnion === 'object') {
      const content = contentUnion as Content;
      if (content.parts) {
        return content.parts
          .map((p) => p.text)
          .filter(Boolean)
          .join('\n');
      }
    }
    return undefined;
  }

  private convertTools(llmRequest: LlmRequest): ChatCompletionTool[] {
    const tools: ChatCompletionTool[] = [];
    const declarations = llmRequest.config?.tools;

    if (declarations) {
      for (const toolGroup of declarations) {
        const funcDecls = (
          toolGroup as { functionDeclarations?: Array<Record<string, unknown>> }
        ).functionDeclarations;
        if (funcDecls) {
          for (const decl of funcDecls) {
            tools.push({
              type: 'function',
              function: {
                name: decl.name as string,
                description: (decl.description as string) ?? '',
                parameters: (decl.parameters as Record<string, unknown>) ?? {
                  type: 'object',
                  properties: {},
                },
              },
            });
          }
        }
      }
    }

    return tools;
  }

  private convertResponse(response: ChatCompletion): LlmResponse {
    const choice = response.choices[0];
    if (!choice) {
      return {
        content: { role: 'model', parts: [{ text: '' }] },
        turnComplete: true,
      };
    }

    const parts: Part[] = [];

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        parts.push({
          functionCall: {
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        });
      }
    }

    return {
      content: { role: 'model', parts },
      turnComplete: choice.finish_reason === 'stop',
    };
  }

  private convertStreamChunk(
    chunk: ChatCompletionChunk,
  ): LlmResponse | undefined {
    const choice = chunk.choices[0];
    if (!choice) return undefined;

    const parts: Part[] = [];

    if (choice.delta.content) {
      parts.push({ text: choice.delta.content });
    }

    if (choice.delta.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        if (tc.function?.name) {
          parts.push({
            functionCall: {
              id: tc.id,
              name: tc.function.name,
              args: tc.function.arguments
                ? JSON.parse(tc.function.arguments)
                : {},
            },
          });
        }
      }
    }

    if (parts.length === 0) return undefined;

    return {
      content: { role: 'model', parts },
      partial: choice.finish_reason === null,
      turnComplete: choice.finish_reason === 'stop',
    };
  }
}
