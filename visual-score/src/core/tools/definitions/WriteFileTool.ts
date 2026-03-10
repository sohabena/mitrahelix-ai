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
    if (typeof content !== 'string') {
      return { success: false, output: '', error: 'Parameter "content" must be a string' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, filePath);

    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${filePath}" is outside the workspace.` };
    }

    if (context.ignoreManager?.isIgnored(filePath)) {
      return { success: false, output: '', error: `Access denied: "${filePath}" is protected by .mitrahelixignore` };
    }

    try {
      let originalContent = '';
      let isNewFile = true;
      try {
        originalContent = await fs.readFile(absolutePath, 'utf-8');
        isNewFile = false;
      } catch {
        // File does not exist — treat as new file
      }

      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');

      const lineCount = content.split('\n').length;
      const originalLines = isNewFile ? [] : originalContent.split('\n');
      const newLines = content.split('\n');
      let addedLines = 0;
      let removedLines = 0;
      if (isNewFile) {
        addedLines = newLines.length;
      } else {
        const maxLen = Math.max(originalLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const oldLine = i < originalLines.length ? originalLines[i] : undefined;
          const newLine = i < newLines.length ? newLines[i] : undefined;
          if (oldLine !== newLine) {
            if (oldLine !== undefined) removedLines++;
            if (newLine !== undefined) addedLines++;
          }
        }
      }

      return {
        success: true,
        output: `Successfully wrote ${lineCount} lines to ${filePath}`,
        diff: {
          filePath,
          original: originalContent,
          modified: content,
          isNewFile,
          addedLines,
          removedLines,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to write file: ${message}` };
    }
  }
}
