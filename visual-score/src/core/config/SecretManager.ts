import * as vscode from 'vscode';

const KEY_PREFIX = 'mitrahelix.';

const SECRET_KEYS = [
  'anthropicApiKey',
  'openaiApiKey',
  'googleApiKey',
  'deepseekApiKey',
  'openrouterApiKey',
] as const;

type SecretKeyName = typeof SECRET_KEYS[number];

export class SecretManager {
  private secrets: vscode.SecretStorage;
  private cache = new Map<string, string>();

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
  }

  async getSecret(key: SecretKeyName): Promise<string> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const value = await this.secrets.get(`${KEY_PREFIX}${key}`);
    if (value) this.cache.set(key, value);
    return value || '';
  }

  async setSecret(key: SecretKeyName, value: string): Promise<void> {
    if (value) {
      await this.secrets.store(`${KEY_PREFIX}${key}`, value);
      this.cache.set(key, value);
    } else {
      await this.secrets.delete(`${KEY_PREFIX}${key}`);
      this.cache.delete(key);
    }
  }

  async migrateFromSettings(): Promise<number> {
    const config = vscode.workspace.getConfiguration('mitraHelix');
    let migrated = 0;

    for (const key of SECRET_KEYS) {
      const settingsValue = config.get<string>(key, '');
      if (settingsValue && settingsValue.length > 10) {
        const existing = await this.secrets.get(`${KEY_PREFIX}${key}`);
        if (!existing) {
          await this.secrets.store(`${KEY_PREFIX}${key}`, settingsValue);
          this.cache.set(key, settingsValue);
          migrated++;
        }
      }
    }
    return migrated;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
