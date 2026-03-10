import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';

const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some(re => re.test(hostname));
}

function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');

  text = text.replace(/<title>(.*?)<\/title>/gi, '# $1\n\n');
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  text = text.replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '#### $1\n');

  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  text = text.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');

  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');

  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

export class WebFetchTool implements Tool {
  readonly name = 'web_fetch';
  readonly description = 'Fetch the content of a URL and return it as readable text. Useful for reading documentation, API references, or web pages relevant to the task. The HTML is automatically converted to readable text/markdown format.';
  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must be http:// or https://)',
        required: true,
      },
    },
    required: ['url'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const url = params.url as string;
    if (!url) {
      return { success: false, output: '', error: 'Missing required parameter: url' };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, output: '', error: `Invalid URL: ${url}` };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, output: '', error: 'Only http:// and https:// URLs are supported' };
    }

    if (isPrivateHost(parsed.hostname)) {
      return { success: false, output: '', error: 'Access to private/local network addresses is blocked (SSRF protection)' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MitraHelix/1.0 (AI Coding Assistant)',
          'Accept': 'text/html,application/xhtml+xml,text/plain,application/json,*/*',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { success: false, output: '', error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') || '';
      const MAX_SIZE = 500_000;
      let body = await response.text();
      if (body.length > MAX_SIZE) {
        body = body.slice(0, MAX_SIZE) + '\n\n[Content truncated at 500KB]';
      }

      let output: string;
      if (contentType.includes('text/html') || contentType.includes('xhtml')) {
        output = htmlToText(body);
      } else if (contentType.includes('application/json')) {
        try {
          output = '```json\n' + JSON.stringify(JSON.parse(body), null, 2) + '\n```';
        } catch {
          output = body;
        }
      } else {
        output = body;
      }

      const header = `URL: ${url}\nContent-Type: ${contentType}\n---\n\n`;
      context.outputChannel.appendLine(`[WebFetch] Fetched ${url} (${output.length} chars)`);
      return { success: true, output: header + output };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('aborted') || msg.includes('abort')) {
        return { success: false, output: '', error: 'Request timed out (30s)' };
      }
      return { success: false, output: '', error: `Fetch failed: ${msg}` };
    }
  }
}
