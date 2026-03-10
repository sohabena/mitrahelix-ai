import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class AskFollowUpTool implements Tool {
  readonly name = 'ask_followup_question';
  readonly description = 'Ask the user a follow-up question to gather more information needed to complete the task. Use this when you need clarification or additional details. You can optionally provide suggested answers that will be shown as clickable options.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user',
        required: true,
      },
      suggestions: {
        type: 'string',
        description: 'Optional comma-separated list of suggested answers (e.g., "Yes,No,Skip this step"). These will be shown as clickable options for the user.',
        required: false,
      },
    },
    required: ['question'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const question = params.question as string;
    if (!question) {
      return { success: false, output: '', error: 'Missing required parameter: question' };
    }

    const suggestionsRaw = params.suggestions as string | undefined;
    const suggestions = suggestionsRaw
      ? suggestionsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const output = suggestions.length > 0
      ? `[FOLLOWUP_QUESTION]\n${question}\n[SUGGESTIONS]\n${suggestions.join('|')}`
      : `[FOLLOWUP_QUESTION]\n${question}`;

    return { success: true, output };
  }
}
