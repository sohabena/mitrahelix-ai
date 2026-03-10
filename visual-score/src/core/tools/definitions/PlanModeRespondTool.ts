import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

export class PlanModeRespondTool implements Tool {
  readonly name = 'plan_mode_respond';
  readonly description = 'Present your analysis, plan, or response to the user while in PLAN mode. Use this to communicate your findings and provide options for the user to choose from. The user can select an option, provide feedback, or switch to ACT mode. You may optionally indicate that you need more exploration before presenting a plan.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      response: {
        type: 'string',
        description: 'Your analysis, plan, or response to present to the user',
        required: true,
      },
      options: {
        type: 'string',
        description: 'Optional comma-separated list of options for the user to choose from (e.g., "Proceed with this plan,Modify the approach,Let me explore more")',
        required: false,
      },
      needs_more_exploration: {
        type: 'string',
        description: 'Set to "true" if you need to continue exploring the codebase before presenting a final plan. The loop will continue instead of waiting for user input.',
        required: false,
      },
    },
    required: ['response'],
  };

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const response = params.response as string;
    if (!response) {
      return { success: false, output: '', error: 'Missing required parameter: response' };
    }

    const needsMoreExploration = params.needs_more_exploration === 'true';

    if (needsMoreExploration) {
      return {
        success: true,
        output: '[PLAN_CONTINUE]\nYou have indicated that you need more exploration. Proceed with calling tools to continue the planning process.',
      };
    }

    const optionsRaw = params.options as string | undefined;
    const options = optionsRaw
      ? optionsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const output = options.length > 0
      ? `[PLAN_MODE_RESPONSE]\n${response}\n[OPTIONS]\n${options.join('|')}`
      : `[PLAN_MODE_RESPONSE]\n${response}`;

    return { success: true, output };
  }
}
