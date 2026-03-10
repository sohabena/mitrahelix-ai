import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

/**
 * The condense tool allows the agent to summarize the conversation so far
 * when context is getting too long. The agent provides a summary, and the
 * tool signals to the AgentLoop to replace older messages with this summary.
 *
 * The actual memory condensation is handled by AgentLoop when it sees
 * the condense tool result (similar to how attempt_completion is terminal).
 */
export class CondenseTool implements Tool {
  readonly name = 'condense';
  readonly description = 'Condense the conversation history by providing a summary of key decisions, changes made, and current state. Use this when the conversation is getting very long and you want to free up context space. The summary you provide will replace the older messages in the conversation, keeping only the summary and recent messages. This helps maintain context quality for long-running tasks.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A comprehensive summary of the conversation so far. Include: 1) The original task/goal, 2) Key decisions made, 3) Files that were read or modified, 4) Current progress status, 5) What remains to be done. Be thorough but concise.',
        required: true,
      },
    },
    required: ['summary'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const summary = params.summary as string;
    if (!summary) {
      return { success: false, output: '', error: 'Missing required parameter: summary' };
    }

    if (summary.length < 50) {
      return { success: false, output: '', error: 'Summary is too short. Please provide a comprehensive summary of at least 50 characters.' };
    }

    context.outputChannel.appendLine(`[Condense] Condensing conversation (summary: ${summary.length} chars)`);

    return {
      success: true,
      output: `[CONDENSE]\n${summary}`,
    };
  }
}
