# MitraHelix AI Agent — Project Progress Document

> **Purpose**: Reference this document at the start of any new agent session so the AI understands the full project state, architecture, and what has been built.

---

## 1. Project Goal

Build a **production-quality VS Code extension** that provides an AI-agentic coding assistant (similar to Cline/Cursor) with:
- Multi-provider LLM support (Anthropic, OpenAI, Google Gemini, DeepSeek, OpenRouter, Ollama)
- 9 tools for file ops, commands, search, and code inspection
- Human-in-the-loop safety/approval system
- Streaming responses with cost tracking
- React-based webview chat UI with markdown rendering
- Conversation memory with intelligent compression

This is a **competition entry** — every detail must be correct and robust.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension runtime | VS Code Extension API, TypeScript, Node16 modules |
| Extension bundler | esbuild (`esbuild.mjs`) |
| Webview UI | React 18 + TailwindCSS + Vite |
| Markdown rendering | react-markdown + remark-gfm + rehype-highlight |
| Icons | lucide-react |
| LLM SDKs | @anthropic-ai/sdk ^0.32.0, openai ^4.70.0 |
| Target | VS Code ^1.85.0, ES2022 |

---

## 3. Project Structure

```
mitra-helix/
├── src/                          # Extension (TypeScript, Node16)
│   ├── extension.ts              # Activation entry point
│   ├── core/
│   │   ├── agent/
│   │   │   ├── AgentController.ts    # Orchestrator: user messages, approval, cost, provider cache
│   │   │   ├── AgentLoop.ts          # Core agentic loop: stream → parse → execute → repeat
│   │   │   └── XMLToolParser.ts      # Fallback XML tool call parser (for Ollama/non-native models)
│   │   ├── config/
│   │   │   └── ConfigManager.ts      # VS Code settings wrapper with change events
│   │   ├── context/
│   │   │   ├── ContextManager.ts     # Gathers all context into ContextPayload
│   │   │   ├── ActiveEditorContext.ts # Current open file content
│   │   │   ├── WorkspaceIndexer.ts   # File tree snapshot
│   │   │   ├── DiagnosticsContext.ts  # VS Code problems/diagnostics
│   │   │   └── MentionsParser.ts     # Parses @file, @folder, @problems, @url
│   │   ├── llm/
│   │   │   ├── LLMProvider.ts        # Interface: stream(), getUsage(), resetUsage()
│   │   │   ├── AnthropicProvider.ts  # Anthropic SDK streaming + message conversion
│   │   │   ├── OpenAIProvider.ts     # OpenAI SDK (also used for OpenRouter + Ollama)
│   │   │   ├── ProviderFactory.ts    # Creates provider from config
│   │   │   └── types.ts             # LLMMessage, LLMToolCall, LLMChunk, LLMUsage
│   │   ├── memory/
│   │   │   └── ConversationMemory.ts # Message store + smart compression
│   │   ├── permissions/
│   │   │   └── PermissionManager.ts  # Tool safety classification + auto-approve logic
│   │   ├── prompts/
│   │   │   ├── SystemPromptBuilder.ts # Assembles system prompt with context sections
│   │   │   └── SystemInfo.ts          # OS, shell, cwd info
│   │   ├── tools/
│   │   │   ├── ToolRegistry.ts       # Register/retrieve tools, generate native + XML defs
│   │   │   ├── ToolExecutor.ts       # Validates params, executes tools, logs errors
│   │   │   └── definitions/          # 9 tool implementations (see §5)
│   │   └── webview/
│   │       └── WebviewProvider.ts    # VS Code WebviewViewProvider, HTML shell, message bridge
│   └── shared/
│       ├── constants.ts              # MAX_ITERATIONS=25, MAX_FILE_SIZE=100K, etc.
│       ├── MessageTypes.ts           # All message interfaces (Webview ↔ Extension)
│       ├── ToolTypes.ts              # Tool, ToolParameterSchema, ToolContext, ToolResult
│       └── pathSecurity.ts           # isWithinWorkspace() — secure path validation
├── webview-ui/                    # React webview (Vite)
│   ├── src/
│   │   ├── main.tsx               # React entry, renders App
│   │   ├── App.tsx                # Wraps ChatPanel in ErrorBoundary
│   │   ├── hooks/
│   │   │   └── useChat.ts        # Central state hook: messages, cost, approval, mode
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx      # Main chat layout: messages list + input
│   │   │   ├── MessageBubble.tsx  # Renders user/assistant messages with markdown
│   │   │   ├── ToolCallCard.tsx   # Expandable card showing tool name, params, result
│   │   │   ├── ApprovalDialog.tsx # Approve/Reject buttons for dangerous tools
│   │   │   ├── InputBox.tsx       # Text input with send button
│   │   │   ├── TaskHeader.tsx     # Mode toggle, cost display, new chat/cancel buttons
│   │   │   └── ErrorBoundary.tsx  # Catches React render errors gracefully
│   │   └── utils/
│   │       └── vscodeApi.ts       # VS Code webview postMessage/onMessage wrappers
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── package.json                   # Extension manifest, commands, settings schema
├── tsconfig.json
├── esbuild.mjs                    # Extension bundler config
├── REVIEW.md                      # Detailed forensic review findings (11 rounds, 30 fixes)
└── TEST_PLAN.md                   # 63 manual test cases across 14 categories
```

