import type { LLMProvider } from '../llm/LLMProvider.js';
import type { LLMMessage, LLMToolCall } from '../llm/types.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolExecutor } from '../tools/ToolExecutor.js';
import type { ToolCallInfo, ToolResult } from '../../shared/ToolTypes.js';
import type { ConversationMemory } from '../memory/ConversationMemory.js';
import type { SystemPromptBuilder } from '../prompts/SystemPromptBuilder.js';
import type { ContextManager } from '../context/ContextManager.js';
import type { PermissionManager } from '../permissions/PermissionManager.js';
import { XMLToolParser } from './XMLToolParser.js';
import { MAX_ITERATIONS } from '../../shared/constants.js';

export type AgentEvent =
  | { type: 'streamToken'; token: string; messageId: string }
  | { type: 'streamEnd'; messageId: string }
  | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
  | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
  | { type: 'requestApproval'; toolCall: ToolCallInfo; resolve: (approved: boolean) => void }
  | { type: 'taskCompleted'; summary: string }
  | { type: 'taskError'; error: string }
  | { type: 'costUpdate'; inputTokens: number; outputTokens: number }
  | { type: 'followUpQuestion'; question: string; messageId: string };

export class AgentLoop {
  private abortController: AbortController | null = null;
  private xmlParser = new XMLToolParser();
  private isRunning = false;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private lastUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
  private accumulatedCost: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };

  constructor(
    private provider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private toolExecutor: ToolExecutor,
    private memory: ConversationMemory,
    private promptBuilder: SystemPromptBuilder,
    private contextManager: ContextManager,
    private permissionManager: PermissionManager,
    private mode: 'act' | 'plan' = 'act',
    private maxTokens: number = 8192,
    private maxBudget: number = 1.0,
    private contextWindowSize: number = 80000,
    private inputCostPer1M: number = 3.0,
    private outputCostPer1M: number = 15.0
  ) {}

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

  setMode(mode: 'act' | 'plan'): void {
    this.mode = mode;
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
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(params)) {
      if (val === 'true') result[key] = true;
      else if (val === 'false') result[key] = false;
      else if (/^\d+$/.test(val)) result[key] = parseInt(val, 10);
      else if (/^\d+\.\d+$/.test(val)) result[key] = parseFloat(val);
      else result[key] = val;
    }
    return result;
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      this.memory.addMessage({ role: 'user', content: userMessage });

      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        if (this.abortController.signal.aborted) {
          yield { type: 'taskError', error: 'Task cancelled by user.' };
          return;
        }

        iteration++;
        const context = await this.contextManager.gatherContext();
        const systemPrompt = this.promptBuilder.build(context, this.mode, this.provider.supportsNativeToolUse);
        // Compress if needed (before getMessages so current call uses compressed history)
        this.memory.compress(this.contextWindowSize);

        const messages = this.memory.getMessages();

        const messageId = `msg_${Date.now()}_${iteration}`;
        let fullResponse = '';
        const nativeToolCalls: LLMToolCall[] = [];

        // Stream from LLM
        try {
          const tools = this.mode === 'act' ? this.toolRegistry.getNativeToolDefinitions() : undefined;

          for await (const chunk of this.provider.stream(
            systemPrompt,
            messages,
            this.provider.supportsNativeToolUse ? tools : undefined,
            { maxTokens: this.maxTokens }
          )) {
            if (this.abortController.signal.aborted) {
              yield { type: 'streamEnd', messageId };
              yield { type: 'taskError', error: 'Task cancelled by user.' };
              return;
            }

            if (chunk.type === 'text') {
              fullResponse += chunk.text;
              yield { type: 'streamToken', token: chunk.text, messageId };
            } else if (chunk.type === 'tool_use') {
              nativeToolCalls.push(chunk.toolCall);
            } else if (chunk.type === 'error') {
              yield { type: 'streamEnd', messageId };
              yield { type: 'taskError', error: chunk.error };
              return;
            }
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          yield { type: 'streamEnd', messageId };
          yield { type: 'taskError', error: `LLM error: ${msg}` };
          return;
        }

        yield { type: 'streamEnd', messageId };

        // Update cost — yield deltas, not cumulative values
        const usage = this.provider.getUsage();
        const deltaInput = usage.inputTokens - this.lastUsage.inputTokens;
        const deltaOutput = usage.outputTokens - this.lastUsage.outputTokens;
        this.lastUsage = { ...usage };
        this.accumulatedCost.inputTokens += deltaInput;
        this.accumulatedCost.outputTokens += deltaOutput;
        yield { type: 'costUpdate', inputTokens: deltaInput, outputTokens: deltaOutput };

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

        if (nativeToolCalls.length > 0) {
          toolCalls = nativeToolCalls;
        } else if (this.mode === 'act' && fullResponse) {
          // Try XML parsing for non-native tool use models
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

        // Execute tool calls
        let taskCompleted = false;
        let followUpAsked = false;

        for (let tcIdx = 0; tcIdx < toolCalls.length; tcIdx++) {
          const tc = toolCalls[tcIdx];
          if (this.abortController.signal.aborted) {
            // Add cancellation results for all remaining tools to satisfy
            // Anthropic's requirement that every tool_use has a matching tool_result
            for (let j = tcIdx; j < toolCalls.length; j++) {
              this.memory.addMessage({
                role: 'tool',
                content: 'Tool call cancelled by user.',
                toolCallId: toolCalls[j].id,
              });
            }
            return;
          }

          const toolCallInfo: ToolCallInfo = {
            id: tc.id,
            name: tc.name,
            parameters: tc.arguments,
            status: 'pending',
          };

          yield { type: 'toolCallStarted', toolCall: toolCallInfo };

          // Check permissions
          const needsApproval = this.permissionManager.needsApproval(tc.name, tc.arguments);

          if (needsApproval) {
            // Create a promise and store the resolver
            const approvalPromise = new Promise<boolean>((resolve) => {
              this.pendingApprovals.set(tc.id, resolve);
            });

            // Yield the approval request — the controller will call resolveApproval()
            yield { type: 'requestApproval', toolCall: toolCallInfo, resolve: (v: boolean) => this.resolveApproval(tc.id, v) };

            // Wait for the user's decision
            const approved = await approvalPromise;

            if (!approved) {
              const result: ToolResult = {
                success: false,
                output: '',
                error: 'User rejected this tool call.',
              };
              this.memory.addMessage({ role: 'tool', content: `Tool call rejected by user.`, toolCallId: tc.id });
              yield { type: 'toolCallCompleted', toolCallId: tc.id, result };
              continue;
            }
          }

          // Execute the tool
          const result = await this.toolExecutor.executeTool(tc.name, tc.arguments);
          this.memory.addMessage({
            role: 'tool',
            content: result.success ? result.output : `Error: ${result.error}`,
            toolCallId: tc.id,
          });

          yield { type: 'toolCallCompleted', toolCallId: tc.id, result };

          // Check for special tools
          if (tc.name === 'attempt_completion') {
            taskCompleted = true;
            yield { type: 'taskCompleted', summary: result.output };
          }

          if (tc.name === 'ask_followup_question') {
            followUpAsked = true;
            yield { type: 'followUpQuestion', question: tc.arguments.question as string || result.output, messageId };
          }
        }

        if (taskCompleted || followUpAsked) return;

        // Continue the loop — agent will see tool results and respond
      }

      yield { type: 'taskError', error: `Reached maximum iterations (${MAX_ITERATIONS}). Task may be incomplete.` };
    } finally {
      this.isRunning = false;
    }
  }
}
