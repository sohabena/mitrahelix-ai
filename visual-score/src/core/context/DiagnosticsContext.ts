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
          const sourceParts: string[] = [];
          if (diag.source) sourceParts.push(diag.source);
          if (diag.code !== undefined) {
            const code = typeof diag.code === 'object' ? diag.code.value : diag.code;
            sourceParts.push(String(code));
          }
          const sourceTag = sourceParts.length > 0 ? ` (${sourceParts.join(' ')})` : '';
          issues.push(`${relativePath}:${line} [${severity}]${sourceTag} ${diag.message}`);
        }
      }
    }

    if (issues.length === 0) {
      return '';
    }

    issues.sort((a, b) => {
      const aIsError = a.includes('[ERROR]') ? 0 : 1;
      const bIsError = b.includes('[ERROR]') ? 0 : 1;
      return aIsError - bIsError;
    });

    const maxIssues = 50;
    const truncated = issues.length > maxIssues;
    const output = issues.slice(0, maxIssues).join('\n');

    return truncated
      ? `${output}\n\n[${issues.length} total issues, showing first ${maxIssues}]`
      : output;
  }
}
