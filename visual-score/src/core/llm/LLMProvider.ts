import type { LLMChunk, LLMMessage, LLMOptions, LLMToolDefinition, LLMUsage } from './types.js';

export interface LLMProvider {
  readonly name: string;
  readonly modelId: string;
  readonly supportsNativeToolUse: boolean;

  stream(
    systemPrompt: string,
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMChunk>;

  getUsage(): LLMUsage;
  resetUsage(): void;
}
