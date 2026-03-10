import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { MAX_SEARCH_RESULTS } from '../../../shared/constants.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

export class SearchFilesTool implements Tool {
  readonly name = 'search_files';
  readonly description = 'Search for a regex pattern across files in the workspace. Returns matching lines with file paths and line numbers. Use this to find code patterns, function definitions, or specific text across the project.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory path to search in (relative to workspace root)',
        required: true,
      },
      regex: {
        type: 'string',
        description: 'The regex pattern to search for',
        required: true,
      },
      file_pattern: {
        type: 'string',
        description: 'Optional glob pattern to filter files (e.g., "*.ts", "*.py")',
      },
    },
    required: ['path', 'regex'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const searchPath = params.path as string;
    const regex = params.regex as string;
    const filePattern = params.file_pattern as string | undefined;

    if (!searchPath || !regex) {
      return { success: false, output: '', error: 'Missing required parameters: path and regex' };
    }

    const absolutePath = path.resolve(context.workspaceRoot, searchPath);
    if (!isWithinWorkspace(absolutePath, context.workspaceRoot)) {
      return { success: false, output: '', error: `Access denied: path "${searchPath}" is outside the workspace.` };
    }

    try {
      let re: RegExp;
      try {
        re = new RegExp(regex, 'gi');
      } catch (regexErr: unknown) {
        const msg = regexErr instanceof Error ? regexErr.message : String(regexErr);
        return { success: false, output: '', error: `Invalid regex: ${msg}` };
      }

      // Guard against catastrophic backtracking: test the regex on a probe string
      const probe = 'a'.repeat(100);
      const probeStart = Date.now();
      re.test(probe);
      if (Date.now() - probeStart > 200) {
        return { success: false, output: '', error: 'Regex rejected: pattern appears to have catastrophic backtracking. Simplify the regex and try again.' };
      }
      re.lastIndex = 0;

      const results: string[] = [];
      await this.searchDir(absolutePath, re, filePattern, results, context.workspaceRoot, context, 0);

      if (results.length === 0) {
        return { success: true, output: `No matches found for pattern "${regex}" in ${searchPath}` };
      }

      const truncated = results.length > MAX_SEARCH_RESULTS;
      const output = results.slice(0, MAX_SEARCH_RESULTS).join('\n');

      return {
        success: true,
        output: truncated
          ? `${output}\n\n[${results.length} total matches, showing first ${MAX_SEARCH_RESULTS}]`
          : `${output}\n\n[${results.length} match(es) found]`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Search failed: ${message}` };
    }
  }

  private async searchDir(
    dirPath: string,
    regex: RegExp,
    filePattern: string | undefined,
    results: string[],
    workspaceRoot: string,
    context: ToolContext,
    depth: number = 0
  ): Promise<void> {
    if (depth > 10) return;
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'out', '.next', '__pycache__', 'venv', '.venv']);

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS * 2) break;

      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath);

      if (context.ignoreManager?.isIgnored(relativePath)) continue;

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          await this.searchDir(fullPath, regex, filePattern, results, workspaceRoot, context, depth + 1);
        }
      } else if (entry.isFile()) {
        if (filePattern && !this.matchGlob(entry.name, filePattern)) continue;
        if (this.isBinaryExtension(entry.name)) continue;

        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 1_000_000) continue;

          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            regex.lastIndex = 0;
            if (regex.test(lines[i])) {
              results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  private matchGlob(filename: string, pattern: string): boolean {
    let regexStr = '';
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '*') {
        regexStr += '.*';
      } else if (pattern[i] === '?') {
        regexStr += '.';
      } else if (pattern[i] === '{') {
        const close = pattern.indexOf('}', i);
        if (close !== -1) {
          const alts = pattern.slice(i + 1, close).split(',').map((a) => a.replace(/[.+^$|()\\[\]*?]/g, '\\$&'));
          regexStr += `(${alts.join('|')})`;
          i = close;
        } else {
          regexStr += '\\{';
        }
      } else if ('.+^$|()\\[]}'.includes(pattern[i])) {
        regexStr += '\\' + pattern[i];
      } else {
        regexStr += pattern[i];
      }
    }
    try {
      return new RegExp(`^${regexStr}$`, 'i').test(filename);
    } catch {
      return filename.endsWith(pattern.replace(/\*/g, ''));
    }
  }

  private isBinaryExtension(filename: string): boolean {
    const binaryExts = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.pyc', '.class', '.o', '.obj',
      '.vsix',
    ]);
    const ext = path.extname(filename).toLowerCase();
    return binaryExts.has(ext);
  }
}
