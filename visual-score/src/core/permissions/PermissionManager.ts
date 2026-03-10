import * as path from 'path';
import type { ConfigManager } from '../config/ConfigManager.js';
import type { AutoApproveSettings } from '../../shared/MessageTypes.js';

const SAFE_COMMANDS = new Set([
  'ls', 'dir', 'cat', 'head', 'tail', 'echo', 'pwd', 'whoami', 'date',
  'wc', 'grep', 'rg', 'find', 'which', 'type', 'where', 'file',
  'git', 'npm', 'npx', 'yarn', 'pnpm', 'node', 'python', 'python3',
  'pip', 'pip3', 'cargo', 'go', 'java', 'javac', 'dotnet', 'ruby',
  'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'pytest', 'mocha',
  'curl', 'wget', 'env', 'printenv', 'uname', 'hostname',
]);

const DANGEROUS_PATTERNS = /[;&|`$\n\r><(){}]/;

function isSafeCommand(rawCommand: string): boolean {
  if (DANGEROUS_PATTERNS.test(rawCommand)) return false;
  const baseCommand = rawCommand.trim().split(/\s+/)[0];
  if (!baseCommand) return false;
  const normalized = path.basename(baseCommand).replace(/\.exe$/i, '');
  return SAFE_COMMANDS.has(normalized);
}

function isExternalPath(filePath: string | undefined, workspaceRoot: string): boolean {
  if (!filePath || !workspaceRoot) return false;
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
  const normalizedResolved = path.normalize(resolved).toLowerCase();
  const normalizedWorkspace = path.normalize(workspaceRoot).toLowerCase();
  return !normalizedResolved.startsWith(normalizedWorkspace);
}

export class PermissionManager {
  private granularOverride: AutoApproveSettings | null = null;
  private workspaceRoot: string = '';

  constructor(private config: ConfigManager) {}

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
  }

  setAutoApproveOverride(settings: AutoApproveSettings): void {
    this.granularOverride = settings;
  }

  clearOverride(): void {
    this.granularOverride = null;
  }

  private get isYoloMode(): boolean {
    return this.granularOverride?.yoloMode ?? false;
  }

  needsApproval(toolName: string, params: Record<string, unknown>): boolean {
    const alwaysAutoApprove = new Set([
      'ask_followup_question', 'attempt_completion', 'condense',
      'plan_mode_respond', 'act_mode_respond', 'new_task',
    ]);
    if (alwaysAutoApprove.has(toolName)) {
      return false;
    }

    if (this.isYoloMode) {
      return false;
    }

    const filePath = params.path as string | undefined;
    const isExternal = isExternalPath(filePath, this.workspaceRoot);

    const readTools = new Set(['read_file', 'list_files', 'search_files', 'list_code_definition_names', 'access_mcp_resource']);
    if (readTools.has(toolName)) {
      if (isExternal) {
        if (this.granularOverride?.readFilesExternally) return false;
        return true;
      }
      if (this.granularOverride?.readFiles) return false;
      if (this.config.getAutoApproveReads()) return false;
      return true;
    }

    const writeTools = new Set(['write_to_file', 'replace_in_file', 'apply_patch', 'new_rule']);
    if (writeTools.has(toolName)) {
      if (isExternal) {
        if (this.granularOverride?.editFilesExternally) return false;
        return true;
      }
      if (this.granularOverride?.editFiles) return false;
      return !this.config.getAutoApproveWrites();
    }

    if (toolName === 'execute_command') {
      const rawCommand = (params.command as string || '').trim();

      if (this.granularOverride?.executeAllCommands) return false;

      if (this.granularOverride?.executeSafeCommands) {
        if (isSafeCommand(rawCommand)) return false;
        return true;
      }

      if (isSafeCommand(rawCommand)) {
        const baseCommand = rawCommand.split(/\s+/)[0];
        const autoApproveCommands = this.config.getAutoApproveCommands();
        for (const approved of autoApproveCommands) {
          if (baseCommand === approved) return false;
        }
      }

      return true;
    }

    if (toolName === 'use_mcp_tool') {
      if (this.granularOverride?.useMcp) return false;
      return true;
    }

    if (toolName === 'web_fetch') {
      return true;
    }

    if (toolName === 'browser_action') {
      if (this.granularOverride?.useBrowser) return false;
      return true;
    }

    return true;
  }
}
