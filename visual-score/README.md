# MitraHelix AI Agent

An AI-agentic coding assistant for Visual Studio Code. MitraHelix can read/write files, run terminal commands, search your codebase, and help you build anything — all with human-in-the-loop safety.

## Features

- **Agentic Chat** — Ask questions, give tasks, and watch the AI work step-by-step
- **9 Built-in Tools** — Read files, write files, edit files, run commands, search code, list directories, extract code definitions, ask follow-ups, and signal completion
- **Streaming Responses** — See the AI's response appear in real-time
- **Human-in-the-Loop** — Approve or reject file writes and command execution
- **6 LLM Providers** — Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, OpenRouter (100+ models), Ollama (local)
- **Model Selector** — Switch models from the UI with a dropdown grouped by provider
- **Right Panel Chat** — Open chat beside your editor (`Ctrl+Shift+L`) so files stay visible
- **Workflows & Slash Commands** — Define reusable workflows in `.mitrahelix/workflows/`, trigger with `/`
- **Context-Aware** — Understands your active file, workspace structure, and diagnostics
- **@Mentions** — Use `@file`, `@folder`, `@problems`, `@url` to attach context
- **Plan & Act Modes** — Toggle between planning (discussion) and acting (tool use)
- **Cost Tracking** — See token usage and estimated cost per task
- **Theme-Aware UI** — Matches your VS Code theme (light, dark, high contrast)
- **Markdown Rendering** — Rich message display with syntax-highlighted code blocks

## Installation

### From Source
```bash
# Clone and install
cd mitra-helix
npm install
cd webview-ui && npm install && cd ..

# Build
npm run build

# Package as .vsix
npm run package

# Install in VS Code
code --install-extension mitra-helix-0.1.0.vsix
```

### Development
```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# In VS Code, press F5 to launch Extension Development Host
```

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
| `mitraHelix.maxBudgetPerTask` | Max cost per task (USD) | `1.00` |
| `mitraHelix.autoApproveReads` | Auto-approve read operations | `true` |
| `mitraHelix.autoApproveWrites` | Auto-approve file writes | `false` |
| `mitraHelix.autoApproveCommands` | Commands to auto-approve | `[]` |

## Available Tools

| Tool | Description | Approval |
|------|------------|----------|
| `read_file` | Read file contents with line numbers | Auto |
| `write_to_file` | Create or overwrite a file | Required |
| `replace_in_file` | Targeted SEARCH/REPLACE edits | Required |
| `execute_command` | Run CLI commands | Required |
| `search_files` | Regex search across files | Auto |
| `list_files` | List directory contents | Auto |
| `list_code_definition_names` | Extract function/class definitions | Auto |
| `ask_followup_question` | Ask user for clarification | Auto |
| `attempt_completion` | Signal task completion | Auto |

## Custom Rules

Create a `.mitrahelixrules` file in your workspace root to give the agent custom instructions:

```
- Always use TypeScript strict mode
- Prefer functional components over class components
- Write tests for all new functions
```

## Workflows

Create workflow files in `.mitrahelix/workflows/` with YAML frontmatter:

```markdown
---
description: Perform a code review of the specified file
---

1. Read the file mentioned by the user
2. Analyze for bugs, security issues, and code style
3. Provide a summary of findings
```

Trigger workflows by typing `/` in the chat input. Built-in workflows:
- `/code-review` — Thorough code review
- `/add-tests` — Generate unit tests
- `/refactor` — Refactor for readability and maintainability

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+I` / `Cmd+Shift+I` | Open MitraHelix sidebar |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Open chat panel (right side) |

## Architecture

```
Extension Host (Node.js)          Webview (React)
├── AgentController               ├── ChatPanel
├── AgentLoop (ReAct)             ├── MessageBubble
├── LLM Providers                 ├── ToolCallCard
│   ├── Anthropic                 ├── ApprovalDialog
│   ├── OpenAI                    ├── InputBox (+ /workflow)
│   ├── Google Gemini             └── TaskHeader (+ model selector)
│   ├── DeepSeek
│   └── OpenRouter/Ollama
├── Tool Registry & Executor
│   └── 9 built-in tools
├── Context Manager
├── Permission Manager
└── System Prompt Builder
```

## License

MIT
