import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class AttemptCompletionTool implements Tool {
  readonly name = 'attempt_completion';
  readonly description = 'Signal that the task is complete. Provide a summary of what was accomplished. Only use this when the task has been fully completed and verified.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      result: {
        type: 'string',
        description: 'A summary of what was accomplished',
        required: true,
      },
      command: {
        type: 'string',
        description: 'Optional CLI command for the user to run to verify the result (e.g., "npm test")',
      },
    },
    required: ['result'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const result = params.result as string;
    if (!result) {
      return { success: false, output: '', error: 'Missing required parameter: result' };
    }

    const command = params.command as string | undefined;
    let output = `[TASK_COMPLETE]\n${result}`;
    if (command) {
      output += `\n\n[SUGGESTED_COMMAND]: ${command}`;
    }

    return { success: true, output };
  }
}
