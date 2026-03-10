import * as vscode from 'vscode';
import { ActiveEditorContext } from './ActiveEditorContext.js';
import { WorkspaceIndexer } from './WorkspaceIndexer.js';
import { DiagnosticsContext } from './DiagnosticsContext.js';
import { RulesManager, type RuleDefinition } from '../rules/RulesManager.js';

export interface ContextPayload {
  activeFile: string;
  fileTree: string;
  diagnostics: string;
  userRules: string;
  availableRuleIndex: string;
  workspaceRoot: string;
}

export class ContextManager {
  private activeEditorContext: ActiveEditorContext;
  private workspaceIndexer: WorkspaceIndexer;
  private diagnosticsContext: DiagnosticsContext;
  private rulesManager: RulesManager;

  constructor(private workspaceRoot: string) {
    this.activeEditorContext = new ActiveEditorContext();
    this.workspaceIndexer = new WorkspaceIndexer(workspaceRoot);
    this.diagnosticsContext = new DiagnosticsContext();
    this.rulesManager = new RulesManager(workspaceRoot);
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  getRulesManager(): RulesManager {
    return this.rulesManager;
  }

  async gatherContext(contextFiles?: string[]): Promise<ContextPayload> {
    const activeEditor = vscode.window.activeTextEditor;
    const activeFilePath = activeEditor
      ? vscode.workspace.asRelativePath(activeEditor.document.uri)
      : '';

    const allContextFiles = [...(contextFiles || [])];
    if (activeFilePath && !allContextFiles.includes(activeFilePath)) {
      allContextFiles.push(activeFilePath);
    }

    const results = await Promise.allSettled([
      this.activeEditorContext.gather(),
      this.workspaceIndexer.getFileTree(),
      this.diagnosticsContext.gather(),
      this.rulesManager.getActiveRules(allContextFiles),
    ]);

    const activeFile = results[0].status === 'fulfilled' ? results[0].value : '';
    const fileTree = results[1].status === 'fulfilled' ? results[1].value : '';
    const diagnostics = results[2].status === 'fulfilled' ? results[2].value : '';
    const rulesResult = results[3].status === 'fulfilled'
      ? results[3].value
      : { activeRules: [] as RuleDefinition[], availableRuleIndex: '' };

    const userRules = this.formatActiveRules(rulesResult.activeRules);

    return {
      activeFile,
      fileTree,
      diagnostics,
      userRules,
      availableRuleIndex: rulesResult.availableRuleIndex,
      workspaceRoot: this.workspaceRoot,
    };
  }

  private static readonly MAX_TOTAL_RULES_CHARS = 30_000;

  private formatActiveRules(rules: RuleDefinition[]): string {
    if (rules.length === 0) return '';

    let totalChars = 0;
    const parts: string[] = [];
    for (const rule of rules) {
      const sourceLabel = rule.source === 'rules-dir' ? `.mitrahelix/rules/${rule.name}.md`
        : rule.source === 'agents-md' ? 'AGENTS.md'
        : rule.source === 'cursorrules' ? '.cursorrules'
        : '.mitrahelixrules';
      const entry = `[From ${sourceLabel}]\n${rule.content}`;
      if (totalChars + entry.length > ContextManager.MAX_TOTAL_RULES_CHARS) {
        parts.push(`[Rules truncated — ${rules.length - parts.length} more rules omitted to fit context budget]`);
        break;
      }
      totalChars += entry.length;
      parts.push(entry);
    }
    return parts.join('\n\n---\n\n');
  }
}
