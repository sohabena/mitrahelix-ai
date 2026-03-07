import * as vscode from 'vscode';
import type { Settings } from '../../shared/MessageTypes.js';

export class ConfigManager {
  private static readonly SECTION = 'mitraHelix';

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(ConfigManager.SECTION);
  }

  getProvider(): Settings['provider'] {
    return this.config.get<Settings['provider']>('provider', 'anthropic');
  }

  getApiKey(): string {
    const provider = this.getProvider();
    switch (provider) {
      case 'anthropic': return this.config.get<string>('anthropicApiKey', '');
      case 'openai': return this.config.get<string>('openaiApiKey', '');
      case 'google': return this.config.get<string>('googleApiKey', '');
      case 'deepseek': return this.config.get<string>('deepseekApiKey', '');
      case 'openrouter': return this.config.get<string>('openrouterApiKey', '');
      case 'ollama': return '';
      default: return '';
    }
  }

  getModel(): string {
    return this.config.get<string>('model', 'claude-sonnet-4-6');
  }

  getMaxTokens(): number {
    return this.config.get<number>('maxTokens', 8192);
  }

  getMaxBudgetPerTask(): number {
    return this.config.get<number>('maxBudgetPerTask', 1.0);
  }

  getAutoApproveReads(): boolean {
    return this.config.get<boolean>('autoApproveReads', true);
  }

  getAutoApproveWrites(): boolean {
    return this.config.get<boolean>('autoApproveWrites', false);
  }

  getAutoApproveCommands(): string[] {
    return this.config.get<string[]>('autoApproveCommands', []);
  }

  getContextWindowSize(): number {
    return this.config.get<number>('contextWindowSize', 100000);
  }

  getGoogleApiKey(): string {
    return this.config.get<string>('googleApiKey', '');
  }

  getDeepseekApiKey(): string {
    return this.config.get<string>('deepseekApiKey', '');
  }

  getOllamaBaseUrl(): string {
    return this.config.get<string>('ollamaBaseUrl', 'http://localhost:11434');
  }

  getAllSettings(): Settings {
    return {
      provider: this.getProvider(),
      model: this.getModel(),
      maxTokens: this.getMaxTokens(),
      maxBudgetPerTask: this.getMaxBudgetPerTask(),
      autoApproveReads: this.getAutoApproveReads(),
      autoApproveWrites: this.getAutoApproveWrites(),
      autoApproveCommands: this.getAutoApproveCommands(),
      contextWindowSize: this.getContextWindowSize(),
    };
  }

  onConfigChanged(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ConfigManager.SECTION)) {
        callback();
      }
    });
  }
}
