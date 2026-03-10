# AI-IDE Competitive Feature Research (2025–2026)

> **Purpose:** Comprehensive feature inventory of leading open-source AI coding tools, compiled March 2026, to inform MitraHelix feature prioritization.

---

## 1. Cline (github.com/cline/cline)

**Stars:** 47,300+ | **Installs:** 1M+ (VS Code) | **License:** Apache-2.0 | **Ranked #1 MCP client on OpenRouter**

### Core Agent Loop
| Feature | Details |
|---------|---------|
| Streaming responses | Real-time token streaming to reduce perceived latency |
| Plan / Act mode | **Plan mode** = explore, review, strategize (read-only). **Act mode** = execute changes. Context carries across modes. Different models per mode supported. |
| Auto-approval | Per-action type auto-approve (read, write, command). Full automation mode toggles Plan→Act automatically. |
| Thinking Budget | Fine-grained control over reasoning-token consumption for cost management |

### Tools & Capabilities
| Feature | Details |
|---------|---------|
| File read/write/replace | Standard file operations with content display |
| Terminal/command execution | Integrated shell with output capture |
| Browser automation | Puppeteer-based browser launch, screenshot capture, console log reading. Settings migrated to webview UI (May 2025). |
| Search (regex + file) | Ripgrep-based file search, file listing |
| List code definitions | Regex-based code symbol extraction |
| MCP integration | Full Model Context Protocol support — custom tools, external service connectors. Users can add MCP servers for databases, APIs, custom workflows. |

### Context & Memory
| Feature | Details |
|---------|---------|
| @-mentions | `@url`, `@file`, `@folder`, `@problems`, `@git`, `@terminal`, `@selection` — inline context injection |
| Task history | Persistent task history with restore. Each task stored with full conversation. |
| Custom instructions | User-defined system prompt additions for behavioral customization |
| .clineignore | Gitignore-style file to protect sensitive files from being read/sent to LLMs. Supports glob patterns, negation, directory-specific rules. |

### Safety & Versioning
| Feature | Details |
|---------|---------|
| Checkpoints | Git-based project snapshots (shadow commits). Instant restore to any checkpoint during a task. |
| Diff view | "See Changes" button shows before/after diff of AI modifications |
| Permission system | Per-action approval with auto-approve settings per category |

### UI & UX
| Feature | Details |
|---------|---------|
| Image/vision support | Screenshot capture via browser, image attachment for vision-capable models |
| Webview sidebar | Custom React webview in VS Code sidebar |
| Token/cost tracking | Per-task cost display with model pricing awareness |

### Model Support
Claude 4 Sonnet/Opus (default), OpenRouter, OpenAI, Google Gemini 2.0/2.5, DeepSeek, AWS Bedrock, SAP AI Core (enterprise). Streaming supported across all providers.

---

## 2. Continue.dev

**Type:** Open-source VS Code + JetBrains extension | **License:** Apache-2.0

### Interaction Modes
| Mode | Description |
|------|-------------|
| **Agent mode** | Full agentic tool use — file read/write, terminal commands, codebase search, web search, create rules. Tool handshake protocol for structured model-tool communication. |
| **Chat mode** | Traditional conversational assistant for explanations and code review |
| **Autocomplete** | Tab-based inline completions with context-aware suggestions |
| **Edit mode** | Inline code editing with diff preview |

### Key Features
| Feature | Details |
|---------|---------|
| Next Edit (Instinct) | Predicts entire code changes beyond cursor position. Open-source "Instinct" model trained on 4,000+ real edits. Handles complex refactoring in single operations. |
| Context providers | Extensible `@`-mention system: `@File`, `@Code`, `@Git Diff`, `@Current File`, `@Terminal`, `@Codebase`, `@Open`, `@Web`, `@Folder`, `@Search`, `@Url`, `@Clipboard`. Custom providers supported. |
| AI Checks | Source-controlled AI checks enforceable in CI/CD pipelines via open-source CLI (`cn`). Automated code review with custom rules. |
| Continue Hub | Marketplace for pre-built agents, models, MCP servers, rules, prompts, and configuration blocks. Team sharing and discovery. |
| Rules system | `.continue/rules/` directory with project-specific AI behavioral guidelines. Version-controlled. |
| CLI tool (`cn`) | Headless automation and CI/CD integration. Apply custom rules, run agents outside IDE. |
| Model routing | Configure different models for chat, autocomplete, and editing affordances |
| Configuration-as-code | JSON/YAML config for all settings, version-controllable |

