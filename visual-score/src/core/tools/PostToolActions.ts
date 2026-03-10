import * as vscode from 'vscode';
import * as path from 'path';

export interface LintResult {
  filePath: string;
  errors: DiagnosticInfo[];
  warnings: DiagnosticInfo[];
}

interface DiagnosticInfo {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  source?: string;
  code?: string | number;
}

export class PostToolActions {

  async checkDiagnosticsAfterEdit(
    workspaceRoot: string,
    filePath: string,
    _delayMs: number = 1500
  ): Promise<LintResult | null> {
    const absolutePath = path.resolve(workspaceRoot, filePath);
    const uri = vscode.Uri.file(absolutePath);

    const intervals = [500, 1000, 1500];
    let lastCount = -1;

    for (const delay of intervals) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const current = vscode.languages.getDiagnostics(uri);
      const currentCount = current.length;

      if (currentCount === lastCount) {
        break;
      }
      lastCount = currentCount;
    }

    const diagnostics = vscode.languages.getDiagnostics(uri);

    if (diagnostics.length === 0) return null;

    const errors: DiagnosticInfo[] = [];
    const warnings: DiagnosticInfo[] = [];

    for (const d of diagnostics) {
      const info: DiagnosticInfo = {
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
        message: d.message,
        source: d.source,
        code: typeof d.code === 'object' ? String(d.code.value) : d.code !== undefined ? String(d.code) : undefined,
      };

      if (d.severity === vscode.DiagnosticSeverity.Error) {
        errors.push(info);
      } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
        warnings.push(info);
      }
    }

    if (errors.length === 0 && warnings.length === 0) return null;

    return { filePath, errors, warnings };
  }

  formatLintFeedback(result: LintResult): string {
    const lines: string[] = [];

    if (result.errors.length > 0) {
      lines.push(`[LINTER] ${result.errors.length} error(s) detected in ${result.filePath} after your edit:`);
      for (const e of result.errors.slice(0, 15)) {
        const src = e.source ? ` (${e.source})` : '';
        const code = e.code ? ` [${e.code}]` : '';
        lines.push(`  Line ${e.line}:${e.column} ERROR${code}${src}: ${e.message}`);
      }
      if (result.errors.length > 15) {
        lines.push(`  ... and ${result.errors.length - 15} more errors`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push(`[LINTER] ${result.warnings.length} warning(s) in ${result.filePath}:`);
      for (const w of result.warnings.slice(0, 10)) {
        const src = w.source ? ` (${w.source})` : '';
        lines.push(`  Line ${w.line}:${w.column} WARNING${src}: ${w.message}`);
      }
    }

    lines.push('');
    lines.push('Please review and fix these issues.');

    return lines.join('\n');
  }
}
