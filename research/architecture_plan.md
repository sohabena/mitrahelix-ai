# MitraHelix AI Agent — Comprehensive Architecture & Implementation Plan

> **Project Name:** MitraHelix (originally "Visual Score")
> **Goal:** Build a competition-winning AI-agentic IDE chat extension for Visual Studio Code — a fully autonomous coding assistant that can read/write files, execute terminal commands, search code, and manage context intelligently, all with human-in-the-loop safety.

---

## IMPLEMENTATION STATUS (Updated after Phase A-E implementation pass)

| Planned Feature | Status | Notes |
|----------------|--------|-------|
| Custom Webview sidebar | **DONE** | React 18 + TailwindCSS + Vite |
| Chat Participant API | **SKIPPED** | Custom webview provides more control |
| Anthropic Provider | **DONE** | Native tool_use, streaming, is_error support |
| OpenAI Provider | **DONE** | Also handles Google, DeepSeek, OpenRouter, Ollama |
| OpenRouter Provider | **DONE** | Via OpenAI-compatible backend |
| Ollama Provider | **DONE** | XML tool fallback for non-native models |
| Google Gemini Provider | **DONE** | Via OpenAI-compatible API |
| DeepSeek Provider | **DONE** | Chat (native) + Reasoner (XML fallback) |
| 17 Core Tools | **DONE** | read, write, replace, execute, search, list, definitions, ask, complete, web_fetch, apply_patch, condense, new_rule, **plan_mode_respond, act_mode_respond, new_task, browser_action** |
| Browser Automation Tool | **DONE** | Puppeteer-based via Chrome DevTools Protocol (CDP) — launch, click, type, scroll, close with screenshots |
| Plan Mode Respond | **DONE** | Dedicated tool for plan mode — present options, wait for user feedback, YOLO auto-switch to act |
| Act Mode Respond | **DONE** | Non-blocking progress updates in act mode — consecutive-call prevention, anti-narration loop |
| New Task Tool | **DONE** | Agent can suggest starting a fresh task with context handoff |
| MCP Integration | **DONE** | MCPClientManager + MCPHub with auto-reconnection, stdio transport, tool/resource bridge |
| Parallel Tool Execution | **DONE** | ToolDependencyAnalyzer batches read-only tools for parallel execution |
| AST-Based Repo Map | **PARTIAL** | Regex-based (not tree-sitter) for TS/JS/Python/Go/Java |
| Diff View Integration | **DONE** | VS Code native side-by-side diff editor via TextDocumentContentProvider + accept/reject workflow |
| Git Checkpoints | **DONE** | ShadowGitCheckpointManager — shadow git repo, auto-commit before writes, restore by hash |
| JSON Checkpoints | **DONE** | CheckpointManager — JSON file snapshots as fallback when git is unavailable |
| Intelligent Context Compression | **DONE** | Smart 3-pass heuristic + LLM-based `condense` tool + **auto-condense** at 85% context window usage |
| Token Counting | **DONE** | js-tiktoken for accurate token counting |
| Plan/Act Modes | **DONE** | Dedicated plan_mode_respond/act_mode_respond tools, XML plan parser, PlanView UI, execute plan button, plan file persistence |
| Budget Controls | **DONE** | Per-task USD budget with enforcement and per-model pricing |
| Permission System | **DONE** | YOLO mode + granular per-tool-type auto-approve + **safe command detection** + **external path distinction** + shell operator detection |
| @Mentions | **DONE** | 7 types: file, folder, problems, url, git, terminal, selection |
| Rules System | **DONE** | 4 sources, YAML frontmatter, glob matching, 30KB budget + `new_rule` tool |
| Workflows | **DONE** | Slash commands, YAML frontmatter, file watchers |
| Custom Agent Modes | **DONE** | 6 built-in modes (Code/Plan/Architect/Ask/Debug/Review) + custom mode support |
| Hooks System | **DONE** | Lifecycle hooks for pre/post tool use, file write, command execution |
| Task Resume | **DONE** | Full conversation persist + resume from history with rebuilt memory |
| Task History | **DONE** | TaskHistoryManager with save, load, list, delete, export (markdown/JSON), resume |
| Settings UI | **DONE** | In-webview settings panel for API keys, model selection, budget, auto-approve |
| Thinking/Reasoning Display | **DONE** | Extract `<thinking>` blocks, render in collapsible ThinkingRow component |
| Inline Diff in Chat | **DONE** | Colored additions/deletions in ToolCallCard with "Full Diff" button |
| Web Fetch Tool | **DONE** | HTTP GET with HTML-to-markdown, SSRF protection, timeout, size limits |
| Apply Patch Tool | **DONE** | Unified diff format, create/modify/delete/rename operations |
| Theme-Aware UI | **DONE** | VS Code CSS variables throughout |
| Markdown Rendering | **DONE** | react-markdown + remark-gfm + rehype-highlight |
| Error Boundary | **DONE** | React ErrorBoundary with retry |
| Streaming Optimization | **DONE** | 50ms token buffer, React.memo on components |
| Model Catalog | **DONE** | 26 models across 6 providers with pricing |
| VSIX Packaging | **NOT DONE** | Build scripts exist but not published |