### Architecture Highlights
- Plugin-based context provider system (easy to add new `@` sources)
- Hub-based distribution of configurations and agents
- Multi-IDE support (VS Code + JetBrains)

---

## 3. Aider

**Stars:** 40,000+ | **Type:** Terminal CLI | **License:** Apache-2.0 | **75+ LLM providers**

### Core Architecture
| Feature | Details |
|---------|---------|
| Repository map | Tree-sitter-based map of entire git repo — classes, functions, call signatures. Graph ranking algorithm selects most relevant portions within token budget (`--map-tokens`, default 1K). |
| Multi-file editing | Add multiple files to chat; Aider edits all simultaneously based on NL instructions |
| Edit formats | Multiple formats: whole-file, search/replace diffs, unified diffs. Model-appropriate format auto-selected. |

### Modes
| Mode | Description |
|------|-------------|
| **Code mode** | Default — AI proposes and applies edits |
| **Ask mode** | Read-only Q&A about codebase |
| **Architect mode** | Two-model approach: large model (O1/Opus) plans, smaller model (Sonnet) executes. Ideal for large-scale refactoring. |
| **Help mode** | Aider usage assistance |

### Developer Workflow Integration
| Feature | Details |
|---------|---------|
| Git auto-commits | Every AI edit auto-committed with descriptive messages. Easy diff/undo via standard git. |
| Linter integration | Built-in linters for major languages. Auto-lint after changes. Custom linters via `--lint-cmd`. |
| Test runner | `/test` command + `--auto-test` flag for running tests after every edit. Output shared with AI for fix iterations. |
| Voice coding | `/voice` command — speak instructions, transcribed to chat. Natural voice-based pair programming. |
| Browser integration | Launch browser previews, share screenshots with AI for visual feedback |

### Unique Strengths
- **Architect mode's two-model pattern** is a standout — separates reasoning cost from execution cost
- **Repo map with tree-sitter** provides superior code understanding vs regex-based approaches
- **Git-first workflow** — every change is a commit, making undo trivial
- **Benchmarking focus** — Aider maintains public coding benchmarks (SWE-bench, polyglot) with leaderboard

---

## 4. Cursor IDE

**Type:** Proprietary IDE (VS Code fork) | **Pricing:** Free tier + Pro ($20/mo) + Business ($40/mo)

### Autocomplete & Editing
| Feature | Details |
|---------|---------|
| Tab autocomplete | "Fusion Model" — custom model for tab completions. Predictive edits including jumps and long-context handling. Substantially better than generic completions. |
| Multi-file inline editing | Edit across multiple files inline with diff preview |
| Apply model | Dedicated fast model for applying suggested changes to files |

### Agent Mode
| Feature | Details |
|---------|---------|
| Background Agents | Cloud-based autonomous agents that work in parallel. Implement features, refactor, write tests, debug — all without supervision. Available to all users since June 2025. Assign via screenshots + NL prompts. |
| Subagents | Async subagents with nesting for deep task decomposition (v2.4+, 2026) |
| Long-running agents | Autonomously create branches, run CI, iterate on code reviews (v2.4+) |

### Context & Understanding
| Feature | Details |
|---------|---------|
| @codebase semantic search | Custom embedding model. Combines instant grep, semantic search, and multi-step search strategies. Files encrypted, code never stored in plaintext. |
| Codebase indexing | Automatic repository indexing for semantic understanding |
| @-mentions | File, folder, codebase, web, docs, and more |