---

## 4. Architecture & Data Flow

### 4.1 Message Flow (User → LLM → Tool → LLM)

```
User types message
    ↓
InputBox → postMessage({type:'sendMessage', text})
    ↓
WebviewProvider.handleMessage → AgentController.handleUserMessage(text)
    ↓
MentionsParser.parse(text) → extracts @file, @folder, @problems refs
    ↓
ContextManager.gatherContext() → {fileTree, activeFile, diagnostics, userRules}
    ↓
AgentController creates AgentLoop (provider, tools, memory, context, permissions)
    ↓
AgentLoop.run() — iterative loop (max 25 iterations):
    │
    ├─ 1. memory.compress(contextWindowSize) if tokens exceed limit
    ├─ 2. promptBuilder.build(context, mode, nativeToolUse)
    ├─ 3. provider.stream(systemPrompt, messages, tools, options)
    ├─ 4. Yield streamTokens as they arrive → webview updates live
    ├─ 5. Parse tool calls (native JSON from API, or XML fallback)
    ├─ 6. For each tool call:
    │      ├─ Check PermissionManager → auto-approve or request approval
    │      ├─ Yield requestApproval → webview shows Approve/Reject
    │      ├─ await approval promise
    │      ├─ Execute tool via ToolExecutor
    │      └─ Add tool result to memory
    ├─ 7. Check budget (abort if exceeded)
    └─ 8. Loop back to step 1 (LLM sees tool results, decides next action)
    │
    ├─ Exit: attempt_completion tool → taskCompleted
    ├─ Exit: ask_followup_question → wait for user
    ├─ Exit: no tool calls → agent done speaking
    └─ Exit: abort signal → cancelled
```

### 4.2 Provider Architecture

```
LLMProvider (interface)
    ├── AnthropicProvider   — uses @anthropic-ai/sdk, native tool_use
    └── OpenAIProvider      — uses openai SDK, configurable nativeToolUse
        ├── OpenAI direct   — nativeToolUse=true
        ├── OpenRouter      — nativeToolUse=true, custom baseURL
        └── Ollama          — nativeToolUse=false (uses XML fallback)
```

**Key**: Ollama uses the OpenAI-compatible API but with `nativeToolUse=false`, so the SystemPromptBuilder includes full XML tool definitions in the system prompt and XMLToolParser extracts tool calls from the response text.

### 4.3 Approval Flow

```
AgentLoop detects tool call needs approval
    ↓
yield {type:'requestApproval', toolCall, resolve}
    ↓
AgentController stores resolve in pendingApprovals map, posts to webview
    ↓
Webview shows ApprovalDialog with Approve/Reject buttons
    ↓
User clicks → postMessage({type:'approveToolCall', toolCallId})
    ↓
AgentController.approveToolCall → calls stored resolve(true)
    → which calls AgentLoop.resolveApproval → resolves the await
    ↓
Tool executes
```

### 4.4 Memory Compression

When token estimate exceeds `contextWindowSize`:
1. Keep first N messages (user + assistant + their tool results)
2. Keep last ~30% of messages (recent context)
3. Compress middle into a summary message (role: 'user' with SYSTEM prefix)
4. Boundary protection ensures:
   - No orphaned tool_use without tool_result (Anthropic requirement)
   - No consecutive user messages (Anthropic alternation requirement)

### 4.5 Anthropic Message Conversion

Critical contract: Anthropic requires strict **alternating user/assistant** messages.

The `convertMessages()` method in `AnthropicProvider.ts` handles:
- `tool` role messages → `{role:'user', content:[{type:'tool_result'}]}`
- **Consecutive tool results merged** into single user message (multi-tool support)
- **Consecutive user messages merged** into array content (post-completion + user follow-up)
- Empty assistant messages get placeholder text block
- `system` role messages are skipped (system prompt passed separately)

---

## 5. Tools Implemented (9 total)

