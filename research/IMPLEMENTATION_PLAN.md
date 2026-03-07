# Visual Score AI Agent — Forensic Implementation Plan

> **Every step has a checkbox. Do NOT proceed to the next step until the current step is implemented, verified, and tested.**
> **Steps marked 🧑‍💻 HUMAN require your manual verification in VS Code.**
> **Steps marked 🤖 CASCADE are implemented by the AI assistant.**
> **Steps marked 🧪 TEST require running a specific test command.**

---

# ══════════════════════════════════════════════════════════
# PHASE 1: PROJECT FOUNDATION
# Goal: A working VS Code extension with a React sidebar that sends/receives messages
# Estimated: Steps 1.1–1.20
# ══════════════════════════════════════════════════════════

## 1.1 — Initialize the Extension Project

### Step 1.1.1 🤖 CASCADE — Create project directory structure
- [ ] Create `visual-score/` root directory
- [ ] Create `visual-score/src/` for extension source
- [ ] Create `visual-score/src/core/` for agent logic
- [ ] Create `visual-score/src/shared/` for shared types
- [ ] Create `visual-score/webview-ui/` for React app
- **Verify:** All directories exist

### Step 1.1.2 🤖 CASCADE — Create `package.json` (Extension Manifest)
- [ ] Create `visual-score/package.json` with:
  - `name`: `"visual-score"`
  - `displayName`: `"Visual Score AI Agent"`
  - `description`: `"AI-agentic coding assistant for VS Code"`
  - `version`: `"0.1.0"`
  - `engines.vscode`: `"^1.85.0"`
  - `categories`: `["AI", "Programming Languages", "Chat"]`
  - `activationEvents`: `["onView:visualScore.chatView"]`
  - `main`: `"./out/extension.js"`
  - `contributes.viewsContainers.activitybar`: Register sidebar icon
  - `contributes.views.visualScorePanel`: Register webview view
  - `contributes.commands`: Register `visualScore.newChat` command
  - `contributes.configuration`: Settings for API keys, model selection
- **Verify:** `package.json` is valid JSON, all fields present

### Step 1.1.3 🤖 CASCADE — Create `tsconfig.json`
- [ ] Create `visual-score/tsconfig.json` with:
  - `target`: `"ES2022"`
  - `module`: `"Node16"`
  - `moduleResolution`: `"Node16"`
  - `outDir`: `"./out"`
  - `rootDir`: `"./src"`
  - `strict`: `true`
  - `esModuleInterop`: `true`
  - `skipLibCheck`: `true`
  - `exclude`: `["webview-ui"]`
- **Verify:** No TypeScript errors when compiling

### Step 1.1.4 🤖 CASCADE — Create `esbuild.mjs` (Extension Bundler)
- [ ] Create `visual-score/esbuild.mjs` with:
  - Entry point: `./src/extension.ts`
  - Output: `./out/extension.js`
  - Format: `cjs` (VS Code requires CommonJS)
  - Platform: `node`
  - External: `["vscode"]`
  - Bundle: `true`
  - Sourcemap: `true`
  - Watch mode support via CLI flag
- **Verify:** Running `node esbuild.mjs` produces `out/extension.js`

### Step 1.1.5 🤖 CASCADE — Install extension dependencies
- [ ] Run `npm init -y` (if package.json needs adjusting)
- [ ] Install dev dependencies:
  - `@types/vscode` — VS Code API types
  - `@types/node` — Node.js types
  - `esbuild` — Bundler
  - `typescript` — TypeScript compiler
- **Verify:** `node_modules/` exists, no install errors

### Step 1.1.6 🤖 CASCADE — Create `.vscodeignore`
- [ ] Create `visual-score/.vscodeignore` excluding:
  - `src/`, `webview-ui/src/`, `node_modules/`, `.gitignore`, `tsconfig.json`, `esbuild.mjs`
- **Verify:** File exists

### Step 1.1.7 🤖 CASCADE — Create `.gitignore`
- [ ] Ignore: `node_modules/`, `out/`, `webview-ui/dist/`, `*.vsix`, `.env`
- **Verify:** File exists

---

## 1.2 — Extension Entry Point

### Step 1.2.1 🤖 CASCADE — Create `src/extension.ts`
- [ ] Implement `activate(context: vscode.ExtensionContext)` function:
  - Log `"Visual Score AI Agent is now active!"` to output channel
  - Create an output channel: `vscode.window.createOutputChannel("Visual Score")`
  - Register the WebviewViewProvider (placeholder for now)
  - Register the `visualScore.newChat` command
- [ ] Implement `deactivate()` function (empty for now)
- [ ] Export both functions
- **Verify:** No TypeScript compilation errors

### Step 1.2.2 🧪 TEST — Compile and verify no errors
- [ ] Run: `npx tsc --noEmit` — should produce 0 errors
- [ ] Run: `node esbuild.mjs` — should produce `out/extension.js`
- **Verify:** Both commands succeed with exit code 0

### Step 1.2.3 🧑‍💻 HUMAN — Test extension loads in VS Code
- [ ] Press `F5` in VS Code (or run "Run Extension" launch config)
- [ ] A new Extension Development Host window should open
- [ ] Check Output panel → "Visual Score" channel shows activation message
- [ ] Check Activity Bar for the Visual Score icon
- **If it fails:** Check `package.json` activation events and `main` path

---

## 1.3 — Launch Configuration

### Step 1.3.1 🤖 CASCADE — Create `.vscode/launch.json`
- [ ] Create `visual-score/.vscode/launch.json` with:
  - Configuration: "Run Extension"
  - Type: `extensionHost`
  - Request: `launch`
  - `runtimeExecutable`: `"${execPath}"`
  - `args`: `["--extensionDevelopmentPath=${workspaceFolder}"]`
  - `outFiles`: `["${workspaceFolder}/out/**/*.js"]`
  - `preLaunchTask`: `"npm: watch"` (or esbuild watch)
- **Verify:** F5 launches Extension Development Host

### Step 1.3.2 🤖 CASCADE — Create `.vscode/tasks.json`
- [ ] Create build task that runs esbuild in watch mode
- [ ] Create compile task for one-off builds
- **Verify:** Tasks appear in VS Code task runner

---

## 1.4 — Shared Type Definitions

### Step 1.4.1 🤖 CASCADE — Create `src/shared/MessageTypes.ts`
- [ ] Define `WebviewMessage` union type (all messages from webview → extension):
  ```typescript
  type WebviewMessage =
    | { type: 'sendMessage'; text: string; attachments?: string[] }
    | { type: 'cancelTask' }
    | { type: 'approveToolCall'; toolCallId: string }
    | { type: 'rejectToolCall'; toolCallId: string; reason?: string }
    | { type: 'newTask' }
    | { type: 'getState' }
    | { type: 'updateSettings'; settings: Partial<Settings> }
  ```
- [ ] Define `ExtensionMessage` union type (all messages from extension → webview):
  ```typescript
  type ExtensionMessage =
    | { type: 'addMessage'; message: ChatMessage }
    | { type: 'streamToken'; messageId: string; token: string }
    | { type: 'streamEnd'; messageId: string }
    | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
    | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
    | { type: 'requestApproval'; toolCall: ToolCallInfo }
    | { type: 'taskCompleted'; summary: string }
    | { type: 'taskError'; error: string }
    | { type: 'costUpdate'; tokensUsed: number; estimatedCost: number }
    | { type: 'stateUpdate'; state: UIState }
  ```
- [ ] Define `ChatMessage` interface:
  ```typescript
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: ToolCallInfo[];
    isStreaming?: boolean;
  }
  ```
- [ ] Define `ToolCallInfo`, `ToolResult`, `Settings`, `UIState` interfaces
- **Verify:** `npx tsc --noEmit` passes

