import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class NewRuleTool implements Tool {
  readonly name = 'new_rule';
  readonly description = 'Create a new rule file in the .mitrahelix/rules/ directory. Rules are persistent instructions that guide the AI assistant across conversations. Use this when the user expresses a preference or convention that should be remembered (e.g., "always use tabs", "prefer functional components", "use snake_case for Python files").';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'The filename for the rule (without path or extension). Will be saved as .mitrahelix/rules/{filename}.md. Use kebab-case, e.g. "prefer-tabs" or "react-conventions".',
        required: true,
      },
      content: {
        type: 'string',
        description: 'The rule content in markdown format. Should be clear, specific instructions.',
        required: true,
      },
    },
    required: ['filename', 'content'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filename = params.filename as string;
    const content = params.content as string;

    if (!filename) return { success: false, output: '', error: 'Missing required parameter: filename' };
    if (!content) return { success: false, output: '', error: 'Missing required parameter: content' };

    const sanitized = filename.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!sanitized) return { success: false, output: '', error: 'Invalid filename after sanitization' };

    const rulesDir = path.join(context.workspaceRoot, '.mitrahelix', 'rules');
    const filePath = path.join(rulesDir, `${sanitized}.md`);

    if (!isWithinWorkspace(filePath, context.workspaceRoot)) {
      return { success: false, output: '', error: 'Path resolution error' };
    }

    try {
      await fs.mkdir(rulesDir, { recursive: true });

      let exists = false;
      try {
        await fs.access(filePath);
        exists = true;
      } catch { /* doesn't exist */ }

      await fs.writeFile(filePath, content, 'utf-8');
      const relPath = `.mitrahelix/rules/${sanitized}.md`;
      const action = exists ? 'Updated' : 'Created';

      context.outputChannel.appendLine(`[NewRule] ${action} rule: ${relPath}`);
      return {
        success: true,
        output: `${action} rule file: ${relPath}\n\nThis rule will be loaded automatically in future conversations when relevant files are being edited.`,
      };
    } catch (error: unknown) {
      return { success: false, output: '', error: `Failed to create rule: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
