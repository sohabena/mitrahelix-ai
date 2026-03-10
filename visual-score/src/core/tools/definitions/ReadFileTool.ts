import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { MAX_FILE_SIZE } from '../../../shared/constants.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pyc', '.class', '.jar', '.war',
  '.sqlite', '.db',
]);

export class ReadFileTool implements Tool {
  readonly name = 'read_file';
  readonly description = 'Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file. The path should be relative to the workspace root. The output will be the file contents with line numbers. You can optionally specify a line range to read only a portion of large files.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path of the file to read (relative to workspace root)',
        required: true,
      },
      line_range: {
        type: 'string',
        description: 'Optional line range to read, e.g. "1-50" for lines 1 through 50. If omitted, the entire file is read.',
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

    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${filePath}" is outside the workspace.` };
    }

    if (context.ignoreManager?.isIgnored(filePath)) {
      return { success: false, output: '', error: `Access denied: "${filePath}" is protected by .mitrahelixignore` };
    }

    try {
      const ext = path.extname(absolutePath).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        const stat = await fs.stat(absolutePath);
        return {
          success: true,
          output: `[Binary file: ${filePath} (${ext}, ${(stat.size / 1024).toFixed(1)}KB) — content not displayed]`,
        };
      }

      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `"${filePath}" is a directory, not a file. Use list_files to see directory contents.` };
      }

      if (stat.size > MAX_FILE_SIZE * 4) {
        return {
          success: false,
          output: '',
          error: `File "${filePath}" is too large (${(stat.size / 1_000_000).toFixed(1)}MB). Maximum supported size is ~${MAX_FILE_SIZE / 1000}KB.`,
        };
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      const lineRange = params.line_range as string | undefined;
      if (lineRange) {
        const rangeMatch = lineRange.match(/^(\d+)-(\d+)$/);
        if (!rangeMatch) {
          return { success: false, output: '', error: `Invalid line_range format: "${lineRange}". Use "start-end", e.g. "1-50".` };
        }
        const startLine = Math.max(1, parseInt(rangeMatch[1], 10));
        const endLine = Math.min(totalLines, parseInt(rangeMatch[2], 10));
        if (startLine > endLine) {
          return { success: false, output: '', error: `Invalid line_range: start (${startLine}) must be <= end (${endLine}).` };
        }
        const slice = allLines.slice(startLine - 1, endLine);
        const numbered = slice.map((line, i) => `${startLine + i}\t${line}`).join('\n');
        return {
          success: true,
          output: `${numbered}\n\n[Showing lines ${startLine}-${endLine} of ${totalLines} total]`,
        };
      }

      if (content.length > MAX_FILE_SIZE) {
        const truncated = content.slice(0, MAX_FILE_SIZE);
        const lines = truncated.split('\n').map((line, i) => `${i + 1}\t${line}`).join('\n');
        return {
          success: true,
          output: `${lines}\n\n[FILE TRUNCATED — showing first ${MAX_FILE_SIZE} characters of ${content.length} total. Use line_range to read specific sections.]`,
        };
      }

      const lines = allLines.map((line, i) => `${i + 1}\t${line}`).join('\n');
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
