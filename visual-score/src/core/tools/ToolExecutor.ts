import type { Tool, ToolContext, ToolResult, ToolCallInfo } from '../../shared/ToolTypes.js';
import type { ToolRegistry } from './ToolRegistry.js';

export class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private context: ToolContext
  ) {}

  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }

    // Validate required parameters
    for (const req of tool.parameterSchema.required) {
      if (params[req] === undefined || params[req] === null) {
        return { success: false, output: '', error: `Missing required parameter: ${req}` };
      }
    }

    try {
      this.context.outputChannel.appendLine(`[ToolExecutor] Executing ${name} with params: ${JSON.stringify(params).slice(0, 200)}`);
      const result = await tool.execute(params, this.context);
      this.context.outputChannel.appendLine(`[ToolExecutor] ${name} completed: success=${result.success}`);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.context.outputChannel.appendLine(`[ToolExecutor] ${name} error: ${message}`);
      return { success: false, output: '', error: `Tool execution failed: ${message}` };
    }
  }

  async executeBatch(toolCalls: ToolCallInfo[]): Promise<Map<string, ToolResult>> {
    const results = new Map<string, ToolResult>();

    // Separate into parallelizable (reads) and sequential (writes/commands)
    const parallelizable: ToolCallInfo[] = [];
    const sequential: ToolCallInfo[] = [];

    for (const tc of toolCalls) {
      const tool = this.registry.get(tc.name);
      if (tool && !tool.requiresApproval) {
        parallelizable.push(tc);
      } else {
        sequential.push(tc);
      }
    }

    // Execute parallelizable tools simultaneously
    if (parallelizable.length > 0) {
      const parallelResults = await Promise.all(
        parallelizable.map(async (tc) => ({
          id: tc.id,
          result: await this.executeTool(tc.name, tc.parameters),
        }))
      );
      for (const { id, result } of parallelResults) {
        results.set(id, result);
      }
    }

    // Execute sequential tools one by one
    for (const tc of sequential) {
      const result = await this.executeTool(tc.name, tc.parameters);
      results.set(tc.id, result);
    }

    return results;
  }
}