**Total: 200+ changes across 40+ forensic review rounds. Feature parity implementation complete for Phases A-F (including plan/act mode tools, browser automation, auto-condense, and enhanced auto-approve).**

---

## PART 1: COMPETITIVE LANDSCAPE DEEP RESEARCH

### 1.1 Cline (formerly Claude Dev) — The Gold Standard Open-Source Agent
**GitHub:** github.com/cline/cline | **5M+ installs** | **Apache-2.0**

**Architecture (from source code analysis):**
```
extension.ts (entry) → webview/ → controller/ → task/

src/core/
├── api/              # LLM provider abstraction (Anthropic, OpenAI, OpenRouter, Bedrock, etc.)
├── assistant-message/ # Parses XML tool calls from LLM responses
├── commands/          # VS Code command registrations
├── context/           # Workspace context gathering
├── controller/        # Message routing between webview ↔ task
├── hooks/             # Lifecycle hooks
├── ignore/            # .clineignore file handling
├── locks/             # Concurrency/state locks
├── mentions/          # @file, @folder, @url, @problems context injection
├── permissions/       # Human-in-the-loop approval system
├── prompts/           # System prompt construction (3 pillars)
├── slash-commands/    # /newtask and similar shortcuts
├── storage/           # Task history persistence
├── task/              # The agentic loop — API calls + tool execution
├── webview/           # WebviewViewProvider lifecycle
└── workspace/         # Workspace file operations
```

**System Prompt (~59K chars, ~12K tokens) — Three Pillars:**
1. **Tools** (largest section): 12 XML-formatted tool definitions with descriptions, parameters, usage examples
2. **System Information**: OS, shell, CWD, home directory
3. **User Preferences**: Custom rules, coding standards (`.clinerules`)

**Tool System (XML format — parsed from LLM text output):**
```xml
<tool_name>
  <parameter1>value1</parameter1>
  <parameter2>value2</parameter2>
</tool_name>
```

**12 Core Tools:**
| Tool | Purpose |
|------|---------|
| `execute_command` | Run CLI commands with approval flag |
| `read_file` | Read file contents (supports PDF/DOCX) |
| `write_to_file` | Create/overwrite entire files |
| `replace_in_file` | SEARCH/REPLACE block-based targeted edits |
| `search_files` | Regex search across files |
| `list_files` | Directory listing (recursive/shallow) |
| `list_code_definition_names` | Extract function/class AST definitions |
| `browser_action` | Puppeteer-based browser automation |
| `ask_followup_question` | Request clarification from user |
| `attempt_completion` | Signal task completion |
| `use_mcp_tool` | Call external MCP server tools |
| `access_mcp_resource` | Read MCP server resources |

**Key Design Decisions:**
- Sequential tool execution (one tool per LLM turn) — simple but slower
- Human-in-the-loop for EVERY file change and terminal command
- Uses `replace_in_file` with SEARCH/REPLACE blocks for targeted edits (avoids rewriting entire files)
- Act Mode vs Plan Mode — two operational modes
- Tracks token usage and API cost per task
- Checkpoints: git-based snapshots to compare and restore

**Weaknesses (from reverse-engineering analysis):**
- Sequential execution is slow compared to parallel approaches
- Simple context truncation (keeps beginning + end, drops middle) loses "why" behind decisions
- State management issues when multiple Cline windows are open

---

### 1.2 Claude Code — The Parallel Execution Pioneer

**Key Architectural Differences from Cline:**
- **Parallel tool execution**: Up to 10 file reads simultaneously, concurrent search + directory analysis + git history
- **Intelligent context compression**: Instead of truncating, creates AI-generated summaries preserving decision rationale
- **AI-powered relevance scoring**: Uses AI to score each piece of context against the current task (semantic similarity, import relationships, recent modifications)
- **AI security layer**: Reasons about novel threats instead of just pattern matching
- **Single-model focus**: Optimized specifically for Claude, enabling deeper integration
- **Dynamic task decomposition**: Breaks complex tasks into parallelizable sub-tasks

**Key Takeaway:** Parallel execution + intelligent context management = 3x+ performance gains.

---

### 1.3 Continue.dev — The Modular Multi-Mode Agent

**Architecture:** Highly modular, separates GUI from core logic
- **4 Modes**: Agent, Chat, Autocomplete, Edit
- **YAML Configuration**: `config.yaml` in repo for model/provider settings
- **AI Checks**: Source-controlled checks enforceable in CI (unique differentiator)
- **CLI Tool**: `cn` CLI for headless CI/CD mode
- **451+ contributors**, supports VS Code + JetBrains

