import * as path from 'path';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';
import type { HookPoint, HookDefinition, HookConfig, HookContext, HookResult } from './types.js';

export class HookManager {
  private config: HookConfig | null = null;
  private loaded = false;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async loadHooks(): Promise<void> {
    if (this.loaded) return;

    const configPath = path.join(this.workspaceRoot, '.mitrahelix', 'hooks.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(data);
    } catch {
      this.config = null;
    }
    this.loaded = true;
  }

  async executeHooks(hookPoint: HookPoint, context: HookContext): Promise<HookResult[]> {
    await this.loadHooks();
    if (!this.config?.hooks?.[hookPoint]) return [];

    const hooks = this.config.hooks[hookPoint]!.filter(h => h.enabled);
    const results: HookResult[] = [];

    for (const hook of hooks) {
      if (hook.filePatterns && context.filePath) {
        const matches = hook.filePatterns.some(pattern => {
          let regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');
          return new RegExp(`^${regexStr}$`).test(context.filePath!);
        });
        if (!matches) continue;
      }

      if (hook.condition) {
        if (!this.evaluateCondition(hook.condition, context)) continue;
      }

      let cmd = hook.command;
      cmd = cmd.replace(/\$\{filePath\}/g, this.shellEscape(context.filePath || ''));
      cmd = cmd.replace(/\$\{command\}/g, this.shellEscape(context.command || ''));
      cmd = cmd.replace(/\$\{exitCode\}/g, this.shellEscape(String(context.exitCode ?? '')));
      cmd = cmd.replace(/\$\{taskId\}/g, this.shellEscape(context.taskId || ''));
      cmd = cmd.replace(/\$\{totalCost\}/g, this.shellEscape(String(context.totalCost ?? '')));
      cmd = cmd.replace(/\$\{toolName\}/g, this.shellEscape(context.toolName || ''));
      cmd = cmd.replace(/\$\{error\}/g, this.shellEscape(context.error || ''));

      const start = Date.now();
      try {
        const output = await this.runCommand(cmd, hook.timeout || 10000);
        results.push({
          hookName: hook.name,
          success: true,
          output: output.slice(0, 5000),
          duration: Date.now() - start,
        });
      } catch (e: unknown) {
        results.push({
          hookName: hook.name,
          success: false,
          output: e instanceof Error ? e.message : String(e),
          duration: Date.now() - start,
        });
      }
    }

    return results;
  }

  private runCommand(command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      const proc = child_process.spawn(shell, shellArgs, {
        cwd: this.workspaceRoot,
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 10000) {
          proc.kill();
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 10000) {
          stderr = stderr.slice(0, 10000);
        }
      });

      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Hook command exited with code ${code}: ${stderr || stdout}`));
        }
      });
    });
  }

  private shellEscape(value: string): string {
    if (process.platform === 'win32') {
      const escaped = value
        .replace(/"/g, '""')
        .replace(/%/g, '%%')
        .replace(/\^/g, '^^')
        .replace(/!/g, '^!')
        .replace(/&/g, '^&')
        .replace(/</g, '^<')
        .replace(/>/g, '^>')
        .replace(/\|/g, '^|');
      return '"' + escaped + '"';
    }
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }

  private evaluateCondition(condition: string, context: HookContext): boolean {
    const trimmed = condition.trim();

    const comparisonMatch = trimmed.match(/^(\w+)\s*(===|!==|==|!=|>|<|>=|<=)\s*(.+)$/);
    if (!comparisonMatch) return false;

    const [, varName, operator, rawValue] = comparisonMatch;

    const variables: Record<string, unknown> = {
      exitCode: context.exitCode,
      toolName: context.toolName,
      filePath: context.filePath,
    };

    const left = variables[varName];
    if (left === undefined) return false;

    let right: unknown = rawValue.trim();
    if ((right as string).startsWith("'") && (right as string).endsWith("'")) {
      right = (right as string).slice(1, -1);
    } else if ((right as string).startsWith('"') && (right as string).endsWith('"')) {
      right = (right as string).slice(1, -1);
    } else if (right === 'true') {
      right = true;
    } else if (right === 'false') {
      right = false;
    } else if (right === 'null') {
      right = null;
    } else if (right === 'undefined') {
      right = undefined;
    } else if (!isNaN(Number(right))) {
      right = Number(right);
    }

    switch (operator) {
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '>': return (left as number) > (right as number);
      case '<': return (left as number) < (right as number);
      case '>=': return (left as number) >= (right as number);
      case '<=': return (left as number) <= (right as number);
      default: return false;
    }
  }

  invalidateCache(): void {
    this.loaded = false;
    this.config = null;
  }

  hasHooks(): boolean {
    return this.config !== null && Object.keys(this.config.hooks || {}).length > 0;
  }
}