### Rules & Memory
| Feature | Details |
|---------|---------|
| .cursor/rules/ | Directory-based rules with YAML frontmatter, glob patterns. Types: Always Apply, Apply Intelligently, Apply to Specific Files, Apply Manually. `/create-rule` command. |
| AGENTS.md | Alternative simpler markdown-based instruction file |
| Memory system | Beta: remembers facts across conversations per-project. Managed from Settings → Rules. |
| Notepad | Scratch space for agent context |

### Safety & Automation
| Feature | Details |
|---------|---------|
| Yolo mode | Auto-approve all agent actions (equivalent to full automation) |
| Bug finder | Automated bug detection across codebase |
| Cursor Blame | Timeline view of code evolution |

### 2026 Additions (v2.4–2.5)
- Plugins & Cursor Marketplace with third-party integrations
- Image generation capabilities
- Jupyter Notebook agent support
- 40% faster context switching, 50ms faster tab completions

---

## 5. Windsurf / Cascade

**Type:** Proprietary IDE (VS Code fork) | **Stat:** 57M lines of code generated daily, 90% of user code written by Cascade

### Operating Modes
| Mode | Description |
|------|-------------|
| **Chat mode** | Traditional assistant — explanations, code review |
| **Code mode** | Autonomous agent — creates/edits files, runs terminal commands, validates results |
| **Plan mode** | Creates detailed implementation plans, then auto-transitions to Code mode for execution |

### Core Features
| Feature | Details |
|---------|---------|
| Flow awareness | Tracks all user actions (edits, commands, clipboard, terminal) to infer intent. Adapts in real-time without repetition. |
| Cascade memory | Auto-generated context persistence across conversations. Workspace-scoped. Non-credit consuming. |
| Workflows | Custom reusable rulebooks with auto-generated slash commands |
| Rules | `.windsurfrules` files and `global_rules.md` for behavioral guidelines |
| Web integration | Integrated browser for live previews + web search. Inspect previews and loop browser context back into code. |
| One-click deploy | Deploy apps directly to public internet |
| MCP support | Plugin store for connecting custom tools and services |
| Skills | Read skills from `.agents/skills` directory |
| Cascade hooks | `POST_CASCADE_RESPONSE_WITH_TRANSCRIPT` and other hook configurations |

### 2026 Updates (Feb–Mar)
- Model picker with family grouping and reasoning effort toggles
- New models: GPT-5.4, Claude Sonnet 4.6, Gemini 3.1 Pro, Claude Opus 4.6 (fast mode)
- Linux ARM64 support
- Plan Mode auto-switch to Code Mode

---

## 6. Roo Code (Roo-Cline fork)

**Type:** Open-source VS Code extension | **License:** Apache-2.0

### Built-in Modes
| Mode | Icon | Description |
|------|------|-------------|
| Code | 💻 | Default — full tool access for implementation |
| Ask | ❓ | Knowledge assistant, read-only |
| Architect | 🏗️ | System design and planning |
| Debug | 🪲 | Troubleshooting and diagnostics |
| Orchestrator | 🪃 | Boomerang task orchestration |

### Key Features
| Feature | Details |
|---------|---------|
| Custom modes | Create global or project-specific modes with custom role definitions, tool access, and model preferences. Marketplace for community-contributed modes. |
| Sticky models | Each mode remembers its last-used model, auto-switching on mode change |
| Boomerang orchestration | 🪃 Orchestrator mode breaks complex projects into subtasks. Each subtask runs in the best-suited mode. Context isolation between subtasks. Results flow automatically. Parent stays uncluttered. |
| MCP support | Full MCP integration — project-level (`.roo/mcp.json`) and global configs. STDIO, Streamable HTTP, and SSE transport. Per-server tool permissions with `alwaysAllow` wildcard. |
| Auto-approval | Granular per-action-type auto-approve. Per-MCP-server auto-approve with wildcard support. |
| Diff editing | Search/replace diffs with fuzzy matching, indentation handling, Windows line ending support |
| Checkpoints | Auto-created before task handoffs for state consistency |
| Parallel tool calling | Enhanced parallel tool execution capabilities (v3.44) |

### Unique Strengths
- **Boomerang pattern** is the most sophisticated orchestration approach in the open-source space
- **Custom modes with marketplace** enables community-driven specialization
- **Project-level MCP configs** enable team-shared tool setups via version control

