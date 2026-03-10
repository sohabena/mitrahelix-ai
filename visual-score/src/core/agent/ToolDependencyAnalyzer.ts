type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

const READ_ONLY_TOOLS = new Set([
  'read_file',
  'search_files',
  'list_files',
  'list_code_definition_names',
  'access_mcp_resource',
]);

const WRITE_TOOLS = new Set([
  'write_to_file',
  'replace_in_file',
]);

const EXECUTE_TOOLS = new Set([
  'execute_command',
  'use_mcp_tool',
]);

const TERMINAL_TOOLS = new Set([
  'attempt_completion',
  'ask_followup_question',
]);

export class ToolDependencyAnalyzer {
  private categorize(name: string): 'read' | 'write' | 'execute' | 'terminal' {
    if (READ_ONLY_TOOLS.has(name)) return 'read';
    if (WRITE_TOOLS.has(name)) return 'write';
    if (EXECUTE_TOOLS.has(name)) return 'execute';
    if (TERMINAL_TOOLS.has(name)) return 'terminal';
    return 'write';
  }

  analyzeBatches(toolCalls: ToolCall[]): ToolCall[][] {
    if (toolCalls.length <= 1) return [toolCalls];

    const batches: ToolCall[][] = [];
    let currentReadBatch: ToolCall[] = [];

    for (const tc of toolCalls) {
      const category = this.categorize(tc.name);

      if (category === 'read') {
        currentReadBatch.push(tc);
      } else {
        if (currentReadBatch.length > 0) {
          batches.push(currentReadBatch);
          currentReadBatch = [];
        }
        batches.push([tc]);
      }
    }

    if (currentReadBatch.length > 0) {
      batches.push(currentReadBatch);
    }

    return batches;
  }
}
