import * as vscode from 'vscode';
import { MitraHelixWebviewProvider } from './core/webview/WebviewProvider.js';
import { AgentController } from './core/agent/AgentController.js';
import { ConfigManager } from './core/config/ConfigManager.js';
import { SecretManager } from './core/config/SecretManager.js';
import { ToolRegistry } from './core/tools/ToolRegistry.js';
import { ReadFileTool } from './core/tools/definitions/ReadFileTool.js';
import { WriteFileTool } from './core/tools/definitions/WriteFileTool.js';
import { ReplaceInFileTool } from './core/tools/definitions/ReplaceInFileTool.js';
import { ExecuteCommandTool } from './core/tools/definitions/ExecuteCommandTool.js';
import { SearchFilesTool } from './core/tools/definitions/SearchFilesTool.js';
import { ListFilesTool } from './core/tools/definitions/ListFilesTool.js';
import { ListCodeDefinitionsTool } from './core/tools/definitions/ListCodeDefinitionsTool.js';
import { AskFollowUpTool } from './core/tools/definitions/AskFollowUpTool.js';
import { AttemptCompletionTool } from './core/tools/definitions/AttemptCompletionTool.js';
import { WebFetchTool } from './core/tools/definitions/WebFetchTool.js';
import { ApplyPatchTool } from './core/tools/definitions/ApplyPatchTool.js';
import { CondenseTool } from './core/tools/definitions/CondenseTool.js';
import { NewRuleTool } from './core/tools/definitions/NewRuleTool.js';
import { PlanModeRespondTool } from './core/tools/definitions/PlanModeRespondTool.js';
import { ActModeRespondTool } from './core/tools/definitions/ActModeRespondTool.js';
import { NewTaskTool } from './core/tools/definitions/NewTaskTool.js';
import { BrowserActionTool } from './core/tools/definitions/BrowserActionTool.js';
import { TerminalOutputCollector } from './core/context/TerminalOutputCollector.js';
import { MCPClientManager } from './core/mcp/MCPClientManager.js';
import { UseMCPToolTool, AccessMCPResourceTool } from './core/mcp/MCPToolBridge.js';
import { ModeManager } from './core/modes/ModeManager.js';
import { VIEW_ID, COMMAND_NEW_CHAT, COMMAND_FOCUS_CHAT, OUTPUT_CHANNEL_NAME } from './shared/constants.js';

