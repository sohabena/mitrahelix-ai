import type { LLMMessage } from '../llm/types.js';

export class ConversationMemory {
  private messages: LLMMessage[] = [];

  addMessage(message: LLMMessage): void {
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
    let total = 0;
    for (const msg of this.messages) {
      total += Math.ceil(msg.content.length / 4);
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          total += Math.ceil(JSON.stringify(tc.arguments).length / 4);
        }
      }
    }
    return total;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  compress(maxTokens: number): void {
    const estimate = this.getTokenEstimate();
    if (estimate <= maxTokens || this.messages.length <= 4) return;

    // Keep first 2 messages (initial context) and last messages
    let keepFirst = 2;
    // Extend keepFirst to include tool results that follow any assistant+tool_use
    // in the first section (Anthropic requires matching tool_result for every tool_use)
    while (keepFirst < this.messages.length && this.messages[keepFirst].role === 'tool') {
      keepFirst++;
    }
    let keepLast = Math.max(6, Math.floor(this.messages.length * 0.3));

    if (this.messages.length <= keepFirst + keepLast) return;

    // Ensure we don't split assistant+tool message pairs at the boundary.
    // Anthropic requires tool_result to immediately follow its assistant tool_use.
    // Also ensure the first kept message isn't 'user' (which would create consecutive
    // user messages with the compression summary, violating Anthropic's alternating requirement).
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

    // Summarize middle messages
    const summary = middle
      .map((m) => {
        const role = m.role;
        const preview = m.content.slice(0, 100).replace(/\n/g, ' ');
        return `[${role}]: ${preview}...`;
      })
      .join('\n');

    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `[SYSTEM: CONVERSATION SUMMARY - ${middle.length} earlier messages compressed for context window management]\n${summary}`,
    };

    this.messages = [...first, summaryMessage, ...last];
  }
}
