export type HookPoint =
  | 'onSessionStart'
  | 'onSessionEnd'
  | 'preToolUse'
  | 'postToolUse'
  | 'preFileWrite'
  | 'postFileWrite'
  | 'preCommandExecute'
  | 'postCommandExecute'
  | 'onError';

export interface HookDefinition {
  name: string;
  command: string;
  filePatterns?: string[];
  condition?: string;
  enabled: boolean;
  timeout?: number;
}

export interface HookConfig {
  hooks: Partial<Record<HookPoint, HookDefinition[]>>;
}

export interface HookContext {
  taskId?: string;
  toolName?: string;
  filePath?: string;
  command?: string;
  exitCode?: number;
  totalCost?: number;
  messageCount?: number;
  workspaceRoot: string;
  error?: string;
}

export interface HookResult {
  hookName: string;
  success: boolean;
  output: string;
  duration: number;
}
