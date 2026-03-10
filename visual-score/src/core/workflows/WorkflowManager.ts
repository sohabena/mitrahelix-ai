import * as vscode from 'vscode';
import * as path from 'path';

export interface WorkflowDefinition {
  name: string;
  description: string;
  fileName: string;
  content: string;
}

export class WorkflowManager {
  readonly workspaceRoot: string;
  private cachedWorkflows: WorkflowDefinition[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL = 10_000;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async getWorkflows(): Promise<WorkflowDefinition[]> {
    const now = Date.now();
    if (this.cachedWorkflows && (now - this.cacheTime) < this.CACHE_TTL) {
      return [...this.cachedWorkflows];
    }

    const workflows: WorkflowDefinition[] = [];
    const workflowDir = path.join(this.workspaceRoot, '.mitrahelix', 'workflows');

    try {
      const dirUri = vscode.Uri.file(workflowDir);
      const entries = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.md')) {
          try {
            const fileUri = vscode.Uri.file(path.join(workflowDir, name));
            const stat = await vscode.workspace.fs.stat(fileUri);
            if (stat.size > 50_000) continue;
            const content = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf-8');
            const parsed = this.parseWorkflow(name, content);
            if (parsed) {
              workflows.push(parsed);
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Directory doesn't exist — that's fine
    }

    this.cachedWorkflows = workflows;
    this.cacheTime = now;
    return [...workflows];
  }

  async getWorkflowByName(name: string): Promise<WorkflowDefinition | undefined> {
    const workflows = await this.getWorkflows();
    return workflows.find((w) => w.name === name);
  }

  invalidateCache(): void {
    this.cachedWorkflows = null;
    this.cacheTime = 0;
  }

  private parseWorkflow(fileName: string, raw: string): WorkflowDefinition | null {
    const name = fileName.replace(/\.md$/, '');
    let description = '';
    let content = raw;

    // Parse YAML frontmatter: ---\ndescription: ...\n---
    const frontmatterMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      content = frontmatterMatch[2].trim();

      const descMatch = frontmatter.match(/description:\s*(.+)/);
      if (descMatch) {
        description = descMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }

    if (!content) return null;

    return { name, description, fileName, content };
  }
}
