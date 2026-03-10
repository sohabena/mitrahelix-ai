import type { LLMMessage } from '../llm/types.js';
import { countMessageTokens } from './TokenCounter.js';

export class ConversationMemory {
  private static readonly MAX_MESSAGE_CHARS = 100_000;
  private messages: LLMMessage[] = [];

  addMessage(message: LLMMessage): void {
    if (message.content.length > ConversationMemory.MAX_MESSAGE_CHARS) {
      message = {
        ...message,
        content: message.content.slice(0, ConversationMemory.MAX_MESSAGE_CHARS) +
          `\n\n[Content truncated — ${message.content.length.toLocaleString()} chars exceeded ${ConversationMemory.MAX_MESSAGE_CHARS.toLocaleString()} limit]`,
      };
    }
    if (message.imageContent) {
      const imageSize = JSON.stringify(message.imageContent).length;
      if (imageSize > 500_000) {
        message = { ...message, imageContent: undefined };
      }
    }
    this.messages.push(message);
  }

  getMessages(): LLMMessage[] {
    return [...this.messages];
  }

  getLastNMessages(n: number): LLMMessage[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }

  getTokenEstimate(): number {
    return countMessageTokens(this.messages);
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  compress(maxTokens: number): void {
    const safeMax = Math.floor(maxTokens * 0.9);
    const MAX_COMPRESS_PASSES = 3;
    for (let pass = 0; pass < MAX_COMPRESS_PASSES; pass++) {
      const estimate = this.getTokenEstimate();
      if (estimate <= safeMax) return;
      if (this.messages.length <= 4) return;
      this.compressOnce();
    }
    if (this.getTokenEstimate() > maxTokens) {
      this.hardTrim(maxTokens);
    }
  }

  /**
   * Condense the conversation by replacing old messages with a provided summary.
   * Called when the agent invokes the `condense` tool. Keeps the first 2 messages
   * (system context) and the last N recent messages, replacing everything in between.
   */
  condenseWithSummary(summary: string, keepRecentCount: number = 6): void {
    if (this.messages.length <= keepRecentCount + 2) return;

    const first = this.messages.slice(0, 2);
    const recent = this.messages.slice(-keepRecentCount);

    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `[SYSTEM: CONVERSATION CONDENSED]\nThe agent summarized the conversation so far:\n\n${summary}`,
    };

    this.messages = [...first, summaryMessage, ...recent];
  }

  private compressOnce(): void {
    const MAX_KEEP_FIRST = 20;
    const MAX_KEEP_LAST = 30;

    let keepFirst = 2;
    while (keepFirst < this.messages.length && keepFirst < MAX_KEEP_FIRST && this.messages[keepFirst].role === 'tool') {
      keepFirst++;
    }
    let keepLast = Math.min(MAX_KEEP_LAST, Math.max(6, Math.floor(this.messages.length * 0.3)));

    if (this.messages.length <= keepFirst + keepLast) return;

    let splitIdx = this.messages.length - keepLast;
    while (splitIdx > keepFirst && splitIdx < this.messages.length) {
      const msg = this.messages[splitIdx];
      if (msg.role === 'tool' || msg.role === 'user') {
        splitIdx--;
        keepLast = this.messages.length - splitIdx;
      } else {
        break;
      }
    }

    if (this.messages.length <= keepFirst + keepLast) return;

    const first = this.messages.slice(0, keepFirst);
    const middle = this.messages.slice(keepFirst, splitIdx);
    const last = this.messages.slice(splitIdx);

    if (middle.length === 0) return;

    const summary = this.buildSmartSummary(middle);

    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `[SYSTEM: CONVERSATION SUMMARY - ${middle.length} earlier messages compressed]\n${summary}`,
    };

