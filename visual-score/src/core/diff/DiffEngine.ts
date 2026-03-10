import { diffLines, type Change } from 'diff';

export interface FileDiff {
  filePath: string;
  originalContent: string;
  newContent: string;
  hunks: DiffHunk[];
  addedLines: number;
  removedLines: number;
  isNewFile: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

const CONTEXT_LINES = 3;

export class DiffEngine {
  computeDiff(filePath: string, original: string, modified: string): FileDiff {
    const changes: Change[] = diffLines(original, modified);
    const isNewFile = original === '';

    const allLines: DiffLine[] = [];
    let oldLine = 1;
    let newLine = 1;

    for (const change of changes) {
      const lines = change.value.replace(/\n$/, '').split('\n');
      if (change.value === '' && lines.length === 1 && lines[0] === '') {
        continue;
      }
      for (const line of lines) {
        if (change.added) {
          allLines.push({ type: 'add', content: line, newLineNumber: newLine++ });
        } else if (change.removed) {
          allLines.push({ type: 'remove', content: line, oldLineNumber: oldLine++ });
        } else {
          allLines.push({ type: 'context', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ });
        }
      }
    }

    let addedLines = 0;
    let removedLines = 0;
    for (const line of allLines) {
      if (line.type === 'add') addedLines++;
      if (line.type === 'remove') removedLines++;
    }

    const hunks = this.buildHunks(allLines);

    return { filePath, originalContent: original, newContent: modified, hunks, addedLines, removedLines, isNewFile };
  }

  formatUnifiedDiff(diff: FileDiff): string {
    const lines: string[] = [];
    lines.push(`--- a/${diff.filePath}`);
    lines.push(`+++ b/${diff.filePath}`);

    for (const hunk of diff.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      for (const line of hunk.lines) {
        switch (line.type) {
          case 'add':
            lines.push(`+${line.content}`);
            break;
          case 'remove':
            lines.push(`-${line.content}`);
            break;
          case 'context':
            lines.push(` ${line.content}`);
            break;
        }
      }
    }

    return lines.join('\n');
  }

  private buildHunks(allLines: DiffLine[]): DiffHunk[] {
    const changeIndices: number[] = [];
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].type !== 'context') {
        changeIndices.push(i);
      }
    }

    if (changeIndices.length === 0) return [];

    const groups: Array<[number, number]> = [];
    let groupStart = changeIndices[0];
    let groupEnd = changeIndices[0];

    for (let i = 1; i < changeIndices.length; i++) {
      if (changeIndices[i] - groupEnd <= CONTEXT_LINES * 2) {
        groupEnd = changeIndices[i];
      } else {
        groups.push([groupStart, groupEnd]);
        groupStart = changeIndices[i];
        groupEnd = changeIndices[i];
      }
    }
    groups.push([groupStart, groupEnd]);

    const hunks: DiffHunk[] = [];

    for (const [gStart, gEnd] of groups) {
      const start = Math.max(0, gStart - CONTEXT_LINES);
      const end = Math.min(allLines.length - 1, gEnd + CONTEXT_LINES);

      const hunkLines = allLines.slice(start, end + 1);

      let oldStart = 0;
      let oldCount = 0;
      let newStart = 0;
      let newCount = 0;

      for (const line of hunkLines) {
        if (line.type === 'context' || line.type === 'remove') {
          if (oldStart === 0 && line.oldLineNumber !== undefined) {
            oldStart = line.oldLineNumber;
          }
          oldCount++;
        }
        if (line.type === 'context' || line.type === 'add') {
          if (newStart === 0 && line.newLineNumber !== undefined) {
            newStart = line.newLineNumber;
          }
          newCount++;
        }
      }

      if (oldStart === 0) oldStart = 1;
      if (newStart === 0) newStart = 1;

      hunks.push({
        oldStart,
        oldLines: oldCount,
        newStart,
        newLines: newCount,
        lines: hunkLines,
      });
    }

    return hunks;
  }
}