**Key Takeaway:** Multi-mode approach (agent/chat/edit/autocomplete) covers different user needs. Configuration-as-code is powerful.

---

### 1.4 GitHub Copilot Chat — The Native Integration

**Architecture:**
- Uses VS Code's native **Chat Participant API** (`@participant` mentions)
- Uses **Language Model Tool API** for agent mode tool calling
- Uses **Language Model API** for direct model access
- Agent mode: Sends request + tool definitions to LLM → LLM returns tool calls → VS Code executes → iterates until resolved
- MCP server support for external tool integration

**Key Takeaway:** VS Code provides first-class APIs for building chat extensions. The Chat Participant API and Language Model Tool API are the "official" way, but Cline-style custom webviews give more UI control.

---

### 1.5 MuleSoft DevAgent — Enterprise Agentic Pattern

- Uses **MCP Protocol** to expose Anypoint Platform capabilities as tools
- Any VS Code-based AI-native IDE (Cursor, Windsurf, Trae) can consume these MCP tools
- Packages core IDE operations as MCP tools for natural language interaction

**Key Takeaway:** MCP is becoming the standard protocol for tool interoperability. Our extension should support MCP from day one.

---

### 1.6 Aider — The Repository Map Pioneer

- Creates a **repository map** (function signatures + file structures) as compressed context
- Uses **tree-sitter** for AST parsing to extract code definitions
- Edit format: Uses SEARCH/REPLACE blocks (similar to Cline's `replace_in_file`)
- Automatic git commits after each change
- Works with most LLMs including local models

**Key Takeaway:** Repository maps via AST parsing are a proven technique for fitting large codebases into context windows.

---

### 1.7 Void Editor — The Open-Source Cursor

- Fork of VS Code itself (not an extension)
- Agent Mode, Gather Mode, Normal Chat
- Supports any model via BYOK (Bring Your Own Key)

**Key Takeaway:** Forking VS Code gives maximum control but massive maintenance burden. Extension approach is better for distribution.

---

## PART 2: VS CODE EXTENSION API CAPABILITIES

### 2.1 Two Architectural Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Custom Webview** (Cline-style) | Full UI control, custom React app, works without Copilot | More code to write, no native chat integration |
| **Chat Participant API** (Copilot-style) | Native look & feel, @-mentioning, slash commands | Requires GitHub Copilot, less UI flexibility |

**Our Decision: Hybrid approach** — Build a **custom Webview sidebar** for full control AND optionally register as a **Chat Participant** for users who have Copilot. This gives us the best of both worlds.

### 2.2 Key VS Code APIs We Will Use

| API | Purpose |
|-----|---------|
| `vscode.window.registerWebviewViewProvider` | Sidebar chat panel |
| `vscode.workspace.fs` | File system operations (read/write/delete) |
| `vscode.window.createTerminal` + Shell Integration API | Terminal command execution with output capture |
| `vscode.languages.getDiagnostics` | Linter/compiler errors for auto-fix |
| `vscode.workspace.findFiles` | File discovery with glob patterns |
| `vscode.window.activeTextEditor` | Current file + cursor context |
| `vscode.workspace.applyEdit` | Programmatic text edits with undo support |
| `vscode.commands.executeCommand` | Trigger any VS Code command |
| `vscode.lm.registerTool` | Register tools for Copilot agent mode (optional) |
| `vscode.chat.createChatParticipant` | Register as @visualscore chat participant (optional) |

### 2.3 Webview ↔ Extension Communication

```
┌─────────────────────┐    postMessage()     ┌─────────────────────┐
│   React Webview UI  │ ──────────────────→  │  Extension Host     │
│   (Sidebar Panel)   │ ←──────────────────  │  (Node.js process)  │
│                     │    postMessage()     │                     │
│  • Chat messages    │                     │  • LLM API calls    │
│  • Tool approvals   │                     │  • Tool execution   │
│  • Settings UI      │                     │  • File system ops  │
│  • Diff views       │                     │  • Terminal control  │
│  • Markdown render  │                     │  • Context gathering│
└─────────────────────┘                     └─────────────────────┘
```

---

## PART 3: ARCHITECTURE DESIGN

### 3.1 High-Level Architecture

```
User ──→ [Webview UI (React)] ──postMessage──→ [Extension Host]
                                                      │
                                           ┌──────────┴──────────┐
                                           │   Agent Controller   │
                                           └──────────┬──────────┘
                                                      │
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
                    │  LLM Provider     │   │  Tool Executor     │   │  Context Manager  │
                    │  (Anthropic/      │   │  (12+ tools)       │   │  (Files, AST,     │
                    │   OpenAI/Local)   │   │                    │   │   Diagnostics)    │
                    └───────────────────┘   └────────────────────┘   └───────────────────┘
```

### 3.2 Core Components (Modular Design)

```
visual-score/
├── src/
│   ├── extension.ts                    # VS Code extension entry point
│   │
│   ├── core/
│   │   ├── agent/
│   │   │   ├── AgentController.ts      # Orchestrates the agentic loop
│   │   │   ├── AgentLoop.ts            # ReAct loop: LLM → Tool → LLM → ...
│   │   │   ├── TaskManager.ts          # Manages task lifecycle and state
│   │   │   └── types.ts               # Core type definitions
│   │   │
│   │   ├── llm/
│   │   │   ├── LLMProviderInterface.ts # Abstract interface for all providers
│   │   │   ├── AnthropicProvider.ts    # Claude API with streaming + tool_use
│   │   │   ├── OpenAIProvider.ts       # GPT-4o/o1 with function calling
│   │   │   ├── OpenRouterProvider.ts   # Multi-model via OpenRouter
│   │   │   ├── OllamaProvider.ts       # Local models via Ollama
│   │   │   └── ProviderFactory.ts      # Factory pattern for provider creation
│   │   │
│   │   ├── tools/
│   │   │   ├── ToolRegistry.ts         # Tool registration + lookup + validation
│   │   │   ├── ToolExecutor.ts         # Executes tools with error handling
│   │   │   ├── definitions/
│   │   │   │   ├── ReadFileTool.ts
│   │   │   │   ├── WriteFileTool.ts
│   │   │   │   ├── ReplaceInFileTool.ts
│   │   │   │   ├── ExecuteCommandTool.ts
│   │   │   │   ├── SearchFilesTool.ts
│   │   │   │   ├── ListFilesTool.ts
│   │   │   │   ├── ListCodeDefinitionsTool.ts
│   │   │   │   ├── BrowserActionTool.ts
│   │   │   │   ├── AskFollowUpTool.ts
│   │   │   │   └── AttemptCompletionTool.ts
│   │   │   └── schemas/               # JSON Schema for each tool's parameters
│   │   │
│   │   ├── context/
│   │   │   ├── ContextManager.ts       # Assembles context for LLM
│   │   │   ├── WorkspaceIndexer.ts     # File tree + AST-based repo map
│   │   │   ├── ActiveEditorContext.ts  # Current file, selection, cursor
│   │   │   ├── DiagnosticsContext.ts   # Linter/compiler errors
│   │   │   ├── MentionsParser.ts       # @file, @folder, @url, @problems
│   │   │   └── ContextCompressor.ts    # Intelligent context summarization
│   │   │
│   │   ├── prompts/
│   │   │   ├── SystemPromptBuilder.ts  # Constructs the 3-pillar system prompt
│   │   │   ├── ToolDefinitions.ts      # XML-format tool descriptions for prompt
│   │   │   ├── SystemInfo.ts           # OS, shell, CWD detection
│   │   │   └── UserRules.ts            # .visualscorerules file support
│   │   │
│   │   ├── memory/
│   │   │   ├── ConversationMemory.ts   # Message history management
│   │   │   ├── ContextWindow.ts        # Token counting + truncation strategy
│   │   │   └── TaskHistory.ts          # Persistent task storage
│   │   │
│   │   ├── permissions/
│   │   │   ├── PermissionManager.ts    # Human-in-the-loop approval system
│   │   │   ├── AutoApproveRules.ts     # Configurable auto-approve lists
│   │   │   └── SafetyGuard.ts          # Command safety classification
│   │   │
│   │   ├── mcp/
│   │   │   ├── MCPClientManager.ts     # MCP server connection management
│   │   │   ├── MCPToolBridge.ts        # Bridge MCP tools into our tool system
│   │   │   └── MCPResourceAccess.ts    # Read MCP server resources
│   │   │
│   │   └── diff/
│   │       ├── DiffEngine.ts           # Generate unified diffs
│   │       ├── SearchReplace.ts        # SEARCH/REPLACE block parsing + application
│   │       └── DiffViewProvider.ts     # VS Code diff editor integration
│   │
│   ├── webview/
│   │   ├── src/
│   │   │   ├── App.tsx                 # Root React component
│   │   │   ├── main.tsx                # React entry point
│   │   │   ├── components/
│   │   │   │   ├── ChatPanel.tsx        # Main chat interface
│   │   │   │   ├── MessageBubble.tsx    # Individual message rendering
│   │   │   │   ├── ToolCallCard.tsx     # Tool execution display + approval UI
│   │   │   │   ├── CodeBlock.tsx        # Syntax-highlighted code blocks
│   │   │   │   ├── DiffView.tsx         # Inline diff visualization
│   │   │   │   ├── InputBox.tsx         # Chat input with @mentions, /commands
│   │   │   │   ├── SettingsPanel.tsx    # API keys, model selection, preferences
│   │   │   │   ├── TaskHeader.tsx       # Current task info + cost tracker
│   │   │   │   ├── ContextChips.tsx     # Visual indicators for attached context
│   │   │   │   └── ApprovalDialog.tsx   # Approve/reject tool execution
│   │   │   ├── hooks/
│   │   │   │   ├── useVSCodeAPI.ts      # postMessage abstraction
│   │   │   │   ├── useChat.ts           # Chat state management
│   │   │   │   └── useStreaming.ts      # Handle streaming LLM responses
│   │   │   ├── styles/
│   │   │   │   └── globals.css          # Tailwind CSS + VS Code theme variables
│   │   │   └── utils/
│   │   │       ├── markdown.ts          # Markdown rendering with code highlighting
│   │   │       └── vscodeApi.ts         # acquireVsCodeApi() wrapper
│   │   ├── index.html
│   │   ├── vite.config.ts              # Vite build config for webview
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── shared/
│       ├── MessageTypes.ts             # Shared message type definitions
│       ├── ToolTypes.ts                # Shared tool-related types
│       └── constants.ts                # Shared constants
│
├── .visualscorerules                   # Default agent rules file
├── package.json                        # Extension manifest + contributes
├── tsconfig.json
├── esbuild.mjs                         # Extension host build (esbuild)
└── README.md
```

### 3.3 The Agentic Loop (Core Innovation)

This is the heart of our extension. Based on the ReAct (Reasoning + Acting) pattern:

```
┌──────────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                          │
│                                                          │
│  1. User sends task                                      │
│  2. ContextManager gathers: active file, workspace       │
│     structure, diagnostics, @mentions                    │
│  3. SystemPromptBuilder creates prompt with:             │
│     - Tool definitions (XML format)                      │
│     - System info (OS, shell, CWD)                       │
│     - User rules (.visualscorerules)                     │
│     - Gathered context                                   │
│  4. LLM receives: system prompt + conversation history   │
│     + user message                                       │
│  5. LLM responds with text AND/OR tool calls             │
│  6. Stream text to Webview in real-time                   │
│  7. For each tool call:                                  │
│     a. PermissionManager checks if approval needed       │
│     b. If needed → show ApprovalDialog in Webview        │
│     c. User approves/rejects                             │
│     d. ToolExecutor runs the tool                        │
│     e. Result sent back to LLM as next message           │
│  8. GOTO step 5 (loop until attempt_completion or error) │
│  9. Present final result to user                         │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Tool Calling Strategy: Dual-Format Support

We support **two** tool calling formats to maximize LLM compatibility:

**Format A — Native Function Calling (OpenAI/Anthropic `tool_use`):**
Used when the LLM API natively supports structured tool calls. The LLM returns JSON tool calls that we parse directly.

**Format B — XML Tool Calling (Cline-style, for any LLM):**
Used as a fallback for models that don't support native tool_use. The LLM outputs XML in its text response, and we parse it.

```xml
<read_file>
  <path>src/index.ts</path>
</read_file>
```

This dual-format approach means we work with **any** LLM — from Claude with native tool_use to local Ollama models using XML parsing.

### 3.5 Context Management Strategy

**Tier 1: Always Included**
- System prompt (tools + system info + user rules)
- Current conversation history (with intelligent compression)

**Tier 2: Automatically Gathered**
- Active editor file content + cursor position
- Workspace file tree (top 2 levels)
- Current diagnostics (errors/warnings)

**Tier 3: User-Requested (@mentions)**
- `@file path/to/file` — Include specific file content
- `@folder path/to/dir` — Include all files in directory
- `@url https://...` — Fetch and include URL content as markdown
- `@problems` — Include all workspace diagnostics

**Tier 4: Agent-Initiated (via tools)**
- Agent uses `read_file`, `search_files`, `list_files` during execution

**Context Window Management:**
- Track token count per message using `tiktoken`
- When approaching limit: Use **intelligent compression** (not simple truncation)
- Compress old conversation turns into summaries preserving key decisions
- Keep first message (task definition) and recent messages intact

### 3.6 Permission & Safety System

```
Command Safety Classification:
┌─────────────────────────────────────────────────┐
│ SAFE (auto-approve if enabled):                 │
│  • read_file, list_files, search_files          │
│  • list_code_definition_names                   │
│  • Non-destructive terminal: ls, cat, echo, pwd │
│                                                 │
│ REQUIRES APPROVAL (always):                     │
│  • write_to_file, replace_in_file               │
│  • execute_command (install, delete, deploy)     │
│  • browser_action                               │
│                                                 │
│ USER CONFIGURABLE:                              │
│  • Auto-approve read operations                 │
│  • Auto-approve file edits                      │
│  • Auto-approve specific commands (allowlist)   │
│  • Never auto-approve (paranoid mode)           │
└─────────────────────────────────────────────────┘
```

---

## PART 4: TECH STACK

| Layer | Technology | Rationale | **Actual Status** |
|-------|-----------|-----------|-------------------|
| **Language** | TypeScript (strict mode) | Type safety, VS Code native, ecosystem | **USED** |
| **Extension Build** | esbuild | Fast bundling, used by Cline and VS Code team | **USED** |
| **Webview UI** | React 18 + Vite | Component model, fast HMR during dev | **USED** |
| **Styling** | Tailwind CSS + VS Code CSS variables | Matches IDE theme, rapid UI development | **USED** |
| **Icons** | Lucide React | Clean, consistent icon set | **USED** |
| **Markdown** | react-markdown + rehype-highlight + remark-gfm | Rich message rendering with syntax highlighting | **USED** |
| **LLM (Primary)** | Anthropic SDK (`@anthropic-ai/sdk`) | Best agentic capabilities, native tool_use + streaming | **USED** |
| **LLM (Secondary)** | OpenAI SDK (`openai`) | Wide model access; also used for Google, DeepSeek, OpenRouter, Ollama | **USED** |
| **LLM (Multi-model)** | OpenRouter API | Access 100+ models via single API | **USED (via OpenAI SDK)** |
| **LLM (Local)** | Ollama HTTP API | Privacy-first, no API keys needed | **USED (via OpenAI-compat)** |
| **Token Counting** | `tiktoken` (via WASM) | Accurate context window management | **NOT USED — heuristic chars/3** |
| **AST Parsing** | `tree-sitter` (via WASM) | Language-agnostic code definition extraction | **NOT USED — regex patterns** |
| **Diff** | `diff` npm package | Unified diff generation | **NOT USED** |
| **MCP** | `@modelcontextprotocol/sdk` | Standard protocol for tool interoperability | **NOT USED** |
| **Schema Validation** | `ajv` | JSON Schema validation for tool parameters | **NOT USED — manual validation** |
| **Testing** | Vitest + Playwright | Unit tests + E2E extension tests | **NOT USED — manual testing** |

---

## PART 5: WHAT MAKES US WIN THE COMPETITION

### 5.1 Our Differentiators vs Cline (Planned → Actual)

| Feature | Cline | Planned | **Actually Built** |
|---------|-------|---------|-------------------|
| Tool execution | Sequential (1 per turn) | Parallel when possible | **Sequential** (parallel not implemented) |
| Context management | Simple truncation | Intelligent compression (AI summaries) | **3-pass compression + hardTrim** (character-slice, not AI) |
| LLM support | Multi-provider | Multi-provider + Local models | **6 providers, 26 models, Ollama local** |
| Edit format | XML only | Dual: Native tool_use + XML fallback | **Dual format implemented** |
| UI | Basic React webview | Modern UI with Tailwind + animations | **Modern UI with React.memo optimization** |
| Plan mode | Basic toggle | Plan → Act pipeline with task decomposition | **Plan/Act with mode-transition markers** |
| MCP | Supported | Supported + auto-discovery | **Not implemented** |
| Cost tracking | Per-task | Per-task + budget limits | **Per-task with USD budget enforcement** |
| Repo understanding | File tree | AST-based repo map (like Aider) | **Regex-based** (not tree-sitter) |
| Checkpoints | Git-based | Git-based + undo any step | **Not implemented** |

### 5.2 Key Innovations

1. **Parallel Tool Execution**: When the LLM requests multiple independent reads/searches, execute them simultaneously (inspired by Claude Code's 3x speedup).

2. **Intelligent Context Compression**: Use a lightweight LLM call to summarize old conversation turns, preserving decision rationale (not just truncating).

3. **AST-Based Repository Map**: Use tree-sitter to build a compact map of all functions/classes/exports — fits entire codebase structure in ~2K tokens.

4. **Dual Tool Format**: Native `tool_use` for Claude/GPT + XML fallback for any model, maximizing compatibility.

5. **Budget Controls**: Set a max spend per task. Extension tracks token usage and warns before exceeding.

6. **Theme-Aware UI**: Webview uses VS Code CSS variables to perfectly match light/dark/high-contrast themes.

7. **Streaming Diff Preview**: Show file changes as a live diff while the agent is still writing, not just after completion.

---

## PART 6: IMPLEMENTATION PHASES

### Phase 1: Foundation ✅ COMPLETE
- [x] Scaffold VS Code extension with TypeScript + esbuild
- [x] Set up Webview View Provider (sidebar panel)
- [x] Build React webview app with Vite + Tailwind
- [x] Establish bidirectional postMessage communication
- [x] Create shared type definitions (MessageTypes, ToolTypes)
- [x] Build basic chat UI (message list, input box, send button)

### Phase 2: LLM Integration & Basic Chat ✅ COMPLETE
- [x] Implement LLM Provider Interface (abstract)
- [x] Build Anthropic Provider with streaming + tool_use support
- [x] Build OpenAI Provider with streaming + function calling
- [x] Implement Provider Factory pattern (6 backends)
- [x] Wire up: Input → Extension → LLM → Stream back to Webview
- [x] Implement conversation memory (message history + 3-pass compression)
- [x] Add API key configuration via VS Code settings
- [x] Add model selection dropdown in webview (26-model catalog)

### Phase 3: Tool System ✅ COMPLETE
- [x] Build Tool Registry (native + XML definition generation)
- [x] Build Tool Executor with error handling + timeout
- [x] Implement System Prompt Builder (9 context sections)
- [x] Implement XML tool call parser (for non-native tool_use models)
- [x] Implement 9 core tools:
  - [x] `read_file` — fs.promises with 400KB pre-check, 100K char truncation
  - [x] `write_to_file` — fs.promises with parent directory creation
  - [x] `replace_in_file` — CRLF-aware SEARCH/REPLACE, $-sequence safe
  - [x] `execute_command` — child_process.spawn, 60s timeout, SIGTERM→SIGKILL
  - [x] `search_files` — Regex with ReDoS protection, binary skip
  - [x] `list_files` — Recursive/flat, depth 3, 500 entries
  - [x] `list_code_definition_names` — Regex-based (not tree-sitter)
  - [x] `ask_followup_question` — With suggestion chips
  - [x] `attempt_completion` — Task completion signal
- [x] Build the Agentic Loop (ReAct pattern, max 25 iterations)

### Phase 4: Context & Intelligence ✅ COMPLETE
- [x] Build Context Manager (assembles full context for each LLM call)
- [x] Implement Active Editor context (50K char cap)
- [x] Implement Workspace Indexer (file tree, 300 lines, depth 2, 30s cache)
- [x] Implement Diagnostics context (severity-sorted, 50 max)
- [x] Implement @mentions parser (7 types: file, folder, problems, url, git, terminal, selection)
- [x] Implement Context Compression (character-slice, 3-pass + hardTrim — NOT LLM-based)
- [x] Token estimation (heuristic chars/3 — NOT tiktoken)

### Phase 5: Safety & Permissions ✅ COMPLETE
- [x] Build Permission Manager (with shell operator detection)
- [x] Implement Approval Dialog in Webview (approve/reject with 5-min timeout)
- [x] Command safety classifier (shell operator blocking: &&, ||, ;, |, >, <, etc.)
- [x] Auto-approve configuration (reads, writes, command prefixes)
- [x] Budget controls (per-task USD limit with enforcement)
- [x] Rules system (4 sources, YAML frontmatter, glob matching, 30KB budget)

### Phase 6: Advanced Features — PARTIAL
- [ ] Parallel tool execution — **NOT BUILT**
- [ ] MCP client integration — **NOT BUILT**
- [ ] Browser automation tool — **NOT BUILT**
- [ ] Diff view integration — **NOT BUILT**
- [ ] Git checkpoint system — **NOT BUILT**
- [x] Plan Mode vs Act Mode toggle (with mode-transition markers)
- [ ] Task history persistence + resume — **NOT BUILT**
- [x] OpenRouter + Ollama + Google Gemini + DeepSeek provider support
- [x] Workflows & slash commands (.mitrahelix/workflows/*.md)
- [x] Enhanced rules system (.mitrahelix/rules/*.md with frontmatter)
- [x] Context menus (editor + explorer)
- [x] Right panel chat (Ctrl+Shift+L)

### Phase 7: Polish & Ship — MOSTLY COMPLETE
- [x] Markdown rendering with syntax highlighting (remark-gfm + rehype-highlight)
- [ ] Streaming diff preview — **NOT BUILT**
- [x] Theme-aware styling (light/dark/high-contrast via CSS variables)
- [x] Error handling (provider errors, tool errors, approval timeouts)
- [x] Loading states + progress indicators (streaming cursor, state labels)
- [x] Keyboard shortcuts (Ctrl+Shift+I, Ctrl+Shift+L)
- [ ] Extension settings page — **NOT BUILT** (uses VS Code native settings)
- [x] README + documentation (README.md, PROGRESS.md, REVIEW.md, TEST_PLAN.md)
- [ ] Package as .vsix — **NOT DONE** (build scripts exist)
- [ ] Publish to VS Code Marketplace — **NOT DONE**

---

## PART 7: MESSAGE PROTOCOL SPECIFICATION

### Webview → Extension Messages
```typescript
type WebviewMessage =
  | { type: 'sendMessage'; text: string; attachments?: Attachment[] }
  | { type: 'approveToolCall'; toolCallId: string }
  | { type: 'rejectToolCall'; toolCallId: string; reason?: string }
  | { type: 'cancelTask' }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'selectModel'; provider: string; model: string }
  | { type: 'newTask' }
  | { type: 'restoreCheckpoint'; checkpointId: string }
```

### Extension → Webview Messages
```typescript
type ExtensionMessage =
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'streamToken'; token: string; messageId: string }
  | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
  | { type: 'toolCallCompleted'; toolCallId: string; result: ToolResult }
  | { type: 'requestApproval'; toolCall: ToolCallInfo }
  | { type: 'taskCompleted'; summary: string }
  | { type: 'taskError'; error: string }
  | { type: 'costUpdate'; tokensUsed: number; estimatedCost: number }
  | { type: 'settingsLoaded'; settings: Settings }
  | { type: 'stateUpdate'; state: AgentState }
```

---

## PART 8: SYSTEM PROMPT TEMPLATE

```
You are Visual Score, an expert AI coding assistant operating inside VS Code.
You have access to tools that let you interact with the user's development environment.

# TOOLS
[Generated XML tool definitions — see ToolDefinitions.ts]

# TOOL USE FORMAT
Use XML-style tags to invoke tools:
<tool_name>
  <param>value</param>
</tool_name>

# TOOL USE GUIDELINES
1. Use one tool at a time per response.
2. Wait for the result before proceeding.
3. Think step-by-step about what information you need.
4. Prefer read_file over asking the user for file contents.
5. Prefer replace_in_file for small edits, write_to_file for new files.
6. Always verify changes succeeded before moving on.
7. Use attempt_completion when the task is fully done.

# MODES
- ACT MODE: You have access to all tools. Execute tasks step by step.
- PLAN MODE: Discuss and plan with the user. Do NOT use tools.
Current mode: {{MODE}}

# SYSTEM INFORMATION
- OS: {{OS}}
- Shell: {{SHELL}}
- CWD: {{CWD}}
- Home: {{HOME}}

# USER RULES
{{USER_RULES from .visualscorerules}}

# WORKSPACE CONTEXT
{{REPO_MAP — AST-based function/class definitions}}
{{ACTIVE_FILE — current editor content if relevant}}
{{DIAGNOSTICS — current errors/warnings if any}}
```

---

## PART 9: KEY IMPLEMENTATION PATTERNS

### 9.1 Streaming LLM Response with Tool Call Detection
```typescript
// Pseudocode for the core agent loop
async function* agentLoop(task: string): AsyncGenerator<AgentEvent> {
  memory.addMessage({ role: 'user', content: task });

  while (true) {
    const context = await contextManager.gather();
    const systemPrompt = promptBuilder.build(context);
    const messages = memory.getMessages();

    let response = '';
    const toolCalls: ToolCall[] = [];

    // Stream from LLM
    for await (const chunk of llm.stream(systemPrompt, messages)) {
      if (chunk.type === 'text') {
        response += chunk.text;
        yield { type: 'streamToken', token: chunk.text };
      } else if (chunk.type === 'tool_use') {
        toolCalls.push(chunk.toolCall);
        yield { type: 'toolCallStarted', toolCall: chunk.toolCall };
      }
    }

    memory.addMessage({ role: 'assistant', content: response, toolCalls });

    if (toolCalls.length === 0) break; // No tools = done

    // Execute tools (with parallel batching for reads)
    const results = await toolExecutor.executeBatch(toolCalls);

    for (const result of results) {
      memory.addMessage({ role: 'tool', content: result.output, toolCallId: result.id });
      yield { type: 'toolCallCompleted', result };
    }

    // Check for attempt_completion
    if (toolCalls.some(tc => tc.name === 'attempt_completion')) break;
  }

  yield { type: 'taskCompleted' };
}
```

### 9.2 LLM Provider Interface
```typescript
interface LLMProvider {
  readonly name: string;
  readonly supportsNativeToolUse: boolean;

  stream(
    systemPrompt: string,
    messages: Message[],
    tools?: ToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMChunk>;

  countTokens(text: string): number;
}
```

---

## APPENDIX: RESEARCH SOURCES

1. **Cline Source Code**: github.com/cline/cline — Core architecture, tool system, system prompt
2. **Cline System Prompt Analysis**: harrywang.me/cline — 59K char prompt breakdown
3. **Cline vs Claude Code Architecture**: squid-club.com — Parallel execution, context compression, security
4. **VS Code AI Extensibility**: code.visualstudio.com/api/extension-guides/ai — Chat Participant, Language Model Tool, MCP APIs
5. **VS Code Webview API**: code.visualstudio.com/api/extension-guides/webview — Webview lifecycle, postMessage
6. **Architecting AI Agents with TypeScript**: apeatling.com — Orchestrator, Tool Executor, Memory patterns
7. **Continue.dev**: github.com/continuedev/continue — Multi-mode architecture, YAML config
8. **Aider**: aider.chat — Repository map, tree-sitter AST, SEARCH/REPLACE format
9. **Void Editor**: voideditor.com — VS Code fork approach, agent/gather/chat modes
10. **MuleSoft DevAgent**: mulesoft.com — MCP-based tool exposition pattern
11. **Anthropic Claude SDK**: github.com/anthropics/anthropic-sdk-typescript — Streaming + tool_use
12. **Model Context Protocol**: modelcontextprotocol.io — MCP architecture overview
