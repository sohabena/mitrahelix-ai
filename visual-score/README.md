# MitraHelix AI Agent

An AI-agentic coding assistant for Visual Studio Code. MitraHelix can read/write files, run terminal commands, search your codebase, and help you build anything — all with human-in-the-loop safety.

## Features

### Core
- **Agentic ReAct Loop** — Autonomous reasoning and acting: the AI thinks step-by-step, uses tools, reads results, and iterates until the task is complete (up to 25 iterations per task)
- **9 Built-in Tools** — Read files, write files, targeted SEARCH/REPLACE edits, run commands, regex search, list directories, extract code definitions, ask follow-ups, and signal completion
- **Streaming Responses** — See the AI's response appear in real-time with optimized 50ms batched rendering
- **Human-in-the-Loop** — Approve or reject file writes and command execution. 5-minute auto-timeout on pending approvals
- **Plan & Act Modes** — Toggle between planning (discussion only, no tools) and acting (full tool access). Mode transitions are tracked in conversation memory for context

### LLM Support (6 Providers, 26+ Models)
- **Anthropic** — Claude Sonnet 4.6, Claude Opus 4.6, Claude Sonnet 4.5, Claude Haiku 4.5 (native `tool_use`)
- **OpenAI** — GPT-5.2, GPT-5, GPT-5 Mini, GPT-5 Nano, o4-mini, o3-pro, GPT-4o (reasoning model detection for o-series)
- **Google Gemini** — Gemini 2.5 Flash/Pro, Gemini 3 Flash/Pro Preview (1M token context via OpenAI-compatible API)
- **DeepSeek** — DeepSeek V3 (chat), DeepSeek Reasoner R1 (XML tool fallback)
- **OpenRouter** — Access 100+ models via single API key
- **Ollama** — Run local models (Llama 3.1, Qwen 2.5 Coder, DeepSeek Coder V2) with XML tool parsing

### Context & Intelligence
- **Context-Aware** — Automatically includes your active file (50K chars), workspace file tree, and current diagnostics (errors first) in every request
- **7 @Mention Types** — `@file` (supports quoted paths with spaces), `@folder`, `@problems`, `@url` (follows redirects, checks status), `@git` (diff + status), `@terminal`, `@selection`
- **150K Context Budget** — Aggregate mention budget with cross-deduplication between text @mentions and UI attachments
- **Intelligent Memory Compression** — 3-pass compression with safety margin, bounded keepFirst/keepLast, and hardTrim fallback that respects tool-message pairing

### Customization
- **Rules System** — 4 sources: `.mitrahelix/rules/*.md` (with YAML frontmatter for globs/alwaysApply), `.mitrahelixrules`, `AGENTS.md`, `.cursorrules`. 30KB aggregate budget
- **Workflows & Slash Commands** — Define reusable workflows in `.mitrahelix/workflows/*.md`, trigger with `/` in the chat input
- **Model Selector** — Switch models from the UI with a dropdown grouped by provider. Accurate cost tracking per model
- **Auto-Approve** — Configure which operations auto-approve: reads (default on), writes, specific command prefixes

### UI
- **Right Panel Chat** — Open chat beside your editor (`Ctrl+Shift+L`) so files stay visible
- **React Error Boundary** — Catches render crashes with a recovery UI instead of blank panel
- **Optimized Rendering** — React.memo on all major components, 50ms streaming token buffer (~20x fewer re-renders)
- **Theme-Aware** — Matches your VS Code theme (light, dark, high contrast) via CSS variables
- **Markdown Rendering** — Rich display with syntax-highlighted code blocks (rehype-highlight), GFM tables, and copy buttons
- **Cost Tracking** — See token usage and estimated cost per task, with configurable budget limits
- **Context Menus** — Right-click code for "Ask MitraHelix About This", right-click files for "Add to MitraHelix Context"

### Security
- **Path Security** — All file tools validate paths with symlink resolution and case-insensitive matching (Windows)
- **Shell Operator Detection** — Blocks `&&`, `||`, `;`, `|`, `>`, `<`, `()`, `{}`, newlines in auto-approved commands
- **Content Security Policy** — Webview runs with strict CSP (nonce-based script-src)
- **ReDoS Protection** — User-supplied regex patterns probed for catastrophic backtracking before execution

## Installation

### From Source (bash / macOS / Linux)
```bash
cd visual-score
npm install
cd webview-ui && npm install && cd ..
npm run build
```

### From Source (PowerShell / Windows)
```powershell
cd visual-score
npm install
cd webview-ui
npm install
cd ..
npm run build
```

### Development
```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# In VS Code, press F5 to launch Extension Development Host
```

### Quick Test Workspace

**bash / macOS / Linux:**
```bash
mkdir -p /tmp/mitra-helix-test/src
echo 'console.log("hello");' > /tmp/mitra-helix-test/src/index.js
echo '# Test Project' > /tmp/mitra-helix-test/README.md
echo 'Always respond concisely.' > /tmp/mitra-helix-test/.mitrahelixrules
```

**PowerShell / Windows:**
```powershell
New-Item -ItemType Directory -Force -Path "C:\temp\mitra-helix-test\src"
Set-Content -Path "C:\temp\mitra-helix-test\src\index.js" -Value 'console.log("hello");'
Set-Content -Path "C:\temp\mitra-helix-test\README.md" -Value '# Test Project'
Set-Content -Path "C:\temp\mitra-helix-test\.mitrahelixrules" -Value 'Always respond concisely.'
```

