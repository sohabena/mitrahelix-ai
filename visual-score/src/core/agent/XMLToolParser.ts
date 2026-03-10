export interface ParsedToolCall {
  name: string;
  parameters: Record<string, string>;
}

export class XMLToolParser {
  private toolNames = new Set([
    'read_file', 'write_to_file', 'replace_in_file', 'execute_command',
    'search_files', 'list_files', 'list_code_definition_names',
    'ask_followup_question', 'attempt_completion',
    'use_mcp_tool', 'access_mcp_resource',
  ]);

  setToolNames(names: string[]): void {
    this.toolNames = new Set(names);
  }

  parse(text: string): ParsedToolCall[] {
    const results: Array<ParsedToolCall & { _index: number }> = [];

    for (const toolName of this.toolNames) {
      const regex = new RegExp(`<${toolName}>([\\s\\S]*?)</${toolName}>`, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const innerXml = match[1];
        const parameters = this.parseParameters(innerXml);
        results.push({ name: toolName, parameters, _index: match.index });
      }
    }

    results.sort((a, b) => a._index - b._index);
    return results.map(({ _index: _, ...rest }) => rest);
  }

  private parseParameters(innerXml: string): Record<string, string> {
    const contentParams = new Set(['content', 'diff', 'result']);
    const params: Record<string, string> = {};
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = paramRegex.exec(innerXml)) !== null) {
      const key = match[1];
      if (!(key in params)) {
        params[key] = contentParams.has(key) ? match[2] : match[2].trim();
      }
    }

    return params;
  }
}
