import * as vscode from 'vscode';

const SCHEME = 'mitrahelix-diff';

export class DiffViewProvider implements vscode.Disposable {
  private static readonly MAX_ENTRIES = 50;
  private contentMap = new Map<string, string>();
  private registration: vscode.Disposable;
  private pendingDecisions = new Map<string, { resolve: (accepted: boolean) => void }>();

  constructor() {
    this.registration = vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
      provideTextDocumentContent: (uri: vscode.Uri) => {
        return this.contentMap.get(uri.toString()) ?? '';
      },
    });
  }

  async showDiff(filePath: string, originalContent: string, newContent: string, title?: string): Promise<void> {
    const ts = Date.now();
    const originalUri = vscode.Uri.parse(`${SCHEME}:/${filePath}?ts=${ts}&version=original`);
    const modifiedUri = vscode.Uri.parse(`${SCHEME}:/${filePath}?ts=${ts}&version=modified`);

    this.contentMap.set(originalUri.toString(), originalContent);
    this.contentMap.set(modifiedUri.toString(), newContent);

    if (this.contentMap.size > DiffViewProvider.MAX_ENTRIES * 2) {
      const keys = [...this.contentMap.keys()];
      const toRemove = keys.slice(0, keys.length - DiffViewProvider.MAX_ENTRIES);
      for (const key of toRemove) {
        this.contentMap.delete(key);
      }
    }

    const label = title ?? `${filePath} (MitraHelix Diff)`;
    await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, label);
  }

  /**
   * Show a diff with accept/reject buttons. Returns true if the user accepted.
   */
  async showDiffWithDecision(
    filePath: string,
    originalContent: string,
    newContent: string,
    toolCallId: string,
  ): Promise<boolean> {
    const label = `${filePath} — Review Changes`;
    await this.showDiff(filePath, originalContent, newContent, label);

    return new Promise((resolve) => {
      this.pendingDecisions.set(toolCallId, { resolve });

      setTimeout(() => {
        if (this.pendingDecisions.has(toolCallId)) {
          this.pendingDecisions.delete(toolCallId);
          resolve(true);
        }
      }, 5 * 60 * 1000);
    });
  }

  resolveDecision(toolCallId: string, accepted: boolean): void {
    const pending = this.pendingDecisions.get(toolCallId);
    if (pending) {
      this.pendingDecisions.delete(toolCallId);
      pending.resolve(accepted);
    }
  }

  /**
   * Compare two checkpoint states by showing their diff.
   */
  async showCheckpointDiff(
    filePath: string,
    beforeContent: string,
    afterContent: string,
    checkpointLabel: string,
  ): Promise<void> {
    await this.showDiff(filePath, beforeContent, afterContent, `Checkpoint: ${checkpointLabel}`);
  }

  dispose(): void {
    for (const { resolve } of this.pendingDecisions.values()) {
      resolve(true);
    }
    this.pendingDecisions.clear();
    this.contentMap.clear();
    this.registration.dispose();
  }
}
