import * as vscode from 'vscode';
import { ActiveEditorContext } from './ActiveEditorContext.js';
import { WorkspaceIndexer } from './WorkspaceIndexer.js';
import { DiagnosticsContext } from './DiagnosticsContext.js';

export interface ContextPayload {
  activeFile: string;
  fileTree: string;
  diagnostics: string;
  userRules: string;
  workspaceRoot: string;
}

export class ContextManager {
  private activeEditorContext: ActiveEditorContext;
  private workspaceIndexer: WorkspaceIndexer;
  private diagnosticsContext: DiagnosticsContext;

  constructor(private workspaceRoot: string) {
    this.activeEditorContext = new ActiveEditorContext();
    this.workspaceIndexer = new WorkspaceIndexer(workspaceRoot);
    this.diagnosticsContext = new DiagnosticsContext();
  }

  async gatherContext(): Promise<ContextPayload> {
    const [activeFile, fileTree, diagnostics, userRules] = await Promise.all([
      this.activeEditorContext.gather(),
      this.workspaceIndexer.getFileTree(),
      this.diagnosticsContext.gather(),
      this.loadUserRules(),
    ]);

    return {
      activeFile,
      fileTree,
      diagnostics,
      userRules,
      workspaceRoot: this.workspaceRoot,
    };
  }

  private async loadUserRules(): Promise<string> {
    try {
      const rulesUri = vscode.Uri.joinPath(vscode.Uri.file(this.workspaceRoot), '.mitrahelixrules');
      const content = await vscode.workspace.fs.readFile(rulesUri);
      return Buffer.from(content).toString('utf-8');
    } catch {
      return '';
    }
  }
}
