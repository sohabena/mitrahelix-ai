import type { ToolContext, ToolResult } from '../../shared/ToolTypes.js';
import type { ToolRegistry } from './ToolRegistry.js';

export class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private context: ToolContext
  ) {}

  async executeTool(name: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }

    // Validate required parameters (allow empty strings for content/diff params)
    const contentLikeParams = new Set(['content', 'diff', 'result']);
    for (const req of tool.parameterSchema.required) {
      const val = params[req];
      if (val === undefined || val === null) {
        return { success: false, output: '', error: `Missing required parameter: ${req}` };
      }
      if (val === '' && !contentLikeParams.has(req)) {
        return { success: false, output: '', error: `Missing required parameter: ${req}` };
      }
    }

    try {
      const ctx = signal ? { ...this.context, abortSignal: signal } : this.context;
      this.context.outputChannel.appendLine(`[ToolExecutor] Executing ${name} with params: ${JSON.stringify(params).slice(0, 200)}`);
      const result = await tool.execute(params, ctx);
      this.context.outputChannel.appendLine(`[ToolExecutor] ${name} completed: success=${result.success}`);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.context.outputChannel.appendLine(`[ToolExecutor] ${name} error: ${message}`);
      return { success: false, output: '', error: `Tool execution failed: ${message}` };
    }
  }
}