| Tool | File | Approval | Description |
|------|------|----------|-------------|
| `read_file` | `ReadFileTool.ts` | Auto (read) | Read file contents, truncated at 100K chars |
| `write_to_file` | `WriteFileTool.ts` | Required | Create/overwrite file with full content |
| `replace_in_file` | `ReplaceInFileTool.ts` | Required | SEARCH/REPLACE blocks for targeted edits |
| `execute_command` | `ExecuteCommandTool.ts` | Required | Run CLI commands (PowerShell/bash), 60s timeout |
| `search_files` | `SearchFilesTool.ts` | Auto (read) | Regex search across workspace files |
| `list_files` | `ListFilesTool.ts` | Auto (read) | Directory listing (recursive/flat) |
| `list_code_definition_names` | `ListCodeDefinitionsTool.ts` | Auto (read) | Extract class/function/interface names from files |
| `ask_followup_question` | `AskFollowUpTool.ts` | None | Ask user for clarification, pauses agent loop |
| `attempt_completion` | `AttemptCompletionTool.ts` | None | Declare task complete with summary |

All file-access tools validate paths with `isWithinWorkspace()` to prevent path traversal.

---

## 6. Configuration (VS Code Settings)

Defined in `package.json` contributes.configuration, accessed via `ConfigManager`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mitraHelix.provider` | enum | `anthropic` | LLM provider |
| `mitraHelix.anthropicApiKey` | string | `""` | Anthropic API key |
| `mitraHelix.openaiApiKey` | string | `""` | OpenAI API key |
| `mitraHelix.openrouterApiKey` | string | `""` | OpenRouter API key |
| `mitraHelix.googleApiKey` | string | `""` | Google Gemini API key |
| `mitraHelix.deepseekApiKey` | string | `""` | DeepSeek API key |
| `mitraHelix.ollamaBaseUrl` | string | `http://localhost:11434` | Ollama server URL |
| `mitraHelix.model` | string | `claude-sonnet-4-6` | Model ID |
| `mitraHelix.maxTokens` | number | `8192` | Max tokens per LLM response |
| `mitraHelix.maxBudgetPerTask` | number | `1.0` | Max USD per task (0 = unlimited) |
| `mitraHelix.autoApproveReads` | boolean | `true` | Auto-approve read tools |
| `mitraHelix.autoApproveWrites` | boolean | `false` | Auto-approve write tools |
| `mitraHelix.autoApproveCommands` | array | `[]` | Command prefixes to auto-approve |
| `mitraHelix.contextWindowSize` | number | `100000` | Max context tokens before compression |

---

## 7. Webview UI Components

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Root — wraps ChatPanel in ErrorBoundary |
| `ChatPanel.tsx` | Main layout: TaskHeader + scrollable message list + InputBox |
| `MessageBubble.tsx` | Renders messages with react-markdown (GFM + syntax highlighting) |
| `ToolCallCard.tsx` | Expandable card: tool name (with icon), params, status, result |
| `ApprovalDialog.tsx` | Warning-styled card with Approve/Reject buttons |
| `InputBox.tsx` | Textarea with send button, disabled during non-idle states |
| `TaskHeader.tsx` | Mode toggle (Act/Plan), cost display, New Chat + Cancel buttons |
| `ErrorBoundary.tsx` | Catches React crashes, shows "Try Again" |
| `useChat.ts` | Central hook: all state, message handler, actions (send/cancel/approve/reject/toggle) |

**Styling**: TailwindCSS with VS Code CSS variables (`var(--vscode-*)`) for theme integration.

---

## 8. Message Protocol (Extension ↔ Webview)

### Webview → Extension (`WebviewMessage`)
| Type | Payload | Trigger |
|------|---------|---------|
| `sendMessage` | `text`, `attachments?` | User sends message |
| `cancelTask` | — | Cancel button |
| `approveToolCall` | `toolCallId` | Approve button |
| `rejectToolCall` | `toolCallId` | Reject button |
| `newTask` | — | New Chat button |
| `toggleMode` | `mode: 'act'|'plan'` | Mode toggle |

### Extension → Webview (`ExtensionMessage`)
| Type | Payload | When |
|------|---------|------|
| `addMessage` | `ChatMessage` | New user/assistant message |
| `streamToken` | `messageId`, `token` | Each streaming chunk |
| `streamEnd` | `messageId` | Stream complete |
| `toolCallStarted` | `ToolCallInfo` | Tool execution begins |
| `toolCallCompleted` | `toolCallId`, `ToolResult` | Tool done |
| `requestApproval` | `ToolCallInfo` | Needs user approval |
| `taskCompleted` | `summary` | Agent finished |
| `taskError` | `error` | Error occurred |
| `costUpdate` | `CostInfo` | After each LLM call |
| `stateUpdate` | `AgentState` | State transition |
| `clearMessages` | — | New chat |

---

## 9. Key Constants (`shared/constants.ts`)

