import { BaseLlm } from '@google/adk';
import type { LlmRequest, LlmResponse, BaseLlmConnection } from '@google/adk';
import type { Part, Content } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  Tool,
  ContentBlockDeltaEvent,
  Message,
  ImageBlockParam,
  TextBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('anthropic-llm');

interface AnthropicLlmOptions {
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Custom BaseLlm adapter for Anthropic Claude models.
 */
export class AnthropicLlm extends BaseLlm {
  private client: Anthropic;
  private temperature: number;
  private maxTokens: number;

  constructor(options: AnthropicLlmOptions) {
    super({ model: options.model });
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens ?? 8192;
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connections not supported for Anthropic adapter');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
  ): AsyncGenerator<LlmResponse, void> {
    const { systemPrompt, messages } = this.convertMessages(llmRequest);
    const tools = this.convertTools(llmRequest);

    log.info(
      `LLM call: model=${this.model}, messages=${messages.length}, tools=${tools.length}, stream=${!!stream}`,
    );

    const baseParams = {
      model: this.model,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    } as const;

    const startTime = performance.now();

    if (stream) {
      const response = this.client.messages.stream(baseParams);

      for await (const event of response) {
        if (event.type === 'content_block_delta') {
          const delta = event as ContentBlockDeltaEvent;
          if (delta.delta.type === 'text_delta') {
            yield {
              content: {
                role: 'model',
                parts: [{ text: delta.delta.text }],
              },
              partial: true,
            };
          }
        }
      }

      const finalMessage = await response.finalMessage();
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const toolUseBlocks = finalMessage.content.filter((b) => b.type === 'tool_use');
      const textBlocks = finalMessage.content.filter((b) => b.type === 'text');
      log.info(
        `LLM stream complete: model=${this.model}, elapsed=${elapsed}s, toolCalls=${toolUseBlocks.length}, stopReason=${finalMessage.stop_reason}`,
      );
      for (const block of toolUseBlocks) {
        if (block.type === 'tool_use') {
          log.info(`  tool_call: ${block.name}(${JSON.stringify(block.input)})`);
        }
      }
      for (const block of textBlocks) {
        if (block.type === 'text') {
          log.debug(`  response text: ${block.text.slice(0, 200)}...`);
        }
      }
      yield this.convertResponse(finalMessage);
    } else {
      const response = await this.client.messages.create({
        ...baseParams,
        stream: false,
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const textBlocks = response.content.filter((b) => b.type === 'text');
      log.info(
        `LLM response: model=${this.model}, elapsed=${elapsed}s, toolCalls=${toolUseBlocks.length}, stopReason=${response.stop_reason}`,
      );
      for (const block of toolUseBlocks) {
        if (block.type === 'tool_use') {
          log.info(`  tool_call: ${block.name}(${JSON.stringify(block.input)})`);
        }
      }
      for (const block of textBlocks) {
        if (block.type === 'text') {
          log.debug(`  response text: ${block.text.slice(0, 200)}...`);
        }
      }

      yield this.convertResponse(response);
    }
  }

  private convertMessages(llmRequest: LlmRequest): {
    systemPrompt: string | undefined;
    messages: MessageParam[];
  } {
    let systemPrompt: string | undefined;
    const messages: MessageParam[] = [];

    // System instruction
    const systemInstruction = llmRequest.config?.systemInstruction;
    if (systemInstruction) {
      systemPrompt = this.extractText(systemInstruction);
    }

    // Conversation contents
    if (llmRequest.contents) {
      for (const content of llmRequest.contents) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        const parts = content.parts ?? [];

        const functionCalls = parts.filter((p) => p.functionCall);
        const functionResponses = parts.filter((p) => p.functionResponse);
        const textParts = parts.filter(
          (p) => p.text !== undefined && !p.functionCall && !p.functionResponse,
        );
        const imageParts = parts.filter((p) => p.inlineData);

        if (functionCalls.length > 0) {
          const contentBlocks: Array<TextBlockParam | ToolUseBlockParam> = [];
          for (const tp of textParts) {
            contentBlocks.push({ type: 'text', text: tp.text ?? '' });
          }
          for (const fc of functionCalls) {
            const call = fc.functionCall!;
            contentBlocks.push({
              type: 'tool_use',
              id: call.id ?? `toolu_${Date.now()}`,
              name: call.name!,
              input: call.args ?? {},
            });
          }
          messages.push({ role: 'assistant', content: contentBlocks });
        } else if (functionResponses.length > 0) {
          const resultBlocks: ToolResultBlockParam[] = [];
          for (const fr of functionResponses) {
            const resp = fr.functionResponse!;
            resultBlocks.push({
              type: 'tool_result',
              tool_use_id: resp.id ?? resp.name ?? '',
              content: JSON.stringify(resp.response),
            });
          }
          messages.push({ role: 'user', content: resultBlocks });
        } else {
          const contentBlocks: Array<TextBlockParam | ImageBlockParam> = [];
          for (const tp of textParts) {
            contentBlocks.push({ type: 'text', text: tp.text ?? '' });
          }
          for (const ip of imageParts) {
            const data = ip.inlineData!;
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: data.mimeType as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: data.data!,
              },
            });
          }
          if (contentBlocks.length > 0) {
            messages.push({ role, content: contentBlocks });
          }
        }
      }
    }

    return { systemPrompt, messages };
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

  private convertTools(llmRequest: LlmRequest): Tool[] {
    const tools: Tool[] = [];
    const declarations = llmRequest.config?.tools;

    if (declarations) {
      for (const toolGroup of declarations) {
        const funcDecls = (
          toolGroup as { functionDeclarations?: Array<Record<string, unknown>> }
        ).functionDeclarations;
        if (funcDecls) {
          for (const decl of funcDecls) {
            tools.push({
              name: decl.name as string,
              description: (decl.description as string) ?? '',
              input_schema: (decl.parameters as Tool.InputSchema) ?? {
                type: 'object',
                properties: {},
              },
            });
          }
        }
      }
    }

    return tools;
  }

  private convertResponse(response: Message): LlmResponse {
    const parts: Part[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            id: block.id,
            name: block.name,
            args: block.input as Record<string, unknown>,
          },
        });
      }
    }

    return {
      content: { role: 'model', parts },
      turnComplete: response.stop_reason === 'end_turn',
    };
  }
}
