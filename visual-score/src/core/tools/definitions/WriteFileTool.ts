import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class WriteFileTool implements Tool {
  readonly name = 'write_to_file';
  readonly description = 'Write content to a file at the specified path. If the file exists, it will be overwritten. If it does not exist, it will be created along with any necessary parent directories. Use this for creating new files or completely replacing file contents.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path of the file to write (relative to workspace root)',
        required: true,
      },
      content: {
        type: 'string',
        description: 'The full content to write to the file',
        required: true,
      },
    },
    required: ['path', 'content'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = params.path as string;
    const content = params.content as string;

    if (!filePath) {
      return { success: false, output: '', error: 'Missing required parameter: path' };
    }
    if (content === undefined || content === null) {
      return { success: false, output: '', error: 'Missing required parameter: content' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, filePath);

    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${filePath}" is outside the workspace.` };
    }

    try {
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');

      const lineCount = content.split('\n').length;
      return {
        success: true,
        output: `Successfully wrote ${lineCount} lines to ${filePath}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to write file: ${message}` };
    }
  }
}
