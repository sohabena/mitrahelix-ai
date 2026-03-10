import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { isWithinWorkspace } from '../../../shared/pathSecurity.js';

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

interface FilePatch {
  oldPath: string;
  newPath: string;
  operation: 'modify' | 'create' | 'delete' | 'rename';
  hunks: PatchHunk[];
}

function parsePatch(patchText: string): FilePatch[] {
  const patches: FilePatch[] = [];
  const lines = patchText.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].startsWith('---') && !lines[i].startsWith('diff ')) {
      i++;
      continue;
    }

    if (lines[i].startsWith('diff ')) {
      i++;
      continue;
    }

    let oldPath = '';
    let newPath = '';
    let operation: FilePatch['operation'] = 'modify';

    if (lines[i].startsWith('---')) {
      const oldMatch = lines[i].match(/^---\s+(?:a\/)?(.+)/);
      oldPath = oldMatch?.[1]?.trim() || '';
      i++;
    }

    if (i < lines.length && lines[i].startsWith('+++')) {
      const newMatch = lines[i].match(/^\+\+\+\s+(?:b\/)?(.+)/);
      newPath = newMatch?.[1]?.trim() || '';
      i++;
    }

    if (oldPath === '/dev/null') operation = 'create';
    else if (newPath === '/dev/null') operation = 'delete';
    else if (oldPath !== newPath && oldPath && newPath) operation = 'rename';

    const effectivePath = operation === 'create' ? newPath : (operation === 'delete' ? oldPath : newPath || oldPath);

    const hunks: PatchHunk[] = [];
    while (i < lines.length && !lines[i].startsWith('---') && !lines[i].startsWith('diff ')) {
      const hunkMatch = lines[i].match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (hunkMatch) {
        const hunk: PatchHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3], 10),
          newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
          lines: [],
        };
        i++;
        while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('---') && !lines[i].startsWith('diff ')) {
          if (lines[i].startsWith('+') || lines[i].startsWith('-') || lines[i].startsWith(' ') || lines[i] === '') {
            hunk.lines.push(lines[i]);
          } else if (lines[i].startsWith('\\')) {
            // "\ No newline at end of file" — skip
          } else {
            break;
          }
          i++;
        }
        hunks.push(hunk);
      } else {
        i++;
      }
    }

    if (effectivePath) {
      patches.push({ oldPath: oldPath || effectivePath, newPath: newPath || effectivePath, operation, hunks });
    }
  }

  return patches;
}

function applyHunksToContent(original: string, hunks: PatchHunk[]): string {
  const originalLines = original.split('\n');
  const result: string[] = [];
  let origIdx = 0;

  const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

  for (const hunk of sortedHunks) {
    const hunkStart = hunk.oldStart - 1;
    while (origIdx < hunkStart && origIdx < originalLines.length) {
      result.push(originalLines[origIdx]);
      origIdx++;
    }

    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        result.push(line.slice(1));
      } else if (line.startsWith('-')) {
        origIdx++;
      } else if (line.startsWith(' ') || line === '') {
        result.push(line.slice(1));
        origIdx++;
      }
    }
  }

  while (origIdx < originalLines.length) {
    result.push(originalLines[origIdx]);
    origIdx++;
  }

  return result.join('\n');
}

export class ApplyPatchTool implements Tool {
  readonly name = 'apply_patch';
  readonly description = 'Apply a unified diff patch to one or more files. Supports creating new files, modifying existing files, and deleting files. The patch should be in standard unified diff format (as produced by `git diff` or `diff -u`). This is useful for making complex multi-file changes or applying known patches.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      patch: {
        type: 'string',
        description: 'The unified diff patch content to apply. Must use standard unified diff format with --- and +++ headers and @@ hunk markers.',
        required: true,
      },
    },
    required: ['patch'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const patchText = params.patch as string;
    if (!patchText) {
      return { success: false, output: '', error: 'Missing required parameter: patch' };
    }

    let patches: FilePatch[];
    try {
      patches = parsePatch(patchText);
    } catch (e: unknown) {
      return { success: false, output: '', error: `Failed to parse patch: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (patches.length === 0) {
      return { success: false, output: '', error: 'No valid patches found in the input. Ensure the patch uses unified diff format.' };
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const filePatch of patches) {
      const targetPath = filePatch.operation === 'delete' ? filePatch.oldPath : filePatch.newPath;
      const absPath = path.resolve(context.workspaceRoot, targetPath);

      if (!isWithinWorkspace(absPath, context.workspaceRoot)) {
        errors.push(`Skipped ${targetPath}: outside workspace`);
        continue;
      }

      if (context.ignoreManager?.isIgnored(targetPath)) {
        errors.push(`Skipped ${targetPath}: protected by .mitrahelixignore`);
        continue;
      }

      try {
        switch (filePatch.operation) {
          case 'create': {
            const content = filePatch.hunks
              .flatMap(h => h.lines.filter(l => l.startsWith('+')).map(l => l.slice(1)))
              .join('\n');
            await fs.mkdir(path.dirname(absPath), { recursive: true });
            await fs.writeFile(absPath, content, 'utf-8');
            results.push(`Created ${targetPath}`);
            break;
          }
          case 'delete': {
            await fs.unlink(absPath);
            results.push(`Deleted ${targetPath}`);
            break;
          }
          case 'rename': {
            const oldAbs = path.resolve(context.workspaceRoot, filePatch.oldPath);
            const original = await fs.readFile(oldAbs, 'utf-8');
            const modified = filePatch.hunks.length > 0
              ? applyHunksToContent(original, filePatch.hunks)
              : original;
            await fs.mkdir(path.dirname(absPath), { recursive: true });
            await fs.writeFile(absPath, modified, 'utf-8');
            await fs.unlink(oldAbs);
            results.push(`Renamed ${filePatch.oldPath} → ${targetPath}`);
            break;
          }
          case 'modify':
          default: {
            const original = await fs.readFile(absPath, 'utf-8');
            const modified = applyHunksToContent(original, filePatch.hunks);
            await fs.writeFile(absPath, modified, 'utf-8');
            const addedLines = filePatch.hunks.reduce((s, h) => s + h.lines.filter(l => l.startsWith('+')).length, 0);
            const removedLines = filePatch.hunks.reduce((s, h) => s + h.lines.filter(l => l.startsWith('-')).length, 0);
            results.push(`Modified ${targetPath} (+${addedLines}, -${removedLines})`);
            break;
          }
        }
      } catch (e: unknown) {
        errors.push(`Failed on ${targetPath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const output = results.join('\n') + (errors.length > 0 ? '\n\nErrors:\n' + errors.join('\n') : '');
    context.outputChannel.appendLine(`[ApplyPatch] Applied ${results.length} patches, ${errors.length} errors`);
    return { success: errors.length === 0, output, error: errors.length > 0 ? errors.join('; ') : undefined };
  }
}
