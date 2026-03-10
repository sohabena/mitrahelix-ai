import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import WebSocket from 'ws';

export type BrowserAction = 'launch' | 'click' | 'type' | 'scroll_down' | 'scroll_up' | 'close';

export interface BrowserActionResult {
  screenshot?: string;
  logs?: string;
  url?: string;
  title?: string;
}

function findChromePath(): string | null {
  const platform = process.platform;

  if (platform === 'win32') {
    const candidates = [
      path.join(process.env['PROGRAMFILES'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    for (const c of candidates) {
      try { require('fs').accessSync(c); return c; } catch { /* continue */ }
    }
  } else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const c of candidates) {
      try { require('fs').accessSync(c); return c; } catch { /* continue */ }
    }
  } else {
    const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
    for (const c of candidates) {
      try {
        require('child_process').execFileSync('which', [c], { stdio: 'pipe' });
        return c;
      } catch { /* continue */ }
    }
  }

  return null;
}

export class BrowserSession {
  private browserProcess: ChildProcess | null = null;
  private debugUrl: string | null = null;
  private wsEndpoint: string | null = null;
  private consoleLogs: string[] = [];
  private currentUrl = '';
  private viewportWidth = 900;
  private viewportHeight = 600;
  private tempDir: string | null = null;
  private cdpSocket: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async launch(url: string): Promise<BrowserActionResult> {
    const chromePath = findChromePath();
    if (!chromePath) {
      throw new Error('Chrome/Chromium not found. Please install Google Chrome or Chromium.');
    }

    this.tempDir = path.join(os.tmpdir(), `mitrahelix-browser-${Date.now()}`);
    await fs.mkdir(this.tempDir, { recursive: true });

    const debugPort = 9222 + Math.floor(Math.random() * 1000);

    const args = [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${this.tempDir}`,
      `--window-size=${this.viewportWidth},${this.viewportHeight}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-default-apps',
      url,
    ];

    this.browserProcess = spawn(chromePath, args, {
      stdio: 'ignore',
      detached: process.platform !== 'win32',
    });

    this.browserProcess.on('error', () => { this.browserProcess = null; });

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      const info = await res.json();
      this.wsEndpoint = info.webSocketDebuggerUrl;
    } catch {
      await this.close();
      throw new Error(`Failed to connect to Chrome DevTools on port ${debugPort}. The browser may have failed to start.`);
    }

    if (this.wsEndpoint) {
      try {
        this.cdpSocket = new WebSocket(this.wsEndpoint);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WebSocket connect timeout')), 5000);
          this.cdpSocket!.on('open', () => { clearTimeout(timeout); resolve(); });
          this.cdpSocket!.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });
        });

        this.cdpSocket.on('message', (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id !== undefined && this.pendingMessages.has(msg.id)) {
              const pending = this.pendingMessages.get(msg.id)!;
              this.pendingMessages.delete(msg.id);
              if (msg.error) {
                pending.reject(new Error(msg.error.message));
              } else {
                pending.resolve(msg.result);
              }
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
              const text = msg.params?.args?.map((a: { value?: string }) => a.value || '').join(' ') || '';
              if (text) this.consoleLogs.push(`[${msg.params.type}] ${text}`);
            }
            if (msg.method === 'Log.entryAdded') {
              this.consoleLogs.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`);
            }
          } catch { /* ignore parse errors */ }
        });

        await this.sendCDP('Runtime.enable', {});
        await this.sendCDP('Log.enable', {});
        await this.sendCDP('Page.enable', {});
      } catch {
        this.cdpSocket = null;
      }
    }

    this.currentUrl = url;
    this.consoleLogs = [];

    await new Promise(resolve => setTimeout(resolve, 1500));

    const screenshot = await this.takeScreenshot();
    return {
      screenshot,
      logs: this.flushLogs(),
      url: this.currentUrl,
    };
  }

  async click(coordinate: string): Promise<BrowserActionResult> {
    const [x, y] = coordinate.split(',').map(v => parseInt(v.trim(), 10));
    if (isNaN(x) || isNaN(y)) {
      throw new Error(`Invalid coordinate: ${coordinate}. Expected "x,y" format.`);
    }

    if (this.cdpSocket) {
      await this.sendCDP('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await this.sendCDP('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshot = await this.takeScreenshot();
    return { screenshot, logs: this.flushLogs() };
  }

  async type(text: string): Promise<BrowserActionResult> {
    if (this.cdpSocket) {
      for (const char of text) {
        await this.sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await this.sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const screenshot = await this.takeScreenshot();
    return { screenshot, logs: this.flushLogs() };
  }

  async scrollDown(): Promise<BrowserActionResult> {
    if (this.cdpSocket) {
      await this.sendCDP('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: this.viewportWidth / 2, y: this.viewportHeight / 2,
        deltaX: 0, deltaY: this.viewportHeight,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const screenshot = await this.takeScreenshot();
    return { screenshot, logs: this.flushLogs() };
  }

  async scrollUp(): Promise<BrowserActionResult> {
    if (this.cdpSocket) {
      await this.sendCDP('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: this.viewportWidth / 2, y: this.viewportHeight / 2,
        deltaX: 0, deltaY: -this.viewportHeight,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const screenshot = await this.takeScreenshot();
    return { screenshot, logs: this.flushLogs() };
  }

  async close(): Promise<BrowserActionResult> {
    if (this.cdpSocket) {
      try { this.cdpSocket.close(); } catch { /* ignore */ }
      this.cdpSocket = null;
    }

    if (this.browserProcess) {
      try {
        this.browserProcess.kill();
      } catch { /* ignore */ }
      this.browserProcess = null;
    }

    if (this.tempDir) {
      fs.rm(this.tempDir, { recursive: true, force: true }).catch(() => {});
      this.tempDir = null;
    }

    this.wsEndpoint = null;
    this.pendingMessages.clear();

    return { logs: 'Browser closed.' };
  }

  get isActive(): boolean {
    return this.browserProcess !== null;
  }

  private async sendCDP(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.cdpSocket || this.cdpSocket.readyState !== 1) {
      throw new Error('CDP socket not connected');
    }

    const id = ++this.messageId;
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, 10000);

      this.pendingMessages.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      this.cdpSocket!.send(JSON.stringify({ id, method, params }));
    });
  }

  private async takeScreenshot(): Promise<string | undefined> {
    if (!this.cdpSocket) return undefined;

    try {
      const result = await this.sendCDP('Page.captureScreenshot', {
        format: 'png',
        quality: 80,
      }) as { data?: string };

      return result?.data;
    } catch {
      return undefined;
    }
  }

  private flushLogs(): string {
    const logs = this.consoleLogs.join('\n');
    this.consoleLogs = [];
    return logs || '(No new console logs)';
  }
}
