import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from '../../shared/MessageTypes.js';
import { getModelCatalog } from '../llm/models.js';
import type { AgentController } from '../agent/AgentController.js';
import type { ConfigManager } from '../config/ConfigManager.js';
import { WorkflowManager } from '../workflows/WorkflowManager.js';

export class MitraHelixWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private agentController?: AgentController;
  private configManager?: ConfigManager;
  private workflowManager?: WorkflowManager;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly extensionContext: vscode.ExtensionContext
  ) {}

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
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.extensionContext.subscriptions
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postMessage({ type: 'stateUpdate', state: 'idle' });
        this.sendModelCatalog();
        this.sendWorkflowList();
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
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.extensionContext.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    // Initial catalog/workflow sends are triggered by webviewReady message from React
  }

  private handleMessage(message: WebviewMessage): void {
    // Handle messages that don't require agentController first
    if (message.type === 'webviewReady') {
      this.sendModelCatalog();
      this.sendWorkflowList();
      return;
    }
    if (message.type === 'selectModel') {
      this.handleSelectModel(message.provider, message.model);
      return;
    }

    if (!this.agentController) return;

    switch (message.type) {
      case 'sendMessage':
        this.agentController.handleUserMessage(message.text);
        break;
      case 'cancelTask':
        this.agentController.cancelTask();
        break;
      case 'newTask':
        this.agentController.newTask();
        break;
      case 'approveToolCall':
        this.agentController.approveToolCall(message.toolCallId);
        break;
      case 'rejectToolCall':
        this.agentController.rejectToolCall(message.toolCallId);
        break;
      case 'toggleMode':
        this.agentController.setMode(message.mode);
        break;
      case 'runWorkflow':
        this.handleRunWorkflow(message.workflowName, message.userText);
        break;
    }
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
    } catch {
      // Silently handle — workflows are optional
    }
  }

  private async handleRunWorkflow(workflowName: string, userText: string): Promise<void> {
    if (!this.agentController || !this.workflowManager) return;
    const workflow = await this.workflowManager.getWorkflowByName(workflowName);
    if (!workflow) return;
    const enrichedText = `[Workflow: ${workflow.name}]\n${workflow.content}\n\n${userText}`;
    const displayText = userText ? `/${workflow.name} ${userText}` : `/${workflow.name}`;
    this.agentController.handleUserMessage(enrichedText, displayText);
  }

  private async handleSelectModel(provider: string, model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('mitraHelix');
    await config.update('provider', provider, vscode.ConfigurationTarget.Global);
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    this.sendModelCatalog();
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
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
