import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class NewTaskTool implements Tool {
  readonly name = 'new_task';
  readonly description = 'Suggest starting a new task to the user. Use this when the current task has evolved significantly, when the context is getting too large, or when a fresh start would be beneficial. The user can either approve the new task or provide feedback to continue the current one.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'A summary of the current state and what the new task should focus on. This context will be carried over if the user approves.',
        required: true,
      },
    },
    required: ['context'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const taskContext = params.context as string;
    if (!taskContext) {
      return { success: false, output: '', error: 'Missing required parameter: context' };
    }

    return {
      success: true,
      output: `[NEW_TASK_SUGGESTION]\n${taskContext}`,
    };
  }
}