---

## 7. Codex CLI (OpenAI)

**Type:** Open-source terminal CLI (Rust) | **License:** Apache-2.0

### Core Features
| Feature | Details |
|---------|---------|
| Interactive TUI | Conversational terminal interface with rich formatting |
| File operations | Direct read/write access to codebase |
| Command execution | Shell command running with output capture |
| Web search | Real-time web information retrieval |
| Image inputs | Attach screenshots and design specs for visual context |
| MCP support | Model Context Protocol for third-party tool integration |
| Session resume | Pick up where you left off with `/resume` |

### Safety & Sandboxing
| Feature | Details |
|---------|---------|
| Sandbox policies | `--sandbox` flag: `read-only`, `workspace-write`, `danger-full-access` |
| Approval modes | `--ask-for-approval`: `untrusted` (default), `on-request`, `never` |
| Scoped execution | Operates within selected directory |

### Multi-Agent (Experimental)
| Feature | Details |
|---------|---------|
| Parallel agents | Spawn specialized agents for parallel task execution |
| Agent roles | Built-in `monitor` role for long-running workflows |
| CSV batch | `spawn_agents_on_csv` for batch processing |
| Orchestration | Automatic agent spawning, routing, and result consolidation |

### Architecture
- Built in Rust for performance
- JSON-RPC protocol via Codex App Server
- Powers CLI, VS Code extension, web app, and macOS app from single harness
- Models: GPT-5.4 (recommended), GPT-5.3-Codex, GPT-5.3-Codex-Spark

---

## 8. Claude Code (Anthropic)

**Stars:** 54,900+ | **Type:** Terminal CLI + IDE integrations | **License:** Proprietary (free with API key)

### Three-Layer Architecture
| Layer | Description |
|-------|-------------|
| **Core** | Main conversation — 200K token context (1M with premium) |
| **Delegation** | Up to 10 parallel subagents with isolated contexts |
| **Extension** | MCP protocol (300+ services), hooks, skills, plugins |

### Core Features
| Feature | Details |
|---------|---------|
| Subagents | Built-in: Explore (Haiku, read-only), Plan (research), General-purpose (full tools). Up to 10 in parallel. Custom subagents via JSON config. |
| Hooks system | Shell commands at lifecycle events: SessionStart/End, PreToolUse/PostToolUse, PermissionRequest, SubagentStart/Stop, InstructionsLoaded, PreCompact. Enables CI/CD automation. |
| Permission system | Tiered: read-only (auto), bash (approval), file mods (approval). Modes: `default`, `plan`, `bypassPermissions`. |
| CLAUDE.md | Project-level instruction files (similar to .cursorrules) |
| Skills | `.claude/skills/` directory — markdown files extending capabilities with reusable workflows |
| Model switching | Haiku (fast/cheap) ↔ Opus (powerful) within session |
| Extended thinking | Deep reasoning mode for complex problems |
| Browser automation | `--chrome` flag for browser interaction |
| Session management | Resume conversations, named sessions |

### IDE Integrations
VS Code, JetBrains, Cursor, Slack, GitHub Actions, GitLab CI/CD, web interface, desktop app.

### Installation
npm, Homebrew, curl installer, WinGet, PowerShell. Requires Node.js 18+.

---

## Feature Comparison Matrix

### Legend
- ✅ = Fully implemented
- 🟡 = Partial / Basic implementation
- ❌ = Not available
- 🔬 = Experimental

