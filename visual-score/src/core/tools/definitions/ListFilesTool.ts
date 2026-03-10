import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class ListFilesTool implements Tool {
  readonly name = 'list_files';
  readonly description = 'List files and directories at the specified path. Can list recursively or just immediate children. Use this to understand project structure or find specific files.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory path to list (relative to workspace root)',
        required: true,
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list recursively (default: false, max depth: 3)',
      },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const listPath = params.path as string;
    const recursive = params.recursive === true || params.recursive === 'true';

    if (!listPath && listPath !== '.') {
      return { success: false, output: '', error: 'Missing required parameter: path' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, listPath);
    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${listPath}" is outside the workspace.` };
    }

    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isDirectory()) {
        return { success: false, output: '', error: `"${listPath}" is not a directory.` };
      }

      const lines: string[] = [];
      await this.listDir(absolutePath, '', recursive ? 3 : 1, lines, 0, context);

      if (lines.length === 0) {
        return { success: true, output: `${listPath}/ (empty directory)` };
      }

      return { success: true, output: lines.join('\n') };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT')) {
        return { success: false, output: '', error: `Directory not found: "${listPath}"` };
      }
      return { success: false, output: '', error: `Failed to list directory: ${message}` };
    }
  }

  private async listDir(
    dirPath: string,
    prefix: string,
    maxDepth: number,
    lines: string[],
    currentDepth: number,
    context: ToolContext
  ): Promise<void> {
    if (currentDepth >= maxDepth || lines.length > 500) return;

    const skipDirs = new Set(['node_modules', '.git', 'dist', 'out', '__pycache__', '.next', 'venv', '.venv']);

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (lines.length > 500) {
        lines.push(`${prefix}... (truncated, too many entries)`);
        return;
      }

      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(context.workspaceRoot, fullPath);
      if (context.ignoreManager?.isIgnored(relativePath)) continue;

      const isDir = entry.isDirectory();
      const icon = isDir ? '📁' : '📄';
      lines.push(`${prefix}${icon} ${entry.name}${isDir ? '/' : ''}`);

      if (isDir && !skipDirs.has(entry.name)) {
        await this.listDir(fullPath, prefix + '  ', maxDepth, lines, currentDepth + 1, context);
      }
    }
  }
}
