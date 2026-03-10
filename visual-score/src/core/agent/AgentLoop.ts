import type { LLMProvider } from '../llm/LLMProvider.js';
import type { ContentPart, LLMToolCall } from '../llm/types.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolExecutor } from '../tools/ToolExecutor.js';
import type { ToolCallInfo, ToolResult } from '../../shared/ToolTypes.js';
import type { ConversationMemory } from '../memory/ConversationMemory.js';
import type { SystemPromptBuilder } from '../prompts/SystemPromptBuilder.js';
import type { ContextManager } from '../context/ContextManager.js';
import type { PermissionManager } from '../permissions/PermissionManager.js';
import type { ICheckpointManager } from '../checkpoints/CheckpointManager.js';
import type { PostToolActions } from '../tools/PostToolActions.js';
import type { HookManager } from '../hooks/HookManager.js';
import type { HookContext } from '../hooks/types.js';
import { XMLToolParser } from './XMLToolParser.js';
import { ToolDependencyAnalyzer } from './ToolDependencyAnalyzer.js';
import { MAX_ITERATIONS } from '../../shared/constants.js';
import { countTokens, ensureReady as ensureTokenCounterReady } from '../memory/TokenCounter.js';

export type AgentEvent =
  | { type: 'streamToken'; token: string; messageId: string }
  | { type: 'streamEnd'; messageId: string }
  | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
  | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
  | { type: 'requestApproval'; toolCall: ToolCallInfo }
  | { type: 'taskCompleted'; summary: string }
  | { type: 'taskError'; error: string }
  | { type: 'costUpdate'; inputTokens: number; outputTokens: number }
  | { type: 'followUpQuestion'; question: string; suggestions: string[]; messageId: string }
  | { type: 'checkpointCreated'; checkpoint: { id: string; label: string; timestamp: string } }
  | { type: 'thinking'; content: string; messageId: string }
  | { type: 'planModeResponse'; response: string; options: string[]; messageId: string }
  | { type: 'actModeMessage'; message: string; messageId: string }
  | { type: 'newTaskSuggestion'; context: string; messageId: string };

export class AgentLoop {
  private abortController: AbortController | null = null;
  private xmlParser = new XMLToolParser();
  private dependencyAnalyzer = new ToolDependencyAnalyzer();
  private isRunning = false;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private lastUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
  private accumulatedCost: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
  private lastToolName: string | null = null;

  constructor(
    private provider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private toolExecutor: ToolExecutor,
    private memory: ConversationMemory,
    private promptBuilder: SystemPromptBuilder,
    private contextManager: ContextManager,
    private permissionManager: PermissionManager,
    private mode: string = 'act',
    private toolsEnabled: boolean = true,
    private maxTokens: number = 16384,
    private maxBudget: number = 1.0,
    private contextWindowSize: number = 80000,
    private inputCostPer1M: number = 3.0,
    private outputCostPer1M: number = 15.0,
    private contextFiles: string[] = [],
    private checkpointManager?: ICheckpointManager,
    private taskId: string = `task_${Date.now()}`,
    private postToolActions?: PostToolActions,
    private hookManager?: HookManager
  ) {}

  private async safeRunHooks(hookPoint: Parameters<HookManager['executeHooks']>[0], context: HookContext): Promise<void> {
    if (!this.hookManager) return;
    try {
      await this.hookManager.executeHooks(hookPoint, context);
    } catch {
      // hooks must never block the agent loop
    }
  }

  private buildHookContext(overrides?: Partial<HookContext>): HookContext {
    return {
      taskId: this.taskId,
      workspaceRoot: this.contextManager.getWorkspaceRoot(),
      ...overrides,
    };
  }

