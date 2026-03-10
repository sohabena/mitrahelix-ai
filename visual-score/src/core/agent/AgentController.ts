import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ConfigManager } from '../config/ConfigManager.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { ConversationMemory } from '../memory/ConversationMemory.js';
import { ProjectMemory } from '../memory/ProjectMemory.js';
import { SystemPromptBuilder } from '../prompts/SystemPromptBuilder.js';
import { ContextManager } from '../context/ContextManager.js';
import { MentionsParser } from '../context/MentionsParser.js';
import { PermissionManager } from '../permissions/PermissionManager.js';
import { AgentLoop } from './AgentLoop.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { ShadowGitCheckpointManager } from '../checkpoints/ShadowGitCheckpointManager.js';
import { HookManager } from '../hooks/HookManager.js';
import { PostToolActions } from '../tools/PostToolActions.js';
import { createProvider } from '../llm/ProviderFactory.js';
import { getModelInfo } from '../llm/models.js';
import type { ContentPart } from '../llm/types.js';
import type { ToolContext } from '../../shared/ToolTypes.js';
import type { ExtensionMessage, CostInfo, Attachment, Plan, PlanStep } from '../../shared/MessageTypes.js';
import { parsePlanFromResponse, planToMarkdown } from './PlanParser.js';
import { IgnoreManager } from '../ignore/IgnoreManager.js';
import { TaskHistoryManager } from '../persistence/TaskHistoryManager.js';
import type { TaskHistoryEntry, TaskHistorySummary } from '../persistence/TaskHistoryManager.js';
import type { TerminalOutputCollector } from '../context/TerminalOutputCollector.js';
import type { MCPClientManager } from '../mcp/MCPClientManager.js';
import type { ModeManager } from '../modes/ModeManager.js';
import { PLACEHOLDER_DIAGNOSTICS, PLACEHOLDER_TERMINAL, PLACEHOLDER_SELECTION } from '../../shared/constants.js';

export class AgentController {
  private memory = new ConversationMemory();
  private agentLoop: AgentLoop | null = null;
  private runPromise: Promise<void> | null = null;
  private mode: string = 'act';
  private modeManager: ModeManager | null = null;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private totalCost: CostInfo = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
  private cachedProvider: { provider: ReturnType<typeof createProvider>; key: string } | null = null;
  private lastContextManager: ContextManager | null = null;
  private ignoreManager: IgnoreManager | null = null;
  private taskHistory: TaskHistoryManager | null = null;
  private checkpointManager: CheckpointManager | null = null;
  private shadowCheckpointManager: ShadowGitCheckpointManager | null = null;
  private hookManager: HookManager | null = null;
  private projectMemory: ProjectMemory | null = null;
  private currentTaskId: string | null = null;
  private taskStartTime: string | null = null;
  private currentPlan: Plan | null = null;

  constructor(
    private config: ConfigManager,
    private toolRegistry: ToolRegistry,
    private outputChannel: vscode.OutputChannel,
    private postMessage: (message: ExtensionMessage) => void,
    private terminalCollector?: TerminalOutputCollector,
    private mcpManager?: MCPClientManager
  ) {}

  setModeManager(manager: ModeManager): void {
    this.modeManager = manager;
  }

  invalidateModesCache(): void {
    this.modeManager?.invalidateCache();
  }

  invalidateRulesCache(): void {
    this.lastContextManager?.getRulesManager().invalidateCache();
  }

  invalidateIgnoreCache(): void {
    this.ignoreManager?.invalidateCache();
  }

  invalidateHooksCache(): void {
    this.hookManager?.invalidateCache();
  }

  private async getOrCreateProvider() {
    const apiKey = await this.config.getApiKeyAsync();
    const key = `${this.config.getProvider()}:${apiKey}:${this.config.getModel()}:${this.config.getOllamaBaseUrl()}`;
    if (this.cachedProvider && this.cachedProvider.key === key) {
      this.cachedProvider.provider.resetUsage();
      return this.cachedProvider.provider;
    }
    const provider = createProvider(this.config, apiKey);
    this.cachedProvider = { provider, key };
    return provider;
  }

