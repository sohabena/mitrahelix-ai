import { MCPClientManager } from './MCPClientManager.js';
import type { MCPServerConfig, MCPToolDefinition, MCPResourceDefinition, MCPToolResult } from './types.js';

export interface MCPServerStatus {
  name: string;
  transport: string;
  connected: boolean;
  toolCount: number;
  resourceCount: number;
  lastError?: string;
  reconnectAttempts: number;
}

/**
 * MCPHub wraps MCPClientManager with auto-reconnection, status tracking,
 * and enhanced server management. Acts as the single entry point for all
 * MCP interactions.
 */
export class MCPHub {
  private manager: MCPClientManager;
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectAttempts = new Map<string, number>();
  private serverConfigs = new Map<string, MCPServerConfig>();
  private maxReconnectAttempts = 5;
  private disposed = false;

  constructor(workspaceRoot: string) {
    this.manager = new MCPClientManager(workspaceRoot);
  }

  async loadConfig(): Promise<void> {
    await this.manager.loadConfig();
  }

  async connectServer(config: MCPServerConfig): Promise<void> {
    this.serverConfigs.set(config.name, config);
    this.reconnectAttempts.set(config.name, 0);
    await this.manager.connectServer(config);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.manager.callTool(serverName, toolName, args);

    if (result.isError && this.shouldReconnect(serverName)) {
      await this.attemptReconnect(serverName);
      return this.manager.callTool(serverName, toolName, args);
    }

    return result;
  }

  async readResource(serverName: string, uri: string): Promise<string> {
    return this.manager.readResource(serverName, uri);
  }

  getAvailableTools(): MCPToolDefinition[] {
    return this.manager.getAvailableTools();
  }

  getAvailableResources(): MCPResourceDefinition[] {
    return this.manager.getAvailableResources();
  }

  getServerStatus(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = [];
    const tools = this.manager.getAvailableTools();
    const resources = this.manager.getAvailableResources();

    for (const name of this.manager.getServerNames()) {
      const serverTools = tools.filter(t => t.serverName === name);
      const serverResources = resources.filter(r => r.serverName === name);

      statuses.push({
        name,
        transport: this.serverConfigs.get(name)?.transport || 'stdio',
        connected: serverTools.length > 0 || serverResources.length > 0,
        toolCount: serverTools.length,
        resourceCount: serverResources.length,
        reconnectAttempts: this.reconnectAttempts.get(name) || 0,
      });
    }

    return statuses;
  }

  getConnectedServerCount(): number {
    return this.manager.getConnectedServerCount();
  }

  private shouldReconnect(serverName: string): boolean {
    const attempts = this.reconnectAttempts.get(serverName) || 0;
    return attempts < this.maxReconnectAttempts && this.serverConfigs.has(serverName);
  }

  private async attemptReconnect(serverName: string): Promise<void> {
    if (this.disposed) return;

    const config = this.serverConfigs.get(serverName);
    if (!config) return;

    const attempts = (this.reconnectAttempts.get(serverName) || 0) + 1;
    this.reconnectAttempts.set(serverName, attempts);

    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
    await new Promise(resolve => setTimeout(resolve, delay));

    if (this.disposed) return;

    try {
      await this.manager.connectServer(config);
      this.reconnectAttempts.set(serverName, 0);
    } catch {
      // reconnection failed, will retry on next call
    }
  }

  scheduleReconnect(serverName: string): void {
    if (this.disposed || this.reconnectTimers.has(serverName)) return;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(serverName);
      this.attemptReconnect(serverName).catch(() => {});
    }, 5000);

    this.reconnectTimers.set(serverName, timer);
  }

  async disconnectAll(): Promise<void> {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    await this.manager.disconnectAll();
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.manager.disconnectAll().catch(() => {});
  }
}