  resolveApproval(toolCallId: string, approved: boolean): void {
    const resolve = this.pendingApprovals.get(toolCallId);
    if (resolve) {
      resolve(approved);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  get running(): boolean {
    return this.isRunning;
  }

  setMode(mode: string): void {
    this.mode = mode;
  }

  private *emitCostUpdate(): Generator<AgentEvent> {
    const usage = this.provider.getUsage();
    const deltaInput = usage.inputTokens - this.lastUsage.inputTokens;
    const deltaOutput = usage.outputTokens - this.lastUsage.outputTokens;
    this.lastUsage = { ...usage };
    this.accumulatedCost.inputTokens += deltaInput;
    this.accumulatedCost.outputTokens += deltaOutput;
    if (deltaInput > 0 || deltaOutput > 0) {
      yield { type: 'costUpdate', inputTokens: deltaInput, outputTokens: deltaOutput };
    }
  }

  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'rate limit', '429',
      '500', '502', '503', '529',
      'overloaded', 'capacity',
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED',
      'socket hang up', 'network',
      'timeout', 'fetch failed',
    ];
    const lower = errorMessage.toLowerCase();
    return retryablePatterns.some(p => lower.includes(p));
  }

  cancel(): void {
    this.abortController?.abort();
    this.isRunning = false;
    // Resolve all pending approvals with false to unblock awaiting promises
    for (const [id, resolve] of this.pendingApprovals) {
      resolve(false);
    }
    this.pendingApprovals.clear();
  }

  private coerceXMLParams(params: Record<string, string>): Record<string, unknown> {
    const textParams = new Set(['content', 'diff', 'command', 'path', 'question', 'result', 'regex', 'file_pattern', 'suggestions', 'line_range', 'url', 'patch', 'summary', 'filename', 'server_name', 'tool_name', 'arguments', 'uri', 'response', 'options', 'context', 'action', 'coordinate', 'text', 'needs_more_exploration']);
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(params)) {
      if (textParams.has(key)) {
        result[key] = val;
      } else if (val === 'true') {
        result[key] = true;
      } else if (val === 'false') {
        result[key] = false;
      } else if (/^\d+$/.test(val) && val.length < 10) {
        result[key] = parseInt(val, 10);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  async *run(userMessage: string, imageContent?: ContentPart[]): AsyncGenerator<AgentEvent> {
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      await ensureTokenCounterReady();

      const registeredToolNames = this.toolRegistry.getAll().map(t => t.name);
      if (registeredToolNames.length > 0) {
        this.xmlParser.setToolNames(registeredToolNames);
      }

      await this.safeRunHooks('onSessionStart', this.buildHookContext());

      this.memory.addMessage({ role: 'user', content: userMessage, imageContent });

      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        if (this.abortController.signal.aborted) {
          yield { type: 'taskError', error: 'Task cancelled by user.' };
          return;
        }

        iteration++;
        const context = await this.contextManager.gatherContext(this.contextFiles);
        const systemPrompt = this.promptBuilder.build(context, this.mode, this.provider.supportsNativeToolUse, this.toolsEnabled);
        const systemPromptTokens = countTokens(systemPrompt);
        const toolDefsTokens = (this.toolsEnabled && this.provider.supportsNativeToolUse)
          ? countTokens(JSON.stringify(this.toolRegistry.getNativeToolDefinitions()))
          : 0;
        const reservedForOutput = this.maxTokens;
        const availableForMessages = Math.max(1000, this.contextWindowSize - systemPromptTokens - toolDefsTokens - reservedForOutput);

        if (iteration > 1 && this.memory.shouldAutoCondense(this.contextWindowSize, systemPromptTokens + toolDefsTokens, reservedForOutput)) {
          const didCondense = this.memory.autoCondense();
          if (didCondense) {
            yield { type: 'streamToken', token: '\n\n[Context auto-condensed to free up space]\n\n', messageId: `autocondense_${Date.now()}` };
          }
        }

        this.memory.compress(availableForMessages);

        const messages = this.memory.getMessages();

        const messageId = `msg_${Date.now()}_${iteration}`;
        let fullResponse = '';
        const nativeToolCalls: LLMToolCall[] = [];

        const MAX_RETRIES = 3;
        const RETRY_BASE_DELAY = 2000;
        let lastError = '';
        let streamSucceeded = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (this.abortController.signal.aborted) break;

          if (attempt > 0) {
            const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
            yield { type: 'streamToken', token: `\n\n[Retrying in ${delay / 1000}s... attempt ${attempt}/${MAX_RETRIES} after: ${lastError}]\n\n`, messageId };
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, delay);
              const checkAbort = () => { clearTimeout(timer); resolve(); };
              if (this.abortController!.signal.aborted) { clearTimeout(timer); resolve(); return; }
              this.abortController!.signal.addEventListener('abort', checkAbort, { once: true });
            });
            if (this.abortController.signal.aborted) break;
            fullResponse = '';
            nativeToolCalls.length = 0;
          }

