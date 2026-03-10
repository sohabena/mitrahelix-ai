import * as path from 'path';
import * as fs from 'fs/promises';
import { isWithinWorkspace } from '../../shared/pathSecurity.js';

export interface CheckpointSummary {
  id: string;
  taskId: string;
  label: string;
  timestamp: string;
  toolName: string;
  fileCount: number;
}

export interface ICheckpointManager {
  initialize(): Promise<void>;
  createCheckpoint(taskId: string, toolName: string, toolParams: Record<string, unknown>): Promise<string>;
  restoreCheckpoint(id: string): Promise<{ restored: string[]; errors: string[] }>;
  getCheckpoints(taskId?: string): CheckpointSummary[];
  getCheckpointCount(taskId?: string): number;
  pruneOld(maxAge?: number): Promise<void>;
}

export interface Checkpoint {
  id: string;
  taskId: string;
  label: string;
  timestamp: string;
  files: CheckpointFile[];
  toolName: string;
  toolParams: Record<string, unknown>;
}

interface CheckpointFile {
  relativePath: string;
  content: string | null;
}

export class CheckpointManager implements ICheckpointManager {
  private checkpointDir: string;
  private index: CheckpointSummary[] = [];

  constructor(private workspaceRoot: string) {
    this.checkpointDir = path.join(workspaceRoot, '.mitrahelix', 'checkpoints');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });
    try {
      const indexPath = path.join(this.checkpointDir, 'index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      this.index = JSON.parse(data) as CheckpointSummary[];
    } catch {
      this.index = [];
    }
  }

  private sanitizeId(id: string): string | null {
    if (!/^[\w-]+$/.test(id)) return null;
    return id;
  }

  async createCheckpoint(taskId: string, toolName: string, toolParams: Record<string, unknown>): Promise<string> {
    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const files: CheckpointFile[] = [];

    const filePath = toolParams.path as string | undefined;

    if (filePath && (toolName === 'write_to_file' || toolName === 'replace_in_file')) {
      const absPath = path.resolve(this.workspaceRoot, filePath);
      if (!isWithinWorkspace(absPath, this.workspaceRoot)) {
        return '';
      }
      try {
        const content = await fs.readFile(absPath, 'utf-8');
        files.push({ relativePath: filePath, content });
      } catch {
        files.push({ relativePath: filePath, content: null });
      }
    }

    const checkpoint: Checkpoint = {
      id,
      taskId,
      label: `${toolName}${filePath ? ` on ${filePath}` : ''}`,
      timestamp: new Date().toISOString(),
      files,
      toolName,
      toolParams: { path: toolParams.path, command: toolParams.command },
    };

    const cpPath = path.join(this.checkpointDir, `${id}.json`);
    await fs.writeFile(cpPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    this.index.push({
      id: checkpoint.id,
      taskId: checkpoint.taskId,
      label: checkpoint.label,
      timestamp: checkpoint.timestamp,
      toolName: checkpoint.toolName,
      fileCount: checkpoint.files.length,
    });

    await this.saveIndex();

    return id;
  }

  async restoreCheckpoint(id: string): Promise<{ restored: string[]; errors: string[] }> {
    const safeId = this.sanitizeId(id);
    if (!safeId) return { restored: [], errors: ['Invalid checkpoint ID'] };

    const cpPath = path.join(this.checkpointDir, `${safeId}.json`);
    let checkpoint: Checkpoint;
    try {
      const data = await fs.readFile(cpPath, 'utf-8');
      checkpoint = JSON.parse(data);
    } catch {
      return { restored: [], errors: [`Checkpoint ${safeId} not found`] };
    }

    const restored: string[] = [];
    const errors: string[] = [];

    for (const file of checkpoint.files) {
      const absPath = path.resolve(this.workspaceRoot, file.relativePath);
      if (!isWithinWorkspace(absPath, this.workspaceRoot)) {
        errors.push(`Skipped ${file.relativePath}: outside workspace`);
        continue;
      }
      try {
        if (file.content === null) {
          await fs.unlink(absPath).catch(() => {});
          restored.push(`Deleted ${file.relativePath} (was newly created)`);
        } else {
          await fs.writeFile(absPath, file.content, 'utf-8');
          restored.push(`Restored ${file.relativePath}`);
        }
      } catch (e: unknown) {
        errors.push(`Failed to restore ${file.relativePath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { restored, errors };
  }

  getCheckpoints(taskId?: string): CheckpointSummary[] {
    if (taskId) return this.index.filter(c => c.taskId === taskId);
    return [...this.index];
  }

  getCheckpointCount(taskId?: string): number {
    if (taskId) return this.index.filter(c => c.taskId === taskId).length;
    return this.index.length;
  }

  async pruneOld(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const toRemove = this.index.filter(c => new Date(c.timestamp).getTime() < cutoff);

    for (const cp of toRemove) {
      const safeId = this.sanitizeId(cp.id);
      if (!safeId) continue;
      try {
        await fs.unlink(path.join(this.checkpointDir, `${safeId}.json`));
      } catch { /* ignore */ }
    }

    this.index = this.index.filter(c => new Date(c.timestamp).getTime() >= cutoff);
    await this.saveIndex();
  }

  private async saveIndex(): Promise<void> {
    const indexPath = path.join(this.checkpointDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }
}
