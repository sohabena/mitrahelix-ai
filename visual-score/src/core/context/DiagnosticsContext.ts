import * as vscode from 'vscode';

export class DiagnosticsContext {
  async gather(): Promise<string> {
    const diagnostics = vscode.languages.getDiagnostics();
    const issues: string[] = [];

    for (const [uri, fileDiagnostics] of diagnostics) {
      const relativePath = vscode.workspace.asRelativePath(uri);
      for (const diag of fileDiagnostics) {
        if (diag.severity === vscode.DiagnosticSeverity.Error || diag.severity === vscode.DiagnosticSeverity.Warning) {
          const severity = diag.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING';
          const line = diag.range.start.line + 1;
          issues.push(`${relativePath}:${line} [${severity}] ${diag.message}`);
        }
      }
    }

    if (issues.length === 0) {
      return '';
    }

    const maxIssues = 50;
    const truncated = issues.length > maxIssues;
    const output = issues.slice(0, maxIssues).join('\n');

    return truncated
      ? `${output}\n\n[${issues.length} total issues, showing first ${maxIssues}]`
      : output;
  }
}