    this.messages = [...first, summaryMessage, ...last];
  }

  private buildSmartSummary(messages: LLMMessage[]): string {
    const sections: string[] = [];
    const filesModified = new Set<string>();
    const toolsUsed: string[] = [];
    const errors: string[] = [];
    const decisions: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const reasoning = msg.content.replace(/\n/g, ' ').trim();
        if (reasoning.length > 0 && !reasoning.startsWith('[')) {
          decisions.push(reasoning.slice(0, 200));
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            const filePath = tc.arguments.path as string;
            if (filePath) filesModified.add(filePath);

            const summary = this.summarizeToolCall(tc.name, tc.arguments);
            toolsUsed.push(summary);
          }
        }
      } else if (msg.role === 'tool') {
        if (msg.isError) {
          errors.push(msg.content.slice(0, 150));
        }
      }
    }

    if (decisions.length > 0) {
      sections.push(`Key reasoning:\n${decisions.slice(0, 5).map(d => `- ${d}`).join('\n')}`);
    }

    if (toolsUsed.length > 0) {
      sections.push(`Actions taken:\n${toolsUsed.map(t => `- ${t}`).join('\n')}`);
    }

    if (filesModified.size > 0) {
      sections.push(`Files involved: ${[...filesModified].join(', ')}`);
    }

    if (errors.length > 0) {
      sections.push(`Errors encountered:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  private summarizeToolCall(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'read_file':
        return `Read ${args.path}`;
      case 'write_to_file':
        return `Wrote ${args.path}`;
      case 'replace_in_file':
        return `Edited ${args.path}`;
      case 'execute_command':
        return `Ran: ${(args.command as string || '').slice(0, 100)}`;
      case 'search_files':
        return `Searched for "${args.regex}" in ${args.path}`;
      case 'list_files':
        return `Listed ${args.path}`;
      case 'list_code_definition_names':
        return `Listed definitions in ${args.path}`;
      default:
        return `${name}(${JSON.stringify(args).slice(0, 80)})`;
    }
  }

  getContextUsageRatio(contextWindowSize: number, systemPromptTokens: number, maxOutputTokens: number): number {
    const messageTokens = this.getTokenEstimate();
    const totalUsed = systemPromptTokens + messageTokens;
    const availableWindow = contextWindowSize - maxOutputTokens;
    if (availableWindow <= 0) return 1;
    return totalUsed / availableWindow;
  }

  shouldAutoCondense(contextWindowSize: number, systemPromptTokens: number, maxOutputTokens: number, threshold: number = 0.85): boolean {
    if (this.messages.length < 10) return false;
    return this.getContextUsageRatio(contextWindowSize, systemPromptTokens, maxOutputTokens) >= threshold;
  }

  autoCondense(): boolean {
    if (this.messages.length < 10) return false;

    const keepFirst = 2;
    const keepLast = 8;

    if (this.messages.length <= keepFirst + keepLast + 1) return false;

    const first = this.messages.slice(0, keepFirst);
    const middle = this.messages.slice(keepFirst, -keepLast);
    const last = this.messages.slice(-keepLast);

    if (middle.length === 0) return false;

    const summary = this.buildSmartSummary(middle);
    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `[SYSTEM: AUTO-CONDENSED — ${middle.length} messages compressed to free up context]\n${summary}`,
    };

    this.messages = [...first, summaryMessage, ...last];
    return true;
  }

  private hardTrim(maxTokens: number): void {
    while (this.messages.length > 4 && this.getTokenEstimate() > maxTokens) {
      let removeIdx = 1;
      if (removeIdx >= this.messages.length) break;
      const msg = this.messages[removeIdx];
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        let endIdx = removeIdx + 1;
        while (endIdx < this.messages.length && this.messages[endIdx].role === 'tool') {
          endIdx++;
        }
        this.messages.splice(removeIdx, endIdx - removeIdx);
      } else if (msg.role === 'tool') {
        let startIdx = removeIdx;
        while (startIdx > 0 && this.messages[startIdx - 1].role === 'assistant') {
          startIdx--;
        }
        let endIdx = removeIdx + 1;
        while (endIdx < this.messages.length && this.messages[endIdx].role === 'tool') {
          endIdx++;
        }
        this.messages.splice(startIdx, endIdx - startIdx);
      } else {
        this.messages.splice(removeIdx, 1);
      }
    }
  }
}
