import * as vscode from 'vscode';
import { MitraHelixWebviewProvider } from './core/webview/WebviewProvider.js';
import { AgentController } from './core/agent/AgentController.js';
import { ConfigManager } from './core/config/ConfigManager.js';
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
import { VIEW_ID, COMMAND_NEW_CHAT, COMMAND_FOCUS_CHAT, OUTPUT_CHANNEL_NAME } from './shared/constants.js';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  outputChannel.appendLine('MitraHelix AI Agent is now active!');

  // Initialize config
  const configManager = new ConfigManager();

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

  outputChannel.appendLine(`Registered ${toolRegistry.getAll().length} tools.`);

  // Initialize webview provider
  const webviewProvider = new MitraHelixWebviewProvider(context.extensionUri, context);

  // Initialize agent controller
  const agentController = new AgentController(
    configManager,
    toolRegistry,
    outputChannel,
    (message) => webviewProvider.postMessage(message)
  );

  webviewProvider.setConfigManager(configManager);
  webviewProvider.setAgentController(agentController);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_NEW_CHAT, () => {
      agentController.newTask();
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

  // Listen for config changes
  context.subscriptions.push(
    configManager.onConfigChanged(() => {
      outputChannel.appendLine('Configuration changed.');
      webviewProvider.sendModelCatalog();
      webviewProvider.sendWorkflowList();
    })
  );

  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('MitraHelix AI Agent ready.');
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
