import * as path from 'path';
import * as fs from 'fs/promises';

interface IgnorePattern {
  pattern: string;
  regex: RegExp;
  negated: boolean;
  directoryOnly: boolean;
}

export class IgnoreManager {
  private patterns: IgnorePattern[] = [];
  private loaded = false;

  constructor(private workspaceRoot: string) {}

  async loadIgnoreFile(): Promise<void> {
    this.patterns = [];
    const ignorePath = path.join(this.workspaceRoot, '.mitrahelixignore');

    try {
      const content = await fs.readFile(ignorePath, 'utf-8');
      const lines = content.split('\n');

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line || line.startsWith('#')) continue;

        let pattern = line;
        let negated = false;
        let directoryOnly = false;

        if (pattern.startsWith('!')) {
          negated = true;
          pattern = pattern.slice(1);
        }

        if (pattern.endsWith('/')) {
          directoryOnly = true;
          pattern = pattern.slice(0, -1);
        }

        const anchored = pattern.startsWith('/');
        pattern = pattern.replace(/^\//, '');

        if (!pattern) continue;

        try {
          const regex = this.patternToRegex(pattern, anchored);
          this.patterns.push({ pattern: line, regex, negated, directoryOnly });
        } catch {
          // Skip patterns that produce invalid regex
        }
      }
    } catch {
      // No ignore file — nothing to ignore
    }

    this.loaded = true;
  }

  isIgnored(relativePath: string): boolean {
    if (this.patterns.length === 0) return false;

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
    let ignored = false;

    for (const p of this.patterns) {
      if (p.regex.test(normalized)) {
        ignored = !p.negated;
      }

      if (p.directoryOnly) {
        const parts = normalized.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentDir = parts.slice(0, i).join('/');
          if (p.regex.test(parentDir)) {
            ignored = !p.negated;
          }
        }
      }
    }

    return ignored;
  }

  filterPaths(paths: string[]): string[] {
    return paths.filter((p) => !this.isIgnored(p));
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.loadIgnoreFile();
  }

  invalidateCache(): void {
    this.loaded = false;
    this.patterns = [];
  }

  private patternToRegex(pattern: string, anchored: boolean): RegExp {
    let regexStr = '';
    let i = 0;

    while (i < pattern.length) {
      const ch = pattern[i];

      if (ch === '*') {
        if (pattern[i + 1] === '*') {
          if (pattern[i + 2] === '/') {
            regexStr += '(?:.+/)?';
            i += 3;
            continue;
          }
          regexStr += '.*';
          i += 2;
          continue;
        }
        regexStr += '[^/]*';
        i++;
        continue;
      }

      if (ch === '?') {
        regexStr += '[^/]';
        i++;
        continue;
      }

      if (ch === '[') {
        const close = pattern.indexOf(']', i + 1);
        if (close !== -1) {
          regexStr += pattern.slice(i, close + 1);
          i = close + 1;
          continue;
        }
      }

      if ('.+^${}()|\\'.includes(ch)) {
        regexStr += '\\' + ch;
      } else {
        regexStr += ch;
      }
      i++;
    }

    if (anchored || pattern.includes('/')) {
      return new RegExp(`^${regexStr}(?:/|$)`);
    }
    return new RegExp(`(?:^|/)${regexStr}(?:/|$)`);
  }
}
