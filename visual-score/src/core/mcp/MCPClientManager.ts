import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { MCPServerConfig, MCPToolDefinition, MCPResourceDefinition, MCPToolResult, MCPConfig } from './types.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPServerConnection {
  config: MCPServerConfig;
  process: child_process.ChildProcess | null;
  tools: MCPToolDefinition[];
  resources: MCPResourceDefinition[];
  connected: boolean;
  requestId: number;
  pendingRequests: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  buffer: string;
  lastError?: string;
}

export class MCPClientManager {
  private servers = new Map<string, MCPServerConnection>();
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async loadConfig(): Promise<void> {
    const projectConfig = path.join(this.workspaceRoot, '.mitrahelix', 'mcp.json');
    let config: MCPConfig | null = null;

    try {
      const data = await fs.readFile(projectConfig, 'utf-8');
      config = JSON.parse(data);
    } catch {
      /* no project config */
    }

    if (!config) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const globalConfig = path.join(homeDir, '.mitrahelix', 'mcp.json');
      try {
        const data = await fs.readFile(globalConfig, 'utf-8');
        config = JSON.parse(data);
      } catch {
        /* no global config either */
      }
    }

    if (!config?.mcpServers) return;

    for (const [name, serverConf] of Object.entries(config.mcpServers)) {
      const fullConfig: MCPServerConfig = { ...serverConf, name };
      await this.connectServer(fullConfig);
    }
  }

  async connectServer(config: MCPServerConfig): Promise<void> {
    if (config.transport !== 'stdio' || !config.command) return;

    const conn: MCPServerConnection = {
      config,
      process: null,
      tools: [],
      resources: [],
      connected: false,
      requestId: 0,
      pendingRequests: new Map(),
      buffer: '',
    };

    try {
      const env: Record<string, string | undefined> = { ...process.env };
      if (config.env) {
        for (const [key, val] of Object.entries(config.env)) {
          env[key] = val.replace(/\$\{env:(\w+)\}/g, (_, name) => process.env[name] || '');
        }
      }

      const proc = child_process.spawn(config.command, config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.workspaceRoot,
        env: env as NodeJS.ProcessEnv,
      });

      conn.process = proc;

      proc.stdout!.on('data', (data: Buffer) => {
        conn.buffer += data.toString();
        if (conn.buffer.length > 1_048_576) {
          conn.buffer = conn.buffer.slice(-524_288);
        }
        this.processBuffer(conn);
      });

      proc.stderr!.on('data', (data: Buffer) => {
        conn.lastError = data.toString().slice(0, 1000);
      });

      const rejectAll = (reason: string) => {
        for (const [, pending] of conn.pendingRequests) {
          pending.reject(new Error(reason));
        }
        conn.pendingRequests.clear();
        conn.connected = false;
      };

      proc.on('error', (err) => rejectAll(`MCP server process error: ${err.message}`));
      proc.on('exit', (code) => rejectAll(`MCP server process exited with code ${code}`));

      const initResult = (await this.sendRequest(conn, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mitrahelix', version: '0.1.0' },
      })) as { capabilities?: { tools?: unknown; resources?: unknown } };

      this.sendNotification(conn, 'notifications/initialized', {});

      conn.connected = true;

      if (initResult?.capabilities?.tools) {
        const toolsResult = (await this.sendRequest(conn, 'tools/list', {})) as {
          tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
        };
        if (toolsResult?.tools) {
          conn.tools = toolsResult.tools.map((t) => ({
            name: t.name,
            description: t.description || '',
            inputSchema: (t.inputSchema || { type: 'object', properties: {} }) as MCPToolDefinition['inputSchema'],
            serverName: config.name,
          }));
        }
      }

      if (initResult?.capabilities?.resources) {
        const resResult = (await this.sendRequest(conn, 'resources/list', {})) as {
          resources?: Array<{ uri: string; name: string; description?: string; mimeType?: string }>;
        };
        if (resResult?.resources) {
          conn.resources = resResult.resources.map((r) => ({
            ...r,
            serverName: config.name,
          }));
        }
      }

      this.servers.set(config.name, conn);
    } catch {
      conn.process?.kill();
    }
  }

  private sendRequest(conn: MCPServerConnection, method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!conn.process?.stdin?.writable) {
      return Promise.reject(new Error(`MCP server "${conn.config.name}" is not connected`));
    }

    return new Promise((resolve, reject) => {
      const id = ++conn.requestId;
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

      const timeout = setTimeout(() => {
        conn.pendingRequests.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, 30000);

      conn.pendingRequests.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const message = JSON.stringify(request) + '\n';
      conn.process?.stdin?.write(message);
    });
  }

  private sendNotification(conn: MCPServerConnection, method: string, params: Record<string, unknown>): void {
    const notification = { jsonrpc: '2.0', method, params };
    conn.process?.stdin?.write(JSON.stringify(notification) + '\n');
  }

  private processBuffer(conn: MCPServerConnection): void {
    const lines = conn.buffer.split('\n');
    conn.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        if (response.id !== undefined) {
          const pending = conn.pendingRequests.get(response.id);
          if (pending) {
            conn.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        }
      } catch {
        /* skip malformed lines */
      }
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const conn = this.servers.get(serverName);
    if (!conn?.connected) {
      return { content: [{ type: 'text', text: `MCP server "${serverName}" is not connected.` }], isError: true };
    }

    try {
      const result = await this.sendRequest(conn, 'tools/call', { name: toolName, arguments: args });
      return result as MCPToolResult;
    } catch (e: unknown) {
      return {
        content: [{ type: 'text', text: `MCP tool error: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  }

  async readResource(serverName: string, uri: string): Promise<string> {
    const conn = this.servers.get(serverName);
    if (!conn?.connected) return `MCP server "${serverName}" is not connected.`;

    try {
      const result = (await this.sendRequest(conn, 'resources/read', { uri })) as {
        contents?: Array<{ text?: string }>;
      };
      return result?.contents?.map((c) => c.text || '').join('\n') || '';
    } catch (e: unknown) {
      return `MCP resource error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  getAvailableTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = [];
    for (const conn of this.servers.values()) {
      if (conn.connected) tools.push(...conn.tools);
    }
    return tools;
  }

  getAvailableResources(): MCPResourceDefinition[] {
    const resources: MCPResourceDefinition[] = [];
    for (const conn of this.servers.values()) {
      if (conn.connected) resources.push(...conn.resources);
    }
    return resources;
  }

  getConnectedServerCount(): number {
    let count = 0;
    for (const conn of this.servers.values()) {
      if (conn.connected) count++;
    }
    return count;
  }

  getServerNames(): string[] {
    return [...this.servers.keys()];
  }

  async disconnectAll(): Promise<void> {
    for (const conn of this.servers.values()) {
      for (const [, pending] of conn.pendingRequests) {
        pending.reject(new Error('MCP client shutting down'));
      }
      conn.pendingRequests.clear();
      conn.process?.kill();
      conn.connected = false;
    }
    this.servers.clear();
  }
}
