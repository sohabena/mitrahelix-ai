export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image_url'; image_url: { url: string } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  imageContent?: ContentPart[];
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
  isError?: boolean;
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
  signal?: AbortSignal;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}
