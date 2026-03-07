import * as path from 'path';
import * as fs from 'fs/promises';

export class WorkspaceIndexer {
  private cachedTree: string = '';
  private lastCacheTime: number = 0;
  private readonly cacheTTL = 30000; // 30 seconds

  constructor(private workspaceRoot: string) {}

  async getFileTree(): Promise<string> {
    const now = Date.now();
    if (this.cachedTree && now - this.lastCacheTime < this.cacheTTL) {
      return this.cachedTree;
    }

    const lines: string[] = [];
    await this.buildTree(this.workspaceRoot, '', 2, lines, 0);
    this.cachedTree = lines.join('\n');
    this.lastCacheTime = now;
    return this.cachedTree;
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    maxDepth: number,
    lines: string[],
    depth: number
  ): Promise<void> {
    if (depth >= maxDepth || lines.length > 300) return;

    const skipDirs = new Set([
      'node_modules', '.git', 'dist', 'out', '__pycache__',
      '.next', 'venv', '.venv', '.cache', 'coverage',
      '.nyc_output', '.turbo', '.vercel',
    ]);

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    const dirs = entries.filter((e) => e.isDirectory() && !skipDirs.has(e.name) && !e.name.startsWith('.'));
    const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.'));

    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    for (const dir of dirs) {
      lines.push(`${prefix}${dir.name}/`);
      await this.buildTree(path.join(dirPath, dir.name), prefix + '  ', maxDepth, lines, depth + 1);
    }

    for (const file of files) {
      lines.push(`${prefix}${file.name}`);
    }
  }

  invalidateCache(): void {
    this.cachedTree = '';
    this.lastCacheTime = 0;
  }
}
