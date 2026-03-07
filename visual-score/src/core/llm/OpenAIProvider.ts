import OpenAI from 'openai';
import type { LLMProvider } from './LLMProvider.js';
import type { LLMChunk, LLMMessage, LLMOptions, LLMToolDefinition, LLMUsage } from './types.js';

export type OpenAIBackendType = 'openai' | 'google' | 'deepseek' | 'openrouter' | 'ollama';

// Reasoning models that don't support temperature or system messages in some cases
const REASONING_MODEL_PREFIXES = ['o1', 'o3', 'o4', 'gpt-5', 'deepseek-reasoner'];

function isReasoningModel(modelId: string): boolean {
  return REASONING_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
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
      params.max_completion_tokens = options?.maxTokens || 8192;
    } else {
      params.max_tokens = options?.maxTokens || 8192;
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
        params as unknown as OpenAI.ChatCompletionCreateParamsStreaming
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

        if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop') {
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

        if (chunk.usage) {
          this.usage.inputTokens += chunk.usage.prompt_tokens || 0;
          this.usage.outputTokens += chunk.usage.completion_tokens || 0;
        }
      }

      yield { type: 'stop' };
    } catch (error: unknown) {
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
    const result: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: msg.content || null,
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
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
        result.push({
          role: 'tool',
          tool_call_id: msg.toolCallId || '',
          content: msg.content,
        });
      }
    }

    return result;
  }
}
