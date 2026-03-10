import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class ActModeRespondTool implements Tool {
  readonly name = 'act_mode_respond';
  readonly description = 'Display a progress update or informational message to the user while in ACT mode. This is non-blocking — execution continues immediately after the message is shown. Use this to communicate what you are about to do next or provide status updates. IMPORTANT: You cannot call act_mode_respond consecutively — your next action MUST be a different tool.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      response: {
        type: 'string',
        description: 'The progress update or informational message to show the user',
        required: true,
      },
    },
    required: ['response'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const response = params.response as string;
    if (!response) {
      return { success: false, output: '', error: 'Missing required parameter: response' };
    }

    return {
      success: true,
      output: `[ACT_MODE_MESSAGE]\n${response}`,
    };
  }
}
