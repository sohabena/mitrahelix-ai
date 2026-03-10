import * as vscode from 'vscode';
import * as path from 'path';

export interface RuleDefinition {
  name: string;
  source: 'rules-dir' | 'mitrahelixrules' | 'agents-md' | 'cursorrules';
  description: string;
  globs: string[];
  alwaysApply: boolean;
  content: string;
}

export class RulesManager {
  private cachedRules: RuleDefinition[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL = 15_000;

  constructor(private workspaceRoot: string) {}

  invalidateCache(): void {
    this.cachedRules = null;
    this.cacheTime = 0;
  }

  async getAllRules(): Promise<RuleDefinition[]> {
    const now = Date.now();
    if (this.cachedRules && (now - this.cacheTime) < this.CACHE_TTL) {
      return [...this.cachedRules];
    }

    const rules: RuleDefinition[] = [];

    const [dirRules, legacyRules, agentsRules, cursorRules] = await Promise.all([
      this.loadRulesDirectory(),
      this.loadLegacyRules(),
      this.loadAgentsMd(),
      this.loadCursorRules(),
    ]);

    rules.push(...dirRules, ...legacyRules, ...agentsRules, ...cursorRules);

    this.cachedRules = rules;
    this.cacheTime = Date.now();
    return [...rules];
  }

  /**
   * Returns rules that should be active given the files currently in context.
   * - alwaysApply rules are always included
   * - glob-matched rules are included if any contextFile matches their globs
   * - Legacy files (.mitrahelixrules, AGENTS.md, .cursorrules) are always included
   * - description-only rules are returned separately as an index for the LLM
   */
  async getActiveRules(contextFiles: string[]): Promise<{
    activeRules: RuleDefinition[];
    availableRuleIndex: string;
  }> {
    const allRules = await this.getAllRules();
    const activeRules: RuleDefinition[] = [];
    const indexEntries: string[] = [];

    for (const rule of allRules) {
      if (rule.source !== 'rules-dir') {
        activeRules.push(rule);
        continue;
      }

      if (rule.alwaysApply) {
        activeRules.push(rule);
        continue;
      }

      if (rule.globs.length > 0) {
        const matched = contextFiles.some((f) => this.matchesAnyGlob(f, rule.globs));
        if (matched) {
          activeRules.push(rule);
        }
        continue;
      }

      if (rule.description) {
        indexEntries.push(`- ${rule.name}: ${rule.description}`);
      }
    }

    const availableRuleIndex = indexEntries.length > 0
      ? `Additional rules available (activated by file context matching):\n${indexEntries.join('\n')}`
      : '';

    return { activeRules, availableRuleIndex };
  }

  async getRuleByName(name: string): Promise<RuleDefinition | undefined> {
    const allRules = await this.getAllRules();
    return allRules.find((r) => r.name === name);
  }

  private async loadRulesDirectory(): Promise<RuleDefinition[]> {
    const rules: RuleDefinition[] = [];
    const rulesDir = path.join(this.workspaceRoot, '.mitrahelix', 'rules');

    try {
      const dirUri = vscode.Uri.file(rulesDir);
      const entries = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.md')) {
          try {
            const fileUri = vscode.Uri.file(path.join(rulesDir, name));
            const stat = await vscode.workspace.fs.stat(fileUri);
            if (stat.size > 50_000) continue;
            const raw = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf-8');
            const parsed = this.parseRuleFile(name, raw);
            if (parsed) {
              rules.push(parsed);
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return rules;
  }

  private async loadLegacyRules(): Promise<RuleDefinition[]> {
    try {
      const rulesUri = vscode.Uri.file(path.join(this.workspaceRoot, '.mitrahelixrules'));
      const stat = await vscode.workspace.fs.stat(rulesUri);
      if (stat.size > 50_000) return [];
      const content = Buffer.from(await vscode.workspace.fs.readFile(rulesUri)).toString('utf-8');
      if (content.trim()) {
        return [{
          name: '.mitrahelixrules',
          source: 'mitrahelixrules',
          description: 'Project-level custom rules',
          globs: [],
          alwaysApply: true,
          content: content.trim(),
        }];
      }
    } catch {
      // File doesn't exist
    }
    return [];
  }

  private async loadAgentsMd(): Promise<RuleDefinition[]> {
    try {
      const agentsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'AGENTS.md'));
      const stat = await vscode.workspace.fs.stat(agentsUri);
      if (stat.size > 50_000) return [];
      const content = Buffer.from(await vscode.workspace.fs.readFile(agentsUri)).toString('utf-8');
      if (content.trim()) {
        return [{
          name: 'AGENTS.md',
          source: 'agents-md',
          description: 'Cross-tool agent instructions (AGENTS.md standard)',
          globs: [],
          alwaysApply: true,
          content: content.trim(),
        }];
      }
    } catch {
      // File doesn't exist
    }
    return [];
  }

  private async loadCursorRules(): Promise<RuleDefinition[]> {
    try {
      const cursorUri = vscode.Uri.file(path.join(this.workspaceRoot, '.cursorrules'));
      const stat = await vscode.workspace.fs.stat(cursorUri);
      if (stat.size > 50_000) return [];
      const content = Buffer.from(await vscode.workspace.fs.readFile(cursorUri)).toString('utf-8');
      if (content.trim()) {
        return [{
          name: '.cursorrules',
          source: 'cursorrules',
          description: 'Cursor-compatible rules',
          globs: [],
          alwaysApply: true,
          content: content.trim(),
        }];
      }
    } catch {
      // File doesn't exist
    }
    return [];
  }

  private parseRuleFile(fileName: string, raw: string): RuleDefinition | null {
    const name = fileName.replace(/\.md$/, '');
    let description = '';
    let globs: string[] = [];
    let alwaysApply = true; // default: always active unless frontmatter overrides
    let content = raw;

    const frontmatterMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      content = frontmatterMatch[2].trim();

      const descMatch = frontmatter.match(/description:\s*"?([^"\n]+)"?/);
      if (descMatch) {
        description = descMatch[1].trim().replace(/["']$/g, '');
      }

      const globsMatch = frontmatter.match(/globs:\s*\[((?:[^\[\]]|\[[^\]]*\])*)\]/);
      if (globsMatch) {
        globs = globsMatch[1]
          .split(',')
          .map((g) => g.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }

      if (!globsMatch) {
        const singleGlobMatch = frontmatter.match(/globs:\s*["']([^"'\n]+)["']/);
        if (singleGlobMatch) {
          globs = [singleGlobMatch[1].trim()];
        }
      }

      if (!globsMatch && globs.length === 0) {
        const yamlGlobSection = frontmatter.match(/globs:\s*\n((?:\s*-\s*.+\n?)*)/);
        if (yamlGlobSection) {
          const yamlListGlobs: string[] = [];
          for (const m of yamlGlobSection[1].matchAll(/^\s*-\s*["']?([^"'\n]+)["']?\s*$/gm)) {
            yamlListGlobs.push(m[1].trim());
          }
          if (yamlListGlobs.length > 0) globs = yamlListGlobs;
        }
      }

      const alwaysMatch = frontmatter.match(/alwaysApply:\s*(true|false)/);
      if (alwaysMatch) {
        alwaysApply = alwaysMatch[1] === 'true';
      } else if (globs.length > 0 || description) {
        alwaysApply = false;
      }
    }

    if (!content) return null;

    return { name, source: 'rules-dir', description, globs, alwaysApply, content };
  }

  /**
   * Lightweight glob matching supporting *, **, and ? patterns.
   * Uses forward-slash normalized paths for cross-platform consistency.
   */
  private matchesAnyGlob(filePath: string, globs: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return globs.some((glob) => this.globMatch(normalized, glob));
  }

  private globMatch(filePath: string, pattern: string): boolean {
    let regexStr = '';
    const p = pattern.replace(/\\/g, '/');
    let i = 0;
    while (i < p.length) {
      if (p[i] === '*' && p[i + 1] === '*' && p[i + 2] === '/') {
        regexStr += '(.+/)?';
        i += 3;
      } else if (p[i] === '*' && p[i + 1] === '*') {
        regexStr += '.*';
        i += 2;
      } else if (p[i] === '*') {
        regexStr += '[^/]*';
        i += 1;
      } else if (p[i] === '?') {
        regexStr += '[^/]';
        i += 1;
      } else if (p[i] === '{') {
        const close = p.indexOf('}', i);
        if (close !== -1) {
          const alternatives = p.slice(i + 1, close).split(',').map((a) => a.replace(/[.+^$|()\\[\]]/g, '\\$&'));
          regexStr += `(${alternatives.join('|')})`;
          i = close + 1;
        } else {
          regexStr += '\\{';
          i += 1;
        }
      } else if (p[i] === '[') {
        const close = p.indexOf(']', i);
        if (close !== -1) {
          regexStr += p.slice(i, close + 1);
          i = close + 1;
        } else {
          regexStr += '\\[';
          i += 1;
        }
      } else if ('.+^$}()|\\'.includes(p[i])) {
        regexStr += '\\' + p[i];
        i += 1;
      } else {
        regexStr += p[i];
        i += 1;
      }
    }
    try {
      return new RegExp(`^${regexStr}$`).test(filePath);
    } catch {
      return false;
    }
  }
}
