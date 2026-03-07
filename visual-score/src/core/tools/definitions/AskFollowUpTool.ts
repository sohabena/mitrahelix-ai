import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class AskFollowUpTool implements Tool {
  readonly name = 'ask_followup_question';
  readonly description = 'Ask the user a follow-up question to gather more information needed to complete the task. Use this when you need clarification or additional details from the user.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user',
        required: true,
      },
    },
    required: ['question'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const question = params.question as string;
    if (!question) {
      return { success: false, output: '', error: 'Missing required parameter: question' };
    }

    // The agent loop handles this specially — it pauses and waits for user input
    return {
      success: true,
      output: `[FOLLOWUP_QUESTION]\n${question}`,
    };
  }
}