### Step 1.4.2 🤖 CASCADE — Create `src/shared/constants.ts`
- [ ] Define:
  - `EXTENSION_ID = "visualScore"`
  - `VIEW_ID = "visualScore.chatView"`
  - `COMMAND_NEW_CHAT = "visualScore.newChat"`
  - `OUTPUT_CHANNEL_NAME = "Visual Score"`
- **Verify:** File compiles without errors

---

## 1.5 — Webview View Provider (Extension Side)

### Step 1.5.1 🤖 CASCADE — Create `src/core/webview/WebviewProvider.ts`
- [ ] Implement class `VisualScoreWebviewProvider` implementing `vscode.WebviewViewProvider`
- [ ] Constructor takes `extensionUri: vscode.Uri` and `extensionContext: vscode.ExtensionContext`
- [ ] Implement `resolveWebviewView(webviewView, context, token)`:
  - Set `webviewView.webview.options`:
    - `enableScripts: true`
    - `localResourceRoots`: `[extensionUri/webview-ui/dist]`
  - Set `webviewView.webview.html` = call `_getHtmlForWebview(webview)`
  - Set up message listener: `webviewView.webview.onDidReceiveMessage(message => this._handleMessage(message))`
  - Store reference to `webviewView` for sending messages back
- [ ] Implement `_getHtmlForWebview(webview: vscode.Webview): string`:
  - Generate nonce for Content Security Policy
  - Construct URI to `webview-ui/dist/index.js` and `webview-ui/dist/index.css`
  - Return HTML string with:
    - CSP meta tag allowing scripts from webview URI + nonce
    - Link to CSS file
    - `<div id="root"></div>`
    - Script tag with nonce loading the React bundle
- [ ] Implement `_handleMessage(message: WebviewMessage)`:
  - Switch on `message.type`
  - For `'sendMessage'`: log to output channel (placeholder)
  - For `'getState'`: send back current state
- [ ] Implement `postMessage(message: ExtensionMessage)`:
  - Call `this._view?.webview.postMessage(message)`
- **Verify:** TypeScript compiles, no errors

### Step 1.5.2 🤖 CASCADE — Register provider in `extension.ts`
- [ ] In `activate()`:
  ```typescript
  const provider = new VisualScoreWebviewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  ```
- [ ] Store provider reference for command handlers
- **Verify:** TypeScript compiles

---

## 1.6 — React Webview App Setup

### Step 1.6.1 🤖 CASCADE — Initialize React project in `webview-ui/`
- [ ] Create `webview-ui/package.json`:
  - Dependencies: `react`, `react-dom`
  - Dev dependencies: `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`
- [ ] Create `webview-ui/tsconfig.json`:
  - `target`: `"ES2020"`
  - `jsx`: `"react-jsx"`
  - `module`: `"ESNext"`
  - `moduleResolution`: `"bundler"`
  - `strict`: `true`
- [ ] Create `webview-ui/vite.config.ts`:
  - `plugins`: `[react()]`
  - `build.outDir`: `"dist"`
  - `build.rollupOptions.output`:
    - `entryFileNames`: `"index.js"` (single predictable filename)
    - `assetFileNames`: `"index.[ext]"` (single CSS file)
  - `build.cssCodeSplit`: `false`
- [ ] Create `webview-ui/postcss.config.js` with tailwind + autoprefixer
- [ ] Create `webview-ui/tailwind.config.ts`:
  - Content: `["./src/**/*.{ts,tsx}"]`
  - Theme: extend with VS Code CSS variables
- **Verify:** All config files are valid

### Step 1.6.2 🤖 CASCADE — Install webview-ui dependencies
- [ ] Run `npm install` inside `webview-ui/`
- **Verify:** No install errors, `node_modules/` created

