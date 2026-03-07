import * as path from 'path';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import { isWithinWorkspace } from '../../shared/pathSecurity.js';

export interface ParsedMention {
  type: 'file' | 'folder' | 'problems' | 'url';
  value: string;
  content: string;
}

export class MentionsParser {
  constructor(private workspaceRoot: string) {}

  async parse(text: string): Promise<{ cleanText: string; mentions: ParsedMention[] }> {
    const mentions: ParsedMention[] = [];
    let cleanText = text;

    // Parse @file mentions
    const fileRegex = /@file\s+(\S+)/g;
    let match;
    while ((match = fileRegex.exec(text)) !== null) {
      const filePath = match[1];
      const content = await this.readFile(filePath);
      mentions.push({ type: 'file', value: filePath, content });
      cleanText = cleanText.replace(match[0], '').trim();
    }

    // Parse @folder mentions
    const folderRegex = /@folder\s+(\S+)/g;
    while ((match = folderRegex.exec(text)) !== null) {
      const folderPath = match[1];
      const content = await this.readFolder(folderPath);
      mentions.push({ type: 'folder', value: folderPath, content });
      cleanText = cleanText.replace(match[0], '').trim();
    }

    // Parse @problems mention
    if (text.includes('@problems')) {
      mentions.push({ type: 'problems', value: 'problems', content: '[Diagnostics included in context]' });
      cleanText = cleanText.replace('@problems', '').trim();
    }

    // Parse @url mentions
    const urlRegex = /@url\s+(https?:\/\/\S+)/g;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[1];
      const content = await this.fetchUrl(url);
      mentions.push({ type: 'url', value: url, content });
      cleanText = cleanText.replace(match[0], '').trim();
    }

    return { cleanText, mentions };
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workspaceRoot, filePath);
      if (!isWithinWorkspace(absolutePath, this.workspaceRoot)) {
        return `[Error: path outside workspace]`;
      }
      const content = await fs.readFile(absolutePath, 'utf-8');
      return `--- ${filePath} ---\n${content.slice(0, 50000)}`;
    } catch {
      return `[Error: could not read file "${filePath}"]`;
    }
  }

  private async readFolder(folderPath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workspaceRoot, folderPath);
      if (!isWithinWorkspace(absolutePath, this.workspaceRoot)) {
        return `[Error: path outside workspace]`;
      }
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const listing = entries
        .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n');
      return `--- ${folderPath}/ ---\n${listing}`;
    } catch {
      return `[Error: could not read folder "${folderPath}"]`;
    }
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          // Simple HTML to text conversion
          const text = data
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 30000);
          resolve(`--- ${url} ---\n${text}`);
        });
      });
      req.on('error', () => resolve(`[Error: could not fetch "${url}"]`));
      req.on('timeout', () => {
        req.destroy();
        resolve(`[Error: timeout fetching "${url}"]`);
      });
    });
  }
}