| Feature Category | Cline | Continue | Aider | Cursor | Windsurf | Roo Code | Codex CLI | Claude Code | **MitraHelix** |
|---|---|---|---|---|---|---|---|---|---|
| **AGENT CORE** | | | | | | | | | |
| Streaming responses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-model support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ |
| Plan / Act modes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Architect mode (2-model) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Background/async agents | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | 🔬 | ✅ | ❌ |
| Subagent orchestration | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | 🔬 | ✅ | ❌ |
| **TOOLS** | | | | | | | | | |
| File read/write/replace | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terminal/command exec | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Code search (regex) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List code definitions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| Browser automation | ✅ | ❌ | 🟡 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| MCP integration | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Parallel tool execution | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **CONTEXT & UNDERSTANDING** | | | | | | | | | |
| @-mention system | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Repository map (AST) | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 |
| Semantic codebase search | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Web search/fetch | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Image/vision input | ✅ | ❌ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Context compression | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| **SAFETY & VERSIONING** | | | | | | | | | |
| Checkpoints/snapshots | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Diff view for changes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Permission system | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-approve granular | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ignore/protect files | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Git auto-commits | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **CUSTOMIZATION** | | | | | | | | | |
| Rules/instructions system | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom modes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Workflows/slash commands | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Hooks/lifecycle events | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Skills system | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Configuration marketplace | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **DEVELOPER WORKFLOW** | | | | | | | | | |
| Linter integration | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Test runner integration | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Voice coding | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tab autocomplete | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inline edit | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **PERSISTENCE** | | | | | | | | | |
| Task/conversation history | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cross-session memory | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Session resume | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Token/cost tracking | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## MitraHelix Feature Parity Status (Updated March 2026)

### Tier 1 — Table Stakes: ALL IMPLEMENTED ✅
1. **Diff View Integration** ✅ — VS Code native diff editor via `DiffViewProvider` with accept/reject workflow and checkpoint comparison.
2. **Checkpoints / Git Snapshots** ✅ — `ShadowGitCheckpointManager` creates shadow git commits before each write, supports restore by hash. JSON-based fallback `CheckpointManager` when git is unavailable.
3. **MCP Integration** ✅ — `MCPClientManager` + `MCPHub` with stdio transport, auto-reconnection, tool/resource bridge (`use_mcp_tool`, `access_mcp_resource`).
4. **Parallel Tool Execution** ✅ — `ToolDependencyAnalyzer` batches read-only tools for concurrent execution via `Promise.allSettled`.
5. **Task/Conversation History & Resume** ✅ — `TaskHistoryManager` stores full conversations. Resume button in UI restores memory and context.
6. **Context Compaction** ✅ — Smart 3-pass heuristic compression + agent-invokable `condense` tool for LLM-based semantic summarization.
7. **Auto-Approve YOLO** ✅ — Three-tier: YOLO mode (approve all), granular per-tool-type (reads/writes/commands/MCP), and command whitelist.

### Tier 2 — Competitive Differentiators: MOSTLY IMPLEMENTED
6. **Repository Map with Tree-Sitter** — ⚠️ Regex-based only. AST-based maps would improve quality.
7. **Semantic Codebase Search** — ❌ Not implemented. Would require embedding model integration.
8. **Browser Automation** ✅ — `BrowserActionTool` with Chrome DevTools Protocol (CDP) — launch, click, type, scroll_up, scroll_down, close. Screenshots via Page.captureScreenshot, console log collection.
9. **Linter/Test Integration** ✅ — `PostToolActions` auto-checks diagnostics after code edits, feeds back to agent.
10. **Image/Vision Input** ✅ — Paste/drop image support, base64 encoding, vision model detection.
11. **Web Fetch** ✅ — `web_fetch` tool with HTML-to-markdown conversion, SSRF protection, timeout.
12. **Apply Patch** ✅ — `apply_patch` tool for unified diff format, multi-file create/modify/delete/rename.
13. **Thinking/Reasoning Display** ✅ — Extracts `<thinking>` blocks, renders in collapsible `ThinkingRow` component.
14. **Inline Diff in Chat** ✅ — Colored additions/deletions in `ToolCallCard` with "Full Diff" button.
15. **Settings UI** ✅ — In-webview settings panel for API keys, model selection, budget, auto-approve toggles (granular: read/write/execute safe/all, browser, MCP, external paths, notifications).
16. **Plan/Act Mode Dedicated Tools** ✅ — `plan_mode_respond` (present options, wait for user, YOLO auto-switch) + `act_mode_respond` (non-blocking progress, consecutive-call prevention).
17. **New Task Tool** ✅ — Agent can suggest starting a fresh task with context handoff.
18. **Auto-Condense** ✅ — Automatic context window monitoring at 85% threshold triggers smart compression.
19. **Enhanced Auto-Approve** ✅ — Safe command detection (40+ safe commands), external vs workspace path distinction, granular execute safe vs all commands.

