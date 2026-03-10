import * as path from 'path';
import * as fs from 'fs/promises';
import type { LLMMessage } from '../llm/types.js';

export interface MemoryEntry {
  id: string;
  content: string;
  category: 'project_fact' | 'preference' | 'tool_learning' | 'code_pattern';
  source: 'auto' | 'user';
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
}

export class ProjectMemory {
  private memoryFile: string;
  private memories: MemoryEntry[] = [];
  private loaded = false;
  private saveLock: Promise<void> = Promise.resolve();

  constructor(private workspaceRoot: string) {
    this.memoryFile = path.join(workspaceRoot, '.mitrahelix', 'memory.json');
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      await fs.mkdir(path.dirname(this.memoryFile), { recursive: true });
      const data = await fs.readFile(this.memoryFile, 'utf-8');
      this.memories = JSON.parse(data);
    } catch {
      this.memories = [];
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    this.saveLock = this.saveLock.then(async () => {
      await fs.mkdir(path.dirname(this.memoryFile), { recursive: true });
      await fs.writeFile(this.memoryFile, JSON.stringify(this.memories, null, 2), 'utf-8');
    }).catch(() => {});
    await this.saveLock;
  }

  async addMemory(content: string, category: MemoryEntry['category'], source: MemoryEntry['source'] = 'auto'): Promise<void> {
    await this.ensureLoaded();

    const existing = this.memories.find(m =>
      m.content.toLowerCase() === content.toLowerCase() ||
      (m.content.length > 20 && content.includes(m.content)) ||
      (content.length > 20 && m.content.includes(content))
    );

    if (existing) {
      existing.lastUsedAt = new Date().toISOString();
      existing.useCount++;
      if (content.length > existing.content.length) {
        existing.content = content;
      }
      await this.save();
      return;
    }

    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      category,
      source,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      useCount: 1,
    };

    this.memories.push(entry);

    if (this.memories.length > 100) {
      this.memories.sort((a, b) => {
        const aScore = a.useCount * 2 + (Date.now() - new Date(a.lastUsedAt).getTime() < 7 * 86400000 ? 5 : 0);
        const bScore = b.useCount * 2 + (Date.now() - new Date(b.lastUsedAt).getTime() < 7 * 86400000 ? 5 : 0);
        return bScore - aScore;
      });
      this.memories = this.memories.slice(0, 100);
    }

    await this.save();
  }

  async getRelevantMemories(maxTokens: number = 500): Promise<string> {
    await this.ensureLoaded();
    if (this.memories.length === 0) return '';

    const sorted = [...this.memories].sort((a, b) => {
      const recencyA = Date.now() - new Date(a.lastUsedAt).getTime();
      const recencyB = Date.now() - new Date(b.lastUsedAt).getTime();
      const scoreA = a.useCount * 3 - recencyA / 86400000;
      const scoreB = b.useCount * 3 - recencyB / 86400000;
      return scoreB - scoreA;
    });

    const lines: string[] = [];
    let charBudget = maxTokens * 3;

    for (const mem of sorted) {
      const line = `- [${mem.category}] ${mem.content}`;
      if (charBudget - line.length < 0) break;
      lines.push(line);
      charBudget -= line.length;
    }

    return lines.join('\n');
  }

  async getAllMemories(): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    return [...this.memories];
  }

  async deleteMemory(id: string): Promise<void> {
    await this.ensureLoaded();
    this.memories = this.memories.filter(m => m.id !== id);
    await this.save();
  }

  async extractMemoriesFromConversation(messages: LLMMessage[]): Promise<void> {
    const facts: Array<{ content: string; category: MemoryEntry['category'] }> = [];

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.name === 'execute_command') {
            const cmd = tc.arguments.command as string;
            if (cmd && (cmd.includes('npm') || cmd.includes('pip') || cmd.includes('cargo') || cmd.includes('make'))) {
              facts.push({ content: `Build/run command: ${cmd.slice(0, 150)}`, category: 'tool_learning' });
            }
          }
        }
      }
    }

    const firstUser = messages.find(m => m.role === 'user');
    if (firstUser && firstUser.content.length > 50) {
      const techPatterns = [
        /uses?\s+(React|Vue|Angular|Svelte|Next\.js|Nuxt|Express|FastAPI|Django|Flask|Spring|Rails)/gi,
        /database\s+is\s+(\w+)/gi,
        /using\s+(TypeScript|JavaScript|Python|Go|Rust|Java|C#|Ruby|PHP)/gi,
        /(PostgreSQL|MySQL|MongoDB|Redis|SQLite|DynamoDB)/gi,
      ];

      for (const pattern of techPatterns) {
        const matches = firstUser.content.matchAll(pattern);
        for (const match of matches) {
          facts.push({ content: `Project uses ${match[1] || match[0]}`, category: 'project_fact' });
        }
      }
    }

    for (const fact of facts) {
      await this.addMemory(fact.content, fact.category, 'auto');
    }
  }
}
