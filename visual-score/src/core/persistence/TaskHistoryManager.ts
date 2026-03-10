import * as path from 'path';
import * as fs from 'fs/promises';
import type { LLMMessage } from '../llm/types.js';

export interface TaskHistoryEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  status: 'completed' | 'cancelled' | 'error' | 'in_progress';
  messages: LLMMessage[];
  toolCallCount: number;
}

export interface TaskHistorySummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  totalCost: number;
  messageCount: number;
  status: string;
}

export class TaskHistoryManager {
  private historyDir: string;
  private indexCache: TaskHistorySummary[] | null = null;

  constructor(private workspaceRoot: string) {
    this.historyDir = path.join(workspaceRoot, '.mitrahelix', 'history');
  }

  private sanitizeId(id: string): string | null {
    if (!/^[\w-]+$/.test(id)) return null;
    return id;
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.historyDir, { recursive: true });
  }

  async saveTask(entry: TaskHistoryEntry): Promise<void> {
    const safeId = this.sanitizeId(entry.id);
    if (!safeId) return;
    await this.ensureDir();
    const filePath = path.join(this.historyDir, `${safeId}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    this.indexCache = null;
  }

  async loadTask(id: string): Promise<TaskHistoryEntry | null> {
    const safeId = this.sanitizeId(id);
    if (!safeId) return null;
    try {
      const filePath = path.join(this.historyDir, `${safeId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.messages)) {
        return null;
      }
      return parsed as TaskHistoryEntry;
    } catch {
      return null;
    }
  }

  async listTasks(limit = 50): Promise<TaskHistorySummary[]> {
    if (this.indexCache) return this.indexCache.slice(0, limit);

    await this.ensureDir();
    let fileNames: string[];
    try {
      fileNames = await fs.readdir(this.historyDir);
    } catch {
      return [];
    }

    const summaries: TaskHistorySummary[] = [];

    for (const fileName of fileNames) {
      if (!fileName.endsWith('.json')) continue;
      try {
        const filePath = path.join(this.historyDir, fileName);
        const data = await fs.readFile(filePath, 'utf-8');
        const entry = JSON.parse(data);
        if (!entry || typeof entry.id !== 'string') continue;
        summaries.push({
          id: entry.id,
          title: entry.title || 'Untitled',
          createdAt: entry.createdAt || '',
          updatedAt: entry.updatedAt || '',
          provider: entry.provider || '?',
          model: entry.model || '?',
          totalCost: entry.totalCost ?? 0,
          messageCount: entry.messageCount ?? 0,
          status: entry.status || 'unknown',
        });
      } catch {
        /* skip corrupt files */
      }
    }

    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.indexCache = summaries;
    return summaries.slice(0, limit);
  }

  async deleteTask(id: string): Promise<void> {
    const safeId = this.sanitizeId(id);
    if (!safeId) return;
    try {
      const filePath = path.join(this.historyDir, `${safeId}.json`);
      await fs.unlink(filePath);
      this.indexCache = null;
    } catch { /* ignore if not found */ }
  }

  async pruneHistory(maxEntries = 100): Promise<void> {
    const all = await this.listTasks(99999);
    if (all.length <= maxEntries) return;
    const toDelete = all.slice(maxEntries);
    for (const entry of toDelete) {
      await this.deleteTask(entry.id);
    }
  }

  async exportTask(id: string, format: 'markdown' | 'json'): Promise<string | null> {
    const safeId = this.sanitizeId(id);
    if (!safeId) return null;
    const entry = await this.loadTask(safeId);
    if (!entry) return null;
    if (format === 'json') return JSON.stringify(entry, null, 2);

    let md = `# ${entry.title || 'Untitled'}\n\n`;
    md += `**Model:** ${entry.provider || '?'}/${entry.model || '?'} | **Cost:** $${(entry.totalCost ?? 0).toFixed(4)} | **Status:** ${entry.status || '?'}\n`;
    md += `**Date:** ${entry.createdAt || '?'}\n\n---\n\n`;
    for (const msg of entry.messages) {
      if (!msg || typeof msg.role !== 'string') continue;
      const role = msg.role.toUpperCase();
      md += `### ${role}\n\n${msg.content || ''}\n\n`;
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          md += `> **Tool:** ${tc.name}(${JSON.stringify(tc.arguments).slice(0, 200)})\n\n`;
        }
      }
    }
    return md;
  }

  invalidateCache(): void {
    this.indexCache = null;
  }
}
