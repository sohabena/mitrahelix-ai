import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class ListCodeDefinitionsTool implements Tool {
  readonly name = 'list_code_definition_names';
  readonly description = 'List all function, class, interface, and type definitions in a file or directory. Useful for understanding code structure without reading entire file contents.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file or directory path (relative to workspace root)',
        required: true,
      },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const targetPath = params.path as string;
    if (!targetPath) {
      return { success: false, output: '', error: 'Missing required parameter: path' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, targetPath);
    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path is outside the workspace.` };
    }

    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        return await this.processDirectory(absolutePath, context.workspaceRoot, 0, { n: 0 }, context);
      } else {
        const relativePath = path.relative(context.workspaceRoot, absolutePath);
        if (context.ignoreManager?.isIgnored(relativePath)) {
          return { success: false, output: '', error: `Access denied: "${targetPath}" is protected by .mitrahelixignore` };
        }
        return await this.processFile(absolutePath, context.workspaceRoot);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to list definitions: ${message}` };
    }
  }

  private static readonly MAX_DEFINITIONS = 500;

  private async processDirectory(dirPath: string, workspaceRoot: string, depth: number = 0, defCount: { n: number } = { n: 0 }, context?: ToolContext): Promise<ToolResult> {
    if (depth > 5 || defCount.n >= ListCodeDefinitionsTool.MAX_DEFINITIONS) {
      return { success: true, output: '' };
    }
    const results: string[] = [];
    const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.cs']);
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'out', '__pycache__']);

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return { success: true, output: '' };
    }

    for (const entry of entries) {
      if (defCount.n >= ListCodeDefinitionsTool.MAX_DEFINITIONS) break;
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath);

      if (context?.ignoreManager?.isIgnored(relativePath)) continue;
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          const subResult = await this.processDirectory(fullPath, workspaceRoot, depth + 1, defCount, context);
          if (subResult.success && subResult.output) {
            results.push(subResult.output);
          }
        }
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!codeExts.has(ext)) continue;

      const fileResult = await this.processFile(fullPath, workspaceRoot, defCount);
      if (fileResult.success && fileResult.output) {
        results.push(fileResult.output);
      }
    }

    const output = results.length > 0 ? results.join('\n\n') : 'No code definitions found.';
    const truncNote = defCount.n >= ListCodeDefinitionsTool.MAX_DEFINITIONS
      ? `\n\n[Output truncated at ${ListCodeDefinitionsTool.MAX_DEFINITIONS} definitions]`
      : '';
    return { success: true, output: output + truncNote };
  }

  private async processFile(filePath: string, workspaceRoot: string, defCount: { n: number } = { n: 0 }): Promise<ToolResult> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 2_000_000) return { success: true, output: '' };

      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(workspaceRoot, filePath);
      const ext = path.extname(filePath).toLowerCase();
      const definitions = this.extractDefinitions(content, ext);

      if (definitions.length === 0) {
        return { success: true, output: '' };
      }

      defCount.n += definitions.length;
      const header = `--- ${relativePath} ---`;
      const defs = definitions.map((d) => `  ${d.type} ${d.name} (line ${d.line})`).join('\n');
      return { success: true, output: `${header}\n${defs}` };
    } catch {
      return { success: true, output: '' };
    }
  }

  private extractDefinitions(content: string, ext: string): Array<{ type: string; name: string; line: number }> {
    const defs: Array<{ type: string; name: string; line: number }> = [];
    const lines = content.split('\n');

    const patterns: Array<{ regex: RegExp; type: string }> = [
      { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, type: 'function' },
      { regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m, type: 'class' },
      { regex: /^(?:export\s+)?interface\s+(\w+)/m, type: 'interface' },
      { regex: /^(?:export\s+)?type\s+(\w+)\s*=/m, type: 'type' },
      { regex: /^(?:export\s+)?enum\s+(\w+)/m, type: 'enum' },
      { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m, type: 'const fn' },
      { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/m, type: 'const fn' },
    ];

    if (['.py'].includes(ext)) {
      patterns.length = 0;
      patterns.push(
        { regex: /^def\s+(\w+)/m, type: 'function' },
        { regex: /^class\s+(\w+)/m, type: 'class' },
      );
    } else if (['.go'].includes(ext)) {
      patterns.length = 0;
      patterns.push(
        { regex: /^func\s+(?:\([^)]+\)\s+)?(\w+)/m, type: 'function' },
        { regex: /^type\s+(\w+)\s+struct/m, type: 'struct' },
        { regex: /^type\s+(\w+)\s+interface/m, type: 'interface' },
      );
    } else if (['.java', '.cs'].includes(ext)) {
      patterns.length = 0;
      patterns.push(
        { regex: /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/m, type: 'method' },
        { regex: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/m, type: 'class' },
        { regex: /(?:public|private|protected)?\s*interface\s+(\w+)/m, type: 'interface' },
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match && match[1]) {
          defs.push({ type, name: match[1], line: i + 1 });
          break;
        }
      }
    }

    return defs;
  }
}
