import type { Tool, ToolContext, ToolResult, ToolParameterSchema } from '../../../shared/ToolTypes.js';
import { BrowserSession } from '../../browser/BrowserSession.js';
import type { BrowserAction } from '../../browser/BrowserSession.js';

const VALID_ACTIONS = new Set<BrowserAction>(['launch', 'click', 'type', 'scroll_down', 'scroll_up', 'close']);

let sharedSession: BrowserSession | null = null;

export class BrowserActionTool implements Tool {
  readonly name = 'browser_action';
  readonly description = `Interact with a browser for testing web applications. Every action except "close" returns a screenshot of the current state along with console logs.

RULES:
- The sequence MUST start with "launch" and MUST end with "close".
- While the browser is open, only browser_action can be used — no other tools.
- You may only perform one browser action per message; wait for the screenshot before deciding the next action.
- To visit a different URL, close the browser first, then launch again.
- The viewport is 900x600 pixels. Click coordinates must be within this range.
- Before clicking, examine the screenshot to determine the element's center coordinates.`;

  readonly requiresApproval = true;
  readonly parameterSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The browser action: launch, click, type, scroll_down, scroll_up, close',
        required: true,
        enum: ['launch', 'click', 'type', 'scroll_down', 'scroll_up', 'close'],
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (required for "launch" action)',
      },
      coordinate: {
        type: 'string',
        description: 'X,Y coordinates for "click" action (e.g., "450,300")',
      },
      text: {
        type: 'string',
        description: 'Text to type for "type" action',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const action = params.action as BrowserAction;

    if (!action || !VALID_ACTIONS.has(action)) {
      return { success: false, output: '', error: `Invalid action: "${action}". Must be one of: launch, click, type, scroll_down, scroll_up, close` };
    }

    try {
      if (action === 'launch') {
        const url = params.url as string;
        if (!url) {
          return { success: false, output: '', error: 'Missing required parameter "url" for launch action' };
        }

        try {
          new URL(url);
        } catch {
          return { success: false, output: '', error: `Invalid URL: "${url}". Include the protocol (e.g., http://localhost:3000)` };
        }

        if (sharedSession?.isActive) {
          await sharedSession.close();
        }
        sharedSession = new BrowserSession();

        const result = await sharedSession.launch(url);
        return this.formatResult(action, result);
      }

      if (!sharedSession?.isActive) {
        return { success: false, output: '', error: 'No browser session active. Use action "launch" first.' };
      }

      switch (action) {
        case 'click': {
          const coordinate = params.coordinate as string;
          if (!coordinate) {
            return { success: false, output: '', error: 'Missing required parameter "coordinate" for click action' };
          }
          const result = await sharedSession.click(coordinate);
          return this.formatResult(action, result);
        }

        case 'type': {
          const text = params.text as string;
          if (!text) {
            return { success: false, output: '', error: 'Missing required parameter "text" for type action' };
          }
          const result = await sharedSession.type(text);
          return this.formatResult(action, result);
        }

        case 'scroll_down': {
          const result = await sharedSession.scrollDown();
          return this.formatResult(action, result);
        }

        case 'scroll_up': {
          const result = await sharedSession.scrollUp();
          return this.formatResult(action, result);
        }

        case 'close': {
          const result = await sharedSession.close();
          sharedSession = null;
          return {
            success: true,
            output: 'Browser closed. You may now use other tools.',
          };
        }
      }

      return { success: false, output: '', error: `Unhandled action: ${action}` };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (sharedSession) {
        await sharedSession.close().catch(() => {});
        sharedSession = null;
      }
      return { success: false, output: '', error: `Browser action failed: ${msg}` };
    }
  }

  private formatResult(action: string, result: { screenshot?: string; logs?: string; url?: string }): ToolResult {
    const parts: string[] = [
      `Browser action "${action}" executed successfully.`,
    ];

    if (result.logs) {
      parts.push(`\nConsole logs:\n${result.logs}`);
    }

    if (result.screenshot) {
      parts.push(`\n[SCREENSHOT attached as base64 PNG — ${Math.round(result.screenshot.length * 0.75 / 1024)}KB]`);
      parts.push(`\n(If you need to proceed to using non-browser_action tools, you MUST first close the browser.)`);
    }

    return {
      success: true,
      output: parts.join('\n'),
    };
  }
}

export function getActiveBrowserSession(): BrowserSession | null {
  return sharedSession?.isActive ? sharedSession : null;
}
