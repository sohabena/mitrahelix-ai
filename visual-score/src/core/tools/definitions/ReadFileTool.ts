import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { MAX_FILE_SIZE } from '../../../shared/constants.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class ReadFileTool implements Tool {
  readonly name = 'read_file';
  readonly description = 'Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file. The path should be relative to the workspace root. The output will be the file contents with line numbers.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path of the file to read (relative to workspace root)',
        required: true,
      },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = params.path as string;
    if (!filePath) {
      return { success: false, output: '', error: 'Missing required parameter: path' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, filePath);

    // Security: ensure path is within workspace
    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${filePath}" is outside the workspace.` };
    }

    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `"${filePath}" is a directory, not a file. Use list_files to see directory contents.` };
      }

      const content = await fs.readFile(absolutePath, 'utf-8');

      if (content.length > MAX_FILE_SIZE) {
        const truncated = content.slice(0, MAX_FILE_SIZE);
        const lines = truncated.split('\n').map((line, i) => `${i + 1}\t${line}`).join('\n');
        return {
          success: true,
          output: `${lines}\n\n[FILE TRUNCATED — showing first ${MAX_FILE_SIZE} characters of ${content.length} total]`,
        };
      }

      const lines = content.split('\n').map((line, i) => `${i + 1}\t${line}`).join('\n');
      return { success: true, output: lines };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT')) {
        return { success: false, output: '', error: `File not found: "${filePath}"` };
      }
      if (message.includes('EACCES')) {
        return { success: false, output: '', error: `Permission denied: "${filePath}"` };
      }
      return { success: false, output: '', error: `Failed to read file: ${message}` };
    }
  }
}