  async handleUserMessage(text: string, displayText?: string, attachments?: Attachment[], prefixContent?: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    if (!workspaceRoot) {
      this.postMessage({ type: 'taskError', error: 'No workspace folder open. Please open a folder first.' });
      return;
    }

    if (!this.taskHistory) {
      this.taskHistory = new TaskHistoryManager(workspaceRoot);
    }
    if (!this.currentTaskId) {
      this.currentTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.taskStartTime = new Date().toISOString();
    }

    if (!this.shadowCheckpointManager) {
      this.shadowCheckpointManager = new ShadowGitCheckpointManager(workspaceRoot);
      await this.shadowCheckpointManager.initialize();
    }
    if (!this.checkpointManager) {
      this.checkpointManager = new CheckpointManager(workspaceRoot);
      await this.checkpointManager.initialize();
    }

    if (!this.hookManager) {
      this.hookManager = new HookManager(workspaceRoot);
    }

    // Parse @mentions from raw text (not from workflow/prefix content)
    const mentionsParser = new MentionsParser(workspaceRoot);
    const { cleanText: parsedText, mentions } = await mentionsParser.parse(text);
    const cleanText = prefixContent ? `${prefixContent}\n\n${parsedText}` : parsedText;

    // Resolve text-based placeholders that need VS Code API access
    for (const m of mentions) {
      if (m.type === 'problems' && m.content === PLACEHOLDER_DIAGNOSTICS) {
        m.content = this.collectDiagnostics();
      }
      if (m.type === 'terminal' && m.content === PLACEHOLDER_TERMINAL) {
        m.content = this.collectTerminalOutput();
      }
      if (m.type === 'selection' && m.content === PLACEHOLDER_SELECTION) {
        m.content = this.collectEditorSelection();
      }
    }

    // Resolve UI-attached context chips into mentions (with budget + dedup)
    const MAX_MENTION_CHARS = 150_000;
    const totalChars = () => mentions.reduce((sum, m) => sum + m.content.length, 0);
    const alreadyHas = (type: string, value: string) => mentions.some((m) => m.type === type && m.value === value);
    const imageAttachments: ContentPart[] = [];

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'image') {
          imageAttachments.push({
            type: 'image',
            source: { type: 'base64', media_type: att.mimeType || 'image/png', data: att.value },
          });
          continue;
        }

        if (totalChars() >= MAX_MENTION_CHARS) break;
        if (alreadyHas(att.type, att.value)) continue;