let activeController: AgentController | undefined;
let mcpManager: MCPClientManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  outputChannel.appendLine('MitraHelix AI Agent is now active!');

  // Initialize config
  const configManager = new ConfigManager();
  const secretManager = new SecretManager(context);
  configManager.setSecretManager(secretManager);
  secretManager.migrateFromSettings().then((count) => {
    if (count > 0) {
      outputChannel.appendLine(`[SecretStorage] Migrated ${count} API key(s) from plaintext settings.`);
    }
  }).catch((err) => outputChannel.appendLine(`[SecretStorage] Migration error: ${err}`));

  // Initialize tool registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new WriteFileTool());
  toolRegistry.register(new ReplaceInFileTool());
  toolRegistry.register(new ExecuteCommandTool());
  toolRegistry.register(new SearchFilesTool());
  toolRegistry.register(new ListFilesTool());
  toolRegistry.register(new ListCodeDefinitionsTool());
  toolRegistry.register(new AskFollowUpTool());
  toolRegistry.register(new AttemptCompletionTool());
  toolRegistry.register(new WebFetchTool());
  toolRegistry.register(new ApplyPatchTool());
  toolRegistry.register(new CondenseTool());
  toolRegistry.register(new NewRuleTool());
  toolRegistry.register(new PlanModeRespondTool());
  toolRegistry.register(new ActModeRespondTool());
  toolRegistry.register(new NewTaskTool());
  toolRegistry.register(new BrowserActionTool());

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  mcpManager = new MCPClientManager(workspaceRoot);
  mcpManager.loadConfig().catch((err) => outputChannel.appendLine(`[MCP] Config load error: ${err}`));

  toolRegistry.register(new UseMCPToolTool(mcpManager));
  toolRegistry.register(new AccessMCPResourceTool(mcpManager));

  outputChannel.appendLine(`Registered ${toolRegistry.getAll().length} tools.`);

  const terminalCollector = new TerminalOutputCollector();
  context.subscriptions.push(terminalCollector);

  // Initialize webview provider
  const webviewProvider = new MitraHelixWebviewProvider(context.extensionUri, context);

  const agentController = new AgentController(
    configManager,
    toolRegistry,
    outputChannel,
    (message) => webviewProvider.postMessage(message),
    terminalCollector,
    mcpManager
  );
  activeController = agentController;

  const modeManager = new ModeManager(workspaceRoot);
  modeManager.loadCustomModes().catch((err) => outputChannel.appendLine(`[Modes] Load error: ${err}`));
  agentController.setModeManager(modeManager);

  webviewProvider.setConfigManager(configManager);
  webviewProvider.setAgentController(agentController);
  webviewProvider.setOutputChannel(outputChannel);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_NEW_CHAT, () => {
      agentController.newTask().catch((err) => {
        outputChannel.appendLine(`[NewTask] Error: ${err}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_FOCUS_CHAT, () => {
      vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mitraHelix.openPanel', () => {
      webviewProvider.openPanel();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mitraHelix.setApiKey', async () => {
      const provider = await vscode.window.showQuickPick(
        ['anthropic', 'openai', 'google', 'deepseek', 'openrouter'],
        { placeHolder: 'Select API provider' }
      );
      if (!provider) return;
      const key = await vscode.window.showInputBox({
        prompt: `Enter your ${provider} API key`,
        password: true,
        placeHolder: 'sk-...',
      });
      if (key !== undefined) {
        try {
          const keyName = `${provider}ApiKey` as Parameters<SecretManager['setSecret']>[0];
          await secretManager.setSecret(keyName, key);
          outputChannel.appendLine(`[SecretStorage] ${provider} API key updated.`);
          vscode.window.showInformationMessage(`${provider} API key saved securely.`);
        } catch (err) {
          outputChannel.appendLine(`[SecretStorage] Error saving key: ${err}`);
          vscode.window.showErrorMessage(`Failed to save API key: ${err}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mitraHelix.askAboutSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) return;
      const selectedText = editor.document.getText(editor.selection);
      const filePath = vscode.workspace.asRelativePath(editor.document.uri);
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;

      vscode.commands.executeCommand(`${VIEW_ID}.focus`);
      webviewProvider.postMessage({
        type: 'askAboutContext',
        text: `Explain the following code from ${filePath} (lines ${startLine}-${endLine})`,
        attachment: {
          type: 'selection',
          value: selectedText.slice(0, 50000),
          displayName: `${filePath}:${startLine}-${endLine}`,
        },
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mitraHelix.addFileToContext', (uri: vscode.Uri) => {
      if (!uri) return;
      const filePath = vscode.workspace.asRelativePath(uri);
      const fileName = uri.fsPath.split(/[\\/]/).pop() || filePath;

      vscode.commands.executeCommand(`${VIEW_ID}.focus`);
      webviewProvider.postMessage({
        type: 'prefillAttachment',
        attachment: { type: 'file', value: filePath, displayName: fileName },
      });
    })
  );

  // Listen for config changes
  context.subscriptions.push(
    configManager.onConfigChanged(() => {
      outputChannel.appendLine('Configuration changed.');
      webviewProvider.sendModelCatalog();
      webviewProvider.sendWorkflowList();
    })
  );

  // File watchers for workflows and rules — invalidate caches and re-send lists on change
  const workflowWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelix/workflows/*.md');
  const onWorkflowChange = () => {
    const wm = webviewProvider.getWorkflowManager();
    if (wm) wm.invalidateCache();
    webviewProvider.sendWorkflowList();
  };
  workflowWatcher.onDidChange(onWorkflowChange);
  workflowWatcher.onDidCreate(onWorkflowChange);
  workflowWatcher.onDidDelete(onWorkflowChange);
  context.subscriptions.push(workflowWatcher);

  const ignoreWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelixignore');
  const onIgnoreChange = () => {
    outputChannel.appendLine('Ignore file changed — invalidating cache.');
    agentController.invalidateIgnoreCache();
  };
  ignoreWatcher.onDidChange(onIgnoreChange);
  ignoreWatcher.onDidCreate(onIgnoreChange);
  ignoreWatcher.onDidDelete(onIgnoreChange);
  context.subscriptions.push(ignoreWatcher);

  const rulesWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelix/rules/*.md');
  const legacyRulesWatcher = vscode.workspace.createFileSystemWatcher('**/{.mitrahelixrules,AGENTS.md,.cursorrules}');
  const onRulesChange = () => {
    outputChannel.appendLine('Rules file changed — invalidating cache.');
    agentController.invalidateRulesCache();
  };
  rulesWatcher.onDidChange(onRulesChange);
  rulesWatcher.onDidCreate(onRulesChange);
  rulesWatcher.onDidDelete(onRulesChange);
  legacyRulesWatcher.onDidChange(onRulesChange);
  legacyRulesWatcher.onDidCreate(onRulesChange);
  legacyRulesWatcher.onDidDelete(onRulesChange);
  context.subscriptions.push(rulesWatcher, legacyRulesWatcher);

  const modesWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelix/modes/*.json');
  const onModesChange = () => {
    outputChannel.appendLine('Custom modes changed — reloading.');
    agentController.invalidateModesCache();
    modeManager.loadCustomModes().then(() => {
      webviewProvider.sendModeList();
    }).catch((err) => outputChannel.appendLine(`[Modes] Reload error: ${err}`));
  };
  modesWatcher.onDidChange(onModesChange);
  modesWatcher.onDidCreate(onModesChange);
  modesWatcher.onDidDelete(onModesChange);
  context.subscriptions.push(modesWatcher);

  const hooksWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelix/hooks.json');
  const onHooksChange = () => {
    outputChannel.appendLine('Hooks config changed — invalidating cache.');
    agentController.invalidateHooksCache();
  };
  hooksWatcher.onDidChange(onHooksChange);
  hooksWatcher.onDidCreate(onHooksChange);
  hooksWatcher.onDidDelete(onHooksChange);
  context.subscriptions.push(hooksWatcher);

  const mcpConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.mitrahelix/mcp.json');
  const onMCPConfigChange = () => {
    if (mcpManager) {
      outputChannel.appendLine('[MCP] Config changed — reconnecting servers.');
      mcpManager.disconnectAll().then(() => mcpManager!.loadConfig()).catch((err) =>
        outputChannel.appendLine(`[MCP] Reload error: ${err}`)
      );
    }
  };
  mcpConfigWatcher.onDidChange(onMCPConfigChange);
  mcpConfigWatcher.onDidCreate(onMCPConfigChange);
  mcpConfigWatcher.onDidDelete(onMCPConfigChange);
  context.subscriptions.push(mcpConfigWatcher);

  // Track active editor changes to update context indicator in webview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      webviewProvider.sendActiveFileInfo();
    })
  );

  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('MitraHelix AI Agent ready.');
}

export async function deactivate(): Promise<void> {
  await activeController?.dispose();
  activeController = undefined;
  await mcpManager?.disconnectAll();
  mcpManager = undefined;
}
