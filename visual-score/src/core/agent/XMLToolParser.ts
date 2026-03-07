export interface ParsedToolCall {
  name: string;
  parameters: Record<string, string>;
}

export class XMLToolParser {
  private static readonly TOOL_NAMES = new Set([
    'read_file', 'write_to_file', 'replace_in_file', 'execute_command',
    'search_files', 'list_files', 'list_code_definition_names',
    'browser_action', 'ask_followup_question', 'attempt_completion',
    'use_mcp_tool', 'access_mcp_resource',
  ]);

  parse(text: string): ParsedToolCall[] {
    const results: ParsedToolCall[] = [];

    for (const toolName of XMLToolParser.TOOL_NAMES) {
      const regex = new RegExp(`<${toolName}>([\\s\\S]*?)</${toolName}>`, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const innerXml = match[1];
        const parameters = this.parseParameters(innerXml);
        results.push({ name: toolName, parameters });
      }
    }

    return results;
  }

  parseStreaming(text: string): { complete: ParsedToolCall[]; partial: string | null } {
    const complete = this.parse(text);

    // Check for partial/incomplete tool call at the end
    let partial: string | null = null;
    for (const toolName of XMLToolParser.TOOL_NAMES) {
      const openTag = `<${toolName}>`;
      const closeTag = `</${toolName}>`;
      const lastOpen = text.lastIndexOf(openTag);
      if (lastOpen !== -1) {
        const lastClose = text.indexOf(closeTag, lastOpen);
        if (lastClose === -1) {
          partial = toolName;
          break;
        }
      }
    }

    return { complete, partial };
  }

  private parseParameters(innerXml: string): Record<string, string> {
    const params: Record<string, string> = {};
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = paramRegex.exec(innerXml)) !== null) {
      params[match[1]] = match[2];
    }

    return params;
  }
}
