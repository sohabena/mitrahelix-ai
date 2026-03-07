import * as path from 'path';
import { spawn } from 'child_process';
import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { MAX_COMMAND_OUTPUT, DEFAULT_COMMAND_TIMEOUT } from '../../../shared/constants.js';

export class ExecuteCommandTool implements Tool {
  readonly name = 'execute_command';
  readonly description = 'Execute a CLI command in the workspace directory. The command will run in the system shell. Use this for running build commands, tests, installing packages, git operations, etc.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The CLI command to execute',
        required: true,
      },
    },
    required: ['command'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = params.command as string;

    if (!command) {
      return { success: false, output: '', error: 'Missing required parameter: command' };
    }

    return new Promise<ToolResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/sh';
      const shellArgs = isWindows ? ['-Command', command] : ['-c', command];

      const child = spawn(shell, shellArgs, {
        cwd: context.workspaceRoot,
        env: { ...process.env, PAGER: 'cat' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, DEFAULT_COMMAND_TIMEOUT);

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > MAX_COMMAND_OUTPUT) {
          stdout = stdout.slice(0, MAX_COMMAND_OUTPUT) + '\n[OUTPUT TRUNCATED]';
          child.kill('SIGTERM');
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > MAX_COMMAND_OUTPUT) {
          stderr = stderr.slice(0, MAX_COMMAND_OUTPUT) + '\n[OUTPUT TRUNCATED]';
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (timedOut) {
          resolve({
            success: false,
            output: stdout,
            error: `Command timed out after ${DEFAULT_COMMAND_TIMEOUT / 1000} seconds.`,
          });
          return;
        }

        const output = [
          stdout ? `STDOUT:\n${stdout}` : '',
          stderr ? `STDERR:\n${stderr}` : '',
          `Exit code: ${code}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? `Command exited with code ${code}` : undefined,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          output: '',
          error: `Failed to execute command: ${err.message}`,
        });
      });
    });
  }
}