Then open the test workspace: `code C:\temp\mitra-helix-test`

## Configuration

Open VS Code Settings → search "MitraHelix":

| Setting | Description | Default |
|---------|------------|---------|
| `mitraHelix.provider` | LLM provider (anthropic, openai, google, deepseek, openrouter, ollama) | `anthropic` |
| `mitraHelix.anthropicApiKey` | Your Anthropic API key | — |
| `mitraHelix.openaiApiKey` | Your OpenAI API key | — |
| `mitraHelix.openrouterApiKey` | Your OpenRouter API key | — |
| `mitraHelix.googleApiKey` | Your Google Gemini API key | — |
| `mitraHelix.deepseekApiKey` | Your DeepSeek API key | — |
| `mitraHelix.ollamaBaseUrl` | Ollama server URL | `http://localhost:11434` |
| `mitraHelix.model` | Model ID | `claude-sonnet-4-6` |
| `mitraHelix.maxTokens` | Max tokens per response | `8192` |
| `mitraHelix.maxBudgetPerTask` | Max cost per task (USD, 0 = unlimited) | `1.00` |
| `mitraHelix.autoApproveReads` | Auto-approve read operations | `true` |
| `mitraHelix.autoApproveWrites` | Auto-approve file writes | `false` |
| `mitraHelix.autoApproveCommands` | Commands to auto-approve (prefix match) | `[]` |
| `mitraHelix.contextWindowSize` | Max context tokens before compression | `100000` |

## Available Tools

| Tool | Description | Approval |
|------|------------|----------|
| `read_file` | Read file contents with line numbers (400KB pre-check, 100K char truncation) | Auto |
| `write_to_file` | Create or overwrite a file (creates parent directories) | Required |
| `replace_in_file` | Targeted SEARCH/REPLACE edits (CRLF-aware, $-sequence safe) | Required |
| `execute_command` | Run CLI commands (60s timeout, 50K output cap) | Required |
| `search_files` | Regex search across files (ReDoS protected) | Auto |
| `list_files` | List directory contents (recursive depth 3, 500 entries) | Auto |
| `list_code_definition_names` | Extract function/class definitions (TS/JS/Python/Go/Java) | Auto |
| `ask_followup_question` | Ask user for clarification (with suggested answers) | Auto |
| `attempt_completion` | Signal task completion with summary | Auto |

## Custom Rules

### Simple Rules File
Create `.mitrahelixrules` in your workspace root:
```
- Always use TypeScript strict mode
- Prefer functional components over class components
- Write tests for all new functions
```

### Advanced Rules (with frontmatter)
Create `.mitrahelix/rules/typescript.md`:
```markdown
---
description: TypeScript coding standards
globs: ["**/*.ts", "**/*.tsx"]
---
- Use strict mode
- Prefer interfaces over types for object shapes
- Use const assertions where possible
```

**Activation modes:**
- `alwaysApply: true` — Always included in system prompt
- `globs: ["**/*.ts"]` — Included when matching files are in context
- `description` only — Indexed for LLM reference
- **Legacy sources** — `.mitrahelixrules`, `AGENTS.md`, `.cursorrules` are always included

## Workflows

Create workflow files in `.mitrahelix/workflows/` with YAML frontmatter:

```markdown
---
description: Perform a thorough code review
---
1. Read the file mentioned by the user
2. Analyze for bugs, security issues, and code style
3. Check for edge cases and error handling
4. Provide a summary with severity ratings
```

Trigger workflows by typing `/` in the chat input. The workflow content is prepended to your message.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+I` / `Cmd+Shift+I` | Focus MitraHelix chat input |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Open chat panel (right side) |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Escape` | Clear input, then cancel task |

## Architecture

```
Extension Host (Node.js)          Webview (React)
├── AgentController               ├── App (ErrorBoundary)
├── AgentLoop (ReAct, max 25)     ├── ChatPanel (auto-scroll)
├── LLM Providers                 ├── MessageBubble (React.memo)
│   ├── Anthropic (native)        ├── ToolCallCard (expandable)
│   ├── OpenAI (native)           ├── ApprovalDialog
│   ├── Google Gemini (compat)    ├── InputBox (React.memo, @mentions, /commands)
│   ├── DeepSeek (native/XML)     └── TaskHeader (React.memo, model selector)
│   ├── OpenRouter (native)
│   └── Ollama (XML fallback)
├── Tool Registry (9 tools)
├── Context Manager (rules, file tree, diagnostics, active file)
├── Permission Manager (shell operator detection)
├── ConversationMemory (3-pass compression + hardTrim)
├── RulesManager (4 sources, glob matching, 30KB budget)
├── WorkflowManager (slash commands)
└── System Prompt Builder (9 context sections)
```

## Quality

This extension has undergone **35 rounds of forensic code review** with **174 total fixes** applied:
- 44 Critical (security, API protocol, race conditions)
- 90 Significant (correctness, performance, UX)
- 34 Minor (code quality, polish)
- 6 Feature gaps closed

Zero TypeScript compilation errors. Zero linter errors.

## License

MIT
