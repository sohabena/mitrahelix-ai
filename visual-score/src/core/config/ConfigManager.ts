import * as vscode from 'vscode';
import type { Settings } from '../../shared/MessageTypes.js';
import type { SecretManager } from './SecretManager.js';

export class ConfigManager {
  private static readonly SECTION = 'mitraHelix';
  private secretManager: SecretManager | null = null;

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(ConfigManager.SECTION);
  }

  setSecretManager(manager: SecretManager): void {
    this.secretManager = manager;
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

  async getApiKeyAsync(): Promise<string> {
    const provider = this.getProvider();
    const keyMap: Record<string, string> = {
      anthropic: 'anthropicApiKey',
      openai: 'openaiApiKey',
      google: 'googleApiKey',
      deepseek: 'deepseekApiKey',
      openrouter: 'openrouterApiKey',
      ollama: '',
    };
    const keyName = keyMap[provider];
    if (!keyName) return '';

    if (this.secretManager) {
      const secret = await this.secretManager.getSecret(keyName as Parameters<SecretManager['getSecret']>[0]);
      if (secret) return secret;
    }
    return this.config.get<string>(keyName, '');
  }

  getModel(): string {
    return this.config.get<string>('model', 'claude-sonnet-4-6');
  }

  getMaxTokens(): number {
    return this.config.get<number>('maxTokens', 16384);
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

  getAutoLintAfterEdit(): boolean {
    return this.config.get<boolean>('autoLintAfterEdit', true);
  }

  getCrossSessionMemory(): boolean {
    return this.config.get<boolean>('crossSessionMemory', true);
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
