import * as path from 'path';

/**
 * Check if a resolved absolute path is within the workspace root.
 * Prevents path traversal attacks via prefix matching
 * (e.g., workspace "project" must not allow access to "project-secrets").
 */
export function isWithinWorkspace(absolutePath: string, workspaceRoot: string): boolean {
  const normalizedPath = path.resolve(absolutePath);
  const normalizedRoot = path.resolve(workspaceRoot);
  if (normalizedPath === normalizedRoot) return true;
  // Handle roots that already end with separator (e.g., "C:\")
  const rootPrefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  return normalizedPath.startsWith(rootPrefix);
}
