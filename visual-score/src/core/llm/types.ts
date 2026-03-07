export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export type LLMChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolCall: LLMToolCall }
  | { type: 'stop' }
  | { type: 'error'; error: string };

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMStreamResult {
  usage: LLMUsage;
}