          try {
            const tools = this.toolsEnabled ? this.toolRegistry.getNativeToolDefinitions() : undefined;
            let errorFromStream = '';

            for await (const chunk of this.provider.stream(
              systemPrompt,
              messages,
              this.provider.supportsNativeToolUse ? tools : undefined,
              { maxTokens: this.maxTokens, signal: this.abortController.signal }
            )) {
              if (this.abortController.signal.aborted) {
                yield { type: 'streamEnd', messageId };
                yield* this.emitCostUpdate();
                yield { type: 'taskError', error: 'Task cancelled by user.' };
                return;
              }

              if (chunk.type === 'text') {
                fullResponse += chunk.text;
                yield { type: 'streamToken', token: chunk.text, messageId };
              } else if (chunk.type === 'tool_use') {
                nativeToolCalls.push(chunk.toolCall);
              } else if (chunk.type === 'error') {
                errorFromStream = chunk.error;
                break;
              }
            }

            if (errorFromStream) {
              if (this.isRetryableError(errorFromStream) && attempt < MAX_RETRIES) {
                lastError = errorFromStream;
                continue;
              }
              yield { type: 'streamEnd', messageId };
              yield* this.emitCostUpdate();
              await this.safeRunHooks('onError', this.buildHookContext({ error: errorFromStream }));
              yield { type: 'taskError', error: errorFromStream };
              return;
            }

            streamSucceeded = true;
            break;
          } catch (error: unknown) {
            if (this.abortController?.signal.aborted) {
              yield { type: 'streamEnd', messageId };
              yield* this.emitCostUpdate();
              yield { type: 'taskError', error: 'Task cancelled by user.' };
              return;
            }
            const msg = error instanceof Error ? error.message : String(error);
            if (this.isRetryableError(msg) && attempt < MAX_RETRIES) {
              lastError = msg;
              continue;
            }
            yield { type: 'streamEnd', messageId };
            yield* this.emitCostUpdate();
            await this.safeRunHooks('onError', this.buildHookContext({ error: msg }));
            yield { type: 'taskError', error: `LLM error: ${msg}` };
            return;
          }
        }

        if (!streamSucceeded && !this.abortController.signal.aborted) {
          yield { type: 'streamEnd', messageId };
          yield* this.emitCostUpdate();
          await this.safeRunHooks('onError', this.buildHookContext({ error: lastError }));
          yield { type: 'taskError', error: `Failed after ${MAX_RETRIES} retries: ${lastError}` };
          return;
        }

        if (this.abortController.signal.aborted) {
          yield { type: 'streamEnd', messageId };
          yield* this.emitCostUpdate();
          yield { type: 'taskError', error: 'Task cancelled by user.' };
          return;
        }

        yield { type: 'streamEnd', messageId };

        // Extract thinking blocks from response
        const thinkingMatch = fullResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
          yield { type: 'thinking', content: thinkingMatch[1].trim(), messageId };
          fullResponse = fullResponse.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
        }

        yield* this.emitCostUpdate();

        // Budget enforcement — uses per-model pricing from catalog
        const estimatedCost =
          (this.accumulatedCost.inputTokens / 1_000_000) * this.inputCostPer1M +
          (this.accumulatedCost.outputTokens / 1_000_000) * this.outputCostPer1M;
        if (this.maxBudget > 0 && estimatedCost > this.maxBudget) {
          yield { type: 'taskError', error: `Task budget exceeded ($${estimatedCost.toFixed(3)} > $${this.maxBudget.toFixed(2)} limit). Task stopped.` };
          return;
        }

        // Determine tool calls — native or XML parsed
        let toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

        if (!this.toolsEnabled) {
          toolCalls = [];
        } else if (nativeToolCalls.length > 0) {
          toolCalls = nativeToolCalls;
        } else if (!this.provider.supportsNativeToolUse && fullResponse) {
          const parsed = this.xmlParser.parse(fullResponse);
          toolCalls = parsed.map((tc, i) => ({
            id: `xml_${Date.now()}_${i}`,
            name: tc.name,
            arguments: this.coerceXMLParams(tc.parameters),
          }));
        }

        // Save assistant message
        this.memory.addMessage({
          role: 'assistant',
          content: fullResponse,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        // If no tool calls, the agent is done speaking
        if (toolCalls.length === 0) {
          yield { type: 'taskCompleted', summary: 'Agent finished responding.' };
          return;
        }

        const batches = this.dependencyAnalyzer.analyzeBatches(toolCalls);
        let taskCompleted = false;
        let followUpAsked = false;

        const remainingToolIds = new Set(toolCalls.map(tc => tc.id));

        const cancelRemaining = () => {
          for (const id of remainingToolIds) {
            this.memory.addMessage({
              role: 'tool',
              content: 'Tool call cancelled by user.',
              toolCallId: id,
            });
          }
        };

        const cancelRemainingAfterTerminal = (currentId: string) => {
          for (const id of remainingToolIds) {
            if (id !== currentId) {
              this.memory.addMessage({
                role: 'tool',
                content: 'Tool call skipped — task completed.',
                toolCallId: id,
              });
            }
          }
        };

        for (const batch of batches) {
          if (this.abortController.signal.aborted) {
            cancelRemaining();
            return;
          }

          if (taskCompleted || followUpAsked) break;

          if (batch.length === 1) {
            const tc = batch[0];
            remainingToolIds.delete(tc.id);

            const toolCallInfo: ToolCallInfo = {
              id: tc.id,
              name: tc.name,
              parameters: tc.arguments,
              status: 'pending',
            };

            yield { type: 'toolCallStarted', toolCall: toolCallInfo };

            const needsApproval = this.permissionManager.needsApproval(tc.name, tc.arguments);

            if (needsApproval) {
              const TIMEOUT_SENTINEL = 'timeout' as const;
              const approvalPromise = new Promise<boolean | typeof TIMEOUT_SENTINEL>((resolve) => {
                this.pendingApprovals.set(tc.id, resolve as (v: boolean) => void);
              });

              let timeoutId: ReturnType<typeof setTimeout>;
              const timeoutPromise = new Promise<boolean | typeof TIMEOUT_SENTINEL>((resolve) => {
                timeoutId = setTimeout(() => resolve(TIMEOUT_SENTINEL), 5 * 60 * 1000);
              });

              yield { type: 'requestApproval', toolCall: toolCallInfo };

              const approved = await Promise.race([approvalPromise, timeoutPromise]);
              clearTimeout(timeoutId!);
              this.pendingApprovals.delete(tc.id);

              if (approved !== true) {
                const timedOut = approved === TIMEOUT_SENTINEL;
                const errorMsg = timedOut
                  ? 'Tool call timed out — no user response within 5 minutes.'
                  : 'User rejected this tool call.';
                const result: ToolResult = {
                  success: false,
                  output: '',
                  error: errorMsg,
                };
                this.memory.addMessage({ role: 'tool', content: errorMsg, toolCallId: tc.id, isError: true });
                yield { type: 'toolCallCompleted', toolCallId: tc.id, result };
                continue;
              }
            }

            const writeTools = new Set(['write_to_file', 'replace_in_file', 'apply_patch']);
            if (this.checkpointManager && writeTools.has(tc.name)) {
              const cpId = await this.checkpointManager.createCheckpoint(this.taskId, tc.name, tc.arguments);
              const cpList = this.checkpointManager.getCheckpoints(this.taskId);
              const cp = cpList.find(c => c.id === cpId);
              if (cp) {
                yield { type: 'checkpointCreated', checkpoint: { id: cp.id, label: cp.label, timestamp: cp.timestamp } };
              }
            }

            const hookCtx = this.buildHookContext({
              toolName: tc.name,
              filePath: tc.arguments.path as string | undefined,
              command: tc.arguments.command as string | undefined,
            });
            await this.safeRunHooks('preToolUse', hookCtx);
            if (tc.name === 'write_to_file' || tc.name === 'replace_in_file') {
              await this.safeRunHooks('preFileWrite', hookCtx);
            }
            if (tc.name === 'execute_command') {
              await this.safeRunHooks('preCommandExecute', hookCtx);
            }

            const result = await this.toolExecutor.executeTool(tc.name, tc.arguments, this.abortController.signal);
            this.memory.addMessage({
              role: 'tool',
              content: result.success ? result.output : `Error: ${result.error}`,
              toolCallId: tc.id,
              isError: !result.success,
            });

            yield { type: 'toolCallCompleted', toolCallId: tc.id, result };

            const postHookCtx = this.buildHookContext({
              toolName: tc.name,
              filePath: tc.arguments.path as string | undefined,
              command: tc.arguments.command as string | undefined,
              exitCode: result.success ? 0 : 1,
            });
            await this.safeRunHooks('postToolUse', postHookCtx);
            if (tc.name === 'write_to_file' || tc.name === 'replace_in_file') {
              await this.safeRunHooks('postFileWrite', postHookCtx);
            }
            if (tc.name === 'execute_command') {
              await this.safeRunHooks('postCommandExecute', postHookCtx);
            }

            if (!result.success) {
              await this.safeRunHooks('onError', this.buildHookContext({
                toolName: tc.name,
                error: result.error,
              }));
            }

            if (this.postToolActions && result.success && (tc.name === 'write_to_file' || tc.name === 'replace_in_file')) {
              const filePath = tc.arguments.path as string;
              if (filePath) {
                const lintResult = await this.postToolActions.checkDiagnosticsAfterEdit(
                  this.contextManager.getWorkspaceRoot(),
                  filePath,
                );
                if (lintResult) {
                  const feedback = this.postToolActions.formatLintFeedback(lintResult);
                  this.memory.addMessage({ role: 'user', content: `[SYSTEM] ${feedback}` });
                }
              }
            }

            if (tc.name === 'condense' && result.success && result.output.startsWith('[CONDENSE]')) {
              const summary = result.output.replace('[CONDENSE]\n', '');
              this.memory.condenseWithSummary(summary);
              this.lastToolName = tc.name;
              continue;
            }

            // act_mode_respond: non-blocking progress message, prevent consecutive calls
            if (tc.name === 'act_mode_respond' && result.success) {
              if (this.lastToolName === 'act_mode_respond') {
                const blockedResult: ToolResult = {
                  success: true,
                  output: '[BLOCKED] You cannot call act_mode_respond consecutively. Your next action MUST be a different tool that performs actual work: read_file, replace_in_file, write_to_file, execute_command, etc. Stop explaining and start doing.',
                };
                this.memory.addMessage({ role: 'tool', content: blockedResult.output, toolCallId: tc.id });
                yield { type: 'toolCallCompleted', toolCallId: tc.id, result: blockedResult };
                this.lastToolName = tc.name;
                continue;
              }
              const actMessage = result.output.replace('[ACT_MODE_MESSAGE]\n', '');
              yield { type: 'actModeMessage', message: actMessage, messageId };
              this.lastToolName = tc.name;
              continue;
            }

            // plan_mode_respond: pause and wait for user input (like follow-up question)
            if (tc.name === 'plan_mode_respond' && result.success) {
              if (result.output.startsWith('[PLAN_CONTINUE]')) {
                this.lastToolName = tc.name;
                continue;
              }
              cancelRemainingAfterTerminal(tc.id);
              followUpAsked = true;
              const planContent = result.output.replace('[PLAN_MODE_RESPONSE]\n', '');
              const optionsMatch = planContent.match(/\n\[OPTIONS\]\n(.+)$/);
              const options = optionsMatch
                ? optionsMatch[1].split('|').map((s: string) => s.trim()).filter(Boolean)
                : [];
              const planResponse = optionsMatch
                ? planContent.replace(/\n\[OPTIONS\]\n.+$/, '')
                : planContent;
              yield { type: 'planModeResponse', response: planResponse, options, messageId };
              this.lastToolName = tc.name;
              break;
            }

            // new_task: pause and wait for user to approve or give feedback
            if (tc.name === 'new_task' && result.success && result.output.startsWith('[NEW_TASK_SUGGESTION]')) {
              cancelRemainingAfterTerminal(tc.id);
              followUpAsked = true;
              const taskContext = result.output.replace('[NEW_TASK_SUGGESTION]\n', '');
              yield { type: 'newTaskSuggestion', context: taskContext, messageId };
              this.lastToolName = tc.name;
              break;
            }

            if (tc.name === 'attempt_completion' || tc.name === 'ask_followup_question') {
              cancelRemainingAfterTerminal(tc.id);

              if (tc.name === 'attempt_completion') {
                taskCompleted = true;
                yield { type: 'taskCompleted', summary: result.output };
              } else {
                followUpAsked = true;
                const suggestionsMatch = result.output.match(/\[SUGGESTIONS\]\n(.+)/);
                const suggestions = suggestionsMatch
                  ? suggestionsMatch[1].split('|').map((s: string) => s.trim()).filter(Boolean)
                  : [];
                yield {
                  type: 'followUpQuestion',
                  question: tc.arguments.question as string || result.output.replace(/\n\[SUGGESTIONS\][\s\S]*$/, '').replace('[FOLLOWUP_QUESTION]\n', ''),
                  suggestions,
                  messageId,
                };
              }
              this.lastToolName = tc.name;
              break;
            }

            this.lastToolName = tc.name;
          } else {
            for (const tc of batch) {
              yield {
                type: 'toolCallStarted',
                toolCall: { id: tc.id, name: tc.name, parameters: tc.arguments, status: 'pending' as const },
              };
            }

            const needsApprovalMap = new Map<string, boolean>();
            for (const tc of batch) {
              needsApprovalMap.set(tc.id, this.permissionManager.needsApproval(tc.name, tc.arguments));
            }

            const toolsNeedingApproval = batch.filter(tc => needsApprovalMap.get(tc.id));
            const autoApproved = batch.filter(tc => !needsApprovalMap.get(tc.id));

            const TIMEOUT_SENTINEL = 'timeout' as const;
            type ApprovalEntry = {
              tc: typeof batch[0];
              promise: Promise<boolean | typeof TIMEOUT_SENTINEL>;
              timeoutId: ReturnType<typeof setTimeout>;
            };

            const approvalEntries: ApprovalEntry[] = [];
            for (const tc of toolsNeedingApproval) {
              const approvalPromise = new Promise<boolean | typeof TIMEOUT_SENTINEL>((resolve) => {
                this.pendingApprovals.set(tc.id, resolve as (v: boolean) => void);
              });

              let timeoutId!: ReturnType<typeof setTimeout>;
              const timeoutPromise = new Promise<boolean | typeof TIMEOUT_SENTINEL>((resolve) => {
                timeoutId = setTimeout(() => resolve(TIMEOUT_SENTINEL), 5 * 60 * 1000);
              });

              yield {
                type: 'requestApproval',
                toolCall: { id: tc.id, name: tc.name, parameters: tc.arguments, status: 'pending' as const },
              };

              approvalEntries.push({
                tc,
                promise: Promise.race([approvalPromise, timeoutPromise]),
                timeoutId,
              });
            }

            const approvalOutcomes = await Promise.all(
              approvalEntries.map(async (entry) => {
                const approved = await entry.promise;
                clearTimeout(entry.timeoutId);
                this.pendingApprovals.delete(entry.tc.id);
                return { tc: entry.tc, approved };
              })
            );

            const rejectedCalls: Array<{ tc: typeof batch[0]; result: ToolResult }> = [];
            const approvedFromApproval: typeof batch = [];

            for (const outcome of approvalOutcomes) {
              if (outcome.approved !== true) {
                const timedOut = outcome.approved === TIMEOUT_SENTINEL;
                const errorMsg = timedOut
                  ? 'Tool call timed out — no user response within 5 minutes.'
                  : 'User rejected this tool call.';
                const result: ToolResult = { success: false, output: '', error: errorMsg };
                this.memory.addMessage({ role: 'tool', content: errorMsg, toolCallId: outcome.tc.id, isError: true });
                rejectedCalls.push({ tc: outcome.tc, result });
              } else {
                approvedFromApproval.push(outcome.tc);
              }
            }

            for (const { tc, result } of rejectedCalls) {
              yield { type: 'toolCallCompleted', toolCallId: tc.id, result };
            }

            const toExecute = [...autoApproved, ...approvedFromApproval];

            if (this.checkpointManager) {
              const batchWriteTools = new Set(['write_to_file', 'replace_in_file', 'apply_patch']);
              for (const tc of toExecute) {
                if (batchWriteTools.has(tc.name)) {
                  const cpId = await this.checkpointManager.createCheckpoint(this.taskId, tc.name, tc.arguments);
                  const cpList = this.checkpointManager.getCheckpoints(this.taskId);
                  const cp = cpList.find(c => c.id === cpId);
                  if (cp) {
                    yield { type: 'checkpointCreated', checkpoint: { id: cp.id, label: cp.label, timestamp: cp.timestamp } };
                  }
                }
              }
            }

            for (const tc of toExecute) {
              const preCtx = this.buildHookContext({
                toolName: tc.name,
                filePath: tc.arguments.path as string | undefined,
                command: tc.arguments.command as string | undefined,
              });
              await this.safeRunHooks('preToolUse', preCtx);
              if (tc.name === 'write_to_file' || tc.name === 'replace_in_file') {
                await this.safeRunHooks('preFileWrite', preCtx);
              }
              if (tc.name === 'execute_command') {
                await this.safeRunHooks('preCommandExecute', preCtx);
              }
            }

            const settled = await Promise.allSettled(
              toExecute.map(async (tc) => {
                const result = await this.toolExecutor.executeTool(tc.name, tc.arguments, this.abortController!.signal);
                return { tc, result };
              })
            );
            const results = settled.map((s, i) =>
              s.status === 'fulfilled'
                ? s.value
                : { tc: toExecute[i], result: { success: false, output: '', error: `Tool threw: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}` } }
            );

            for (const { tc, result } of results) {
              this.memory.addMessage({
                role: 'tool',
                content: result.success ? result.output : `Error: ${result.error}`,
                toolCallId: tc.id,
                isError: !result.success,
              });
            }

            for (const tc of batch) {
              remainingToolIds.delete(tc.id);
            }

            for (const { tc, result } of results) {
              yield { type: 'toolCallCompleted', toolCallId: tc.id, result };

              const postCtx = this.buildHookContext({
                toolName: tc.name,
                filePath: tc.arguments.path as string | undefined,
                command: tc.arguments.command as string | undefined,
                exitCode: result.success ? 0 : 1,
              });
              await this.safeRunHooks('postToolUse', postCtx);
              if (tc.name === 'write_to_file' || tc.name === 'replace_in_file') {
                await this.safeRunHooks('postFileWrite', postCtx);
              }
              if (tc.name === 'execute_command') {
                await this.safeRunHooks('postCommandExecute', postCtx);
              }
              if (!result.success) {
                await this.safeRunHooks('onError', this.buildHookContext({
                  toolName: tc.name,
                  error: result.error,
                }));
              }

              if (this.postToolActions && result.success && (tc.name === 'write_to_file' || tc.name === 'replace_in_file')) {
                const filePath = tc.arguments.path as string;
                if (filePath) {
                  const lintResult = await this.postToolActions.checkDiagnosticsAfterEdit(
                    this.contextManager.getWorkspaceRoot(),
                    filePath,
                  );
                  if (lintResult) {
                    const feedback = this.postToolActions.formatLintFeedback(lintResult);
                    this.memory.addMessage({ role: 'user', content: `[SYSTEM] ${feedback}` });
                  }
                }
              }
            }
          }
        }

        if (taskCompleted || followUpAsked) return;

        // Continue the loop — agent will see tool results and respond
      }

      yield { type: 'taskError', error: `Reached maximum iterations (${MAX_ITERATIONS}). Task may be incomplete.` };
    } finally {
      await this.safeRunHooks('onSessionEnd', this.buildHookContext());
      this.isRunning = false;
    }
  }
}
