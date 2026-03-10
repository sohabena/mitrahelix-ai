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

    if (context.ignoreManager?.isIgnored(filePath)) {
      return { success: false, output: '', error: `Access denied: "${filePath}" is protected by .mitrahelixignore` };
    }

    try {
      let content = await fs.readFile(absolutePath, 'utf-8');
      const originalContent = content;
      const blocks = this.parseSearchReplaceBlocks(diff);

      if (blocks.length === 0) {
        return { success: false, output: '', error: 'No valid SEARCH/REPLACE blocks found in diff parameter.' };
      }

      const changes: string[] = [];

      for (let i = 0; i < blocks.length; i++) {
        const { search, replace } = blocks[i];

        if (!search) {
          return {
            success: false,
            output: changes.join('\n'),
            error: `SEARCH block ${i + 1} is empty. Each SEARCH block must contain the exact text to find.`,
          };
        }

        if (!content.includes(search)) {
          const normalizedSearch = search.replace(/\r\n/g, '\n');
          const normalizedContent = content.replace(/\r\n/g, '\n');

          if (normalizedContent.includes(normalizedSearch)) {
            const nIdx = normalizedContent.indexOf(normalizedSearch);
            const origIdx = this.mapNormalizedIndex(content, nIdx);
            const origEnd = this.mapNormalizedIndex(content, nIdx + normalizedSearch.length);
            const useCrlf = content.includes('\r\n');
            const adjustedReplace = useCrlf ? replace.replace(/(?<!\r)\n/g, '\r\n') : replace.replace(/\r\n/g, '\n');
            content = content.slice(0, origIdx) + adjustedReplace + content.slice(origEnd);
            changes.push(`Block ${i + 1}: Applied (with normalized line endings)`);
          } else {
            return {
              success: false,
              output: changes.join('\n'),
              error: `SEARCH block ${i + 1} not found in file. The content to search for does not match exactly.\nSearching for:\n${search.slice(0, 200)}`,
            };
          }
        } else {
          const idx = content.indexOf(search);
          content = content.slice(0, idx) + replace + content.slice(idx + search.length);
          changes.push(`Block ${i + 1}: Applied successfully`);
        }
      }

      await fs.writeFile(absolutePath, content, 'utf-8');

      const originalLines = originalContent.split('\n');
      const newLines = content.split('\n');
      let addedLines = 0;
      let removedLines = 0;
      const maxLen = Math.max(originalLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        const oldLine = i < originalLines.length ? originalLines[i] : undefined;
        const newLine = i < newLines.length ? newLines[i] : undefined;
        if (oldLine !== newLine) {
          if (oldLine !== undefined) removedLines++;
          if (newLine !== undefined) addedLines++;
        }
      }

      return {
        success: true,
        output: `Applied ${blocks.length} change(s) to ${filePath}:\n${changes.join('\n')}`,
        diff: {
          filePath,
          original: originalContent,
          modified: content,
          isNewFile: false,
          addedLines,
          removedLines,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT')) {
        return { success: false, output: '', error: `File not found: "${filePath}"` };
      }
      return { success: false, output: '', error: `Failed to edit file: ${message}` };
    }
  }

  private mapNormalizedIndex(original: string, normalizedIdx: number): number {
    let nPos = 0;
    let oPos = 0;
    while (nPos < normalizedIdx && oPos < original.length) {
      if (original[oPos] === '\r' && original[oPos + 1] === '\n') {
        oPos += 2;
      } else {
        oPos += 1;
      }
      nPos += 1;
    }
    return oPos;
  }

  private parseSearchReplaceBlocks(diff: string): Array<{ search: string; replace: string }> {
    const blocks: Array<{ search: string; replace: string }> = [];
    const normalizedDiff = diff.replace(/\r\n/g, '\n');
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?\n?)>>>>>>> REPLACE/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalizedDiff)) !== null) {
      let replace = match[2];
      if (replace.endsWith('\n')) {
        replace = replace.slice(0, -1);
      }
      blocks.push({
        search: match[1],
        replace,
      });
    }

    return blocks;
  }
}