        if (att.type === 'file') {
          const content = await mentionsParser.resolveFile(att.value);
          mentions.push({ type: 'file', value: att.value, content });
        } else if (att.type === 'folder') {
          const content = await mentionsParser.resolveFolder(att.value);
          mentions.push({ type: 'folder', value: att.value, content });
        } else if (att.type === 'problems') {
          mentions.push({ type: 'problems', value: 'problems', content: this.collectDiagnostics() });
        } else if (att.type === 'url') {
          const content = await mentionsParser.resolveUrl(att.value);
          mentions.push({ type: 'url', value: att.value, content });
        } else if (att.type === 'git') {
          const content = await mentionsParser.resolveGit();
          mentions.push({ type: 'git', value: 'git', content });
        } else if (att.type === 'terminal') {
          const content = this.collectTerminalOutput();
          mentions.push({ type: 'terminal', value: 'terminal', content });
        } else if (att.type === 'selection') {
          const content = att.value && att.value !== 'selection'
            ? `--- Selection (${att.displayName || 'editor'}) ---\n${att.value.slice(0, 50000)}`
            : this.collectEditorSelection();
          mentions.push({ type: 'selection', value: 'selection', content });
        }
      }
    }

    // Build enriched text, handling empty cleanText gracefully
    let enrichedText = cleanText;
    if (mentions.length > 0) {
      const mentionContent = mentions.map((m) => m.content).join('\n\n');
      enrichedText = cleanText
        ? `${cleanText}\n\n[Attached context]:\n${mentionContent}`
        : `[Attached context]:\n${mentionContent}`;
    }

    // Build display text for empty messages with attachments
    let effectiveDisplayText = displayText ?? text;
    if (!effectiveDisplayText.trim() && attachments && attachments.length > 0) {
      const chipLabels = attachments.map((a) => a.displayName || `@${a.type}`);
      effectiveDisplayText = `[${chipLabels.join(', ')}]`;
    }

    // Post user message to webview
    this.postMessage({
      type: 'addMessage',
      message: {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: effectiveDisplayText,
        timestamp: Date.now(),
      },
    });

    this.postMessage({ type: 'stateUpdate', state: 'thinking' });

    if (this.agentLoop?.running) {
      this.agentLoop.cancel();
      this.pendingApprovals.clear();
      try { await this.runPromise; } catch { /* swallow — errors already handled inside */ }
    }

    let resolveRun: (() => void) | undefined;
    try {
      const provider = await this.getOrCreateProvider();

      if (!this.ignoreManager || this.ignoreManager['workspaceRoot'] !== workspaceRoot) {
        this.ignoreManager = new IgnoreManager(workspaceRoot);
      }
      await this.ignoreManager.ensureLoaded();

      const toolContext: ToolContext = {
        workspaceRoot,
        outputChannel: this.outputChannel,
        postMessage: (msg) => this.postMessage(msg as ExtensionMessage),
        ignoreManager: this.ignoreManager,
      };

      const modeDefinition = this.modeManager?.getMode(this.mode);
      const hasRestrictAll = modeDefinition?.restrictedTools?.includes('*') ?? false;
      const hasAllowedTools = (modeDefinition?.allowedTools?.length ?? 0) > 0;
      const toolsEnabled = hasRestrictAll ? false : (hasAllowedTools || !modeDefinition?.restrictedTools);

      const filteredRegistry = toolsEnabled && modeDefinition
        ? this.toolRegistry.filter((name) => this.modeManager!.isToolAllowed(this.mode, name))
        : this.toolRegistry;

      const toolExecutor = new ToolExecutor(filteredRegistry, toolContext);
      const promptBuilder = new SystemPromptBuilder(filteredRegistry);

      if (modeDefinition?.rolePrompt) {
        promptBuilder.setModeRolePrompt(modeDefinition.rolePrompt);
      }

      if (this.mcpManager) {
        const mcpTools = this.mcpManager.getAvailableTools();
        const mcpResources = this.mcpManager.getAvailableResources();
        if (mcpTools.length > 0 || mcpResources.length > 0) {
          promptBuilder.setMCPToolsInfo(this.formatMCPInfo(mcpTools, mcpResources));
        }
      }

      if (this.config.getCrossSessionMemory()) {
        if (!this.projectMemory || this.projectMemory['workspaceRoot'] !== workspaceRoot) {
          this.projectMemory = new ProjectMemory(workspaceRoot);
        }
        const memoryContent = await this.projectMemory.getRelevantMemories();
        if (memoryContent) {
          promptBuilder.setProjectMemory(memoryContent);
        }
      }

      const contextManager = new ContextManager(workspaceRoot);
      this.lastContextManager = contextManager;
      const permissionManager = new PermissionManager(this.config);
      permissionManager.setWorkspaceRoot(workspaceRoot);

      const modelInfo = getModelInfo(this.config.getModel(), this.config.getProvider());
      const effectiveContextWindow = Math.min(
        this.config.getContextWindowSize(),
        modelInfo?.contextWindow ?? this.config.getContextWindowSize()
      );
      const effectiveMaxTokens = Math.min(
        this.config.getMaxTokens(),
        modelInfo?.maxOutput ?? this.config.getMaxTokens()
      );

      // Per-task budget: pass remaining budget so multi-message tasks
      // can't exceed the configured limit
      const configuredBudget = this.config.getMaxBudgetPerTask();
      const remainingBudget = configuredBudget > 0
        ? Math.max(0, configuredBudget - this.totalCost.estimatedCost)
        : 0;

      if (configuredBudget > 0 && remainingBudget <= 0) {
        this.postMessage({
          type: 'taskError',
          error: `Task budget exhausted ($${this.totalCost.estimatedCost.toFixed(3)} >= $${configuredBudget.toFixed(2)} limit). Start a new task to continue.`,
        });
        this.postMessage({ type: 'stateUpdate', state: 'idle' });
        return;
      }

      const contextFiles = mentions
        .filter((m) => m.type === 'file' || m.type === 'folder')
        .map((m) => m.value);

      const postToolActions = this.config.getAutoLintAfterEdit() ? new PostToolActions() : undefined;

      this.agentLoop = new AgentLoop(
        provider,
        filteredRegistry,
        toolExecutor,
        this.memory,
        promptBuilder,
        contextManager,
        permissionManager,
        this.mode,
        toolsEnabled,
        effectiveMaxTokens,
        remainingBudget,
        effectiveContextWindow,
        modelInfo?.inputCostPer1M ?? 3.0,
        modelInfo?.outputCostPer1M ?? 15.0,
        contextFiles,
        this.shadowCheckpointManager ?? this.checkpointManager ?? undefined,
        this.currentTaskId!,
        postToolActions,
        this.hookManager ?? undefined
      );

      let currentMessageId = '';
      const streamBuffers = new Map<string, string>();
      this.runPromise = new Promise<void>((r) => { resolveRun = r; });

      try { for await (const event of this.agentLoop.run(enrichedText, imageAttachments.length > 0 ? imageAttachments : undefined)) {
        switch (event.type) {
          case 'streamToken':
            if (currentMessageId !== event.messageId) {
              currentMessageId = event.messageId;
              streamBuffers.set(event.messageId, '');
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
            streamBuffers.set(event.messageId, (streamBuffers.get(event.messageId) || '') + event.token);
            this.postMessage({ type: 'streamToken', messageId: event.messageId, token: event.token });
            break;

          case 'streamEnd': {
            this.postMessage({ type: 'streamEnd', messageId: event.messageId });

            if (this.mode === 'plan') {
              const fullResponse = streamBuffers.get(event.messageId) || '';
              const plan = parsePlanFromResponse(fullResponse);
              if (plan) {
                this.currentPlan = plan;
                this.postMessage({ type: 'planUpdate', plan });

                const cleanedContent = fullResponse.replace(/<plan>[\s\S]*?<\/plan>/, '').trim();
                this.postMessage({
                  type: 'updateMessageContent',
                  messageId: event.messageId,
                  content: cleanedContent,
                });

                this.savePlanToFile(plan).catch(() => {});
              }
            }
            break;
          }

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
            this.saveCurrentTask('completed').catch(() => {});
            this.extractProjectMemories();
            break;

          case 'taskError':
            this.postMessage({ type: 'taskError', error: event.error });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            this.saveCurrentTask('error').catch(() => {});
            break;

          case 'costUpdate':
            this.totalCost.inputTokens += event.inputTokens;
            this.totalCost.outputTokens += event.outputTokens;
            this.totalCost.estimatedCost += this.estimateCostDelta(event.inputTokens, event.outputTokens);
            this.postMessage({ type: 'costUpdate', cost: this.totalCost });
            break;

          case 'followUpQuestion':
            this.postMessage({ type: 'followUpSuggestions', question: event.question, suggestions: event.suggestions ?? [] });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;

          case 'checkpointCreated':
            this.postMessage({ type: 'checkpointCreated', checkpoint: event.checkpoint });
            break;

          case 'thinking':
            this.postMessage({
              type: 'addMessage',
              message: {
                id: `thinking_${event.messageId}`,
                role: 'system',
                content: `[THINKING]\n${event.content}`,
                timestamp: Date.now(),
              },
            });
            break;

          case 'planModeResponse':
            this.postMessage({
              type: 'addMessage',
              message: {
                id: `plan_response_${event.messageId}`,
                role: 'assistant',
                content: event.response,
                timestamp: Date.now(),
              },
            });
            this.postMessage({
              type: 'followUpSuggestions',
              question: event.options.length > 0 ? 'Choose an option or type your response:' : undefined,
              suggestions: event.options.length > 0
                ? [...event.options, 'Switch to Act mode']
                : ['Looks good, proceed', 'Make changes', 'Switch to Act mode'],
            });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;

          case 'actModeMessage':
            this.postMessage({
              type: 'addMessage',
              message: {
                id: `act_msg_${event.messageId}_${Date.now()}`,
                role: 'assistant',
                content: event.message,
                timestamp: Date.now(),
              },
            });
            break;

          case 'newTaskSuggestion':
            this.postMessage({
              type: 'addMessage',
              message: {
                id: `new_task_${event.messageId}`,
                role: 'assistant',
                content: `**New Task Suggestion:**\n\n${event.context}`,
                timestamp: Date.now(),
              },
            });
            this.postMessage({
              type: 'followUpSuggestions',
              question: 'The agent suggests starting a new task. What would you like to do?',
              suggestions: ['Start new task with this context', 'Continue current task'],
            });
            this.postMessage({ type: 'stateUpdate', state: 'idle' });
            break;
        }
      }
      } finally { resolveRun?.(); }
    } catch (error: unknown) {
      resolveRun?.();
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[AgentController] Error: ${message}`);
      this.postMessage({ type: 'taskError', error: message });
      this.postMessage({ type: 'stateUpdate', state: 'idle' });
      this.saveCurrentTask('error').catch(() => {});
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
    this.saveCurrentTask('cancelled').catch(() => {});
  }

  async dispose(): Promise<void> {
    this.cancelTask();
    try {
      await Promise.race([
        this.runPromise,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch { /* swallow */ }
  }

  async newTask(): Promise<void> {
    this.cancelTask();
    try { await this.runPromise; } catch { /* swallow */ }
    await this.saveCurrentTask('completed').catch(() => {});
    this.checkpointManager?.pruneOld().catch(() => {});
    this.checkpointManager = null;
    this.shadowCheckpointManager?.pruneOld().catch(() => {});
    this.shadowCheckpointManager = null;
    this.currentTaskId = null;
    this.taskStartTime = null;
    this.memory.clear();
    this.totalCost = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
    this.currentPlan = null;
    this.postMessage({ type: 'clearMessages' });
    this.postMessage({ type: 'planCleared' });
    this.postMessage({ type: 'costUpdate', cost: this.totalCost });
    this.postMessage({ type: 'stateUpdate', state: 'idle' });
  }

  async restoreCheckpoint(id: string): Promise<{ restored: string[]; errors: string[] }> {
    if (id.startsWith('scp_') && this.shadowCheckpointManager) {
      return this.shadowCheckpointManager.restoreCheckpoint(id);
    }
    if (!this.checkpointManager) {
      return { restored: [], errors: ['No checkpoint manager available'] };
    }
    return this.checkpointManager.restoreCheckpoint(id);
  }

  getCheckpointList(): Array<{ id: string; label: string; timestamp: string; toolName: string }> {
    const shadowCheckpoints = this.shadowCheckpointManager
      ?.getCheckpoints(this.currentTaskId ?? undefined)
      .map(c => ({ id: c.id, label: c.label, timestamp: c.timestamp, toolName: c.toolName })) ?? [];

    const jsonCheckpoints = this.checkpointManager
      ?.getCheckpoints(this.currentTaskId ?? undefined)
      .map(c => ({ id: c.id, label: c.label, timestamp: c.timestamp, toolName: c.toolName })) ?? [];

    return [...shadowCheckpoints, ...jsonCheckpoints];
  }

  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  async executePlan(planId: string): Promise<void> {
    if (!this.currentPlan || this.currentPlan.id !== planId) return;

    const plan = this.currentPlan;
    this.setMode('act');
    this.postMessage({ type: 'modeUpdate', mode: 'act' });

    const planContext = planToMarkdown(plan);
    const executionPrompt = `Execute the following plan step by step. After completing each step, state which step you just completed before moving to the next.\n\n${planContext}`;

    this.handleUserMessage(executionPrompt, `Execute Plan: ${plan.title}`).catch(() => {});
  }

  private async savePlanToFile(plan: Plan): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const plansDir = path.join(workspaceRoot, '.mitrahelix', 'plans');
    await fs.mkdir(plansDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeTitle = plan.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50);
    const fileName = `${timestamp}-${safeTitle}.md`;
    const filePath = path.join(plansDir, fileName);

    const markdown = planToMarkdown(plan);
    const header = `<!-- Plan ID: ${plan.id} -->\n<!-- Created: ${new Date(plan.createdAt).toISOString()} -->\n\n`;
    await fs.writeFile(filePath, header + markdown, 'utf-8');

    this.outputChannel.appendLine(`[AgentController] Plan saved to ${filePath}`);
  }

  editPlanStep(planId: string, stepId: string, title: string, description: string): void {
    if (!this.currentPlan || this.currentPlan.id !== planId) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.title = title;
      step.description = description;
      this.postMessage({ type: 'planUpdate', plan: this.currentPlan });
    }
  }

  skipPlanStep(planId: string, stepId: string): void {
    if (!this.currentPlan || this.currentPlan.id !== planId) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'skipped';
      this.postMessage({ type: 'planStepUpdate', planId, stepId, status: 'skipped' });
    }
  }

  async resumeTask(taskId: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    if (!this.taskHistory) {
      this.taskHistory = new TaskHistoryManager(workspaceRoot);
    }

    const entry = await this.taskHistory.loadTask(taskId);
    if (!entry || !entry.messages || entry.messages.length === 0) {
      this.postMessage({ type: 'taskError', error: 'Could not load task history for resume.' });
      return;
    }

    this.cancelTask();
    try { await this.runPromise; } catch { /* swallow */ }

    this.memory.clear();
    this.totalCost = {
      inputTokens: entry.totalInputTokens || 0,
      outputTokens: entry.totalOutputTokens || 0,
      estimatedCost: entry.totalCost || 0,
    };
    this.currentTaskId = entry.id;
    this.taskStartTime = entry.createdAt;
    this.currentPlan = null;

    for (const msg of entry.messages) {
      this.memory.addMessage(msg);
    }

    this.postMessage({ type: 'clearMessages' });
    this.postMessage({ type: 'taskResumed', taskId: entry.id, title: entry.title });
    this.postMessage({ type: 'costUpdate', cost: this.totalCost });

    for (const msg of entry.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        this.postMessage({
          type: 'addMessage',
          message: {
            id: `resume_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: msg.role,
            content: msg.content.slice(0, 5000) + (msg.content.length > 5000 ? '\n\n[...truncated for display]' : ''),
            timestamp: Date.now(),
          },
        });
      }
    }

    this.postMessage({ type: 'stateUpdate', state: 'idle' });
  }

  async getTaskHistory(): Promise<TaskHistorySummary[]> {
    if (!this.taskHistory) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return [];
      this.taskHistory = new TaskHistoryManager(workspaceRoot);
    }
    return this.taskHistory.listTasks();
  }

  async deleteTaskHistory(id: string): Promise<void> {
    if (!this.taskHistory) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return;
      this.taskHistory = new TaskHistoryManager(workspaceRoot);
    }
    await this.taskHistory.deleteTask(id);
  }

  async exportTaskHistory(id: string, format: 'markdown' | 'json'): Promise<string | null> {
    if (!this.taskHistory) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return null;
      this.taskHistory = new TaskHistoryManager(workspaceRoot);
    }
    return this.taskHistory.exportTask(id, format);
  }

  private async saveCurrentTask(status: TaskHistoryEntry['status']): Promise<void> {
    if (!this.taskHistory || !this.currentTaskId) return;
    const messages = this.memory.getMessages();
    if (messages.length === 0) return;
    const title = messages.find(m => m.role === 'user')?.content.slice(0, 100) || 'Untitled task';
    const entry: TaskHistoryEntry = {
      id: this.currentTaskId,
      title,
      createdAt: this.taskStartTime || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: this.config.getProvider(),
      model: this.config.getModel(),
      totalCost: this.totalCost.estimatedCost,
      totalInputTokens: this.totalCost.inputTokens,
      totalOutputTokens: this.totalCost.outputTokens,
      messageCount: messages.length,
      status,
      messages,
      toolCallCount: messages.filter(m => m.role === 'tool').length,
    };
    await this.taskHistory.saveTask(entry);
  }

  get isRunning(): boolean {
    return this.agentLoop?.running ?? false;
  }

  getMode(): string {
    return this.mode;
  }

  getModeManager(): ModeManager | null {
    return this.modeManager;
  }

  setMode(mode: string): void {
    const oldMode = this.mode;
    this.mode = mode;
    this.agentLoop?.setMode(mode);
    if (oldMode !== mode) {
      const modeDef = this.modeManager?.getMode(mode);
      const isPlan = mode === 'plan';
      const toolsRestricted = modeDef?.restrictedTools?.includes('*') ?? false;
      let hint: string;
      if (isPlan) {
        hint = 'Explore the codebase with read-only tools and create a structured plan.';
      } else if (toolsRestricted) {
        hint = 'Discuss and analyze only — do not use tools.';
      } else if (this.currentPlan) {
        hint = `You may now use tools to execute. Follow the plan: "${this.currentPlan.title}".`;
      } else {
        hint = 'You may now use tools to execute.';
      }
      this.memory.addMessage({
        role: 'user',
        content: `[System: Mode switched from ${oldMode.toUpperCase()} to ${mode.toUpperCase()}. ${hint}]`,
      });

      if (isPlan && this.currentPlan) {
        this.postMessage({ type: 'planUpdate', plan: this.currentPlan });
      }
    }
  }

  private collectTerminalOutput(): string {
    if (this.terminalCollector) {
      return this.terminalCollector.collectOutput();
    }
    return this.fallbackTerminalOutput();
  }

  private fallbackTerminalOutput(): string {
    const terminals = vscode.window.terminals;
    if (terminals.length === 0) {
      return '--- Terminal ---\nNo active terminals.';
    }
    const terminalNames = terminals.map((t) => t.name).join(', ');
    return `--- Terminal ---\nActive terminals: ${terminalNames}\n(Terminal content capture requires the Terminal Shell Integration API — terminal names provided for context.)`;
  }

  private collectEditorSelection(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '[No active editor]';
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
      return '[No text selected in the active editor]';
    }
    const selectedText = editor.document.getText(selection);
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    return `--- Selection from ${filePath} (lines ${startLine}-${endLine}) ---\n${selectedText.slice(0, 50000)}`;
  }

  private collectDiagnostics(): string {
    const diags = vscode.languages.getDiagnostics();
    const issues: string[] = [];
    for (const [uri, fileDiags] of diags) {
      const relPath = vscode.workspace.asRelativePath(uri);
      for (const d of fileDiags) {
        if (d.severity <= vscode.DiagnosticSeverity.Warning) {
          const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING';
          issues.push(`${relPath}:${d.range.start.line + 1} [${sev}] ${d.message}`);
        }
      }
    }
    return issues.length > 0 ? issues.slice(0, 50).join('\n') : 'No diagnostics found.';
  }

  private estimateCostDelta(inputTokens: number, outputTokens: number): number {
    const modelId = this.config.getModel();
    const provider = this.config.getProvider();
    const modelInfo = getModelInfo(modelId, provider);

    const inputCostPer1M = modelInfo?.inputCostPer1M ?? 3.0;
    const outputCostPer1M = modelInfo?.outputCostPer1M ?? 15.0;

    return (inputTokens / 1_000_000) * inputCostPer1M + (outputTokens / 1_000_000) * outputCostPer1M;
  }

  private extractProjectMemories(): void {
    if (!this.projectMemory || !this.config.getCrossSessionMemory()) return;
    const messages = this.memory.getMessages();
    this.projectMemory.extractMemoriesFromConversation(messages).catch(() => {});
  }

  private formatMCPInfo(
    tools: Array<{ name: string; description: string; serverName: string }>,
    resources: Array<{ uri: string; name: string; description?: string; serverName: string }>
  ): string {
    const sections: string[] = ['# MCP SERVERS'];

    if (tools.length > 0) {
      sections.push('## Available MCP Tools\nThe following external tools are available via MCP servers. Use use_mcp_tool to call them.\n');
      const byServer = new Map<string, typeof tools>();
      for (const t of tools) {
        const list = byServer.get(t.serverName) || [];
        list.push(t);
        byServer.set(t.serverName, list);
      }
      for (const [server, serverTools] of byServer) {
        sections.push(`### ${server}`);
        for (const t of serverTools) {
          sections.push(`- **${t.name}**: ${t.description}`);
        }
      }
    }

    if (resources.length > 0) {
      sections.push('\n## Available MCP Resources\nUse access_mcp_resource to read these.\n');
      for (const r of resources) {
        sections.push(`- **${r.serverName}** — ${r.uri}: ${r.description || r.name}`);
      }
    }

    return sections.join('\n');
  }
}
