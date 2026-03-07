import * as vscode from 'vscode';
import type { ConfigManager } from '../config/ConfigManager.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { ConversationMemory } from '../memory/ConversationMemory.js';
import { SystemPromptBuilder } from '../prompts/SystemPromptBuilder.js';
import { ContextManager } from '../context/ContextManager.js';
import { MentionsParser } from '../context/MentionsParser.js';
import { PermissionManager } from '../permissions/PermissionManager.js';
import { AgentLoop } from './AgentLoop.js';
import { createProvider } from '../llm/ProviderFactory.js';
import { getModelInfo } from '../llm/models.js';
import type { ToolContext } from '../../shared/ToolTypes.js';
import type { ExtensionMessage, CostInfo } from '../../shared/MessageTypes.js';

export class AgentController {
  private memory = new ConversationMemory();
  private agentLoop: AgentLoop | null = null;
  private mode: 'act' | 'plan' = 'act';
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private totalCost: CostInfo = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
  private cachedProvider: { provider: ReturnType<typeof createProvider>; key: string } | null = null;

  constructor(
    private config: ConfigManager,
    private toolRegistry: ToolRegistry,
    private outputChannel: vscode.OutputChannel,
    private postMessage: (message: ExtensionMessage) => void
  ) {}

  private getOrCreateProvider() {
    const key = `${this.config.getProvider()}:${this.config.getApiKey()}:${this.config.getModel()}`;
    if (this.cachedProvider && this.cachedProvider.key === key) {
      this.cachedProvider.provider.resetUsage();
      return this.cachedProvider.provider;
    }
    const provider = createProvider(this.config);
    this.cachedProvider = { provider, key };
    return provider;
  }

