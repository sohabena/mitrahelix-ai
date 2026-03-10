import * as path from 'path';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { isWithinWorkspace } from '../../shared/pathSecurity.js';
import { PLACEHOLDER_DIAGNOSTICS, PLACEHOLDER_TERMINAL, PLACEHOLDER_SELECTION } from '../../shared/constants.js';

export interface ParsedMention {
  type: 'file' | 'folder' | 'problems' | 'url' | 'git' | 'terminal' | 'selection';
  value: string;
  content: string;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.wasm', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.ttf', '.woff', '.woff2', '.eot',
]);

export class MentionsParser {
  private static readonly MAX_TOTAL_MENTION_CHARS = 150_000;

  constructor(private workspaceRoot: string) {}

  private totalMentionChars(mentions: ParsedMention[]): number {
    return mentions.reduce((sum, m) => sum + m.content.length, 0);
  }

  async parse(text: string): Promise<{ cleanText: string; mentions: ParsedMention[] }> {
    const mentions: ParsedMention[] = [];
    let cleanText = text;

    // Parse @file mentions — supports bare paths and "quoted paths" for spaces/special chars
    const fileRegex = /@file\s+(?:"([^"]+)"|([\w.\\/:\-]+))/g;
    let match;
    const seenFiles = new Set<string>();
    while ((match = fileRegex.exec(text)) !== null) {
      const filePath = match[1] || match[2];
      if (!seenFiles.has(filePath) && this.totalMentionChars(mentions) < MentionsParser.MAX_TOTAL_MENTION_CHARS) {
        seenFiles.add(filePath);
        const content = await this.resolveFile(filePath);
        mentions.push({ type: 'file', value: filePath, content });
      }
      cleanText = cleanText.replaceAll(match[0], '');
    }
    cleanText = cleanText.trim();

    const folderRegex = /@folder\s+(?:"([^"]+)"|([\w.\\/:\-]+))/g;
    const seenFolders = new Set<string>();
    while ((match = folderRegex.exec(text)) !== null) {
      const folderPath = match[1] || match[2];
      if (!seenFolders.has(folderPath) && this.totalMentionChars(mentions) < MentionsParser.MAX_TOTAL_MENTION_CHARS) {
        seenFolders.add(folderPath);
        const content = await this.resolveFolder(folderPath);
        mentions.push({ type: 'folder', value: folderPath, content });
      }
      cleanText = cleanText.replaceAll(match[0], '');
    }
    cleanText = cleanText.trim();

    if (/(^|\s)@problems\b/.test(text)) {
      mentions.push({ type: 'problems', value: 'problems', content: PLACEHOLDER_DIAGNOSTICS });
      cleanText = cleanText.replace(/(^|\s)@problems\b/g, '$1').trim();
    }

    // Parse @url mentions
    const urlRegex = /@url\s+(https?:\/\/[^\s,;)}\]]+)/g;
    const seenUrls = new Set<string>();
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[1];
      if (!seenUrls.has(url) && this.totalMentionChars(mentions) < MentionsParser.MAX_TOTAL_MENTION_CHARS) {
        seenUrls.add(url);
        const content = await this.resolveUrl(url);
        mentions.push({ type: 'url', value: url, content });
      }
      cleanText = cleanText.replaceAll(match[0], '');
    }
    cleanText = cleanText.trim();

    if (/(^|\s)@git\b/.test(text) && this.totalMentionChars(mentions) < MentionsParser.MAX_TOTAL_MENTION_CHARS) {
      const content = await this.resolveGit();
      mentions.push({ type: 'git', value: 'git', content });
      cleanText = cleanText.replace(/(^|\s)@git\b/g, '$1').trim();
    }

    if (/(^|\s)@terminal\b/.test(text)) {
      mentions.push({ type: 'terminal', value: 'terminal', content: PLACEHOLDER_TERMINAL });
      cleanText = cleanText.replace(/(^|\s)@terminal\b/g, '$1').trim();
    }

    if (/(^|\s)@selection\b/.test(text)) {
      mentions.push({ type: 'selection', value: 'selection', content: PLACEHOLDER_SELECTION });
      cleanText = cleanText.replace(/(^|\s)@selection\b/g, '$1').trim();
    }

    return { cleanText, mentions };
  }

  async resolveFile(filePath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workspaceRoot, filePath);
      if (!isWithinWorkspace(absolutePath, this.workspaceRoot)) {
        return `[Error: path outside workspace]`;
      }
      const ext = path.extname(absolutePath).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        return `--- File: ${filePath} ---\n[Binary file — ${ext} format, not included in context]`;
      }
      const content = await fs.readFile(absolutePath, 'utf-8');
      const maxChars = 50000;
      const truncated = content.length > maxChars
        ? content.slice(0, maxChars) + '\n[FILE TRUNCATED]'
        : content;
      return `--- ${filePath} ---\n${truncated}`;
    } catch {
      return `[Error: could not read file "${filePath}"]`;
    }
  }

  async resolveFolder(folderPath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workspaceRoot, folderPath);
      if (!isWithinWorkspace(absolutePath, this.workspaceRoot)) {
        return `[Error: path outside workspace]`;
      }
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const listing = entries
        .map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`)
        .join('\n');
      return `--- ${folderPath}/ ---\n${listing}`;
    } catch {
      return `[Error: could not read folder "${folderPath}"]`;
    }
  }

  async resolveGit(): Promise<string> {
    const opts = { cwd: this.workspaceRoot, timeout: 15_000, maxBuffer: 200_000 };
    try {
      const [statusResult, diffResult, stagedResult] = await Promise.all([
        execAsync('git status --short', opts),
        execAsync('git diff', opts),
        execAsync('git diff --cached', opts),
      ]);
      const status = statusResult.stdout;
      const diff = diffResult.stdout;
      const stagedDiff = stagedResult.stdout;

      const parts: string[] = ['--- Git Context ---'];
      if (status.trim()) {
        parts.push(`## git status\n${status.trim()}`);
      } else {
        parts.push('## git status\nClean working tree.');
      }
      if (stagedDiff.trim()) {
        parts.push(`## Staged changes (git diff --cached)\n${stagedDiff.trim().slice(0, 50000)}`);
      }
      if (diff.trim()) {
        parts.push(`## Unstaged changes (git diff)\n${diff.trim().slice(0, 50000)}`);
      }
      if (!stagedDiff.trim() && !diff.trim()) {
        parts.push('No uncommitted changes.');
      }
      return parts.join('\n\n');
    } catch {
      return '[Error: could not read git status — is this a git repository?]';
    }
  }

  private isPrivateUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
      if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
      const parts = hostname.split('.').map(Number);
      if (parts.length === 4 && parts.every(p => !isNaN(p))) {
        if (parts[0] === 10) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  async resolveUrl(url: string, redirectsLeft = 10): Promise<string> {
    if (this.isPrivateUrl(url)) {
      return `[Error: cannot fetch private/internal URL "${url}"]`;
    }
    return new Promise((resolve) => {
      const maxDataSize = 50_000;
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            resolve(`[Error: too many redirects fetching "${url}"]`);
            return;
          }
          if (this.isPrivateUrl(res.headers.location)) {
            resolve(`[Error: redirect to private URL blocked]`);
            return;
          }
          resolve(this.resolveUrl(res.headers.location, redirectsLeft - 1));
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          resolve(`[Error: HTTP ${res.statusCode} fetching "${url}"]`);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          if (data.length > maxDataSize) {
            res.destroy();
          }
        });
        res.on('end', () => {
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
