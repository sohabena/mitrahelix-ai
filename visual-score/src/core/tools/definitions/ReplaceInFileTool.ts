import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class ReplaceInFileTool implements Tool {
  readonly name = 'replace_in_file';
  readonly description = 'Make targeted edits to a file using SEARCH/REPLACE blocks. Each block specifies exact text to find and replace. This is preferred over write_to_file for making small changes to existing files, as it preserves the rest of the file content.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path of the file to edit (relative to workspace root)',
        required: true,
      },
      diff: {
        type: 'string',
        description: 'One or more SEARCH/REPLACE blocks in the format:\n<<<<<<< SEARCH\n[exact content to find]\n=======\n[new content to replace with]\n>>>>>>> REPLACE',
        required: true,
      },
    },
    required: ['path', 'diff'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = params.path as string;
    const diff = params.diff as string;

    if (!filePath) {
      return { success: false, output: '', error: 'Missing required parameter: path' };
    }
    if (!diff) {
      return { success: false, output: '', error: 'Missing required parameter: diff' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, filePath);

    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${filePath}" is outside the workspace.` };
    }

    try {
      let content = await fs.readFile(absolutePath, 'utf-8');
      const blocks = this.parseSearchReplaceBlocks(diff);

      if (blocks.length === 0) {
        return { success: false, output: '', error: 'No valid SEARCH/REPLACE blocks found in diff parameter.' };
      }

      const changes: string[] = [];

      for (let i = 0; i < blocks.length; i++) {
        const { search, replace } = blocks[i];

        if (!content.includes(search)) {
          // Try with normalized whitespace
          const normalizedContent = content.replace(/\r\n/g, '\n');
          const normalizedSearch = search.replace(/\r\n/g, '\n');

          if (normalizedContent.includes(normalizedSearch)) {
            content = normalizedContent.replace(normalizedSearch, replace);
            changes.push(`Block ${i + 1}: Applied (with normalized line endings)`);
          } else {
            return {
              success: false,
              output: changes.join('\n'),
              error: `SEARCH block ${i + 1} not found in file. The content to search for does not match exactly.\nSearching for:\n${search.slice(0, 200)}`,
            };
          }
        } else {
          content = content.replace(search, replace);
          changes.push(`Block ${i + 1}: Applied successfully`);
        }
      }

      await fs.writeFile(absolutePath, content, 'utf-8');

      return {
        success: true,
        output: `Applied ${blocks.length} change(s) to ${filePath}:\n${changes.join('\n')}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT')) {
        return { success: false, output: '', error: `File not found: "${filePath}"` };
      }
      return { success: false, output: '', error: `Failed to edit file: ${message}` };
    }
  }

  private parseSearchReplaceBlocks(diff: string): Array<{ search: string; replace: string }> {
    const blocks: Array<{ search: string; replace: string }> = [];
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(diff)) !== null) {
      blocks.push({
        search: match[1],
        replace: match[2],
      });
    }

    return blocks;
  }
}
