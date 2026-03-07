import type { ConfigManager } from '../config/ConfigManager.js';

export class PermissionManager {
  constructor(private config: ConfigManager) {}

  needsApproval(toolName: string, params: Record<string, unknown>): boolean {
    // Tools that never need approval
    const safeTools = new Set([
      'read_file',
      'list_files',
      'search_files',
      'list_code_definition_names',
      'ask_followup_question',
      'attempt_completion',
    ]);

    if (safeTools.has(toolName) && this.config.getAutoApproveReads()) {
      return false;
    }

    // File write tools
    if (toolName === 'write_to_file' || toolName === 'replace_in_file') {
      return !this.config.getAutoApproveWrites();
    }

    // Command execution
    if (toolName === 'execute_command') {
      const command = (params.command as string || '').trim();
      const autoApproveCommands = this.config.getAutoApproveCommands();

      // Check if command starts with any auto-approved command
      for (const approved of autoApproveCommands) {
        if (command.startsWith(approved)) {
          return false;
        }
      }
      return true;
    }

    // Browser actions always need approval
    if (toolName === 'browser_action') {
      return true;
    }

    // Default: need approval for unknown tools
    return true;
  }

  classifySafety(toolName: string): 'safe' | 'approval_required' | 'dangerous' {
    const safe = new Set(['read_file', 'list_files', 'search_files', 'list_code_definition_names', 'ask_followup_question', 'attempt_completion']);
    const dangerous = new Set(['execute_command', 'browser_action']);

    if (safe.has(toolName)) return 'safe';
    if (dangerous.has(toolName)) return 'dangerous';
    return 'approval_required';
  }
}
