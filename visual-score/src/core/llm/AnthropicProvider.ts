import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './LLMProvider.js';
import type { LLMChunk, LLMMessage, LLMOptions, LLMToolDefinition, LLMUsage } from './types.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly supportsNativeToolUse = true;
  readonly modelId: string;

  private client: Anthropic;
  private usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(apiKey: string, model?: string) {
    this.modelId = model || 'claude-sonnet-4-6';
    this.client = new Anthropic({ apiKey });
  }

  async *stream(
    systemPrompt: string,
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMChunk> {
    const anthropicMessages = this.convertMessages(messages);

    const params: Anthropic.MessageCreateParams = {
      model: this.modelId,
      max_tokens: options?.maxTokens || 16384,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    };

    if (options?.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    if (tools && tools.length > 0) {
      params.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      }));
    }

    try {
      const stream = this.client.messages.stream(params, options?.signal ? { signal: options.signal } : {});

      let currentToolCallId = '';
      let currentToolName = '';
      let currentToolInput = '';

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolCallId = event.content_block.id;
            currentToolName = event.content_block.name;
            currentToolInput = '';
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', text: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            currentToolInput += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolCallId) {
            let args: Record<string, unknown> = {};
            try {
              if (currentToolInput) {
                args = JSON.parse(currentToolInput);
              }
            } catch {
              args = { _raw: currentToolInput };
            }
            yield {
              type: 'tool_use',
              toolCall: {
                id: currentToolCallId,
                name: currentToolName,
                arguments: args,
              },
            };
            currentToolCallId = '';
            currentToolName = '';
            currentToolInput = '';
          }
        } else if (event.type === 'message_delta') {
          if (event.usage) {
            this.usage.outputTokens += event.usage.output_tokens;
          }
          const delta = 'delta' in event ? (event.delta as { stop_reason?: string }) : null;
          if (delta?.stop_reason === 'max_tokens') {
            yield { type: 'text', text: '\n\n[Response truncated — max output tokens reached]' };
          }
        } else if (event.type === 'message_start') {
          if (event.message.usage) {
            this.usage.inputTokens += event.message.usage.input_tokens;
          }
        }
      }

      yield { type: 'stop' };
    } catch (error: unknown) {
      if (options?.signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('authentication') || message.includes('api_key') || message.includes('401')) {
        yield { type: 'error', error: 'Invalid API key. Please check your Anthropic API key in VS Code settings.' };
      } else if (message.includes('rate_limit') || message.includes('429')) {
        yield { type: 'error', error: 'Rate limited by Anthropic. Please wait a moment and try again.' };
      } else {
        yield { type: 'error', error: `Anthropic API error: ${message}` };
      }
    }
  }

  getUsage(): LLMUsage {
    return { ...this.usage };
  }

  resetUsage(): void {
    this.usage = { inputTokens: 0, outputTokens: 0 };
  }

  private convertMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        const contentParts: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
          { type: 'text', text: msg.content },
        ];
        if (msg.imageContent) {
          for (const part of msg.imageContent) {
            if (part.type === 'image') {
              contentParts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: part.source.media_type as Anthropic.ImageBlockParam.Source['media_type'],
                  data: part.source.data,
                },
              });
            }
          }
        }
        const hasImages = contentParts.length > 1;
        const lastMsg = result[result.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          const existing: unknown[] =
            typeof lastMsg.content === 'string'
              ? [{ type: 'text', text: lastMsg.content }]
              : Array.isArray(lastMsg.content) ? [...lastMsg.content] : [];
          existing.push(...contentParts);
          (lastMsg as { role: 'user'; content: unknown }).content = existing;
        } else {
          result.push({
            role: 'user',
            content: hasImages ? contentParts : msg.content,
          } as Anthropic.MessageParam);
        }
      } else if (msg.role === 'assistant') {
        const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }
        // Anthropic requires at least one content block in assistant messages
        if (content.length === 0) {
          content.push({ type: 'text', text: '(empty response)' });
        }
        result.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        const toolResultBlock = {
          type: 'tool_result' as const,
          tool_use_id: msg.toolCallId || '',
          content: msg.content,
          ...(msg.isError ? { is_error: true } : {}),
        };
        // Merge consecutive tool results into a single user message
        // Anthropic requires all tool_results after a multi-tool assistant message
        // to be in ONE user message, not separate ones
        const lastMsg = result[result.length - 1];
        if (
          lastMsg &&
          lastMsg.role === 'user' &&
          Array.isArray(lastMsg.content) &&
          lastMsg.content.length > 0 &&
          typeof lastMsg.content[0] === 'object' &&
          'type' in lastMsg.content[0] &&
          (lastMsg.content[0] as { type: string }).type === 'tool_result'
        ) {
          (lastMsg.content as Array<typeof toolResultBlock>).push(toolResultBlock);
        } else {
          result.push({
            role: 'user',
            content: [toolResultBlock],
          });
        }
      }
    }

    return result;
  }
}