```typescript
MAX_ITERATIONS = 25       // Max agentic loop iterations per task
MAX_FILE_SIZE = 100_000   // Max chars to read from a file
MAX_COMMAND_OUTPUT = 50_000  // Max chars from command stdout
MAX_SEARCH_RESULTS = 100  // Max regex search matches
DEFAULT_COMMAND_TIMEOUT = 60_000  // 60s command timeout
```

---

## 10. Build & Run

```bash
# Install
npm install && cd webview-ui && npm install && cd ..

# Type check
npx tsc --noEmit

# Build extension
node esbuild.mjs

# Build webview
cd webview-ui && npx vite build && cd ..

# Full production build
npm run build

# Run in VS Code
# Press F5 in VS Code with the project open → Extension Development Host launches
```

---

## 11. Quality Assurance Done

### 11 Rounds of Forensic Code Review (see REVIEW.md for full details)

**30 bugs found and fixed**, including:

| Category | Count | Key Fixes |
|----------|-------|-----------|
| **Critical** | 11 | Cost double-counting, path traversal security, Anthropic consecutive user messages, compression orphaning tool results, cancel during approval hang |
| **Significant** | 12 | Memory compression order, config passthrough, concurrent loop corruption, abort missing tool results, token estimation |
| **Minor** | 7 | Unused imports, pendingApprovals cleanup, depth limit, ApprovalDialog TypeScript errors |

### Security Measures
- `isWithinWorkspace()` in all 7 file-access tools + MentionsParser (8 files)
- Handles path.resolve, separator-safe prefix matching, drive root edge case
- CSP on webview (script-src nonce, no inline scripts)
- Command execution sandboxed to workspace cwd
- File size and output truncation limits

### Test Coverage
- `TEST_PLAN.md`: 63 manual test cases across 14 categories
- Test workspace setup at `C:\temp\mitra-helix-test`

---

## 12. Known Limitations (Acceptable)

- API keys stored in VS Code settings (plain text) — would need SecretStorage for production
- Duplicate type definitions in `shared/` and `webview-ui/` (ToolCallInfo, ToolResult) — structural typing makes them compatible
- No explicit deactivation cleanup — VS Code kills the host process
- `highlight.js/styles/github-dark.css` bundled for code block syntax highlighting
- Webview JS bundle ~503KB (could be code-split but acceptable for extension)

---

## 13. New Features (v0.2)

### 13.1 Multi-Provider Model Catalog (25+ models)

New file: `src/core/llm/models.ts` — central registry with id, name, provider, contextWindow, pricing, toolSupport.

| Provider | Models | API |
|----------|--------|-----|
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus | Native SDK |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo, o3 Mini, o1, o1 Mini | Native SDK |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash | OpenAI-compatible (`generativelanguage.googleapis.com`) |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 | OpenAI-compatible (`api.deepseek.com`) |
| **OpenRouter** | Claude, GPT-4o, Gemini, Llama 3.1, Mistral Large, DeepSeek | OpenAI-compatible |
| **Ollama** | Llama 3.1, Code Llama, DeepSeek Coder V2, Qwen 2.5 Coder, Mistral | Local |

- Per-model cost estimation (replaces old per-provider hardcoded pricing)
- New settings: `mitraHelix.googleApiKey`, `mitraHelix.deepseekApiKey`

### 13.2 Model Selector UI

- Dropdown in TaskHeader shows all available models grouped by provider
- Context window size displayed for each model
- Current model highlighted with active selection style
- Model change updates VS Code settings and invalidates provider cache
- Message protocol: `modelCatalog` (Extension → Webview), `selectModel` (Webview → Extension)

### 13.3 Right Panel Chat

- New command: `mitraHelix.openPanel` — opens chat as a `WebviewPanel` in `ViewColumn.Beside`
- Keybinding: `Ctrl+Shift+L` / `Cmd+Shift+L`
- Both sidebar view and editor panel share the same AgentController
- Messages broadcast to both views simultaneously
- Panel retains context when hidden

### 13.4 Workflows & Slash Commands

- Workflow files: `.mitrahelix/workflows/*.md` with YAML frontmatter
- Format: `---\ndescription: ...\n---\n[workflow steps]`
- Slash command UI: type `/` in InputBox to see available workflows
- Filter workflows by name/description as you type
- On select, workflow instructions are prepended to the user's message
- New class: `WorkflowManager` (loads, parses, caches workflows)
- 3 sample workflows included: `/code-review`, `/add-tests`, `/refactor`

---

## 14. What's NOT Built Yet (Future Features)

- Diff view for file changes (showing before/after)
- Checkpoint/restore system (message types exist but not wired)
- Settings UI panel in webview
- Image attachment support
- Multi-file context from git diff
- Automated test suite (unit + integration)
- VSIX packaging and marketplace publishing
- SecretStorage for API keys
