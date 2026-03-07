export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'approved' | 'rejected' | 'completed' | 'failed';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Attachment {
  type: 'file' | 'folder' | 'url' | 'problems';
  value: string;
}

export interface Settings {
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'openrouter' | 'ollama';
  model: string;
  maxTokens: number;
  maxBudgetPerTask: number;
  autoApproveReads: boolean;
  autoApproveWrites: boolean;
  autoApproveCommands: string[];
  contextWindowSize: number;
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export type AgentState = 'idle' | 'thinking' | 'tool_calling' | 'awaiting_approval' | 'streaming' | 'error';

// Webview → Extension messages
export type WebviewMessage =
  | { type: 'sendMessage'; text: string; attachments?: Attachment[] }
  | { type: 'cancelTask' }
  | { type: 'approveToolCall'; toolCallId: string }
  | { type: 'rejectToolCall'; toolCallId: string; reason?: string }
  | { type: 'newTask' }
  | { type: 'getState' }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'restoreCheckpoint'; checkpointId: string }
  | { type: 'toggleMode'; mode: 'act' | 'plan' }
  | { type: 'selectModel'; provider: string; model: string }
  | { type: 'runWorkflow'; workflowName: string; userText: string }
  | { type: 'webviewReady' };

// Extension → Webview messages
export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsToolUse: boolean;
}

export interface WorkflowInfo {
  name: string;
  description: string;
  fileName: string;
}

export type ExtensionMessage =
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'updateMessage'; messageId: string; content: string; isStreaming: boolean }
  | { type: 'streamToken'; messageId: string; token: string }
  | { type: 'streamEnd'; messageId: string }
  | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
  | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
  | { type: 'requestApproval'; toolCall: ToolCallInfo }
  | { type: 'taskCompleted'; summary: string }
  | { type: 'taskError'; error: string }
  | { type: 'costUpdate'; cost: CostInfo }
  | { type: 'stateUpdate'; state: AgentState }
  | { type: 'settingsLoaded'; settings: Settings }
  | { type: 'modelCatalog'; models: ModelCatalogEntry[]; currentProvider: string; currentModel: string }
  | { type: 'workflowList'; workflows: WorkflowInfo[] }
  | { type: 'clearMessages' };