### Tier 3 — Advanced / Emerging
20. **Subagent Orchestration** — ❌ Not built. Complex task decomposition pattern.
21. **Custom Modes** ✅ — 6 built-in + custom mode support with role prompts, tool restrictions, mode manager.
22. **Hooks/Lifecycle Events** ✅ — `HookManager` with pre/post tool, file write, command execute hooks. Safe evaluation.
23. **Cross-Session Memory** ✅ — `ProjectMemory` extracts and persists facts across conversations.
24. **Architect Mode (2-model)** — ⚠️ Partial. Plan mode uses same model. Different models per mode is theoretically supported via mode config.
25. **Tab Autocomplete** — ❌ Not feasible for VS Code extension (requires IDE-level integration).

---

## Architectural Patterns Worth Adopting

### 1. Boomerang Orchestration (from Roo Code)
Break complex tasks into subtasks, each running in a specialized mode with isolated context. Parent task stays clean. Results flow automatically between subtasks.

### 2. Architect Mode (from Aider)
Use an expensive reasoning model (Opus/O1) to create a plan, then a fast execution model (Sonnet/Haiku) to apply changes. Separates reasoning cost from execution cost.

### 3. Hooks System (from Claude Code)
Shell commands that fire at lifecycle events (PreToolUse, PostToolUse, SessionStart, etc.). Enables: auto-formatting after writes, auto-linting, CI triggers, custom logging.

### 4. Tree-Sitter Repo Map (from Aider)
Parse the entire repo into an AST, extract classes/functions/signatures, rank by relevance using graph algorithms. Provides LLM with compact yet comprehensive codebase overview.

### 5. Checkpoint Shadow Commits (from Cline)
Create hidden git commits at each significant change. User can restore to any checkpoint without polluting their real git history.

### 6. MCP as Plugin System (from Cline/Roo Code)
Use MCP not just for tool integration but as the primary plugin/extension mechanism. Each MCP server = a plugin with its own tools, resources, and prompts.

---

## Key Takeaways

1. **MCP is now table stakes.** 7/8 major tools support it. ✅ MitraHelix now supports MCP with MCPHub auto-reconnection.
2. **The agent loop is converging.** Everyone has Plan/Act, streaming, multi-model. ✅ MitraHelix has structured plan mode, 6 modes, parallel tools.
3. **Safety/undo is expected.** Checkpoints + diff view are minimum. ✅ MitraHelix has git-based shadow checkpoints + VS Code diff editor.
4. **Context quality wins.** Semantic search + AST repo maps + compression = better answers with fewer tokens. ⚠️ Partial — has smart compression + condense tool but needs semantic search/tree-sitter.
5. **The CLI tools (Claude Code, Codex CLI) are catching up fast.** Their multi-agent and hooks systems are more advanced than most IDE extensions. ✅ MitraHelix has hooks system.
6. **Custom modes + marketplace = community.** Roo Code's approach of letting users create and share specialized modes creates a flywheel effect. ✅ MitraHelix supports custom modes.

## Remaining Gaps (Future Work)

1. **Tree-Sitter AST** — Would significantly improve code understanding. Requires native module integration.
2. **Semantic Search** — Embedding-based codebase search for better context selection.
3. **Subagent Orchestration** — Multi-agent task decomposition for complex tasks.
4. **Model-Specific Prompt Variants** — Optimized prompts per model family (GPT, Gemini, etc.).
5. **Web Search Tool** — Cline's web_search uses a proprietary API. Could integrate with SerpAPI or similar.
6. **Focus Chain / Task Progress** — Checklist-based task progress tracking during execution.
7. **SSE/StreamableHTTP MCP Transports** — Currently only stdio. Remote MCP servers would need SSE/HTTP.
8. **Generate Explanation Tool** — AI-powered diff explanation for code review workflows.
9. **Skills System** — Loadable skill definitions for specialized agent behaviors.
