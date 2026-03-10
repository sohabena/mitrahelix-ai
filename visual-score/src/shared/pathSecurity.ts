import * as path from 'path';
import * as fs from 'fs';

/**
 * Check if a resolved absolute path is within the workspace root.
 * Resolves symlinks to prevent traversal, and uses case-insensitive
 * comparison on Windows where the filesystem is case-insensitive.
 */
export function isWithinWorkspace(absolutePath: string, workspaceRoot: string): boolean {
  let normalizedPath = path.resolve(absolutePath);
  let normalizedRoot = path.resolve(workspaceRoot);

  try {
    normalizedPath = fs.realpathSync(normalizedPath);
  } catch {
    // File/directory may not exist yet (write_to_file creating new paths);
    // walk up the directory tree until we find an existing ancestor
    let current = normalizedPath;
    let resolved = false;
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) break; // reached filesystem root
      try {
        const realParent = fs.realpathSync(parent);
        const relative = path.relative(parent, normalizedPath);
        normalizedPath = path.join(realParent, relative);
        resolved = true;
        break;
      } catch {
        current = parent;
      }
    }
    if (!resolved) return false;
  }

  try {
    normalizedRoot = fs.realpathSync(normalizedRoot);
  } catch {
    return false;
  }

  // Case-insensitive comparison on Windows
  if (process.platform === 'win32') {
    normalizedPath = normalizedPath.toLowerCase();
    normalizedRoot = normalizedRoot.toLowerCase();
  }

  if (normalizedPath === normalizedRoot) return true;
  const rootPrefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  return normalizedPath.startsWith(rootPrefix);
}
