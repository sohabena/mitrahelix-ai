import * as vscode from 'vscode';

interface TerminalExecution {
  terminalName: string;
  commandLine: string;
  cwd: string;
  exitCode: number | undefined;
  output: string;
  timestamp: number;
}

export class TerminalOutputCollector implements vscode.Disposable {
  private recentExecutions: TerminalExecution[] = [];
  private disposables: vscode.Disposable[] = [];
  private static readonly MAX_EXECUTIONS = 20;
  private static readonly MAX_OUTPUT_PER_EXECUTION = 5000;

  constructor() {
    if (vscode.window.onDidEndTerminalShellExecution) {
      this.disposables.push(
        vscode.window.onDidEndTerminalShellExecution(async (e) => {
          let output = '';
          try {
            const stream = (e.execution as any).read();
            for await (const data of stream) {
              output += data;
              if (output.length > TerminalOutputCollector.MAX_OUTPUT_PER_EXECUTION) {
                output = output.slice(0, TerminalOutputCollector.MAX_OUTPUT_PER_EXECUTION) + '\n[truncated]';
                break;
              }
            }
          } catch {
            // Stream may not be available
          }

          this.recentExecutions.push({
            terminalName: e.terminal.name,
            commandLine: (e.execution as any).commandLine?.value || '(unknown)',
            cwd: e.shellIntegration?.cwd?.fsPath || '',
            exitCode: e.exitCode,
            output,
            timestamp: Date.now(),
          });

          while (this.recentExecutions.length > TerminalOutputCollector.MAX_EXECUTIONS) {
            this.recentExecutions.shift();
          }
        })
      );
    }
  }

  collectOutput(maxChars: number = 30_000): string {
    const terminals = vscode.window.terminals;
    if (terminals.length === 0) {
      return '--- Terminal ---\nNo active terminals.';
    }

    if (this.recentExecutions.length === 0) {
      const terminalNames = terminals.map(t => t.name).join(', ');
      return `--- Terminal ---\nActive terminals: ${terminalNames}\n(No recent command executions captured.)`;
    }

    const sections: string[] = [];
    let totalChars = 0;

    const recent = [...this.recentExecutions].reverse();
    for (const exec of recent) {
      if (totalChars >= maxChars) break;

      let section = `--- Terminal: ${exec.terminalName} ---\n`;
      if (exec.cwd) section += `CWD: ${exec.cwd}\n`;
      section += `$ ${exec.commandLine}\n`;
      if (exec.exitCode !== undefined) section += `Exit code: ${exec.exitCode}\n`;
      if (exec.output) section += `${exec.output}\n`;

      const remaining = maxChars - totalChars;
      if (section.length > remaining) {
        section = section.slice(0, remaining) + '\n[truncated]';
      }

      sections.push(section);
      totalChars += section.length;
    }

    return sections.join('\n');
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