### Step 1.6.3 🤖 CASCADE — Create webview entry files
- [ ] Create `webview-ui/index.html`:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
  </html>
  ```
- [ ] Create `webview-ui/src/main.tsx`:
  ```tsx
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App';
  import './styles/globals.css';
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
  ```
- [ ] Create `webview-ui/src/App.tsx`:
  ```tsx
  export default function App() {
    return <div className="p-4"><h1 className="text-lg font-bold">Visual Score AI Agent</h1><p>Chat will appear here.</p></div>;
  }
  ```
- [ ] Create `webview-ui/src/styles/globals.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  :root { /* VS Code theme variable mappings */ }
  body { background-color: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); padding: 0; margin: 0; }
  ```
- **Verify:** Files exist and are syntactically correct

### Step 1.6.4 🤖 CASCADE — Build the webview
- [ ] Run: `cd webview-ui && npx vite build`
- **Verify:** `webview-ui/dist/index.js` and `webview-ui/dist/index.css` exist

### Step 1.6.5 🧪 TEST — Full build pipeline
- [ ] Run from root: `cd webview-ui && npm run build && cd .. && node esbuild.mjs`
- **Verify:** Both `out/extension.js` and `webview-ui/dist/index.js` exist without errors

### Step 1.6.6 🧑‍💻 HUMAN — Verify sidebar renders in VS Code
- [ ] Press F5 to launch Extension Development Host
- [ ] Click the Visual Score icon in the Activity Bar
- [ ] Sidebar should show: "Visual Score AI Agent" heading + "Chat will appear here."
- [ ] Text should match VS Code theme colors (light/dark)
- **If blank white panel:** Check browser DevTools in webview (Help → Toggle Developer Tools → find the webview iframe) for CSP errors or missing files
- **If icon missing:** Check `package.json` contributes.viewsContainers and contributes.views

---

## 1.7 — Bidirectional Communication

### Step 1.7.1 🤖 CASCADE — Create `webview-ui/src/utils/vscodeApi.ts`
- [ ] Implement VS Code API wrapper:
  ```typescript
  interface VSCodeAPI { postMessage(message: any): void; getState(): any; setState(state: any): void; }
  const vscodeApi: VSCodeAPI = acquireVsCodeApi();
  export function postMessage(message: WebviewMessage): void { vscodeApi.postMessage(message); }
  export function onMessage(callback: (message: ExtensionMessage) => void): void {
    window.addEventListener('message', (event) => callback(event.data));
  }
  ```
- **Verify:** TypeScript compiles

### Step 1.7.2 🤖 CASCADE — Create `webview-ui/src/hooks/useVSCodeAPI.ts`
- [ ] Create React hook that:
  - Sets up `onMessage` listener in `useEffect`
  - Returns `{ postMessage }` for sending messages
  - Cleans up listener on unmount
- **Verify:** TypeScript compiles

### Step 1.7.3 🤖 CASCADE — Add test communication to `App.tsx`
- [ ] Add a button: "Send Test Message"
- [ ] On click: `postMessage({ type: 'sendMessage', text: 'Hello from webview!' })`
- [ ] Listen for `addMessage` from extension and display it
- **Verify:** Build succeeds

### Step 1.7.4 🤖 CASCADE — Handle test message in `WebviewProvider.ts`
- [ ] In `_handleMessage`: When receiving `sendMessage`, send back:
  ```typescript
  this.postMessage({ type: 'addMessage', message: {
    id: Date.now().toString(), role: 'assistant', content: `Echo: ${msg.text}`, timestamp: Date.now()
  }});
  ```
- **Verify:** TypeScript compiles

### Step 1.7.5 🧑‍💻 HUMAN — Verify two-way communication
- [ ] F5 → Open sidebar → Click "Send Test Message"
- [ ] Should see "Echo: Hello from webview!" appear in the panel
- [ ] Check Output channel for log messages
- **This is CRITICAL.** If this doesn't work, nothing else will. Debug thoroughly.
- **Common issues:**
  - CSP blocking scripts → check nonce in HTML + CSP header
  - `acquireVsCodeApi` not available → script must run inside webview, not in dev server
  - Message not received → check `onDidReceiveMessage` is wired up

---

## 1.8 — Basic Chat UI

### Step 1.8.1 🤖 CASCADE — Create `webview-ui/src/components/ChatPanel.tsx`
- [ ] Main chat container component with:
  - Scrollable message list area (flex-grow, overflow-y-auto)
  - Fixed input area at bottom
  - Auto-scroll to bottom on new messages
- **Verify:** Component renders without errors

### Step 1.8.2 🤖 CASCADE — Create `webview-ui/src/components/MessageBubble.tsx`
- [ ] Renders a single `ChatMessage`:
  - User messages: right-aligned, blue tint
  - Assistant messages: left-aligned, transparent
  - Show role label + timestamp
  - Content rendered as plain text (markdown later in Phase 7)
- **Verify:** Component renders without errors

### Step 1.8.3 🤖 CASCADE — Create `webview-ui/src/components/InputBox.tsx`
- [ ] Text input area (textarea, auto-resizing):
  - Enter to send (Shift+Enter for newline)
  - Send button (icon)
  - Placeholder: "Ask Visual Score anything..."
  - Disabled state when agent is processing
- **Verify:** Component renders, input captures text

### Step 1.8.4 🤖 CASCADE — Create `webview-ui/src/hooks/useChat.ts`
- [ ] Chat state management hook:
  ```typescript
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  ```
  - `sendMessage(text)`: Posts to extension, adds user message to list
  - Listens for `addMessage`, `streamToken`, `streamEnd` from extension
  - Handles streaming: creates message placeholder, appends tokens
- **Verify:** Hook compiles, state updates correctly

### Step 1.8.5 🤖 CASCADE — Wire up `App.tsx` with all components
- [ ] Replace placeholder with `ChatPanel` using `useChat` + `useVSCodeAPI`
- [ ] Remove test button
- **Verify:** Build succeeds

### Step 1.8.6 🧑‍💻 HUMAN — Verify chat UI
- [ ] F5 → Open sidebar
- [ ] Type a message and press Enter
- [ ] User message appears on the right
- [ ] Echo response appears on the left
- [ ] Multiple messages scroll correctly
- [ ] Input clears after sending
- [ ] Shift+Enter creates a newline (doesn't send)
- **If messages don't appear:** Check message types match between hook and extension

---

## PHASE 1 COMPLETE CHECKPOINT ✅
**At this point you should have:**
- A VS Code extension that activates and shows a sidebar
- A React-based chat UI in the sidebar
- Bidirectional postMessage communication working
- User can type messages and see echo responses
- All code compiles without errors

🧑‍💻 **HUMAN CHECKPOINT:** Please confirm all of the above work before we proceed to Phase 2.

---

# ══════════════════════════════════════════════════════════
# PHASE 2: LLM INTEGRATION & REAL CHAT
# Goal: User sends a message → LLM responds with streaming text
# ══════════════════════════════════════════════════════════

## 2.1 — LLM Provider Abstraction

### Step 2.1.1 🤖 CASCADE — Create `src/core/llm/types.ts`
- [ ] Define core LLM types:
  ```typescript
  interface LLMMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; }
  interface LLMToolDefinition { name: string; description: string; inputSchema: object; }
  interface LLMChunk { type: 'text' | 'tool_use' | 'stop'; text?: string; toolCall?: { id: string; name: string; arguments: Record<string, unknown> }; }
  interface LLMOptions { temperature?: number; maxTokens?: number; }
  interface LLMUsage { inputTokens: number; outputTokens: number; }
  ```
- **Verify:** Compiles

### Step 2.1.2 🤖 CASCADE — Create `src/core/llm/LLMProvider.ts` (Interface)
- [ ] Define abstract interface:
  ```typescript
  interface LLMProvider {
    readonly name: string;
    readonly modelId: string;
    readonly supportsNativeToolUse: boolean;
    stream(systemPrompt: string, messages: LLMMessage[], tools?: LLMToolDefinition[], options?: LLMOptions): AsyncGenerator<LLMChunk>;
    getUsage(): LLMUsage;
    resetUsage(): void;
  }
  ```
- **Verify:** Compiles

### Step 2.1.3 🤖 CASCADE — Create `src/core/llm/AnthropicProvider.ts`
- [ ] Install `@anthropic-ai/sdk` as a dependency
- [ ] Implement `AnthropicProvider` class:
  - Constructor takes `apiKey: string`, `model: string` (default `"claude-sonnet-4-20250514"`)
  - `stream()` method:
    - Creates `Anthropic` client
    - Converts our `LLMMessage[]` to Anthropic format
    - Calls `client.messages.stream(...)` with `system`, `messages`, `max_tokens`, `tools` (if any)
    - Yields `LLMChunk` for each event:
      - `content_block_delta` with `text_delta` → `{ type: 'text', text }`
      - `content_block_start` with `tool_use` → `{ type: 'tool_use', toolCall }`
      - `message_stop` → `{ type: 'stop' }`
    - Tracks token usage from `message.usage`
  - Handle API errors gracefully (invalid key, rate limit, etc.)
- **Verify:** Compiles (cannot test without API key yet)

### Step 2.1.4 🤖 CASCADE — Create `src/core/llm/OpenAIProvider.ts`
- [ ] Install `openai` as a dependency
- [ ] Implement `OpenAIProvider` class (same interface):
  - Constructor takes `apiKey`, `model` (default `"gpt-4o"`)
  - `stream()` method:
    - Converts messages to OpenAI format
    - Calls `client.chat.completions.create(...)` with `stream: true`
    - Yields `LLMChunk` for each chunk:
      - `delta.content` → `{ type: 'text', text }`
      - `delta.tool_calls` → `{ type: 'tool_use', toolCall }`
      - `finish_reason === 'stop'` → `{ type: 'stop' }`
    - Tracks token usage
- **Verify:** Compiles

### Step 2.1.5 🤖 CASCADE — Create `src/core/llm/ProviderFactory.ts`
- [ ] Factory function:
  ```typescript
  function createProvider(config: { provider: 'anthropic' | 'openai'; apiKey: string; model?: string }): LLMProvider
  ```
  - Switch on `config.provider` to create the right class
  - Throw meaningful error for unknown provider
- **Verify:** Compiles

---

## 2.2 — Settings & API Key Management

### Step 2.2.1 🤖 CASCADE — Add VS Code settings to `package.json`
- [ ] Under `contributes.configuration`:
  ```json
  {
    "title": "Visual Score AI Agent",
    "properties": {
      "visualScore.provider": { "type": "string", "enum": ["anthropic", "openai"], "default": "anthropic" },
      "visualScore.anthropicApiKey": { "type": "string", "default": "", "description": "Your Anthropic API key" },
      "visualScore.openaiApiKey": { "type": "string", "default": "", "description": "Your OpenAI API key" },
      "visualScore.model": { "type": "string", "default": "claude-sonnet-4-20250514" },
      "visualScore.maxTokens": { "type": "number", "default": 8192 }
    }
  }
  ```
- **Verify:** Settings appear in VS Code Settings UI under "Visual Score AI Agent"

### Step 2.2.2 🤖 CASCADE — Create `src/core/config/ConfigManager.ts`
- [ ] Class that reads VS Code settings:
  ```typescript
  class ConfigManager {
    getProvider(): string { return vscode.workspace.getConfiguration('visualScore').get('provider', 'anthropic'); }
    getApiKey(): string { /* read based on provider */ }
    getModel(): string { ... }
    getMaxTokens(): number { ... }
    onConfigChanged(callback): vscode.Disposable { ... }
  }
  ```
- **Verify:** Compiles, reads settings correctly

---

## 2.3 — Wire Up LLM to Chat Flow

### Step 2.3.1 🤖 CASCADE — Create `src/core/agent/AgentController.ts`
- [ ] Central orchestrator class:
  - Takes `WebviewProvider`, `ConfigManager` as dependencies
  - `handleUserMessage(text: string)` method:
    1. Post `addMessage` (user message) to webview
    2. Create LLM provider from config
    3. Create a simple system prompt: `"You are Visual Score, a helpful AI coding assistant."`
    4. Call `provider.stream(systemPrompt, messages)`
    5. For each `text` chunk: post `streamToken` to webview
    6. On completion: post `streamEnd` to webview
    7. Post `costUpdate` with token usage
  - Manages conversation history (array of `LLMMessage`)
  - `cancelTask()` method: aborts current stream
  - `newTask()` method: clears history
- **Verify:** Compiles

### Step 2.3.2 🤖 CASCADE — Update `WebviewProvider.ts` to use `AgentController`
- [ ] Create `AgentController` in constructor
- [ ] Route `sendMessage` to `agentController.handleUserMessage(text)`
- [ ] Route `cancelTask` to `agentController.cancelTask()`
- [ ] Route `newTask` to `agentController.newTask()`
- **Verify:** Compiles

### Step 2.3.3 🤖 CASCADE — Update `useChat.ts` to handle streaming
- [ ] On `streamToken`: Append token to the last assistant message's content
- [ ] On `streamEnd`: Mark message as no longer streaming
- [ ] On `costUpdate`: Update cost display
- [ ] Show a loading indicator while `isLoading === true`
- **Verify:** Build succeeds

### Step 2.3.4 🧑‍💻 HUMAN — Configure API Key
- [ ] Open VS Code Settings → Search "Visual Score"
- [ ] Enter your Anthropic API key (or OpenAI key)
- [ ] Select provider and model
- **Ask human:** "Please enter your API key in VS Code settings: Settings → Visual Score → Anthropic API Key. Then tell me it's done."

### Step 2.3.5 🧪 TEST — First real LLM conversation
- [ ] F5 → Open sidebar
- [ ] Type: "What is 2 + 2?"
- [ ] Assistant should stream a response character by character
- [ ] Response should be sensible (e.g., "4" or similar)
- [ ] Cost indicator should show token usage
- **Verify:** Streaming works, no errors in Output channel

### Step 2.3.6 🧪 TEST — Error handling
- [ ] Set an invalid API key → Send message → Should show friendly error message
- [ ] Remove API key entirely → Should prompt user to configure
- [ ] Send a very long message → Should handle gracefully
- **Verify:** No unhandled exceptions, user sees clear error messages

### Step 2.3.7 🧪 TEST — Cancel mid-stream
- [ ] Send a message that produces a long response (e.g., "Write a 500 word essay about TypeScript")
- [ ] Click cancel while streaming → Stream should stop
- [ ] Partial response should remain visible
- **Verify:** Stream stops cleanly, no errors

---

## 2.4 — Conversation Memory

### Step 2.4.1 🤖 CASCADE — Create `src/core/memory/ConversationMemory.ts`
- [ ] Class that manages message history:
  - `addMessage(message: LLMMessage)`
  - `getMessages(): LLMMessage[]`
  - `clear()`
  - `getTokenCount(): number` (rough estimate: chars / 4)
- **Verify:** Compiles

### Step 2.4.2 🤖 CASCADE — Integrate memory into `AgentController`
- [ ] Use `ConversationMemory` instead of raw array
- [ ] Pass full history to each LLM call
- **Verify:** Multi-turn conversation works (agent remembers previous messages)

### Step 2.4.3 🧪 TEST — Multi-turn conversation
- [ ] Ask: "My name is Alice"
- [ ] Then ask: "What is my name?"
- [ ] Agent should respond "Alice"
- **Verify:** Context is maintained across turns

---

## PHASE 2 COMPLETE CHECKPOINT ✅
**At this point you should have:**
- LLM provider abstraction (Anthropic + OpenAI)
- Streaming responses in the chat UI
- API key configuration via VS Code settings
- Conversation memory (multi-turn chat)
- Error handling for invalid keys
- Cancel mid-stream capability
- Cost tracking display

🧑‍💻 **HUMAN CHECKPOINT:** Please confirm all of the above work before we proceed to Phase 3.

---

# ══════════════════════════════════════════════════════════
# PHASE 3: TOOL SYSTEM — THE AGENTIC CORE
# Goal: Agent can use tools to read/write files, run commands, search code
# ══════════════════════════════════════════════════════════

## 3.1 — Tool Infrastructure

### Step 3.1.1 🤖 CASCADE — Create `src/core/tools/types.ts`
- [ ] Define:
  ```typescript
  interface Tool {
    name: string;
    description: string;
    parameterSchema: object; // JSON Schema
    requiresApproval: boolean;
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
  }
  interface ToolContext { workspaceRoot: string; outputChannel: vscode.OutputChannel; }
  interface ToolResult { success: boolean; output: string; error?: string; }
  ```
- **Verify:** Compiles

### Step 3.1.2 🤖 CASCADE — Create `src/core/tools/ToolRegistry.ts`
- [ ] Class that:
  - Stores tools in a `Map<string, Tool>`
  - `register(tool: Tool)`: Adds tool
  - `get(name: string): Tool | undefined`
  - `getAll(): Tool[]`
  - `getToolDefinitions(): LLMToolDefinition[]` — Generates LLM-compatible definitions
  - `getXMLToolDefinitions(): string` — Generates XML format for system prompt
- **Verify:** Compiles

### Step 3.1.3 🤖 CASCADE — Create `src/core/tools/ToolExecutor.ts`
- [ ] Class that:
  - Takes `ToolRegistry`, `PermissionManager` (placeholder for now)
  - `executeTool(name: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>`:
    1. Look up tool in registry
    2. Validate params against JSON schema (using `ajv` or manual check)
    3. Check permissions (placeholder: always allow for now)
    4. Execute tool
    5. Return result
    6. Handle errors: return `{ success: false, error: message }` instead of throwing
  - `executeBatch(toolCalls: ToolCall[]): Promise<ToolResult[]>`:
    - Group into parallelizable (reads) and sequential (writes)
    - Execute parallel group with `Promise.all`
    - Execute sequential group one by one
- **Verify:** Compiles

---

## 3.2 — Core Tools Implementation (One by One)

### Step 3.2.1 🤖 CASCADE — Implement `ReadFileTool`
- [ ] Create `src/core/tools/definitions/ReadFileTool.ts`:
  - **Name:** `read_file`
  - **Params:** `{ path: string }` (relative to workspace root)
  - **Logic:**
    - Resolve path relative to workspace root
    - Security check: path must be within workspace (no `../` escapes)
    - Read file using `vscode.workspace.fs.readFile(uri)`
    - Decode Uint8Array to string
    - Return file contents (truncate if > 100K chars with warning)
  - `requiresApproval: false`
- **Verify:** Compiles

### Step 3.2.2 🧪 TEST — ReadFileTool unit test
- [ ] Create `src/core/tools/__tests__/ReadFileTool.test.ts`:
  - Test: reads an existing file → returns content
  - Test: non-existent file → returns error
  - Test: path escape attempt (`../../etc/passwd`) → returns error
- [ ] Run: `npx vitest run src/core/tools/__tests__/ReadFileTool.test.ts`
- **Verify:** All tests pass

### Step 3.2.3 🤖 CASCADE — Implement `WriteFileTool`
- [ ] Create `src/core/tools/definitions/WriteFileTool.ts`:
  - **Name:** `write_to_file`
  - **Params:** `{ path: string, content: string }`
  - **Logic:**
    - Resolve + security check path
    - Create parent directories if needed (`vscode.workspace.fs.createDirectory`)
    - Write file (`vscode.workspace.fs.writeFile`)
    - Return success message with file path
  - `requiresApproval: true`
- **Verify:** Compiles

### Step 3.2.4 🤖 CASCADE — Implement `ReplaceInFileTool`
- [ ] Create `src/core/tools/definitions/ReplaceInFileTool.ts`:
  - **Name:** `replace_in_file`
  - **Params:** `{ path: string, diff: string }`
  - **Logic:**
    - Parse SEARCH/REPLACE blocks from `diff` parameter:
      ```
      <<<<<<< SEARCH
      [content to find]
      =======
      [content to replace with]
      >>>>>>> REPLACE
      ```
    - Read current file content
    - For each SEARCH/REPLACE block:
      - Find exact match of SEARCH content in file
      - Replace with REPLACE content
      - If SEARCH not found: return error with helpful message
    - Write modified content back
    - Return diff summary
  - `requiresApproval: true`
- **Verify:** Compiles

### Step 3.2.5 🧪 TEST — ReplaceInFileTool unit test
- [ ] Test: single SEARCH/REPLACE block works
- [ ] Test: multiple SEARCH/REPLACE blocks work
- [ ] Test: SEARCH content not found → error
- [ ] Test: empty REPLACE (deletion) works
- **Verify:** All tests pass

### Step 3.2.6 🤖 CASCADE — Implement `ExecuteCommandTool`
- [ ] Create `src/core/tools/definitions/ExecuteCommandTool.ts`:
  - **Name:** `execute_command`
  - **Params:** `{ command: string, requires_approval: boolean }`
  - **Logic:**
    - Use `child_process.spawn` with shell (not `vscode.window.createTerminal` — we need output capture)
    - Set CWD to workspace root
    - Capture stdout + stderr
    - Set timeout (60 seconds default)
    - Return combined output (truncate if > 50K chars)
    - Handle process exit codes
  - `requiresApproval: true` (always, regardless of `requires_approval` param — we enforce at permission layer)
- **Verify:** Compiles

### Step 3.2.7 🤖 CASCADE — Implement `SearchFilesTool`
- [ ] Create `src/core/tools/definitions/SearchFilesTool.ts`:
  - **Name:** `search_files`
  - **Params:** `{ path: string, regex: string, file_pattern?: string }`
  - **Logic:**
    - Use `vscode.workspace.findFiles` to get file list
    - For each file, read content and apply regex
    - Return matches with file path, line number, and matching line
    - Limit results (max 100 matches)
  - `requiresApproval: false`
- **Verify:** Compiles

### Step 3.2.8 🤖 CASCADE — Implement `ListFilesTool`
- [ ] Create `src/core/tools/definitions/ListFilesTool.ts`:
  - **Name:** `list_files`
  - **Params:** `{ path: string, recursive?: boolean }`
  - **Logic:**
    - Resolve path relative to workspace
    - If recursive: list all files (max depth 3, max 500 entries)
    - If not: list immediate children
    - Format as tree-like output with file/directory indicators
  - `requiresApproval: false`
- **Verify:** Compiles

### Step 3.2.9 🤖 CASCADE — Implement `ListCodeDefinitionsTool`
- [ ] Create `src/core/tools/definitions/ListCodeDefinitionsTool.ts`:
  - **Name:** `list_code_definition_names`
  - **Params:** `{ path: string }`
  - **Logic:**
    - Read file content
    - Use regex patterns to extract:
      - Function definitions (`function`, `const x = () =>`, `def`, etc.)
      - Class definitions (`class`, `interface`, `type`, `struct`)
      - Export statements
    - Return list of definitions with line numbers
    - (Note: tree-sitter integration is Phase 6 — regex is good enough for now)
  - `requiresApproval: false`
- **Verify:** Compiles

### Step 3.2.10 🤖 CASCADE — Implement `AskFollowUpTool`
- [ ] Create `src/core/tools/definitions/AskFollowUpTool.ts`:
  - **Name:** `ask_followup_question`
  - **Params:** `{ question: string }`
  - **Logic:**
    - Post question to webview as a special message type
    - Pause agent loop (wait for user response)
    - Return user's response text
  - `requiresApproval: false`
- **Verify:** Compiles

### Step 3.2.11 🤖 CASCADE — Implement `AttemptCompletionTool`
- [ ] Create `src/core/tools/definitions/AttemptCompletionTool.ts`:
  - **Name:** `attempt_completion`
  - **Params:** `{ result: string, command?: string }`
  - **Logic:**
    - Post completion message to webview
    - If `command` provided: show as a clickable button to run
    - Signal agent loop to stop
  - `requiresApproval: false`
- **Verify:** Compiles

---

## 3.3 — System Prompt Builder

### Step 3.3.1 🤖 CASCADE — Create `src/core/prompts/SystemPromptBuilder.ts`
- [ ] Class that constructs the full system prompt:
  - `build(context: PromptContext): string` method assembles:
    1. **Role & Identity**: "You are Visual Score, an expert AI coding assistant..."
    2. **Tool Use Format**: XML format specification
    3. **Tool Definitions**: Generated from ToolRegistry
    4. **Tool Use Guidelines**: Rules for using tools
    5. **System Info**: OS, shell, CWD, home directory
    6. **User Rules**: Contents of `.visualscorerules` if exists
    7. **Workspace Context**: File tree, active file, diagnostics
  - Each section clearly delimited with `====` separators
- **Verify:** Compiles, generates reasonable prompt

### Step 3.3.2 🤖 CASCADE — Create `src/core/prompts/SystemInfo.ts`
- [ ] Function that detects:
  - OS: `process.platform` → human-readable (Windows/macOS/Linux)
  - Shell: `process.env.SHELL` or `process.env.COMSPEC`
  - CWD: workspace folder path
  - Home: `os.homedir()`
- **Verify:** Returns correct values on your system

### Step 3.3.3 🤖 CASCADE — Create `src/core/prompts/ToolDefinitions.ts`
- [ ] Function that generates XML tool definitions from `ToolRegistry`:
  ```
  ## read_file
  Description: Read the contents of a file...
  Parameters:
  - path: (required) The path of the file to read...
  Usage:
  <read_file>
    <path>File path here</path>
  </read_file>
  ```
- [ ] Generate for ALL registered tools
- **Verify:** Output matches expected XML format

---

## 3.4 — XML Tool Call Parser

### Step 3.4.1 🤖 CASCADE — Create `src/core/agent/XMLToolParser.ts`
- [ ] Parser that extracts tool calls from LLM text output:
  - Regex-based parsing for XML tags: `<tool_name>...</tool_name>`
  - Extracts parameter values from nested tags
  - Handles multi-line content (important for `write_to_file` content)
  - Returns `{ name: string, parameters: Record<string, string> }[]`
  - Handles edge cases: incomplete XML (streaming), nested tags, escaped characters
- **Verify:** Compiles

### Step 3.4.2 🧪 TEST — XML parser tests
- [ ] Test: `<read_file><path>src/index.ts</path></read_file>` → correct parse
- [ ] Test: `<write_to_file><path>test.ts</path><content>const x = 1;\nconst y = 2;</content></write_to_file>` → correct parse
- [ ] Test: `<replace_in_file><path>test.ts</path><diff><<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE</diff></replace_in_file>` → correct parse
- [ ] Test: No tool call in text → returns empty array
- [ ] Test: Multiple tool calls in one response → returns all
- **Verify:** All tests pass

---

## 3.5 — The Agentic Loop

### Step 3.5.1 🤖 CASCADE — Create `src/core/agent/AgentLoop.ts`
- [ ] Implements the full ReAct loop:
  ```typescript
  async *run(task: string): AsyncGenerator<AgentEvent> {
    // 1. Build system prompt with tools
    // 2. Add user message to memory
    // 3. LOOP:
    //    a. Call LLM with system prompt + history
    //    b. Stream text tokens to UI
    //    c. Detect tool calls (native or XML)
    //    d. For each tool call:
    //       - Emit toolCallStarted event
    //       - Execute tool via ToolExecutor
    //       - Emit toolCallCompleted event
    //       - Add tool result to memory
    //    e. If no tool calls → break (task is done)
    //    f. If attempt_completion → break
    //    g. Loop back to 3a
    // 4. Emit taskCompleted
  }
  ```
  - Max iterations: 25 (prevent infinite loops)
  - Handle cancellation via AbortController
  - Handle errors at each step
- **Verify:** Compiles

### Step 3.5.2 🤖 CASCADE — Update `AgentController.ts` to use `AgentLoop`
- [ ] Replace simple LLM call with full `AgentLoop`
- [ ] Forward all `AgentEvent`s to webview
- **Verify:** Compiles

### Step 3.5.3 🤖 CASCADE — Update webview to display tool calls
- [ ] Create `webview-ui/src/components/ToolCallCard.tsx`:
  - Shows tool name, parameters, status (running/completed/failed)
  - Expandable to show full output
  - Visual indicators: 🔄 running, ✅ completed, ❌ failed
- [ ] Update `useChat.ts` to handle `toolCallStarted`, `toolCallCompleted` events
- [ ] Insert tool call cards inline in message flow
- **Verify:** Build succeeds

### Step 3.5.4 🧑‍💻 HUMAN — Register ALL tools in extension.ts
- [ ] In `activate()`:
  - Create ToolRegistry instance
  - Register all tools: ReadFile, WriteFile, ReplaceInFile, ExecuteCommand, SearchFiles, ListFiles, ListCodeDefinitions, AskFollowUp, AttemptCompletion
  - Pass registry to AgentController
- **Verify:** Compiles

### Step 3.5.5 🧪 TEST — Agent uses tools
- [ ] F5 → Open sidebar → Send: "List the files in the current project"
- [ ] Agent should:
  1. Think about what tool to use
  2. Use `list_files` tool (you should see a ToolCallCard)
  3. Receive the result
  4. Present a formatted response
- **Verify:** Tool call card appears, result is correct

### Step 3.5.6 🧪 TEST — Agent reads a file
- [ ] Send: "Read the package.json file and tell me the project name"
- [ ] Agent should use `read_file` → receive contents → answer correctly
- **Verify:** Correct file contents, correct answer

### Step 3.5.7 🧪 TEST — Agent writes a file
- [ ] Send: "Create a new file called test-output.txt with the content 'Hello from Visual Score!'"
- [ ] Agent should use `write_to_file`
- [ ] File should appear in workspace
- **Verify:** File exists with correct content

### Step 3.5.8 🧪 TEST — Agent runs a command
- [ ] Send: "Run 'echo hello world' in the terminal"
- [ ] Agent should use `execute_command`
- [ ] Output should show "hello world"
- **Verify:** Command executed, output captured

### Step 3.5.9 🧪 TEST — Agent does multi-step task
- [ ] Send: "List all TypeScript files in src/, then read the first one and summarize it"
- [ ] Agent should:
  1. Use `list_files` or `search_files`
  2. Use `read_file` on the first result
  3. Provide a summary
- **Verify:** Multi-step execution works, each tool call visible

### Step 3.5.10 🧪 TEST — Max iterations safety
- [ ] Ensure a pathological task doesn't loop forever
- [ ] After 25 iterations, agent should stop with a message
- **Verify:** Loop terminates

---

## PHASE 3 COMPLETE CHECKPOINT ✅
**At this point you should have:**
- 9 working tools (read, write, replace, execute, search, list, definitions, ask, complete)
- XML tool call parser for non-native models
- Full system prompt with tool definitions
- Agentic ReAct loop (LLM → tool → LLM → tool → ... → done)
- Tool call cards visible in UI
- Multi-step task execution
- Max iteration safety

🧑‍💻 **HUMAN CHECKPOINT:** Please test 5 different tasks and confirm all work before Phase 4.

---

# ══════════════════════════════════════════════════════════
# PHASE 4: CONTEXT & INTELLIGENCE
# Goal: Agent understands workspace, gathers smart context, manages token window
# ══════════════════════════════════════════════════════════

## 4.1 — Context Manager

### Step 4.1.1 🤖 CASCADE — Create `src/core/context/ContextManager.ts`
- [ ] Gathers all context tiers:
  - `gatherContext(): Promise<ContextPayload>`
  - Returns: `{ activeFile, fileTree, diagnostics, userRules }`
- **Verify:** Compiles

### Step 4.1.2 🤖 CASCADE — Create `src/core/context/ActiveEditorContext.ts`
- [ ] Reads from `vscode.window.activeTextEditor`:
  - File path, language ID
  - Full content or selection (if selection exists)
  - Cursor line number
- **Verify:** Returns correct data for the open file

### Step 4.1.3 🤖 CASCADE — Create `src/core/context/WorkspaceIndexer.ts`
- [ ] Builds a compact file tree (max depth 3):
  - Uses `vscode.workspace.findFiles('**/*', '**/node_modules/**')`
  - Formats as indented tree
  - Respects `.gitignore` patterns
  - Caches result (rebuild every 30 seconds or on file change)
- **Verify:** Returns correct tree structure

### Step 4.1.4 🤖 CASCADE — Create `src/core/context/DiagnosticsContext.ts`
- [ ] Reads from `vscode.languages.getDiagnostics()`:
  - Filters to errors and warnings only
  - Formats as: `file:line - [ERROR] message`
  - Limits to 50 most recent
- **Verify:** Returns current workspace errors

### Step 4.1.5 🤖 CASCADE — Create `src/core/prompts/UserRules.ts`
- [ ] Reads `.visualscorerules` from workspace root (if exists):
  - Returns content as string
  - Returns empty string if file doesn't exist
- **Verify:** Reads rules file correctly

### Step 4.1.6 🤖 CASCADE — Integrate context into SystemPromptBuilder
- [ ] Append context sections to system prompt:
  - `# ACTIVE FILE\n{{activeFile}}`
  - `# WORKSPACE STRUCTURE\n{{fileTree}}`
  - `# CURRENT ERRORS\n{{diagnostics}}`
  - `# USER RULES\n{{userRules}}`
- **Verify:** System prompt includes context

### Step 4.1.7 🧪 TEST — Context-aware responses
- [ ] Open a file with errors → Ask: "What errors are in my workspace?"
- [ ] Agent should report errors from diagnostics context
- [ ] Ask: "What file am I editing?" → Should know the active file
- **Verify:** Context is correctly fed to the LLM

---

## 4.2 — @Mentions Support

### Step 4.2.1 🤖 CASCADE — Create `src/core/context/MentionsParser.ts`
- [ ] Parses user input for @mentions:
  - `@file path/to/file` → Reads and includes file content
  - `@folder path/to/dir` → Lists and includes all files
  - `@problems` → Includes all diagnostics
  - `@url https://...` → Fetches URL content (using `https` module)
- [ ] Returns extracted mentions + cleaned user text
- **Verify:** Compiles

### Step 4.2.2 🤖 CASCADE — Integrate mentions into AgentController
- [ ] Before sending to LLM, parse mentions from user text
- [ ] Append mentioned content to the user message
- **Verify:** Compiles

### Step 4.2.3 🤖 CASCADE — Update InputBox to support @mention autocomplete
- [ ] Typing `@` triggers a dropdown with: file, folder, problems, url
- [ ] Selecting `@file` shows file picker
- [ ] Selected mention shown as a chip/tag in the input
- **Verify:** Build succeeds, UI works

### Step 4.2.4 🧪 TEST — @mentions work
- [ ] Type: `@file package.json What dependencies does this project use?`
- [ ] Agent should have package.json content in context and answer correctly
- **Verify:** Correct answer based on file content

---

## 4.3 — Token Counting & Context Window Management

### Step 4.3.1 🤖 CASCADE — Create `src/core/memory/ContextWindow.ts`
- [ ] Token counting:
  - Simple estimator: `Math.ceil(text.length / 4)` (good enough to start)
  - Calculate total tokens: system prompt + all messages + context
- [ ] Window management:
  - Max window size: configurable (default 100K for Claude, 128K for GPT-4o)
  - When approaching 80%: summarize old messages
  - Keep: first 2 messages (system context) + last 10 messages
  - Middle messages: concatenate and summarize via quick LLM call
- **Verify:** Token counting works, summarization triggers correctly

### Step 4.3.2 🧪 TEST — Long conversation handling
- [ ] Have a 20+ message conversation
- [ ] Verify agent still responds coherently
- [ ] Check token count stays within limits
- **Verify:** No context overflow errors

---

## PHASE 4 COMPLETE CHECKPOINT ✅
**At this point you should have:**
- Active editor context (file, cursor, selection)
- Workspace file tree in context
- Diagnostics (errors/warnings) in context
- .visualscorerules support
- @mentions (@file, @folder, @problems, @url)
- Token counting and context window management

🧑‍💻 **HUMAN CHECKPOINT:** Confirm context-aware features work.

---

# ══════════════════════════════════════════════════════════
# PHASE 5: SAFETY & PERMISSIONS
# Goal: Human-in-the-loop approval for dangerous operations
# ══════════════════════════════════════════════════════════

## 5.1 — Permission System

### Step 5.1.1 🤖 CASCADE — Create `src/core/permissions/PermissionManager.ts`
- [ ] Class that determines if a tool call needs approval:
  - `needsApproval(toolName: string, params: Record<string, unknown>): boolean`
  - Rules:
    - `read_file`, `list_files`, `search_files`, `list_code_definition_names` → **false** (safe)
    - `write_to_file`, `replace_in_file` → **true** (modifies files)
    - `execute_command` → **true** (runs commands)
    - `browser_action` → **true** (browser control)
    - `ask_followup_question`, `attempt_completion` → **false** (user interaction)
  - Override: check VS Code settings for auto-approve preferences
- **Verify:** Compiles

### Step 5.1.2 🤖 CASCADE — Create `src/core/permissions/AutoApproveRules.ts`
- [ ] Reads from VS Code settings:
  ```json
  "visualScore.autoApproveReads": true,
  "visualScore.autoApproveWrites": false,
  "visualScore.autoApproveCommands": [],
  "visualScore.neverAutoApprove": false
  ```
- **Verify:** Reads settings correctly

### Step 5.1.3 🤖 CASCADE — Create approval flow in AgentLoop
- [ ] When tool needs approval:
  1. Emit `requestApproval` event with tool details
  2. Pause the loop (await a Promise)
  3. WebviewProvider receives approval/rejection from UI
  4. Resolve the Promise with approval/rejection
  5. If approved: execute tool
  6. If rejected: send rejection reason to LLM as tool result
- **Verify:** Compiles

### Step 5.1.4 🤖 CASCADE — Create `webview-ui/src/components/ApprovalDialog.tsx`
- [ ] Renders when `requestApproval` message received:
  - Tool name + icon
  - Parameters displayed clearly (e.g., file path for write, command for execute)
  - For file writes: show diff preview (before/after)
  - For commands: show the exact command
  - Three buttons: ✅ Approve | ❌ Reject | 🔄 Always Allow (this tool)
- **Verify:** Build succeeds

### Step 5.1.5 🧪 TEST — Approval flow
- [ ] Ask agent to create a new file
- [ ] Approval dialog should appear showing the file path and content
- [ ] Click Approve → file gets created
- [ ] Ask agent to create another file → Click Reject → agent gets rejection message
- [ ] Agent should gracefully handle rejection (explain it was rejected)
- **Verify:** Full approval cycle works

### Step 5.1.6 🧪 TEST — Auto-approve settings
- [ ] Enable "auto-approve reads" in settings
- [ ] Ask agent to read a file → should not show approval dialog
- [ ] Ask agent to write a file → should show approval dialog
- **Verify:** Settings respected correctly

---

## 5.2 — Budget Controls

### Step 5.2.1 🤖 CASCADE — Add budget tracking to AgentController
- [ ] Track cumulative tokens used per task
- [ ] Add VS Code setting: `visualScore.maxBudgetPerTask` (default: $1.00)
- [ ] Estimate cost: `(inputTokens * inputPrice + outputTokens * outputPrice)`
- [ ] When approaching budget: warn user
- [ ] When exceeding budget: pause and ask for approval to continue
- **Verify:** Cost tracking accurate

### Step 5.2.2 🤖 CASCADE — Create `webview-ui/src/components/TaskHeader.tsx`
- [ ] Shows at top of chat:
  - Current task name/description
  - Token count: `12.5K / 100K`
  - Estimated cost: `$0.03`
  - Elapsed time
  - Cancel button
- **Verify:** Build succeeds, updates in real-time

---

## PHASE 5 COMPLETE CHECKPOINT ✅
**At this point you should have:**
- Human-in-the-loop approval for writes and commands
- Approval dialog with tool details and diff preview
- Auto-approve configuration
- "Always Allow" per-tool option
- Budget tracking and warnings
- Task header with cost/token display

🧑‍💻 **HUMAN CHECKPOINT:** Test the approval flow thoroughly. Try approve, reject, and always-allow for different tool types.

---

# ══════════════════════════════════════════════════════════
# PHASE 6: ADVANCED FEATURES
# Goal: Parallel execution, MCP, diffs, checkpoints, plan mode
# ══════════════════════════════════════════════════════════

## 6.1 — Diff View Integration

### Step 6.1.1 🤖 CASCADE — Create `src/core/diff/DiffViewProvider.ts`
- [ ] Before writing a file, show VS Code diff editor:
  - Read current file content (or empty for new files)
  - Create a virtual document with new content
  - Use `vscode.commands.executeCommand('vscode.diff', oldUri, newUri, title)`
  - User can review changes in the native diff editor
- **Verify:** Diff view opens for file modifications

### Step 6.1.2 🤖 CASCADE — Update WriteFileTool and ReplaceInFileTool
- [ ] Before writing: trigger diff view
- [ ] Show diff in approval dialog as well
- **Verify:** Diffs visible in both VS Code editor and webview

---

## 6.2 — Git Checkpoint System

### Step 6.2.1 🤖 CASCADE — Create `src/core/agent/CheckpointManager.ts`
- [ ] Before each task:
  - Create a git stash or lightweight tag: `visual-score-checkpoint-{timestamp}`
  - Store checkpoint metadata (task description, files modified)
- [ ] Restore checkpoint:
  - `git stash pop` or `git checkout` to restore files
- [ ] List checkpoints for the current session
- **Verify:** Checkpoints created and restorable

### Step 6.2.2 🤖 CASCADE — Add checkpoint UI to webview
- [ ] "Undo" button on each tool call card
- [ ] "Restore to checkpoint" in TaskHeader
- **Verify:** Build succeeds

---

## 6.3 — Plan Mode vs Act Mode

### Step 6.3.1 🤖 CASCADE — Implement mode toggle
- [ ] Add a toggle button in the chat UI: "Plan" / "Act"
- [ ] In Plan Mode: system prompt says "Do NOT use tools. Discuss and plan only."
- [ ] In Act Mode: full tool access (default)
- [ ] Agent behavior changes based on mode
- **Verify:** Mode switch works, agent respects mode

---

## 6.4 — Parallel Tool Execution (Batch Reads)

### Step 6.4.1 🤖 CASCADE — Update ToolExecutor for parallel execution
- [ ] When native `tool_use` returns multiple tool calls:
  - Classify each as parallelizable (reads) or sequential (writes)
  - Execute all reads in parallel with `Promise.all`
  - Execute writes sequentially
- [ ] Update prompt to encourage batching: "You can request multiple read operations in a single response"
- **Verify:** Multiple reads execute simultaneously

---

## 6.5 — MCP Client Integration

### Step 6.5.1 🤖 CASCADE — Create `src/core/mcp/MCPClientManager.ts`
- [ ] Install `@modelcontextprotocol/sdk`
- [ ] Read MCP server configuration from VS Code settings or `.vscode/mcp.json`
- [ ] Connect to configured MCP servers
- [ ] Discover available tools from each server
- [ ] Register MCP tools in our ToolRegistry
- **Verify:** Connects to a test MCP server

### Step 6.5.2 🤖 CASCADE — Create `use_mcp_tool` and `access_mcp_resource` tools
- [ ] Bridge between our tool system and MCP protocol
- **Verify:** MCP tools callable from agent

---

## 6.6 — Additional LLM Providers

### Step 6.6.1 🤖 CASCADE — Create `src/core/llm/OpenRouterProvider.ts`
- [ ] OpenRouter API (OpenAI-compatible format)
- [ ] Add to settings: `visualScore.openrouterApiKey`, `visualScore.openrouterModel`
- **Verify:** Works with OpenRouter models

### Step 6.6.2 🤖 CASCADE — Create `src/core/llm/OllamaProvider.ts`
- [ ] Local Ollama API (`http://localhost:11434/api/chat`)
- [ ] Streaming support
- [ ] XML-only tool calling (Ollama doesn't support native tool_use for most models)
- **Verify:** Works with a local Ollama model

---

## PHASE 6 COMPLETE CHECKPOINT ✅
🧑‍💻 **HUMAN CHECKPOINT:** Test advanced features. Verify diffs, checkpoints, plan mode, and MCP if you have a server.

---

# ══════════════════════════════════════════════════════════
# PHASE 7: POLISH & SHIP
# Goal: Production-quality UI, error handling, packaging
# ══════════════════════════════════════════════════════════

## 7.1 — Rich Markdown Rendering

### Step 7.1.1 🤖 CASCADE — Install markdown dependencies in webview-ui
- [ ] `react-markdown`, `remark-gfm`, `rehype-highlight`
- **Verify:** Installed

### Step 7.1.2 🤖 CASCADE — Update MessageBubble to render markdown
- [ ] Code blocks with syntax highlighting
- [ ] Tables, lists, bold, italic, links
- [ ] Inline code with monospace font
- [ ] Copy button on code blocks
- **Verify:** Markdown renders beautifully

---

## 7.2 — Theme-Aware Styling

### Step 7.2.1 🤖 CASCADE — Map VS Code CSS variables
- [ ] Use `--vscode-editor-background`, `--vscode-editor-foreground`
- [ ] Use `--vscode-button-background`, `--vscode-button-foreground`
- [ ] Use `--vscode-input-background`, `--vscode-input-foreground`
- [ ] Test in Light, Dark, and High Contrast themes
- **Verify:** Looks good in all three themes

---

## 7.3 — Error Handling & Edge Cases

### Step 7.3.1 🤖 CASCADE — Comprehensive error handling
- [ ] API timeout → retry with exponential backoff (max 3 retries)
- [ ] Rate limit (429) → show "Rate limited, waiting X seconds..."
- [ ] Network error → show "Check your internet connection"
- [ ] Invalid API key → show "Please check your API key in settings"
- [ ] Tool execution timeout → return timeout error to LLM
- [ ] LLM returns malformed tool call → return parse error to LLM
- **Verify:** Each error scenario handled gracefully

---

## 7.4 — Keyboard Shortcuts

### Step 7.4.1 🤖 CASCADE — Add keybindings to package.json
- [ ] `Ctrl+Shift+I` (or `Cmd+Shift+I`): Open Visual Score sidebar
- [ ] `Ctrl+L` (in sidebar): Focus chat input
- [ ] `Escape`: Cancel current task
- **Verify:** Keybindings work

---

## 7.5 — Extension Icon & Branding

### Step 7.5.1 🤖 CASCADE — Create extension icon
- [ ] Create `visual-score/resources/icon.png` (128x128 or 256x256)
- [ ] Reference in `package.json`: `"icon": "resources/icon.png"`
- [ ] Create activity bar icon (SVG): `resources/sidebar-icon.svg`
- **Verify:** Icons display correctly

---

## 7.6 — README & Documentation

### Step 7.6.1 🤖 CASCADE — Create comprehensive README.md
- [ ] Feature overview with screenshots
- [ ] Installation instructions
- [ ] Configuration guide (API keys, models, settings)
- [ ] Available tools documentation
- [ ] .visualscorerules file format
- [ ] Keyboard shortcuts
- [ ] FAQ / Troubleshooting
- **Verify:** README is complete and accurate

---

## 7.7 — Packaging & Distribution

### Step 7.7.1 🤖 CASCADE — Create build scripts
- [ ] Add to `package.json` scripts:
  ```json
  "vscode:prepublish": "npm run build",
  "build": "cd webview-ui && npm run build && cd .. && node esbuild.mjs --production",
  "watch": "node esbuild.mjs --watch",
  "package": "npx @vscode/vsce package"
  ```
- **Verify:** `npm run build` succeeds

### Step 7.7.2 🧪 TEST — Package as .vsix
- [ ] Run: `npx @vscode/vsce package`
- [ ] Should produce `visual-score-0.1.0.vsix`
- **Verify:** .vsix file exists

### Step 7.7.3 🧑‍💻 HUMAN — Install and test .vsix
- [ ] Install: `code --install-extension visual-score-0.1.0.vsix`
- [ ] Open a project → Open Visual Score sidebar → Have a full conversation
- [ ] Verify all features work outside of development mode
- **Verify:** Extension works in production mode

---

## PHASE 7 COMPLETE — PROJECT SHIPPED ✅

---

# ══════════════════════════════════════════════════════════
# TESTING CHECKLIST (Run before each phase completion)
# ══════════════════════════════════════════════════════════

## Automated Tests
- [ ] `npx tsc --noEmit` — No TypeScript errors
- [ ] `npx vitest run` — All unit tests pass
- [ ] `cd webview-ui && npx tsc --noEmit` — No webview TypeScript errors
- [ ] `npm run build` — Full build succeeds

## Manual Integration Tests
- [ ] Extension activates without errors
- [ ] Sidebar renders correctly
- [ ] Chat sends and receives messages
- [ ] Streaming works (tokens appear one by one)
- [ ] Tool calls execute and show results
- [ ] Approval dialogs appear for writes/commands
- [ ] Cancel stops the agent mid-task
- [ ] New Task clears conversation
- [ ] Multiple consecutive tasks work
- [ ] Settings changes take effect immediately
- [ ] Works in Light, Dark, and High Contrast themes
- [ ] No memory leaks after extended use (check VS Code memory)

## Edge Case Tests
- [ ] Empty message → handled (don't send)
- [ ] Very long message (10K chars) → handled
- [ ] Rapid multiple sends → queued or handled
- [ ] Extension host restart → webview reconnects
- [ ] No workspace open → graceful degradation
- [ ] Large file read (>1MB) → truncated with warning
- [ ] Binary file read → error message
- [ ] Permission denied on file → error message
- [ ] No internet → clear error message
