import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ExtensionMessage, WebviewMessage, FileListItem, Attachment } from '../../shared/MessageTypes.js';
import { getModelCatalog } from '../llm/models.js';
import type { AgentController } from '../agent/AgentController.js';
import type { ConfigManager } from '../config/ConfigManager.js';
import { WorkflowManager } from '../workflows/WorkflowManager.js';
import { DiffViewProvider } from '../diff/DiffViewProvider.js';

export class MitraHelixWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private agentController?: AgentController;
  private configManager?: ConfigManager;
  private workflowManager?: WorkflowManager;
  private outputChannel?: vscode.OutputChannel;
  private diffViewProvider: DiffViewProvider;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly extensionContext: vscode.ExtensionContext
  ) {
    this.diffViewProvider = new DiffViewProvider();
    extensionContext.subscriptions.push(this.diffViewProvider);
  }

  setOutputChannel(channel: vscode.OutputChannel): void {
    this.outputChannel = channel;
  }

  setAgentController(controller: AgentController): void {
    this.agentController = controller;
  }

  setConfigManager(config: ConfigManager): void {
    this.configManager = config;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => { this.handleMessage(message).catch(() => {}); },
      undefined,
      this.extensionContext.subscriptions
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendModelCatalog();
        this.sendWorkflowList();
        this.sendActiveFileInfo();
      }
    });
    // Initial catalog/workflow sends are triggered by webviewReady message from React
  }

  postMessage(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
    this.panel?.webview.postMessage(message);
  }

  openPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'mitraHelix.chatPanel',
      'MitraHelix Chat',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist'),
        ],
      }
    );

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => { this.handleMessage(message).catch(() => {}); },
      undefined,
      this.extensionContext.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      if (!this.view) {
        this.agentController?.cancelTask();
      }
    });
    // Initial catalog/workflow sends are triggered by webviewReady message from React
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    // Handle messages that don't require agentController first
    if (message.type === 'webviewReady') {
      this.sendModelCatalog();
      this.sendWorkflowList();
      this.sendModeList();
      this.sendActiveFileInfo();
      const actualState = this.agentController?.isRunning ? 'thinking' : 'idle';
      this.postMessage({ type: 'stateUpdate', state: actualState });
      if (this.agentController) {
        this.postMessage({ type: 'modeUpdate', mode: this.agentController.getMode() });
        const plan = this.agentController.getCurrentPlan();
        if (plan) {
          this.postMessage({ type: 'planUpdate', plan });
        }
      }
      return;
    }
    if (message.type === 'selectModel') {
      this.handleSelectModel(message.provider, message.model);
      return;
    }
    if (message.type === 'requestFileList') {
      this.handleRequestFileList(message.query);
      return;
    }
    if (message.type === 'requestFolderList') {
      this.handleRequestFolderList(message.query);
      return;
    }
    if (message.type === 'openRulesFile') {
      this.handleOpenRulesFile();
      return;
    }
    if (message.type === 'showDiff') {
      this.diffViewProvider.showDiff(message.filePath, message.original, message.modified).catch(() => {});
      return;
    }
    if (message.type === 'requestTaskHistory') {
      this.handleRequestTaskHistory().catch(() => {});
      return;
    }
    if (message.type === 'deleteTaskHistory') {
      this.handleDeleteTaskHistory(message.taskId).catch(() => {});
      return;
    }
    if (message.type === 'exportTaskHistory') {
      this.handleExportTaskHistory(message.taskId, message.format).catch(() => {});
      return;
    }
    if (message.type === 'resumeTask') {
      this.agentController?.resumeTask(message.taskId).catch(() => {});
      return;
    }
    if (message.type === 'requestCheckpoints') {
      this.handleRequestCheckpoints();
      return;
    }
    if (message.type === 'restoreCheckpoint') {
      this.handleRestoreCheckpoint(message.checkpointId).catch(() => {});
      return;
    }
    if (message.type === 'runCodeBlock') {
      const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('MitraHelix');
      terminal.show(false);
      terminal.sendText(message.code);
      return;
    }
    if (message.type === 'applyCodeBlock') {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        await editor.edit(editBuilder => {
          if (selection.isEmpty) {
            editBuilder.insert(selection.start, message.code);
          } else {
            editBuilder.replace(selection, message.code);
          }
        });
      } else {
        const langMap: Record<string, string> = {
          typescript: 'typescript', ts: 'typescript', javascript: 'javascript', js: 'javascript',
          python: 'python', py: 'python', rust: 'rust', go: 'go', java: 'java',
          html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml',
          markdown: 'markdown', md: 'markdown', sql: 'sql', cpp: 'cpp', c: 'c',
        };
        const doc = await vscode.workspace.openTextDocument({ content: message.code, language: langMap[message.language] || message.language });
        await vscode.window.showTextDocument(doc);
      }
      return;
    }

    if (message.type === 'openUrl') {
      if (typeof message.url === 'string') {
        vscode.env.openExternal(vscode.Uri.parse(message.url)).then(() => {}, () => {});
      }
      return;
    }
    if (message.type === 'previewDiff') {
      this.handlePreviewDiff(message.toolName, message.path as string, message.content as string | undefined, message.diff as string | undefined).catch(() => {});
      return;
    }

    if (message.type === 'updateSettings') {
      const settings = (message as Record<string, unknown>).settings as { budget?: number; autoApprove?: { yoloMode: boolean; readFiles: boolean; editFiles: boolean; executeCommands: boolean; useMcp: boolean } } | undefined;
      if (settings?.autoApprove) {
        this.postMessage({ type: 'settingsUpdate', settings: settings.autoApprove });
      }
      return;
    }
    if (message.type === 'setApiKey') {
      const provider = (message as Record<string, unknown>).provider as string;
      if (provider) {
        vscode.commands.executeCommand('mitraHelix.setApiKey');
      }
      return;
    }

    if (!this.agentController) return;

    switch (message.type) {
      case 'sendMessage':
        this.agentController.handleUserMessage(message.text, undefined, message.attachments).catch(() => {});
        break;
      case 'cancelTask':
        this.agentController.cancelTask();
        break;
      case 'newTask':
        this.agentController.newTask().catch(() => {});
        break;
      case 'approveToolCall':
        this.agentController.approveToolCall(message.toolCallId);
        break;
      case 'rejectToolCall':
        this.agentController.rejectToolCall(message.toolCallId);
        break;
      case 'toggleMode':
        this.agentController.setMode(message.mode);
        this.postMessage({ type: 'modeUpdate', mode: message.mode });
        break;
      case 'executePlan':
        this.agentController.executePlan(message.planId).catch(() => {});
        break;
      case 'editPlanStep':
        this.agentController.editPlanStep(message.planId, message.stepId, message.title, message.description);
        break;
      case 'skipPlanStep':
        this.agentController.skipPlanStep(message.planId, message.stepId);
        break;
      case 'runWorkflow':
        this.handleRunWorkflow(message.workflowName, message.userText, message.attachments).catch(() => {});
        break;
    }
  }

  sendModeList(): void {
    const mm = this.agentController?.getModeManager();
    if (!mm) return;
    const modes = mm.getAllModes().map(m => ({
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      description: m.description,
      isBuiltin: m.isBuiltin,
    }));
    this.postMessage({ type: 'modeList', modes });
  }

  sendModelCatalog(): void {
    if (!this.configManager) return;
    const catalog = getModelCatalog();
    const models = catalog.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextWindow: m.contextWindow,
      supportsToolUse: m.supportsToolUse,
    }));
    this.postMessage({
      type: 'modelCatalog',
      models,
      currentProvider: this.configManager.getProvider(),
      currentModel: this.configManager.getModel(),
    });
  }

  async sendWorkflowList(): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return;
      if (!this.workflowManager || this.workflowManager.workspaceRoot !== workspaceRoot) {
        this.workflowManager = new WorkflowManager(workspaceRoot);
      }
      const workflows = await this.workflowManager.getWorkflows();
      this.postMessage({
        type: 'workflowList',
        workflows: workflows.map((w) => ({ name: w.name, description: w.description, fileName: w.fileName })),
      });
    } catch (err) {
      // Log but don't crash — workflows are optional
      if (this.outputChannel) {
        this.outputChannel.appendLine(`[WebviewProvider] Failed to load workflows: ${err}`);
      }
    }
  }

  getWorkflowManager(): WorkflowManager | undefined {
    return this.workflowManager;
  }

  private async handleRunWorkflow(workflowName: string, userText: string, attachments?: Attachment[]): Promise<void> {
    if (!this.agentController || !this.workflowManager) return;
    const workflow = await this.workflowManager.getWorkflowByName(workflowName);
    if (!workflow) {
      this.postMessage({ type: 'taskError', error: `Workflow "${workflowName}" not found. It may have been deleted or renamed.` });
      return;
    }
    const workflowPrefix = `[Workflow: ${workflow.name}]\n${workflow.content}`;
    const displayText = userText ? `/${workflow.name} ${userText}` : `/${workflow.name}`;
    this.agentController.handleUserMessage(userText, displayText, attachments, workflowPrefix).catch(() => {});
  }

  private async handleSelectModel(provider: string, model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('mitraHelix');
    await config.update('provider', provider, vscode.ConfigurationTarget.Global);
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    this.sendModelCatalog();
  }

  sendActiveFileInfo(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const filePath = vscode.workspace.asRelativePath(editor.document.uri);
      const fileName = path.basename(editor.document.uri.fsPath);
      this.postMessage({ type: 'activeFileInfo', filePath, fileName });
    }
  }

  private async handleRequestFileList(query: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const files = await this.walkWorkspaceFiles(workspaceRoot, query, false);
    this.postMessage({ type: 'fileList', files });
  }

  private async handleRequestFolderList(query: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const folders = await this.walkWorkspaceFiles(workspaceRoot, query, true);
    this.postMessage({ type: 'folderList', folders });
  }

  private async handleOpenRulesFile(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const rulesPath = path.join(workspaceRoot, '.mitrahelixrules');
    const rulesUri = vscode.Uri.file(rulesPath);
    try {
      await vscode.workspace.fs.stat(rulesUri);
    } catch {
      // File doesn't exist — create it with a template
      const template = `# MitraHelix Global Rules
# These rules are automatically included in every conversation.
# Add your project-specific instructions below.

`;
      await vscode.workspace.fs.writeFile(rulesUri, Buffer.from(template, 'utf-8'));
    }
    const doc = await vscode.workspace.openTextDocument(rulesUri);
    await vscode.window.showTextDocument(doc);
  }

  private async handleRequestTaskHistory(): Promise<void> {
    if (!this.agentController) return;
    const tasks = await this.agentController.getTaskHistory();
    this.postMessage({ type: 'taskHistory', tasks });
  }

  private async handleDeleteTaskHistory(taskId: string): Promise<void> {
    if (!this.agentController) return;
    await this.agentController.deleteTaskHistory(taskId);
    const tasks = await this.agentController.getTaskHistory();
    this.postMessage({ type: 'taskHistory', tasks });
  }

  private async handleExportTaskHistory(taskId: string, format: 'markdown' | 'json'): Promise<void> {
    if (!this.agentController) return;
    const content = await this.agentController.exportTaskHistory(taskId, format);
    if (content) {
      const language = format === 'json' ? 'json' : 'markdown';
      const doc = await vscode.workspace.openTextDocument({ content, language });
      await vscode.window.showTextDocument(doc, { preview: false });
    }
  }

  private handleRequestCheckpoints(): void {
    if (!this.agentController) return;
    const checkpoints = this.agentController.getCheckpointList();
    this.postMessage({ type: 'checkpointList', checkpoints });
  }

  private async handleRestoreCheckpoint(checkpointId: string): Promise<void> {
    if (!this.agentController) return;
    const result = await this.agentController.restoreCheckpoint(checkpointId);
    this.postMessage({ type: 'checkpointRestored', result });
  }

  private async handlePreviewDiff(toolName: string, filePath: string, content?: string, diff?: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !filePath) return;
    const absolutePath = path.join(workspaceRoot, filePath);
    let originalContent = '';
    try {
      originalContent = (await fs.readFile(absolutePath, 'utf-8'));
    } catch {
      // New file — original is empty
    }

    let modifiedContent = originalContent;
    if (toolName === 'write_to_file' && typeof content === 'string') {
      modifiedContent = content;
    } else if (toolName === 'replace_in_file' && typeof diff === 'string') {
      modifiedContent = this.applySearchReplacePreview(originalContent, diff);
    }

    this.diffViewProvider.showDiff(filePath, originalContent, modifiedContent).catch(() => {});
  }

  private applySearchReplacePreview(content: string, diff: string): string {
    const normalizedDiff = diff.replace(/\r\n/g, '\n');
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)>>>>>>> REPLACE/g;
    let result = content;
    let match;
    while ((match = regex.exec(normalizedDiff)) !== null) {
      const search = match[1];
      const replace = match[2].endsWith('\n') ? match[2].slice(0, -1) : match[2];
      if (result.includes(search)) {
        const idx = result.indexOf(search);
        result = result.slice(0, idx) + replace + result.slice(idx + search.length);
      } else {
        const normalizedSearch = search.replace(/\r\n/g, '\n');
        const normalizedResult = result.replace(/\r\n/g, '\n');
        if (normalizedResult.includes(normalizedSearch)) {
          const idx = normalizedResult.indexOf(normalizedSearch);
          result = normalizedResult.slice(0, idx) + replace + normalizedResult.slice(idx + normalizedSearch.length);
        }
      }
    }
    return result;
  }

  private async walkWorkspaceFiles(
    rootDir: string,
    query: string,
    foldersOnly: boolean,
    maxResults: number = 100
  ): Promise<FileListItem[]> {
    const skipDirs = new Set([
      'node_modules', '.git', 'dist', 'out', '__pycache__',
      '.next', 'venv', '.venv', '.cache', 'coverage',
      '.nyc_output', '.turbo', '.vercel',
    ]);
    const results: FileListItem[] = [];
    const lowerQuery = query.toLowerCase();

    const walk = async (dir: string, relPrefix: string, depth: number): Promise<void> => {
      if (depth > 6 || results.length >= maxResults) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch { return; }

      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (entry.name.startsWith('.') && entry.name !== '.mitrahelix') continue;
        if (entry.isSymbolicLink()) continue;
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (skipDirs.has(entry.name)) continue;
          if (foldersOnly && relPath.toLowerCase().includes(lowerQuery)) {
            results.push({ path: relPath, name: entry.name, isDirectory: true });
          }
          await walk(path.join(dir, entry.name), relPath, depth + 1);
        } else if (!foldersOnly) {
          if (relPath.toLowerCase().includes(lowerQuery)) {
            results.push({ path: relPath, name: entry.name, isDirectory: false });
          }
        }
      }
    };

    await walk(rootDir, '', 0);
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.css'));
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>MitraHelix</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
