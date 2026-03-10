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
  diff?: { filePath: string; original: string; modified: string; isNewFile: boolean; addedLines: number; removedLines: number };
}

export interface Attachment {
  type: 'file' | 'folder' | 'url' | 'problems' | 'git' | 'terminal' | 'selection' | 'image';
  value: string;
  displayName?: string;
  mimeType?: string;
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
  | { type: 'toggleMode'; mode: string }
  | { type: 'selectModel'; provider: string; model: string }
  | { type: 'runWorkflow'; workflowName: string; userText: string; attachments?: Attachment[] }
  | { type: 'webviewReady' }
  | { type: 'requestFileList'; query: string }
  | { type: 'requestFolderList'; query: string }
  | { type: 'openRulesFile' }
  | { type: 'showDiff'; filePath: string; original: string; modified: string }
  | { type: 'requestTaskHistory' }
  | { type: 'deleteTaskHistory'; taskId: string }
  | { type: 'exportTaskHistory'; taskId: string; format: 'markdown' | 'json' }
  | { type: 'resumeTask'; taskId: string }
  | { type: 'requestCheckpoints' }
  | { type: 'restoreCheckpoint'; checkpointId: string }
  | { type: 'runCodeBlock'; code: string; language: string }
  | { type: 'applyCodeBlock'; code: string; language: string }
  | { type: 'openUrl'; url: string }
  | { type: 'previewDiff'; toolName: string; path: string; content?: unknown; diff?: unknown }
  | { type: 'executePlan'; planId: string }
  | { type: 'editPlanStep'; planId: string; stepId: string; title: string; description: string }
  | { type: 'skipPlanStep'; planId: string; stepId: string }
  | { type: 'updateSettings'; settings: { budget?: number; autoApprove?: AutoApproveSettings } }
  | { type: 'setApiKey'; provider: string }
  | { type: 'openSettings' };

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

export interface FileListItem {
  path: string;
  name: string;
  isDirectory: boolean;
}

export type ExtensionMessage =
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'streamToken'; messageId: string; token: string }
  | { type: 'streamEnd'; messageId: string }
  | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
  | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
  | { type: 'requestApproval'; toolCall: ToolCallInfo }
  | { type: 'taskCompleted'; summary: string }
  | { type: 'taskError'; error: string }
  | { type: 'costUpdate'; cost: CostInfo }
  | { type: 'stateUpdate'; state: AgentState }
  | { type: 'modelCatalog'; models: ModelCatalogEntry[]; currentProvider: string; currentModel: string }
  | { type: 'workflowList'; workflows: WorkflowInfo[] }
  | { type: 'clearMessages' }
  | { type: 'fileList'; files: FileListItem[] }
  | { type: 'folderList'; folders: FileListItem[] }
  | { type: 'activeFileInfo'; filePath: string; fileName: string }
  | { type: 'prefillAttachment'; attachment: Attachment }
  | { type: 'askAboutContext'; text: string; attachment: Attachment }
  | { type: 'followUpSuggestions'; question?: string; suggestions: string[] }
  | { type: 'modeUpdate'; mode: string }
  | { type: 'modeList'; modes: Array<{ slug: string; name: string; icon: string; description: string; isBuiltin: boolean }> }
  | { type: 'taskHistory'; tasks: TaskHistorySummaryMsg[] }
  | { type: 'checkpointCreated'; checkpoint: { id: string; label: string; timestamp: string } }
  | { type: 'checkpointList'; checkpoints: Array<{ id: string; label: string; timestamp: string; toolName: string }> }
  | { type: 'checkpointRestored'; result: { restored: string[]; errors: string[] } }
  | { type: 'planUpdate'; plan: Plan }
  | { type: 'planStepUpdate'; planId: string; stepId: string; status: PlanStep['status'] }
  | { type: 'planCleared' }
  | { type: 'updateMessageContent'; messageId: string; content: string }
  | { type: 'settingsUpdate'; settings: Partial<AutoApproveSettings> }
  | { type: 'taskResumed'; taskId: string; title: string };

export interface TaskHistorySummaryMsg {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  totalCost: number;
  messageCount: number;
  status: string;
}

export interface AutoApproveSettings {
  yoloMode: boolean;
  readFiles: boolean;
  readFilesExternally: boolean;
  editFiles: boolean;
  editFilesExternally: boolean;
  executeSafeCommands: boolean;
  executeAllCommands: boolean;
  useBrowser: boolean;
  useMcp: boolean;
  enableNotifications: boolean;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  fileReferences: string[];
}

export interface Plan {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  createdAt: number;
}
