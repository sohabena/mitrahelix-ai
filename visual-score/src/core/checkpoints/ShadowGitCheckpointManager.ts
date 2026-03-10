import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CheckpointSummary, ICheckpointManager } from './CheckpointManager.js';
import { isWithinWorkspace } from '../../shared/pathSecurity.js';
import { shouldExcludeFromCheckpoint, MAX_FILE_SIZE_FOR_CHECKPOINT } from './CheckpointExclusions.js';

const execFileAsync = promisify(execFile);

interface ShadowCheckpointEntry extends CheckpointSummary {
  hash: string;
  filePath: string;
  fileExisted: boolean;
}

/**
 * Git-based checkpoint manager that creates a shadow repository to track
 * file states before modifications. Enables reliable undo by storing
 * pre-write snapshots as git commits.
 */
export class ShadowGitCheckpointManager implements ICheckpointManager {
  private shadowDir: string;
  private initialized = false;
  private gitAvailable: boolean | null = null;
  private index: ShadowCheckpointEntry[] = [];

  constructor(private workspaceRoot: string) {
    this.shadowDir = path.join(workspaceRoot, '.mitrahelix', 'checkpoints', 'shadow');
  }

  private async runGit(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.shadowDir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    });
    return stdout;
  }

  private async checkGitAvailable(): Promise<boolean> {
    if (this.gitAvailable !== null) return this.gitAvailable;
    try {
      await execFileAsync('git', ['--version'], { timeout: 5000 });
      this.gitAvailable = true;
    } catch {
      this.gitAvailable = false;
    }
    return this.gitAvailable;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!(await this.checkGitAvailable())) {
      this.initialized = true;
      return;
    }

    await fs.mkdir(this.shadowDir, { recursive: true });

    try {
      await this.runGit('rev-parse', '--git-dir');
    } catch {
      await this.runGit('init');
      await this.runGit('config', 'user.email', 'checkpoint@mitrahelix.local');
      await this.runGit('config', 'user.name', 'MitraHelix');
      await fs.writeFile(
        path.join(this.shadowDir, '.gitignore'),
        'index.json\n',
        'utf-8',
      );
      await this.runGit('add', '.gitignore');
      await this.runGit('commit', '-m', 'init', '--allow-empty');
    }

    try {
      const data = await fs.readFile(path.join(this.shadowDir, 'index.json'), 'utf-8');
      this.index = JSON.parse(data) as ShadowCheckpointEntry[];
    } catch {
      this.index = [];
    }

    this.initialized = true;
  }

  async createCheckpoint(
    taskId: string,
    toolName: string,
    toolParams: Record<string, unknown>,
  ): Promise<string> {
    if (!this.initialized || !this.gitAvailable) return '';

    const filePath = toolParams.path as string | undefined;
    if (!filePath) return '';

    const writeTools = new Set(['write_to_file', 'replace_in_file', 'apply_patch']);
    if (!writeTools.has(toolName)) return '';

    if (shouldExcludeFromCheckpoint(filePath)) return '';

    const absPath = path.resolve(this.workspaceRoot, filePath);
    if (!isWithinWorkspace(absPath, this.workspaceRoot)) return '';

    try {
      const destPath = path.join(this.shadowDir, filePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      let fileExisted = true;
      try {
        const stat = await fs.stat(absPath);
        if (stat.size > MAX_FILE_SIZE_FOR_CHECKPOINT) return '';
        await fs.copyFile(absPath, destPath);
      } catch {
        fileExisted = false;
        await fs.writeFile(destPath, '', 'utf-8');
      }

      await this.runGit('add', '-A');

      const status = (await this.runGit('status', '--porcelain')).trim();
      if (!status) return '';

      const timestamp = new Date().toISOString();
      await this.runGit('commit', '-m', `cp: ${toolName} on ${filePath}`);
      const hash = (await this.runGit('rev-parse', '--short', 'HEAD')).trim();

      const id = `scp_${hash}`;
      const entry: ShadowCheckpointEntry = {
        id,
        taskId,
        label: `${toolName} on ${filePath}`,
        timestamp,
        toolName,
        fileCount: 1,
        hash,
        filePath,
        fileExisted,
      };

      this.index.push(entry);
      await this.saveIndex();
      return id;
    } catch {
      return '';
    }
  }

  async restoreCheckpoint(id: string): Promise<{ restored: string[]; errors: string[] }> {
    if (!this.initialized || !this.gitAvailable) {
      return { restored: [], errors: ['Git checkpoints not available'] };
    }

    const entry = this.index.find(e => e.id === id);
    if (!entry) return { restored: [], errors: [`Checkpoint ${id} not found`] };

    const restored: string[] = [];
    const errors: string[] = [];

    try {
      if (!entry.fileExisted) {
        const wsPath = path.resolve(this.workspaceRoot, entry.filePath);
        try {
          await fs.unlink(wsPath);
          restored.push(`Deleted ${entry.filePath} (was newly created)`);
        } catch {
          errors.push(`Could not delete ${entry.filePath}`);
        }
      } else {
        const content = await this.runGit('show', `${entry.hash}:${entry.filePath}`);
        const wsPath = path.resolve(this.workspaceRoot, entry.filePath);
        if (!isWithinWorkspace(wsPath, this.workspaceRoot)) {
          errors.push(`${entry.filePath}: outside workspace`);
        } else {
          await fs.mkdir(path.dirname(wsPath), { recursive: true });
          await fs.writeFile(wsPath, content, 'utf-8');
          restored.push(`Restored ${entry.filePath}`);
        }
      }
    } catch (e: unknown) {
      errors.push(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { restored, errors };
  }

  getCheckpoints(taskId?: string): CheckpointSummary[] {
    const entries = taskId ? this.index.filter(e => e.taskId === taskId) : this.index;
    return entries.map(({ hash: _h, filePath: _f, fileExisted: _e, ...summary }) => summary);
  }

  getCheckpointCount(taskId?: string): number {
    if (taskId) return this.index.filter(e => e.taskId === taskId).length;
    return this.index.length;
  }

  async getDiff(fromHash: string, toHash: string): Promise<string> {
    if (!this.initialized || !this.gitAvailable) return '';
    try {
      return await this.runGit('diff', fromHash, toHash);
    } catch {
      return '';
    }
  }

  async pruneOld(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    this.index = this.index.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    await this.saveIndex();
  }

  private async saveIndex(): Promise<void> {
    await fs.writeFile(
      path.join(this.shadowDir, 'index.json'),
      JSON.stringify(this.index, null, 2),
      'utf-8',
    );
  }
}