  async handleUserMessage(text: string, displayText?: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    if (!workspaceRoot) {
      this.postMessage({ type: 'taskError', error: 'No workspace folder open. Please open a folder first.' });
      return;
    }

    // Parse @mentions
    const mentionsParser = new MentionsParser(workspaceRoot);
    const { cleanText, mentions } = await mentionsParser.parse(text);

    let enrichedText = cleanText;
    if (mentions.length > 0) {
      const mentionContent = mentions.map((m) => m.content).join('\n\n');
      enrichedText = `${cleanText}\n\n[Attached context from @mentions]:\n${mentionContent}`;
    }

    // Post user message to webview (use displayText if provided for cleaner UI)
    this.postMessage({
      type: 'addMessage',
      message: {
        id: `user_${Date.now()}`,
        role: 'user',
        content: displayText ?? text,
        timestamp: Date.now(),
      },
    });

    this.postMessage({ type: 'stateUpdate', state: 'thinking' });

    // Cancel any existing running loop to prevent concurrent processing
    if (this.agentLoop?.running) {
      this.agentLoop.cancel();
      this.pendingApprovals.clear();
    }

    try {
      const provider = this.getOrCreateProvider();

      const toolContext: ToolContext = {
        workspaceRoot,
        outputChannel: this.outputChannel,
        postMessage: (msg) => this.postMessage(msg as ExtensionMessage),
      };

      const toolExecutor = new ToolExecutor(this.toolRegistry, toolContext);
      const promptBuilder = new SystemPromptBuilder(this.toolRegistry);
      const contextManager = new ContextManager(workspaceRoot);
      const permissionManager = new PermissionManager(this.config);

      const modelInfo = getModelInfo(this.config.getModel(), this.config.getProvider());
      const effectiveContextWindow = Math.min(
        this.config.getContextWindowSize(),
        modelInfo?.contextWindow ?? this.config.getContextWindowSize()
      );
      const effectiveMaxTokens = Math.min(
        this.config.getMaxTokens(),
        modelInfo?.maxOutput ?? this.config.getMaxTokens()
      );

      this.agentLoop = new AgentLoop(
        provider,
        this.toolRegistry,
        toolExecutor,
        this.memory,
        promptBuilder,
        contextManager,
        permissionManager,
        this.mode,
        effectiveMaxTokens,
        this.config.getMaxBudgetPerTask(),
        effectiveContextWindow,
        modelInfo?.inputCostPer1M ?? 3.0,
        modelInfo?.outputCostPer1M ?? 15.0
      );

      let currentMessageId = '';

      for await (const event of this.agentLoop.run(enrichedText)) {
        switch (event.type) {
          case 'streamToken':
            if (currentMessageId !== event.messageId) {
              currentMessageId = event.messageId;
              this.postMessage({
                type: 'addMessage',
                message: {
                  id: event.messageId,
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now(),
                  isStreaming: true,
                },
              });
            }
            this.postMessage({ type: 'streamToken', messageId: event.messageId, token: event.token });
            break;

          case 'streamEnd':
            this.postMessage({ type: 'streamEnd', messageId: event.messageId });
            break;

          case 'toolCallStarted':
            this.postMessage({ type: 'stateUpdate', state: 'tool_calling' });
            this.postMessage({ type: 'toolCallStarted', toolCall: event.toolCall });
            break;

          case 'requestApproval':
            this.postMessage({ type: 'stateUpdate', state: 'awaiting_approval' });
            this.postMessage({ type: 'requestApproval', toolCall: event.toolCall });
            // Store the resolve callback from the AgentLoop
            this.pendingApprovals.set(event.toolCall.id, (approved: boolean) => {
              this.agentLoop?.resolveApproval(event.toolCall.id, approved);
            });
            break;

          case 'toolCallCompleted':
            this.postMessage({ type: 'toolCallCompleted', toolCallId: event.toolCallId, result: event.result });
            this.postMessage({ type: 'stateUpdate', state: 'thinking' });
            break;

          case 'taskCompleted':
            this.postMessage({ type: 'taskCompleted', summary: event.summary });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;

          case 'taskError':
            this.postMessage({ type: 'taskError', error: event.error });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;

          case 'costUpdate':
            this.totalCost.inputTokens += event.inputTokens;
            this.totalCost.outputTokens += event.outputTokens;
            this.totalCost.estimatedCost = this.estimateCost(this.totalCost.inputTokens, this.totalCost.outputTokens);
            this.postMessage({ type: 'costUpdate', cost: this.totalCost });
            break;

          case 'followUpQuestion':
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[AgentController] Error: ${message}`);
      this.postMessage({ type: 'taskError', error: message });
      this.postMessage({ type: 'stateUpdate', state: 'idle' });
    }
  }

  approveToolCall(toolCallId: string): void {
    const resolve = this.pendingApprovals.get(toolCallId);
    if (resolve) {
      resolve(true);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  rejectToolCall(toolCallId: string): void {
    const resolve = this.pendingApprovals.get(toolCallId);
    if (resolve) {
      resolve(false);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  cancelTask(): void {
    this.agentLoop?.cancel();
    this.pendingApprovals.clear();
    this.postMessage({ type: 'stateUpdate', state: 'idle' });
  }

  newTask(): void {
    this.cancelTask();
    this.memory.clear();
    this.totalCost = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
    this.postMessage({ type: 'clearMessages' });
    this.postMessage({ type: 'costUpdate', cost: this.totalCost });
    this.postMessage({ type: 'stateUpdate', state: 'idle' });
  }

  setMode(mode: 'act' | 'plan'): void {
    this.mode = mode;
    this.agentLoop?.setMode(mode);
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    const modelId = this.config.getModel();
    const provider = this.config.getProvider();
    const modelInfo = getModelInfo(modelId, provider);

    const inputCostPer1M = modelInfo?.inputCostPer1M ?? 3.0;
    const outputCostPer1M = modelInfo?.outputCostPer1M ?? 15.0;

    return (inputTokens / 1_000_000) * inputCostPer1M + (outputTokens / 1_000_000) * outputCostPer1M;
  }
}
