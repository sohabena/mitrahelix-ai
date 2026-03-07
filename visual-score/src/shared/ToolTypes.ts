export interface Tool {
  name: string;
  description: string;
  parameterSchema: ToolParameterSchema;
  requiresApproval: boolean;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
    default?: unknown;
  }>;
  required: string[];
}

export interface ToolContext {
  workspaceRoot: string;
  outputChannel: { appendLine(value: string): void };
  postMessage: (message: unknown) => void;
  waitForApproval?: (toolCall: ToolCallInfo) => Promise<boolean>;
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

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}
