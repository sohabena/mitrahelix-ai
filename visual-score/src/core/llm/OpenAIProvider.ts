import OpenAI from 'openai';
import type { LLMProvider } from './LLMProvider.js';
import type { LLMChunk, LLMMessage, LLMOptions, LLMToolDefinition, LLMUsage } from './types.js';

export type OpenAIBackendType = 'openai' | 'google' | 'deepseek' | 'openrouter' | 'ollama';

function isReasoningModel(modelId: string): boolean {
  const baseName = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
  if (baseName === 'deepseek-reasoner') return true;
  if (baseName.startsWith('o1') || baseName.startsWith('o3') || baseName.startsWith('o4')) return true;
  if (/^gpt-5($|\.\d)/.test(baseName)) return true;
  return false;
}

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  readonly supportsNativeToolUse: boolean;
  readonly modelId: string;

  private client: OpenAI;
  private usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
  private backendType: OpenAIBackendType;

  constructor(
    apiKey: string,
    model?: string,
    baseURL?: string,
    nativeToolUse: boolean = true,
    backendType: OpenAIBackendType = 'openai'
  ) {
    this.supportsNativeToolUse = nativeToolUse;
    this.modelId = model || 'gpt-5.2';
    this.backendType = backendType;
    this.name = backendType;

    const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
    if (baseURL) {
      opts.baseURL = baseURL;
    }
    // OpenRouter requires attribution headers
    if (backendType === 'openrouter') {
      opts.defaultHeaders = {
        'HTTP-Referer': 'https://github.com/mitrahelix',
        'X-Title': 'MitraHelix AI Agent',
      };
    }
    this.client = new OpenAI(opts);
  }

  async *stream(
    systemPrompt: string,
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMChunk> {
    const openaiMessages = this.convertMessages(systemPrompt, messages);

    // Build params carefully per provider to avoid unsupported parameter errors
    const params: Record<string, unknown> = {
      model: this.modelId,
      messages: openaiMessages,
      stream: true,
    };

    // max_completion_tokens for native OpenAI (required for GPT-5.x / o-series)
    // max_tokens for all OpenAI-compatible endpoints (Google, DeepSeek, Ollama, OpenRouter)
    if (this.backendType === 'openai') {
      params.max_completion_tokens = options?.maxTokens || 16384;
    } else {
      params.max_tokens = options?.maxTokens || 16384;
    }

    // stream_options for usage tracking — supported by OpenAI, DeepSeek, OpenRouter, Google (2.5+)
    // Ollama's OpenAI-compat layer doesn't reliably support it
    if (this.backendType !== 'ollama') {
      params.stream_options = { include_usage: true };
    }

    // Temperature — not supported by reasoning models
    if (options?.temperature !== undefined && !isReasoningModel(this.modelId)) {
      params.temperature = options.temperature;
    }

    if (tools && tools.length > 0) {
      params.tools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    try {
      const stream = await this.client.chat.completions.create(
        params as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
        options?.signal ? { signal: options.signal } : {}
      );

      const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];

        if (choice?.delta?.content) {
          yield { type: 'text', text: choice.delta.content };
        }

        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            if (!toolCallAccumulators.has(tc.index)) {
              toolCallAccumulators.set(tc.index, {
                id: tc.id || '',
                name: tc.function?.name || '',
                args: '',
              });
            }
            const acc = toolCallAccumulators.get(tc.index)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
        }

        if (choice?.finish_reason) {
          if (choice.finish_reason === 'content_filter') {
            yield { type: 'error', error: 'Response blocked by content filter.' };
            return;
          }
          if (choice.finish_reason === 'length') {
            yield { type: 'text', text: '\n\n[Response truncated — max output tokens reached]' };
            toolCallAccumulators.clear();
          } else {
            for (const [, acc] of toolCallAccumulators) {
              let args: Record<string, unknown> = {};
              try {
                if (acc.args) args = JSON.parse(acc.args);
              } catch {
                args = { _raw: acc.args };
              }
              yield {
                type: 'tool_use',
                toolCall: { id: acc.id, name: acc.name, arguments: args },
              };
            }
            toolCallAccumulators.clear();
          }
        }

        if (chunk.usage) {
          this.usage.inputTokens += chunk.usage.prompt_tokens || 0;
          this.usage.outputTokens += chunk.usage.completion_tokens || 0;
        }
      }

      // Flush any remaining tool calls if stream ended without finish_reason
      if (toolCallAccumulators.size > 0) {
        for (const [, acc] of toolCallAccumulators) {
          let args: Record<string, unknown> = {};
          try {
            if (acc.args) args = JSON.parse(acc.args);
          } catch {
            args = { _raw: acc.args };
          }
          yield {
            type: 'tool_use',
            toolCall: { id: acc.id, name: acc.name, arguments: args },
          };
        }
      }

      yield { type: 'stop' };
    } catch (error: unknown) {
      if (options?.signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      const providerLabel = this.backendType === 'openai' ? 'OpenAI'
        : this.backendType === 'google' ? 'Google Gemini'
        : this.backendType === 'deepseek' ? 'DeepSeek'
        : this.backendType === 'openrouter' ? 'OpenRouter'
        : this.backendType === 'ollama' ? 'Ollama'
        : 'LLM';

      if (message.includes('Incorrect API key') || message.includes('401') || message.includes('authentication')) {
        yield { type: 'error', error: `Invalid API key. Please check your ${providerLabel} API key in VS Code settings.` };
      } else if (message.includes('Rate limit') || message.includes('429')) {
        yield { type: 'error', error: `Rate limited by ${providerLabel}. Please wait a moment and try again.` };
      } else if (message.includes('model_not_found') || message.includes('does not exist') || message.includes('404')) {
        yield { type: 'error', error: `Model "${this.modelId}" not found on ${providerLabel}. Check your model setting.` };
      } else {
        yield { type: 'error', error: `${providerLabel} API error: ${message}` };
      }
    }
  }

  getUsage(): LLMUsage {
    return { ...this.usage };
  }

  resetUsage(): void {
    this.usage = { inputTokens: 0, outputTokens: 0 };
  }

  private convertMessages(systemPrompt: string, messages: LLMMessage[]): OpenAI.ChatCompletionMessageParam[] {
    const useDevRole = this.backendType === 'openai' && isReasoningModel(this.modelId);
    const systemRole = useDevRole ? 'developer' : 'system';
    const result: OpenAI.ChatCompletionMessageParam[] = [
      { role: systemRole as 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        if (msg.imageContent && msg.imageContent.length > 0) {
          const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
            { type: 'text', text: msg.content },
          ];
          for (const part of msg.imageContent) {
            if (part.type === 'image') {
              parts.push({
                type: 'image_url',
                image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
              });
            } else if (part.type === 'image_url') {
              parts.push({ type: 'image_url', image_url: part.image_url });
            }
          }
          result.push({ role: 'user', content: parts } as OpenAI.ChatCompletionMessageParam);
        } else {
          result.push({ role: 'user', content: msg.content });
        }
      } else if (msg.role === 'assistant') {
        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: msg.content || null,
        };
        if (this.supportsNativeToolUse && msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        result.push(assistantMsg);
      } else if (msg.role === 'tool') {
        if (this.supportsNativeToolUse) {
          result.push({
            role: 'tool',
            tool_call_id: msg.toolCallId || '',
            content: msg.content,
          });
        } else {
          result.push({
            role: 'user',
            content: `[Tool Result (${msg.toolCallId})]\n${msg.content}`,
          });
        }
      }
    }

    return result;
  }
}
