import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../shared/ToolTypes.js';
import type { MCPClientManager } from './MCPClientManager.js';

export class UseMCPToolTool implements Tool {
  readonly name = 'use_mcp_tool';
  readonly description =
    'Call a tool provided by an MCP (Model Context Protocol) server. Use this to interact with external services, databases, APIs, and custom tools.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      server_name: { type: 'string', description: 'The name of the MCP server providing the tool', required: true },
      tool_name: { type: 'string', description: 'The name of the tool to call', required: true },
      arguments: { type: 'string', description: 'JSON string of arguments to pass to the tool (defaults to "{}" if omitted)' },
    },
    required: ['server_name', 'tool_name'],
  };

  constructor(private mcpManager: MCPClientManager) {}

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const serverName = params.server_name as string;
    const toolName = params.tool_name as string;
    const argsStr = params.arguments as string;

    if (!serverName || !toolName) {
      return { success: false, output: '', error: 'Missing required parameters: server_name and tool_name' };
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsStr || '{}');
    } catch {
      return { success: false, output: '', error: 'Invalid JSON in arguments parameter' };
    }

    const result = await this.mcpManager.callTool(serverName, toolName, args);
    const text = (result.content ?? []).map((c) => c.text || '').join('\n');

    return {
      success: !result.isError,
      output: text,
      error: result.isError ? text : undefined,
    };
  }
}

export class AccessMCPResourceTool implements Tool {
  readonly name = 'access_mcp_resource';
  readonly description = 'Read a resource provided by an MCP server.';
  readonly requiresApproval = false;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      server_name: { type: 'string', description: 'The name of the MCP server', required: true },
      uri: { type: 'string', description: 'The URI of the resource to read', required: true },
    },
    required: ['server_name', 'uri'],
  };

  constructor(private mcpManager: MCPClientManager) {}

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const serverName = params.server_name as string;
    const uri = params.uri as string;

    if (!serverName || !uri) {
      return { success: false, output: '', error: 'Missing required parameters: server_name and uri' };
    }

    const content = await this.mcpManager.readResource(serverName, uri);
    const isError = content.startsWith('MCP server ') || content.startsWith('MCP resource error');
    return {
      success: !isError,
      output: isError ? '' : content,
      error: isError ? content : undefined,
    };
  }
}
