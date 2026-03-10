# MitraHelix — Comprehensive Feature Implementation Plan

> **Generated:** March 10, 2026
> **Scope:** Deep forensic analysis of MitraHelix codebase + competitive research across 8 AI-IDE tools (Cline, Continue, Aider, Cursor, Windsurf, Roo Code, Codex CLI, Claude Code)
> **Goal:** Close every meaningful feature gap and position MitraHelix as a top-tier open-source AI-IDE extension

---

## Executive Summary

MitraHelix has a **solid foundation** — 38 source files, 9 tools, 6 LLM providers, 26 models, streaming, Plan/Act modes, rules/workflows, @mentions, and a polished React UI that passed 35 rounds of forensic review with 174 fixes. However, comparing against 8 competitors reveals **16 critical feature gaps** that prevent MitraHelix from competing at the top tier.

### Current State vs Competition

| Category | MitraHelix | Industry Standard |
|----------|-----------|------------------|
| Agent Core | Solid ReAct loop, dual tool format | Missing: parallel tools, subagents, architect mode |
| Safety/Undo | Approval system, budget controls | Missing: diff view, checkpoints, .mitrahelixignore |
| Context | 7 @mentions, rules, diagnostics | Missing: AST repo map, semantic search, vision input |
| Extensibility | Rules + workflows | Missing: MCP, hooks, custom modes |
| Persistence | None (state lost on reload) | Missing: task history, session resume, cross-session memory |
| Developer Workflow | Basic command execution | Missing: linter integration, test runner, browser automation |
| UI | Functional chat with React.memo | Missing: diff view, conversation history, code actions, virtual scrolling |

### Priority Tiers

- **Tier 1 (Table Stakes):** 5 features every competitor has — ship these first
- **Tier 2 (Differentiators):** 5 features that separate good from great
- **Tier 3 (Advanced):** 6 features for category leadership

---

## TIER 1 — TABLE STAKES (Must-Have)

These are features that 6+ of 8 competitors already ship. Without them, MitraHelix cannot compete.

---

### 1.1 Diff View Integration

**Why:** All 8 competitors show before/after diffs for file changes. MitraHelix's `ApprovalDialog` shows raw content but no visual diff. Users cannot confidently approve changes they can't see clearly.

**Competitive Reference:** Cline shows "See Changes" button that opens VS Code's native diff editor. Cursor shows inline diffs. Continue shows edit-mode diffs.

#### Architecture

```
src/core/diff/
├── DiffEngine.ts          # Generate unified diffs from file changes
├── DiffViewProvider.ts    # VS Code diff editor integration
└── InlineDiffRenderer.ts  # Webview inline diff for approval dialog
```

#### Implementation Details

**A. `DiffEngine.ts` — Diff Generation**

```typescript
import { diffLines, Change } from 'diff';

export interface FileDiff {
  filePath: string;
  originalContent: string;
  newContent: string;
  changes: Change[];
  addedLines: number;
  removedLines: number;
  isNewFile: boolean;
}

export class DiffEngine {
  computeDiff(original: string, modified: string): Change[];
  formatUnifiedDiff(diff: FileDiff): string;
  computeSearchReplaceDiff(filePath: string, searchReplaceBlocks: SearchReplaceBlock[]): FileDiff;
}
```

- Use npm `diff` package (lightweight, battle-tested)
- Before `write_to_file` or `replace_in_file` executes, read original content
- Compute diff and attach to `ToolCallInfo`
- Support both unified format (for system prompt / tool result) and structured format (for UI)

**B. `DiffViewProvider.ts` — VS Code Native Diff Editor**

```typescript
export class DiffViewProvider {
  showDiff(filePath: string, originalContent: string, newContent: string): Promise<void>;
  showDiffFromToolCall(toolCall: ToolCallInfo): Promise<void>;
}
```

- Use `vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, title)`
- Create temporary `TextDocumentContentProvider` for original content (before changes)
- Modified content comes from the proposed change
- Register URI scheme `mitrahelix-diff:` for virtual documents
- Add "See Changes" button in `ToolCallCard.tsx` and `ApprovalDialog.tsx`

**C. Webview Inline Diff**

- Add lightweight inline diff rendering in `ApprovalDialog.tsx` using a simple +/- line renderer
- Color: green background for additions, red for deletions (using VS Code theme variables)
- Collapsible unchanged lines (show 3 lines of context around changes)

#### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `diff` dependency |
| **New:** `src/core/diff/DiffEngine.ts` | Diff computation logic |
| **New:** `src/core/diff/DiffViewProvider.ts` | VS Code diff editor integration |
| `src/core/tools/definitions/WriteFileTool.ts` | Read original before writing, attach diff to result |
| `src/core/tools/definitions/ReplaceInFileTool.ts` | Read original before replacing, attach diff to result |
| `src/shared/ToolTypes.ts` | Add `diff?: FileDiff` to `ToolResult` |
| `src/shared/MessageTypes.ts` | Add `showDiff` webview→extension message |
| `src/core/webview/WebviewProvider.ts` | Handle `showDiff` message |
| `webview-ui/src/components/ApprovalDialog.tsx` | Inline diff rendering + "See in Editor" button |
| `webview-ui/src/components/ToolCallCard.tsx` | "See Changes" button for completed write tools |

#### Estimated Effort: 3-4 days

---

### 1.2 Checkpoints / Git Snapshot System

**Why:** Cline, Aider, and Roo Code offer instant restore. Users need a safety net when an agent makes destructive changes across multiple files. Without checkpoints, the only undo is manual Ctrl+Z per file.

**Competitive Reference:** Cline uses "shadow commits" — hidden git commits that don't pollute the user's actual history. Aider auto-commits every change with descriptive messages.

#### Architecture

```
src/core/checkpoints/
├── CheckpointManager.ts    # Create/restore/list checkpoints
├── ShadowGitManager.ts     # Hidden git operations in .mitrahelix/checkpoints/
└── types.ts                # Checkpoint metadata types
```

#### Implementation Details

**A. `ShadowGitManager.ts` — Hidden Git Operations**

Two approaches (choose one):

**Approach A — Shadow Git Directory (Recommended):**
- Maintain a separate git repository inside `.mitrahelix/checkpoints/`
- Before each task starts, copy tracked files into shadow repo and commit
- Before each destructive tool (write/replace/execute), create a checkpoint commit
- Restore = copy files from shadow repo back to workspace
- Advantage: doesn't touch user's git history at all
- Disadvantage: storage overhead (mitigated by git's dedup)

**Approach B — Git Stash/Tag Based:**
- Use `git stash` or lightweight tags on the user's actual repo
- Create tagged commits before changes: `mitrahelix/checkpoint/<taskId>/<timestamp>`
- Restore = `git checkout` the tagged commit for specific files
- Advantage: lightweight, leverages existing git
- Disadvantage: requires clean working tree, may conflict with user's workflow

```typescript
export class ShadowGitManager {
  private shadowDir: string; // .mitrahelix/checkpoints/

  async initialize(): Promise<void>;
  async createCheckpoint(label: string, files: string[]): Promise<CheckpointId>;
  async restoreCheckpoint(id: CheckpointId): Promise<RestoreResult>;
  async listCheckpoints(taskId?: string): Promise<Checkpoint[]>;
  async diffFromCheckpoint(id: CheckpointId): Promise<FileDiff[]>;
  async pruneOldCheckpoints(maxAge: number): Promise<void>;
}
```

**B. `CheckpointManager.ts` — High-Level Orchestration**

```typescript
export class CheckpointManager {
  async createPreTaskCheckpoint(taskId: string): Promise<void>;
  async createPreToolCheckpoint(taskId: string, toolName: string, params: Record<string, unknown>): Promise<CheckpointId>;
  async restoreToCheckpoint(id: CheckpointId): Promise<void>;
  async getTaskCheckpoints(taskId: string): Promise<Checkpoint[]>;
  async compareWithCheckpoint(id: CheckpointId): Promise<FileDiff[]>;
}
```

- Automatically create checkpoint before:
  - `write_to_file` — snapshot the target file (or note it didn't exist)
  - `replace_in_file` — snapshot the target file
  - `execute_command` — snapshot all tracked workspace files (commands can affect anything)
- Each checkpoint stores: taskId, timestamp, label, affected files, tool that triggered it
- Expose "Restore to Checkpoint" in webview UI

**C. Webview Integration**

- Add checkpoint indicator in `TaskHeader.tsx` showing number of checkpoints
- Add checkpoint timeline/list view accessible from header
- Each checkpoint shows: timestamp, tool name, files affected, "Restore" button, "Show Diff" button
- Restore triggers confirmation dialog

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/checkpoints/CheckpointManager.ts` | High-level checkpoint logic |
| **New:** `src/core/checkpoints/ShadowGitManager.ts` | Git operations |
| **New:** `src/core/checkpoints/types.ts` | Checkpoint types |
| `src/core/agent/AgentLoop.ts` | Call `checkpointManager.createPreToolCheckpoint()` before destructive tools |
| `src/core/agent/AgentController.ts` | Create pre-task checkpoint, expose restore API |
| `src/shared/MessageTypes.ts` | Add checkpoint-related messages |
| `src/core/webview/WebviewProvider.ts` | Handle checkpoint messages |
| **New:** `webview-ui/src/components/CheckpointTimeline.tsx` | Checkpoint UI |
| `webview-ui/src/components/TaskHeader.tsx` | Checkpoint indicator |
| `webview-ui/src/hooks/useChat.ts` | Checkpoint state |

#### Estimated Effort: 4-5 days

---

### 1.3 MCP (Model Context Protocol) Integration

**Why:** 7 of 8 competitors support MCP. It's the industry standard for tool extensibility. MCP lets users connect databases, APIs, custom workflows, and third-party services as tools the agent can use. Without MCP, MitraHelix is a closed system.

**Competitive Reference:** Cline is the #1 MCP client. Roo Code supports project-level `.roo/mcp.json`. Claude Code has 300+ MCP services.

#### Architecture

```
src/core/mcp/
├── MCPClientManager.ts      # Manages MCP server connections
├── MCPToolBridge.ts         # Bridges MCP tools into MitraHelix tool system
├── MCPResourceAccess.ts     # Read MCP server resources
├── MCPTransport.ts          # STDIO, HTTP, SSE transport handling
├── MCPConfigLoader.ts       # Load MCP config from .mitrahelix/mcp.json
└── types.ts                 # MCP-related types
```

#### Implementation Details

**A. `MCPClientManager.ts` — Server Lifecycle**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export class MCPClientManager {
  private servers: Map<string, MCPServerConnection>;

  async loadConfig(): Promise<void>;
  async connectServer(config: MCPServerConfig): Promise<void>;
  async disconnectServer(name: string): Promise<void>;
  async disconnectAll(): Promise<void>;
  getConnectedServers(): MCPServerInfo[];
  getAvailableTools(): MCPToolDefinition[];
  getAvailableResources(): MCPResourceDefinition[];
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult>;
  async readResource(serverName: string, uri: string): Promise<MCPResourceContent>;
}
```

**B. Configuration — `.mitrahelix/mcp.json`**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "transport": "stdio"
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      },
      "transport": "stdio",
      "alwaysAllow": ["query"]
    },
    "remote-api": {
      "url": "https://api.example.com/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer ${env:API_TOKEN}"
      }
    }
  }
}
```

Also support global config at `~/.mitrahelix/mcp.json` (merged with project-level, project takes precedence).

**C. `MCPToolBridge.ts` — Integration with Tool System**

```typescript
export class MCPToolBridge {
  registerMCPTools(registry: ToolRegistry, mcpManager: MCPClientManager): void;
  createToolDefinition(mcpTool: MCPToolDefinition, serverName: string): Tool;
}
```

- Dynamically register two meta-tools:
  - `use_mcp_tool` — Call any MCP server tool by name
  - `access_mcp_resource` — Read any MCP server resource by URI
- These appear in the tool catalog alongside built-in tools
- Permission: MCP tools always require approval unless in server's `alwaysAllow` list

**D. Transport Support**

| Transport | Use Case | Implementation |
|-----------|----------|---------------|
| STDIO | Local command-line MCP servers (most common) | Spawn child process, communicate via stdin/stdout |
| SSE (Server-Sent Events) | Remote MCP servers | HTTP connection with SSE for server→client events |
| Streamable HTTP | Newer remote servers | HTTP POST for client→server, streaming response |

**E. Webview Integration**

- Add MCP server status in `TaskHeader.tsx` (connected count, health indicator)
- Add MCP configuration panel accessible from settings
- Show MCP tools in tool catalog alongside built-in tools
- MCP tool calls shown in `ToolCallCard.tsx` with server name prefix

#### Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@modelcontextprotocol/sdk` dependency |
| **New:** `src/core/mcp/MCPClientManager.ts` | Server lifecycle management |
| **New:** `src/core/mcp/MCPToolBridge.ts` | Tool system integration |
| **New:** `src/core/mcp/MCPResourceAccess.ts` | Resource reading |
| **New:** `src/core/mcp/MCPTransport.ts` | Transport abstraction |
| **New:** `src/core/mcp/MCPConfigLoader.ts` | Config file loading |
| **New:** `src/core/mcp/types.ts` | MCP types |
| `src/extension.ts` | Initialize MCPClientManager, connect servers on activation |
| `src/core/tools/ToolRegistry.ts` | Support dynamic tool registration from MCP |
| `src/core/agent/AgentController.ts` | Pass MCP tools to agent loop |
| `src/core/prompts/SystemPromptBuilder.ts` | Include MCP tool definitions in system prompt |
| `src/core/permissions/PermissionManager.ts` | Handle MCP tool permissions + `alwaysAllow` |
| `src/shared/MessageTypes.ts` | MCP status messages |
| `webview-ui/src/components/TaskHeader.tsx` | MCP status indicator |

#### Estimated Effort: 5-7 days

---

### 1.4 Parallel Tool Execution

**Why:** 6 of 8 competitors support parallel tool execution. When the LLM requests multiple independent reads or searches, executing them simultaneously provides 2-5x speedup. Sequential execution is the single biggest performance bottleneck.

**Competitive Reference:** Claude Code executes up to 10 tools in parallel. Cursor batches independent reads. Roo Code added parallel tool calling in v3.44.

#### Architecture

This is primarily a change to `AgentLoop.ts` and how tool calls are batched.

#### Implementation Details

**A. Tool Dependency Analysis**

```typescript
export class ToolDependencyAnalyzer {
  canRunInParallel(toolCalls: LLMToolCall[]): LLMToolCall[][];
}
```

Rules for parallelization:
- **Always parallel:** Multiple `read_file` calls (different files)
- **Always parallel:** Multiple `search_files` calls (independent searches)
- **Always parallel:** Multiple `list_files` calls (different directories)
- **Always parallel:** `list_code_definition_names` calls (different files)
- **Never parallel:** `write_to_file` or `replace_in_file` (may conflict)
- **Never parallel:** `execute_command` (may have side effects)
- **Never parallel with writes:** Any read on a file being written
- **Sequential:** `attempt_completion`, `ask_followup_question` (terminal)

Classification:
```typescript
type ToolParallelCategory = 'read' | 'write' | 'execute' | 'terminal';

const TOOL_CATEGORIES: Record<string, ToolParallelCategory> = {
  read_file: 'read',
  search_files: 'read',
  list_files: 'read',
  list_code_definition_names: 'read',
  write_to_file: 'write',
  replace_in_file: 'write',
  execute_command: 'execute',
  attempt_completion: 'terminal',
  ask_followup_question: 'terminal',
  use_mcp_tool: 'execute',      // conservative: treat as side-effecting
  access_mcp_resource: 'read',
};
```

**B. Batch Execution in AgentLoop**

```typescript
// In AgentLoop.run():
const batches = this.dependencyAnalyzer.canRunInParallel(toolCalls);

for (const batch of batches) {
  // All tools in this batch can run simultaneously
  const approvals = await Promise.all(
    batch.map(tc => this.getApproval(tc))
  );

  const approved = batch.filter((_, i) => approvals[i]);
  const results = await Promise.all(
    approved.map(tc => this.toolExecutor.executeTool(tc.name, tc.arguments, context))
  );

  for (let i = 0; i < results.length; i++) {
    yield { type: 'toolCallCompleted', toolCallId: approved[i].id, result: results[i] };
    this.memory.addMessage({ role: 'tool', toolCallId: approved[i].id, content: results[i].output });
  }
}
```

**C. Approval Batching**

When multiple tools need approval, show them all in the approval dialog at once:
- "Approve All" button for read-only batches
- Individual approve/reject for mixed batches
- Batch approval dialog shows all pending tools with their parameters

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/agent/ToolDependencyAnalyzer.ts` | Parallelization logic |
| `src/core/agent/AgentLoop.ts` | Replace sequential execution with batched parallel |
| `src/core/tools/ToolExecutor.ts` | Add `executeBatch()` method |
| `src/shared/MessageTypes.ts` | Add `requestBatchApproval` message type |
| `webview-ui/src/components/ApprovalDialog.tsx` | Support batch approval UI |
| `webview-ui/src/hooks/useChat.ts` | Handle batch approval state |

#### Estimated Effort: 3-4 days

---

### 1.5 Task History & Conversation Persistence

**Why:** 7 of 8 competitors persist conversations. When VS Code reloads or the user starts a new task, all conversation history is lost. Users expect to resume tasks, review past conversations, and learn from previous sessions.

**Competitive Reference:** Cline stores full task history with restore. Cursor persists conversations per-workspace. Claude Code supports named sessions with resume.

#### Architecture

```
src/core/persistence/
├── TaskHistoryManager.ts    # Save/load/list/delete task histories
├── ConversationStore.ts     # Serialize/deserialize conversation state
└── types.ts                 # Persistence types
```

Storage location: `.mitrahelix/history/` (per-workspace) with JSON files per task.

#### Implementation Details

**A. `TaskHistoryManager.ts`**

```typescript
export interface TaskHistoryEntry {
  id: string;
  title: string;                    // First user message (truncated to 100 chars)
  createdAt: string;                // ISO timestamp
  updatedAt: string;
  provider: string;
  model: string;
  totalCost: number;
  totalTokens: { input: number; output: number };
  messageCount: number;
  status: 'completed' | 'cancelled' | 'error' | 'in_progress';
  messages: LLMMessage[];           // Full conversation
  toolCallCount: number;
  checkpoints?: CheckpointId[];     // Associated checkpoints
}

export class TaskHistoryManager {
  private historyDir: string;       // .mitrahelix/history/

  async saveTask(entry: TaskHistoryEntry): Promise<void>;
  async loadTask(id: string): Promise<TaskHistoryEntry | null>;
  async listTasks(limit?: number, offset?: number): Promise<TaskHistoryEntry[]>;
  async deleteTask(id: string): Promise<void>;
  async searchTasks(query: string): Promise<TaskHistoryEntry[]>;
  async getRecentTasks(count: number): Promise<TaskHistoryEntry[]>;
  async exportTask(id: string, format: 'json' | 'markdown'): Promise<string>;
  async pruneHistory(maxEntries: number, maxAge: number): Promise<void>;
}
```

**B. Auto-Save Strategy**

- Save after every agent loop iteration (incremental updates)
- Save on task completion/cancellation/error
- Save on VS Code deactivation (`deactivate()`)
- Use file locking to prevent corruption
- Keep last 100 tasks (configurable), auto-prune older ones
- Individual task files: `.mitrahelix/history/<taskId>.json`
- Index file: `.mitrahelix/history/index.json` (list of all tasks with metadata, no messages)

**C. Webview State Persistence**

Use VS Code webview `getState()`/`setState()` API (already have wrappers in `vscodeApi.ts` but unused):
- Save current conversation state to webview state on every update
- Restore on webview re-creation (when switching tabs and coming back)
- This is separate from task history — it's for surviving webview hide/show cycles

**D. Conversation Resume**

- "Continue" button on task history entries that are incomplete
- Loads messages back into `ConversationMemory`
- Re-creates `AgentLoop` with restored state
- Agent sees full conversation history and can continue where it left off

**E. Webview UI**

- Add "History" button in `TaskHeader.tsx` or as a sidebar tab
- History view: list of past tasks with title, date, model, cost, status
- Search/filter by text, date range, model, status
- Click to view read-only conversation
- "Resume" button for in-progress tasks
- "Export" button for sharing conversations
- "Delete" for cleanup

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/persistence/TaskHistoryManager.ts` | History management |
| **New:** `src/core/persistence/ConversationStore.ts` | Serialization |
| **New:** `src/core/persistence/types.ts` | Types |
| `src/core/agent/AgentController.ts` | Auto-save on iterations, expose history API |
| `src/extension.ts` | Initialize TaskHistoryManager, save on deactivate |
| `src/shared/MessageTypes.ts` | History-related messages |
| `src/core/webview/WebviewProvider.ts` | Handle history messages |
| **New:** `webview-ui/src/components/TaskHistory.tsx` | History list UI |
| **New:** `webview-ui/src/components/TaskHistoryDetail.tsx` | Read-only conversation view |
| `webview-ui/src/components/TaskHeader.tsx` | History button |
| `webview-ui/src/hooks/useChat.ts` | History state + webview state persistence |
| `webview-ui/src/utils/vscodeApi.ts` | Activate getState/setState usage |

#### New Configuration

```json
{
  "mitraHelix.maxHistoryEntries": {
    "type": "number",
    "default": 100,
    "description": "Maximum number of task history entries to keep"
  },
  "mitraHelix.historyMaxAge": {
    "type": "number",
    "default": 30,
    "description": "Maximum age of history entries in days"
  }
}
```

#### Estimated Effort: 4-5 days

---

## TIER 2 — COMPETITIVE DIFFERENTIATORS

These features separate good AI-IDE tools from great ones. Having 3+ of these puts MitraHelix in the top tier.

---

### 2.1 Tree-Sitter AST Repository Map

**Why:** MitraHelix's `ListCodeDefinitionsTool` uses regex patterns (166 lines) that only work for TS/JS/Python/Go/Java. Aider's tree-sitter-based repo map provides language-agnostic AST parsing for 30+ languages, extracts class/function/interface signatures, and ranks them by relevance. This dramatically improves the LLM's understanding of large codebases.

**Competitive Reference:** Aider pioneered this. Cursor uses custom embeddings + AST. Claude Code has comprehensive code understanding.

#### Architecture

```
src/core/context/
├── RepoMapGenerator.ts      # Tree-sitter AST parsing + ranking
├── TreeSitterManager.ts     # Tree-sitter WASM initialization + language loading
└── relevance/
    ├── GraphRanker.ts        # PageRank-style relevance scoring
    └── SymbolIndex.ts        # In-memory symbol index with file→symbol mappings
```

#### Implementation Details

**A. Tree-Sitter WASM Integration**

```typescript
import Parser from 'web-tree-sitter';

export class TreeSitterManager {
  private parser: Parser;
  private languages: Map<string, Parser.Language>;

  async initialize(): Promise<void>;
  async loadLanguage(langId: string): Promise<Parser.Language>;
  parseFile(content: string, language: Parser.Language): Parser.Tree;
  extractDefinitions(tree: Parser.Tree, langId: string): CodeDefinition[];
}
```

Supported languages (via `tree-sitter-<lang>.wasm`):
- TypeScript, JavaScript, TSX, JSX
- Python, Go, Java, Rust, C, C++, C#
- Ruby, PHP, Swift, Kotlin
- HTML, CSS, SCSS
- JSON, YAML, TOML, Markdown

**B. `RepoMapGenerator.ts` — Compact Codebase Summary**

```typescript
export interface CodeDefinition {
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'enum' | 'variable' | 'module';
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  signature: string;       // e.g., "async function fetchData(url: string): Promise<Response>"
  parentName?: string;     // e.g., class name for methods
  references: string[];    // Files that import/reference this symbol
}

export class RepoMapGenerator {
  async generateMap(workspaceRoot: string, tokenBudget: number): Promise<string>;
  async generateFileMap(filePath: string): Promise<CodeDefinition[]>;
  async getRelevantDefinitions(query: string, maxTokens: number): Promise<CodeDefinition[]>;
}
```

Map format (compact, ~2K tokens for medium repo):
```
src/core/agent/AgentController.ts:
  class AgentController
    handleUserMessage(text: string, attachments?: Attachment[]): Promise<void>
    approveToolCall(toolCallId: string): void
    rejectToolCall(toolCallId: string, reason?: string): void
    cancelCurrentTask(): void
  
src/core/agent/AgentLoop.ts:
  class AgentLoop
    *run(): AsyncGenerator<AgentEvent>
    resolveApproval(toolCallId: string, approved: boolean): void
```

**C. Relevance Ranking**

Use PageRank-style algorithm based on:
1. **Import graph:** Files that import a symbol rank it higher
2. **Recency:** Recently modified files get a boost
3. **Query relevance:** If user mentions specific files/concepts, boost related symbols
4. **Depth:** Top-level exports rank higher than private helper functions

Token budget management:
- Default: 1024 tokens for repo map in system prompt
- Configurable via `mitraHelix.repoMapTokens`
- When over budget, drop lowest-ranked definitions first
- Cache parsed ASTs with file modification time check (invalidate on change)

**D. Replace Regex-Based `ListCodeDefinitionsTool`**

- Keep regex as fallback for when tree-sitter WASM isn't available
- Default to tree-sitter when initialized
- Add languages: Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin

#### Dependencies

```json
{
  "web-tree-sitter": "^0.22.0"
}
```

Plus WASM files for each language (bundled with extension or downloaded on first use):
- Store in `resources/tree-sitter/` directory
- Total size: ~5-10MB for all languages
- Lazy-load: only load languages that are present in the workspace

#### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `web-tree-sitter` dependency |
| **New:** `src/core/context/TreeSitterManager.ts` | Tree-sitter initialization |
| **New:** `src/core/context/RepoMapGenerator.ts` | Repo map generation |
| **New:** `src/core/context/relevance/GraphRanker.ts` | Relevance ranking |
| **New:** `src/core/context/relevance/SymbolIndex.ts` | Symbol index |
| `src/core/context/ContextManager.ts` | Replace file tree with repo map |
| `src/core/tools/definitions/ListCodeDefinitionsTool.ts` | Use tree-sitter instead of regex |
| `src/core/prompts/SystemPromptBuilder.ts` | Include repo map in system prompt |
| `src/shared/constants.ts` | Add `DEFAULT_REPO_MAP_TOKENS = 1024` |

#### New Configuration

```json
{
  "mitraHelix.repoMapTokens": {
    "type": "number",
    "default": 1024,
    "description": "Token budget for repository map in system prompt"
  }
}
```

#### Estimated Effort: 5-7 days

---

### 2.2 Image/Vision Input Support

**Why:** 6 of 8 competitors support image/screenshot input. Users need to show UI bugs, design mockups, error screenshots, and diagrams to the AI. Without vision, MitraHelix cannot handle frontend/UI tasks effectively.

**Competitive Reference:** Cline captures browser screenshots via Puppeteer. Cursor supports image attachments. Codex CLI accepts image inputs.

#### Implementation Details

**A. Image Attachment in Input**

- Add image attachment button (paperclip icon) to `InputBox.tsx`
- Support: drag-and-drop, paste from clipboard, file picker
- Accepted formats: PNG, JPEG, GIF, WebP
- Max size: 5MB per image, 20MB total per message
- Display thumbnails in attachment chips area
- Store images as base64 data URLs (for webview→extension transfer)

**B. Image in LLM Messages**

Anthropic and OpenAI both support vision via content arrays:

```typescript
// Anthropic format
{
  role: 'user',
  content: [
    { type: 'text', text: 'Fix this bug visible in the screenshot' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
  ]
}

// OpenAI format
{
  role: 'user',
  content: [
    { type: 'text', text: 'Fix this bug visible in the screenshot' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
  ]
}
```

**C. Provider Support Matrix**

| Provider | Vision Support | Format |
|----------|---------------|--------|
| Anthropic (Claude Sonnet/Opus) | Yes | `type: 'image'` with base64 |
| OpenAI (GPT-5.x, GPT-4o) | Yes | `type: 'image_url'` with data URL |
| Google Gemini | Yes | Via OpenAI-compatible format |
| DeepSeek | No (strip images) | — |
| OpenRouter | Depends on model | Pass through |
| Ollama | Some models (llava) | Via OpenAI-compatible format |

**D. Screenshot Capture**

- Add "Capture Screenshot" command (`mitraHelix.captureScreenshot`)
- Uses VS Code's internal screenshot API or `html2canvas` approach
- Captures current editor viewport
- Automatically attaches to current message

#### Files to Modify

| File | Changes |
|------|---------|
| `src/core/llm/types.ts` | Add `ImageContent` type to `LLMMessage` |
| `src/core/llm/AnthropicProvider.ts` | Handle image content in message conversion |
| `src/core/llm/OpenAIProvider.ts` | Handle image content in message conversion |
| `src/core/llm/models.ts` | Add `supportsVision: boolean` to ModelInfo |
| `src/core/agent/AgentController.ts` | Process image attachments |
| `src/shared/MessageTypes.ts` | Add image attachment type |
| `webview-ui/src/components/InputBox.tsx` | Image attachment UI (button, drag-drop, paste) |
| `webview-ui/src/components/MessageBubble.tsx` | Render images in messages |
| `webview-ui/src/hooks/useChat.ts` | Image attachment state |

#### Estimated Effort: 3-4 days

---

### 2.3 Browser Automation Tool

**Why:** Cline, Cursor, Windsurf, and Claude Code all offer browser automation. This enables: frontend testing, visual debugging, screenshot capture, web scraping for context, and live preview of web apps.

**Competitive Reference:** Cline uses Puppeteer for browser launch, navigation, click, type, screenshot, and console log capture.

#### Architecture

```
src/core/tools/definitions/BrowserActionTool.ts   # Tool definition
src/core/browser/
├── BrowserManager.ts                              # Puppeteer lifecycle
└── types.ts                                       # Browser action types
```

#### Implementation Details

**A. `BrowserManager.ts`**

```typescript
import puppeteer, { Browser, Page } from 'puppeteer-core';

export class BrowserManager {
  private browser: Browser | null;
  private page: Page | null;

  async launch(): Promise<void>;
  async navigate(url: string): Promise<void>;
  async click(selector: string): Promise<void>;
  async type(selector: string, text: string): Promise<void>;
  async screenshot(): Promise<string>;        // Returns base64
  async getConsoleLogs(): Promise<string[]>;
  async getPageContent(): Promise<string>;     // Readable text
  async close(): Promise<void>;
  async scrollDown(): Promise<void>;
  async scrollUp(): Promise<void>;
}
```

**B. `BrowserActionTool.ts`**

Tool parameters:
```typescript
{
  action: 'launch' | 'navigate' | 'click' | 'type' | 'screenshot' | 'console_logs' | 'scroll_down' | 'scroll_up' | 'close',
  url?: string,        // for navigate
  selector?: string,   // for click/type
  text?: string,       // for type
}
```

Returns:
- `launch`: "Browser launched successfully"
- `navigate`: Page title + URL + screenshot (base64)
- `click`: Screenshot after click
- `type`: Screenshot after typing
- `screenshot`: Base64 image
- `console_logs`: Array of console messages
- `scroll_*`: Screenshot after scroll
- `close`: "Browser closed"

**C. Chrome Detection**

Try to find Chrome/Chromium in standard locations:
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Linux: `/usr/bin/google-chrome`, `/usr/bin/chromium-browser`
- Fallback: Ask user to configure `mitraHelix.chromePath`
- Alternative: Bundle `puppeteer` (not `puppeteer-core`) which includes Chromium

#### Dependencies

```json
{
  "puppeteer-core": "^22.0.0"
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `puppeteer-core` dependency |
| **New:** `src/core/browser/BrowserManager.ts` | Puppeteer lifecycle |
| **New:** `src/core/browser/types.ts` | Browser types |
| **New:** `src/core/tools/definitions/BrowserActionTool.ts` | Tool definition |
| `src/extension.ts` | Register browser_action tool |
| `src/core/permissions/PermissionManager.ts` | browser_action always requires approval |
| `src/core/agent/AgentController.ts` | Clean up browser on task end |

#### New Configuration

```json
{
  "mitraHelix.chromePath": {
    "type": "string",
    "default": "",
    "description": "Path to Chrome/Chromium executable (auto-detected if empty)"
  }
}
```

#### Estimated Effort: 3-4 days

---

### 2.4 Linter & Test Runner Integration

**Why:** Aider and Claude Code automatically lint and run tests after every code change. This creates a tight feedback loop where the AI can fix its own mistakes immediately. Without it, users have to manually check for errors.

**Competitive Reference:** Aider has `--lint-cmd` and `--auto-test` flags. Claude Code runs linters via hooks system.

#### Implementation Details

**A. Auto-Lint After Write**

MitraHelix already has `DiagnosticsContext.ts` that reads VS Code diagnostics. The missing piece is:

1. After `write_to_file` or `replace_in_file` succeeds, wait 1-2 seconds for VS Code linters to update
2. Check `vscode.languages.getDiagnostics()` for the modified file
3. If new errors are found, automatically inject them as a tool result message:

```
[LINTER] New errors detected in src/utils.ts after your edit:
  Line 15: Property 'name' does not exist on type 'User' (ts2339)
  Line 23: Unused variable 'result' (ts6133)

Please fix these errors.
```

4. The LLM sees these errors and can self-correct in the next iteration

**B. Auto-Test After Edit**

```typescript
export class TestRunnerIntegration {
  private testCommand: string;  // from config: "npm test", "pytest", etc.

  async runTests(affectedFiles?: string[]): Promise<TestResult>;
  async detectTestFramework(): Promise<string | null>;
}
```

- After writing files, optionally run the project's test command
- Parse test output for pass/fail counts
- Feed failures back to the LLM as context
- Configurable: `mitraHelix.autoTestCommand` and `mitraHelix.autoTestEnabled`

**C. Diagnostic Feedback Loop in AgentLoop**

Add a post-tool-execution step:

```typescript
// After write/replace tool execution:
if (['write_to_file', 'replace_in_file'].includes(toolCall.name)) {
  await this.waitForDiagnostics(1500); // Wait for linters
  const newErrors = await this.diagnosticsContext.getErrorsForFile(filePath);
  if (newErrors.length > 0) {
    const lintMessage = formatLintErrors(newErrors);
    this.memory.addMessage({ role: 'user', content: `[SYSTEM] ${lintMessage}` });
  }
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/tools/PostToolActions.ts` | Post-execution lint/test checking |
| **New:** `src/core/testing/TestRunnerIntegration.ts` | Test runner |
| `src/core/agent/AgentLoop.ts` | Add post-tool-execution lint check |
| `src/core/context/DiagnosticsContext.ts` | Add `getErrorsForFile()` method |

#### New Configuration

```json
{
  "mitraHelix.autoLintAfterEdit": {
    "type": "boolean",
    "default": true,
    "description": "Automatically check for linter errors after file edits"
  },
  "mitraHelix.autoTestCommand": {
    "type": "string",
    "default": "",
    "description": "Test command to run after edits (e.g., 'npm test')"
  },
  "mitraHelix.autoTestEnabled": {
    "type": "boolean",
    "default": false,
    "description": "Automatically run tests after file edits"
  }
}
```

#### Estimated Effort: 2-3 days

---

### 2.5 `.mitrahelixignore` — File Protection

**Why:** Cline has `.clineignore`, Aider has `.aiderignore`. Users need to protect sensitive files (`.env`, credentials, private keys) from being read or sent to LLM APIs.

#### Implementation Details

**A. Ignore File Format**

`.mitrahelixignore` in workspace root, gitignore syntax:
```
# Sensitive files
.env
.env.*
*.pem
*.key
credentials.json

# Large binary files
*.zip
*.tar.gz
node_modules/
dist/

# Private directories
.secret/
```

**B. `IgnoreManager.ts`**

```typescript
import { minimatch } from 'minimatch';

export class IgnoreManager {
  private patterns: string[];

  async loadIgnoreFile(): Promise<void>;
  isIgnored(relativePath: string): boolean;
  filterFiles(paths: string[]): string[];
}
```

**C. Integration Points**

Apply ignore rules at every file access point:
- `ReadFileTool.ts` — reject reading ignored files
- `WriteFileTool.ts` — reject writing to ignored files (configurable)
- `ReplaceInFileTool.ts` — reject replacing in ignored files
- `SearchFilesTool.ts` — skip ignored files in search
- `ListFilesTool.ts` — hide ignored files in listing
- `ListCodeDefinitionsTool.ts` — skip ignored files
- `MentionsParser.ts` — reject @file mentions of ignored files
- `WorkspaceIndexer.ts` — exclude from file tree
- `RepoMapGenerator.ts` — exclude from repo map
- `ContextManager.ts` — exclude from active file context if ignored

**D. Warning System**

When the LLM tries to access an ignored file, return a clear error:
```
Error: File '.env' is protected by .mitrahelixignore and cannot be accessed.
```

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/ignore/IgnoreManager.ts` | Ignore pattern matching |
| All 7 file-access tools | Add ignore check before execution |
| `src/core/context/MentionsParser.ts` | Filter ignored files |
| `src/core/context/WorkspaceIndexer.ts` | Exclude ignored files |
| `src/core/context/ContextManager.ts` | Skip ignored active file |
| `src/extension.ts` | Initialize IgnoreManager, watch for changes |

#### Estimated Effort: 2 days

---

## TIER 3 — ADVANCED / CATEGORY LEADERSHIP

These features would put MitraHelix ahead of most competitors.

---

### 3.1 Architect Mode (Dual-Model Pattern)

**Why:** Aider's architect mode uses an expensive reasoning model (Claude Opus, GPT-5) to create a detailed plan, then a fast/cheap model (Claude Haiku, GPT-5 Mini) to execute the plan. This separates reasoning cost from execution cost, achieving better results at lower total cost for complex tasks.

**Competitive Reference:** Aider pioneered this. Roo Code has it in their Architect mode. Windsurf's Plan→Code mode is similar.

#### Implementation Details

**A. Mode System Extension**

Current modes: `plan`, `act`
New modes: `plan`, `act`, `architect`

In architect mode:
1. **Planning phase:** Use expensive model (configurable) to analyze the task and create a detailed, step-by-step implementation plan. No tool use allowed.
2. **Execution phase:** Automatically switch to fast model. The plan is injected as context. The fast model follows the plan step-by-step, using all tools.
3. **Review phase:** If execution model encounters issues, it can escalate back to the planning model for re-planning.

**B. Configuration**

```json
{
  "mitraHelix.architectPlannerModel": {
    "type": "string",
    "default": "claude-opus-4-6",
    "description": "Model to use for planning in Architect mode"
  },
  "mitraHelix.architectExecutorModel": {
    "type": "string",
    "default": "claude-haiku-4-5",
    "description": "Model to use for execution in Architect mode"
  }
}
```

**C. Protocol**

```typescript
// In AgentController:
async handleArchitectMode(task: string): Promise<void> {
  // Phase 1: Planning
  const planProvider = createProvider(architectPlannerConfig);
  const plan = await this.runPlanningPhase(planProvider, task);

  // Phase 2: Execution
  const execProvider = createProvider(architectExecutorConfig);
  const enrichedTask = `
    ## Original Task
    ${task}

    ## Implementation Plan (follow this exactly)
    ${plan}

    Execute this plan step by step. Use the available tools to implement each step.
  `;
  await this.runExecutionPhase(execProvider, enrichedTask);
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| `src/core/agent/AgentController.ts` | Add architect mode orchestration |
| `src/core/agent/AgentLoop.ts` | Support mode-specific provider switching |
| `src/core/llm/ProviderFactory.ts` | Support creating providers for specific models |
| `src/shared/MessageTypes.ts` | Add `architect` mode type |
| `webview-ui/src/components/TaskHeader.tsx` | Add Architect mode toggle |
| `webview-ui/src/components/InputBox.tsx` | Architect mode indicator |

#### Estimated Effort: 3-4 days

---

### 3.2 Custom Agent Modes

**Why:** Roo Code's custom mode system lets users create specialized agent modes with custom role definitions, tool restrictions, and model preferences. This enables community-driven specialization (e.g., a "Security Auditor" mode, a "Documentation Writer" mode, a "Test Engineer" mode).

**Competitive Reference:** Roo Code has 5 built-in modes + custom mode marketplace. Claude Code supports custom subagent configurations.

#### Implementation Details

**A. Built-in Modes**

| Mode | Icon | Role | Tools Allowed | Default Model |
|------|------|------|--------------|---------------|
| Code | `code` | Full coding assistant | All tools | User's default |
| Ask | `help-circle` | Read-only Q&A | read_file, search_files, list_files, list_code_definitions | User's default |
| Architect | `compass` | Planning & design | None (plan only) → then executor | Opus → Haiku |
| Debug | `bug` | Troubleshooting | All tools + enhanced diagnostics context | User's default |
| Review | `eye` | Code review | read_file, search_files, list_code_definitions | User's default |

**B. Custom Mode Definition**

Store in `.mitrahelix/modes/<modeName>.json`:

```json
{
  "name": "Security Auditor",
  "icon": "shield",
  "description": "Reviews code for security vulnerabilities",
  "rolePrompt": "You are a security expert. Focus on OWASP Top 10, injection attacks, auth issues, and data exposure.",
  "allowedTools": ["read_file", "search_files", "list_files", "list_code_definitions"],
  "restrictedTools": ["write_to_file", "replace_in_file", "execute_command"],
  "preferredModel": "claude-opus-4-6",
  "systemPromptAdditions": "Always check for: SQL injection, XSS, CSRF, path traversal, insecure deserialization.",
  "autoApprove": {
    "reads": true,
    "writes": false,
    "commands": false
  }
}
```

**C. Mode Manager**

```typescript
export class ModeManager {
  private builtinModes: Map<string, ModeDefinition>;
  private customModes: Map<string, ModeDefinition>;

  async loadModes(): Promise<void>;
  getMode(name: string): ModeDefinition | undefined;
  getAllModes(): ModeDefinition[];
  getToolsForMode(name: string): string[];
  getRolePromptForMode(name: string): string;
}
```

**D. Sticky Models Per Mode**

Each mode remembers its last-used model (stored in workspace state):
```typescript
// When user switches to "Debug" mode, auto-select the model they last used in Debug mode
const stickyModel = this.getModeModel(modeName);
if (stickyModel) this.switchModel(stickyModel);
```

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/modes/ModeManager.ts` | Mode management |
| **New:** `src/core/modes/types.ts` | Mode types |
| `src/core/agent/AgentController.ts` | Mode-aware tool filtering and prompt adjustment |
| `src/core/prompts/SystemPromptBuilder.ts` | Include mode role prompt |
| `src/core/tools/ToolRegistry.ts` | Tool filtering by mode |
| `src/shared/MessageTypes.ts` | Mode-related messages |
| `webview-ui/src/components/TaskHeader.tsx` | Mode selector (dropdown with icons) |
| `webview-ui/src/hooks/useChat.ts` | Mode state |

#### Estimated Effort: 3-4 days

---

### 3.3 Hooks / Lifecycle Events System

**Why:** Claude Code's hooks system enables powerful automation: auto-formatting after writes, auto-linting, CI triggers, custom logging, notifications. Windsurf also has hooks.

**Competitive Reference:** Claude Code has 10+ hook points (SessionStart, PreToolUse, PostToolUse, etc.)

#### Implementation Details

**A. Hook Points**

| Hook | When | Use Cases |
|------|------|-----------|
| `onSessionStart` | New task begins | Custom greeting, load project context |
| `onSessionEnd` | Task completes/cancels | Cleanup, stats logging |
| `preToolUse` | Before any tool executes | Validation, logging, custom rules |
| `postToolUse` | After tool completes | Auto-format, auto-lint, notifications |
| `preFileWrite` | Before writing a file | Backup, validation |
| `postFileWrite` | After writing a file | Auto-format (prettier), lint check |
| `preCommandExecute` | Before shell command | Sandboxing, logging |
| `postCommandExecute` | After shell command | Output parsing, error detection |
| `onApprovalRequest` | When approval is needed | Custom approval logic, auto-approve rules |
| `onError` | When an error occurs | Custom error handling, retry logic |

**B. Hook Configuration**

`.mitrahelix/hooks.json`:
```json
{
  "hooks": {
    "postFileWrite": [
      {
        "name": "Auto-format",
        "command": "npx prettier --write ${filePath}",
        "filePatterns": ["**/*.ts", "**/*.tsx", "**/*.js"],
        "enabled": true
      }
    ],
    "postCommandExecute": [
      {
        "name": "Notify on failure",
        "command": "echo 'Command failed: ${command}' >> .mitrahelix/error.log",
        "condition": "exitCode !== 0",
        "enabled": true
      }
    ],
    "onSessionEnd": [
      {
        "name": "Log stats",
        "command": "echo '${taskId}: ${totalCost} USD, ${messageCount} messages' >> .mitrahelix/stats.log",
        "enabled": true
      }
    ]
  }
}
```

**C. `HookManager.ts`**

```typescript
export class HookManager {
  async loadHooks(): Promise<void>;
  async executeHooks(hookPoint: HookPoint, context: HookContext): Promise<HookResult[]>;
}

interface HookContext {
  taskId: string;
  toolName?: string;
  filePath?: string;
  command?: string;
  exitCode?: number;
  totalCost?: number;
  messageCount?: number;
}
```

Variable substitution in hook commands: `${filePath}`, `${command}`, `${exitCode}`, `${taskId}`, `${totalCost}`.

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/hooks/HookManager.ts` | Hook orchestration |
| **New:** `src/core/hooks/types.ts` | Hook types |
| `src/core/agent/AgentLoop.ts` | Call hooks at appropriate lifecycle points |
| `src/core/agent/AgentController.ts` | Initialize HookManager, pass to loop |
| `src/core/tools/definitions/WriteFileTool.ts` | Pre/post write hooks |
| `src/core/tools/definitions/ReplaceInFileTool.ts` | Pre/post write hooks |
| `src/core/tools/definitions/ExecuteCommandTool.ts` | Pre/post command hooks |
| `src/extension.ts` | Initialize HookManager, watch hooks.json |

#### Estimated Effort: 3-4 days

---

### 3.4 Subagent Orchestration (Boomerang Pattern)

**Why:** Cursor, Roo Code, Claude Code, and Codex CLI all support multi-agent patterns. Complex tasks benefit from being broken into subtasks executed by specialized agents. The "Boomerang" pattern (from Roo Code) is the most elegant open-source approach.

**Competitive Reference:** Claude Code spawns up to 10 parallel subagents. Roo Code's Boomerang breaks tasks into subtasks with context isolation.

#### Implementation Details

**A. Orchestrator Mode**

When in "Orchestrator" mode, the agent:
1. Analyzes the complex task
2. Breaks it into subtasks, each assigned to a mode (Code, Debug, Review, etc.)
3. Spawns subtasks sequentially or in parallel
4. Each subtask gets its own `AgentLoop` with isolated `ConversationMemory`
5. Results from subtasks flow back to the orchestrator
6. Orchestrator summarizes and presents final result

**B. `SubagentManager.ts`**

```typescript
export interface SubtaskDefinition {
  id: string;
  description: string;
  mode: string;                    // 'code', 'debug', 'review', etc.
  model?: string;                  // Override model for this subtask
  maxIterations?: number;          // Limit iterations (default: 10)
  maxBudget?: number;              // Budget cap for subtask
  context?: string;                // Additional context to inject
  dependsOn?: string[];            // Subtask IDs that must complete first
}

export class SubagentManager {
  async spawnSubtask(definition: SubtaskDefinition): Promise<SubtaskResult>;
  async spawnParallel(definitions: SubtaskDefinition[]): Promise<SubtaskResult[]>;
  async cancelSubtask(id: string): Promise<void>;
  getActiveSubtasks(): SubtaskInfo[];
}
```

**C. Orchestrator Tool**

Add a new tool `delegate_subtask` available only in Orchestrator mode:

```typescript
{
  name: 'delegate_subtask',
  description: 'Delegate a subtask to a specialized agent',
  parameters: {
    description: { type: 'string', required: true, description: 'What the subtask should accomplish' },
    mode: { type: 'string', required: true, description: 'Agent mode: code, debug, review, ask' },
    context: { type: 'string', required: false, description: 'Additional context for the subtask' },
  }
}
```

**D. Context Isolation**

Each subtask:
- Gets its own `ConversationMemory` (fresh, no parent context leakage)
- Receives: orchestrator's subtask description + mode role prompt + workspace context
- Returns: completion summary + any files modified + any errors encountered
- Cannot access parent orchestrator's conversation or other subtasks' context

**E. Webview UI**

- Show subtask tree in chat panel when in orchestrator mode
- Each subtask: status (running/done/failed), description, model, cost
- Expandable to see subtask's conversation
- "Cancel Subtask" button

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/agent/SubagentManager.ts` | Subtask spawning and management |
| **New:** `src/core/tools/definitions/DelegateSubtaskTool.ts` | Delegation tool |
| `src/core/agent/AgentController.ts` | Support subtask lifecycle |
| `src/core/agent/AgentLoop.ts` | Subtask-aware iteration (reduced max for subtasks) |
| `src/core/modes/ModeManager.ts` | Register Orchestrator mode |
| `src/shared/MessageTypes.ts` | Subtask messages |
| `webview-ui/src/components/ChatPanel.tsx` | Subtask tree rendering |
| `webview-ui/src/hooks/useChat.ts` | Subtask state |

#### Estimated Effort: 5-7 days

---

### 3.5 Cross-Session Memory

**Why:** Cursor and Windsurf persist facts across conversations. The AI remembers project-specific context (architecture decisions, coding conventions, known issues) without re-explaining every time.

**Competitive Reference:** Cursor has a Memory system (beta) in Settings → Rules. Windsurf has Cascade Memory.

#### Implementation Details

**A. Memory Types**

| Type | Scope | Persistence | Example |
|------|-------|-------------|---------|
| Project facts | Per workspace | Disk | "This project uses PostgreSQL for the database" |
| User preferences | Global | Disk | "User prefers TypeScript strict mode" |
| Tool learnings | Per workspace | Disk | "npm test runs Jest with --coverage" |
| Code patterns | Per workspace | Disk | "Error handling uses AppError class from src/errors.ts" |

**B. `ProjectMemory.ts`**

```typescript
export interface MemoryEntry {
  id: string;
  content: string;
  category: 'project_fact' | 'preference' | 'tool_learning' | 'code_pattern';
  source: 'auto' | 'user';        // Auto-extracted vs user-defined
  createdAt: string;
  lastUsedAt: string;
  relevanceScore: number;          // Decays over time, boosted on use
}

export class ProjectMemory {
  private memoryFile: string;      // .mitrahelix/memory.json

  async addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'relevanceScore'>): Promise<void>;
  async getRelevantMemories(query: string, maxTokens: number): Promise<MemoryEntry[]>;
  async getAllMemories(): Promise<MemoryEntry[]>;
  async deleteMemory(id: string): Promise<void>;
  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<void>;
  async autoExtractMemories(conversation: LLMMessage[]): Promise<MemoryEntry[]>;
}
```

**C. Auto-Extraction**

After each task completion, use a lightweight LLM call to extract memories:

```
Given this conversation, extract any project-specific facts, preferences, or patterns that would be useful to remember for future tasks. Return as JSON array.
```

Extracted memories are stored and automatically included in future system prompts (within a token budget).

**D. Memory in System Prompt**

Add a "Project Memory" section to the system prompt:
```
## Project Memory
(These are facts remembered from previous conversations)
- This project uses React 18 with TypeScript strict mode
- Database migrations are in db/migrations/ using Knex
- Tests run with: npm test (Jest with --coverage)
- The API follows RESTful conventions with /api/v1/ prefix
```

Token budget: configurable, default 500 tokens.

#### Files to Modify

| File | Changes |
|------|---------|
| **New:** `src/core/memory/ProjectMemory.ts` | Cross-session memory |
| `src/core/prompts/SystemPromptBuilder.ts` | Include relevant memories |
| `src/core/agent/AgentController.ts` | Auto-extract memories on task completion |
| `src/shared/MessageTypes.ts` | Memory management messages |
| `src/core/webview/WebviewProvider.ts` | Handle memory messages |
| `webview-ui/src/components/TaskHeader.tsx` | Memory indicator |

#### New Configuration

```json
{
  "mitraHelix.crossSessionMemory": {
    "type": "boolean",
    "default": true,
    "description": "Enable cross-session project memory"
  },
  "mitraHelix.memoryTokenBudget": {
    "type": "number",
    "default": 500,
    "description": "Token budget for project memory in system prompt"
  }
}
```

#### Estimated Effort: 3-4 days

---

### 3.6 Semantic Codebase Search (@codebase)

**Why:** Cursor, Continue, Windsurf, and Claude Code all have embeddings-based semantic search. This lets users say "find where user authentication is handled" instead of constructing regex patterns.

**Competitive Reference:** Cursor uses custom embedding models. Continue has `@Codebase` context provider.

#### Implementation Details

**A. Approach: Local Embeddings**

Use a lightweight embedding model that runs locally (no API calls needed):
- **Option 1:** `@xenova/transformers` (runs ONNX models in Node.js) — recommended
- **Option 2:** Send to LLM API (slower, costs money)
- **Option 3:** Use VS Code's built-in embedding API (if available)

**B. `SemanticIndex.ts`**

```typescript
export class SemanticIndex {
  private embeddings: Map<string, Float32Array>;  // file chunk → embedding vector
  private chunks: Map<string, CodeChunk>;

  async buildIndex(workspaceRoot: string): Promise<void>;
  async updateFile(filePath: string): Promise<void>;
  async search(query: string, topK: number): Promise<SearchResult[]>;
  async invalidateFile(filePath: string): Promise<void>;
}

interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  type: 'function' | 'class' | 'block' | 'comment';
}
```

**C. Chunking Strategy**

Split files into semantic chunks:
- Function/method bodies (from tree-sitter AST)
- Class definitions
- Top-level code blocks (50-line windows with overlap)
- Comments/docstrings

**D. New @mention: `@codebase`**

```
User: @codebase Where is the approval workflow handled?
```

Resolves to: top 5 most relevant code chunks from the semantic index, injected as context.

**E. New Tool: `semantic_search`**

```typescript
{
  name: 'semantic_search',
  description: 'Search the codebase using natural language queries',
  parameters: {
    query: { type: 'string', required: true },
    maxResults: { type: 'integer', required: false, default: 5 },
  }
}
```

#### Dependencies

```json
{
  "@xenova/transformers": "^2.17.0"
}
```

Or if using VS Code's API: no additional dependency (use `vscode.lm.computeEmbedding` if available).

#### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@xenova/transformers` or similar |
| **New:** `src/core/context/SemanticIndex.ts` | Embedding index |
| **New:** `src/core/context/ChunkingStrategy.ts` | File chunking |
| **New:** `src/core/tools/definitions/SemanticSearchTool.ts` | Search tool |
| `src/core/context/MentionsParser.ts` | Add `@codebase` mention type |
| `src/extension.ts` | Initialize semantic index, register tool |
| `src/core/prompts/SystemPromptBuilder.ts` | Include semantic search results |

#### Estimated Effort: 5-7 days

---

## ADDITIONAL IMPROVEMENTS (Quick Wins)

These are smaller improvements identified during forensic analysis that can be done alongside the major features.

---

### A1. Accurate Token Counting (Replace chars/3 Heuristic)

**Current:** `ConversationMemory.ts` line 144 uses `chars / 3 + 4 per message` heuristic.
**Fix:** Use `js-tiktoken` (lightweight WASM-based tokenizer).

```typescript
import { encodingForModel } from 'js-tiktoken';
const enc = encodingForModel('cl100k_base'); // Works for Claude and GPT models
const tokenCount = enc.encode(text).length;
```

**Dependency:** `js-tiktoken` (~200KB, WASM)
**Effort:** 0.5 days

---

### A2. SecretStorage for API Keys

**Current:** API keys stored in VS Code settings (plaintext in settings.json).
**Fix:** Use VS Code's `SecretStorage` API.

```typescript
const secretStorage = context.secrets;
await secretStorage.store('mitraHelix.anthropicApiKey', apiKey);
const key = await secretStorage.get('mitraHelix.anthropicApiKey');
```

- Migrate existing keys on first run
- Add "Set API Key" command that uses input box (password type)
- Keys stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**Effort:** 1 day

---

### A3. Webview Virtual Scrolling

**Current:** All messages rendered in DOM. Long conversations cause performance degradation.
**Fix:** Use `react-virtuoso` for virtualized message list.

```typescript
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={messages}
  itemContent={(index, message) => <MessageBubble {...message} />}
  followOutput="smooth"
  alignToBottom
/>
```

**Dependency:** `react-virtuoso`
**Effort:** 1 day

---

### A4. Conversation Export

- Export as Markdown (formatted conversation)
- Export as JSON (full data)
- Copy entire conversation to clipboard
- Share link (if hosted)

**Effort:** 0.5 days

---

### A5. Edit Message / Regenerate Response

- "Edit" button on user messages → re-send with modified text
- "Regenerate" button on assistant messages → re-run from that point
- Branching: keep original conversation, create new branch from edit point

**Effort:** 2 days

---

### A6. Code Actions in Messages

- "Apply to File" button on code blocks → apply suggested changes to the file
- "Copy" button already exists; add "Insert at Cursor" button
- "Open File" link for file paths mentioned in messages
- "Run in Terminal" button for command suggestions

**Effort:** 2 days

---

### A7. Terminal Output Capture (Fix Stub)

**Current:** `MentionsParser.ts` `collectTerminalOutput()` only returns terminal names, not content.
**Fix:** Use VS Code Shell Integration API to capture actual terminal output.

```typescript
const terminal = vscode.window.activeTerminal;
if (terminal) {
  // Use Shell Integration API (VS Code 1.93+)
  const execution = terminal.shellIntegration?.executeCommand('echo test');
  for await (const data of execution.read()) {
    output += data;
  }
}
```

Alternatively, for older VS Code versions, use `terminal.sendText()` and capture via custom shell wrapper.

**Effort:** 1-2 days

---

### A8. LLM-Based Conversation Summarization

**Current:** `ConversationMemory.ts` uses character-slice summary (first 500 chars of compressed messages).
**Fix:** Use a fast/cheap LLM call to generate semantic summaries.

```typescript
async summarizeMessages(messages: LLMMessage[]): Promise<string> {
  const summaryPrompt = `Summarize the following conversation into key decisions, changes made, and current state. Be concise (max 200 words).`;
  const result = await cheapProvider.complete(summaryPrompt + formatMessages(messages));
  return result;
}
```

Use the cheapest available model (Haiku, GPT-5 Nano) for summarization. Cost: ~$0.001 per summarization.

**Effort:** 1 day

---

### A9. System Prompt Size Guard

**Current:** No warning if system prompt exceeds context window.
**Fix:** After building system prompt, check total tokens vs context window. If >50%, warn. If >80%, auto-trim.

**Effort:** 0.5 days

---

### A10. Smart Active File Truncation

**Current:** Active file truncated at 50K chars from the beginning.
**Fix:** Truncate around cursor position — include 40% before cursor, 60% after cursor. More useful context.

**Effort:** 0.5 days

---

## IMPLEMENTATION ROADMAP

### Phase 1: Table Stakes (Weeks 1-3)

| Week | Feature | Effort | Priority |
|------|---------|--------|----------|
| 1 | 1.1 Diff View Integration | 3-4 days | P0 |
| 1 | A1 Accurate Token Counting | 0.5 days | P0 |
| 1 | A2 SecretStorage for API Keys | 1 day | P0 |
| 2 | 1.4 Parallel Tool Execution | 3-4 days | P0 |
| 2 | 2.5 .mitrahelixignore | 2 days | P0 |
| 3 | 1.5 Task History & Persistence | 4-5 days | P0 |
| 3 | A7 Terminal Output Capture | 1-2 days | P0 |

**Week 1-3 Total: ~16-20 days of work**

### Phase 2: Safety & Extensibility (Weeks 4-6)

| Week | Feature | Effort | Priority |
|------|---------|--------|----------|
| 4 | 1.2 Checkpoints / Git Snapshots | 4-5 days | P0 |
| 5 | 1.3 MCP Integration | 5-7 days | P0 |
| 6 | 2.4 Linter & Test Runner Integration | 2-3 days | P1 |
| 6 | A3 Virtual Scrolling | 1 day | P1 |
| 6 | A8 LLM Summarization | 1 day | P1 |

**Week 4-6 Total: ~14-18 days of work**

### Phase 3: Intelligence & Context (Weeks 7-9)

| Week | Feature | Effort | Priority |
|------|---------|--------|----------|
| 7 | 2.1 Tree-Sitter AST Repo Map | 5-7 days | P1 |
| 8 | 2.2 Image/Vision Input | 3-4 days | P1 |
| 9 | 3.5 Cross-Session Memory | 3-4 days | P1 |
| 9 | A5 Edit/Regenerate Messages | 2 days | P1 |

**Week 7-9 Total: ~14-18 days of work**

### Phase 4: Advanced (Weeks 10-13)

| Week | Feature | Effort | Priority |
|------|---------|--------|----------|
| 10 | 2.3 Browser Automation | 3-4 days | P2 |
| 10 | A6 Code Actions in Messages | 2 days | P2 |
| 11 | 3.1 Architect Mode | 3-4 days | P2 |
| 11 | 3.2 Custom Agent Modes | 3-4 days | P2 |
| 12 | 3.3 Hooks/Lifecycle Events | 3-4 days | P2 |
| 13 | 3.4 Subagent Orchestration | 5-7 days | P2 |

**Week 10-13 Total: ~20-27 days of work**

### Phase 5: Semantic & Polish (Weeks 14-16)

| Week | Feature | Effort | Priority |
|------|---------|--------|----------|
| 14-15 | 3.6 Semantic Codebase Search | 5-7 days | P2 |
| 16 | A4 Conversation Export | 0.5 days | P2 |
| 16 | A9 System Prompt Size Guard | 0.5 days | P1 |
| 16 | A10 Smart Active File Truncation | 0.5 days | P1 |
| 16 | VSIX Packaging & Testing | 3-4 days | P0 |

**Week 14-16 Total: ~10-13 days of work**

---

## DEPENDENCY MAP

```
Phase 1 (Table Stakes)
├── Diff View ← Required by: Checkpoints, Approval UX
├── Parallel Tools ← Required by: Subagent Orchestration
├── Task History ← Required by: Cross-Session Memory, Session Resume
├── Token Counting ← Required by: Better compression, budget accuracy
├── .mitrahelixignore ← Required by: All file tools
└── Terminal Capture ← Required by: Better @terminal mentions

Phase 2 (Safety & Extensibility)
├── Checkpoints ← Depends on: Diff View
├── MCP ← Standalone
├── Linter Integration ← Depends on: Diagnostics Context (exists)
└── LLM Summarization ← Depends on: Token Counting

Phase 3 (Intelligence & Context)
├── Tree-Sitter ← Standalone (replaces regex in ListCodeDefinitions)
├── Vision Input ← Depends on: Provider support flags in models.ts
├── Cross-Session Memory ← Depends on: Task History
└── Edit/Regenerate ← Depends on: Conversation Memory refactor

Phase 4 (Advanced)
├── Browser Automation ← Standalone
├── Architect Mode ← Depends on: Provider Factory multi-model
├── Custom Modes ← Depends on: Mode system refactor
├── Hooks ← Standalone
└── Subagents ← Depends on: Custom Modes, Parallel Tools

Phase 5 (Semantic & Polish)
├── Semantic Search ← Depends on: Tree-Sitter (for chunking)
└── VSIX Packaging ← Final step
```

---

## NEW DEPENDENCIES SUMMARY

| Package | Version | Size | Purpose | Phase |
|---------|---------|------|---------|-------|
| `diff` | ^5.0.0 | 50KB | Diff computation | 1 |
| `js-tiktoken` | ^1.0.0 | 200KB | Accurate token counting | 1 |
| `react-virtuoso` | ^4.0.0 | 60KB | Virtual scrolling | 2 |
| `@modelcontextprotocol/sdk` | ^1.0.0 | 100KB | MCP client | 2 |
| `web-tree-sitter` | ^0.22.0 | 300KB + WASMs | AST parsing | 3 |
| `puppeteer-core` | ^22.0.0 | 2MB | Browser automation | 4 |
| `@xenova/transformers` | ^2.17.0 | 5MB | Semantic embeddings | 5 |

**Total new dependency size: ~8MB** (plus ~5-10MB for tree-sitter WASM files)

---

## NEW FILES SUMMARY

| File | Phase | Description |
|------|-------|-------------|
| `src/core/diff/DiffEngine.ts` | 1 | Diff computation |
| `src/core/diff/DiffViewProvider.ts` | 1 | VS Code diff editor |
| `src/core/diff/InlineDiffRenderer.ts` | 1 | Webview inline diff |
| `src/core/agent/ToolDependencyAnalyzer.ts` | 1 | Parallel tool analysis |
| `src/core/persistence/TaskHistoryManager.ts` | 1 | Task history |
| `src/core/persistence/ConversationStore.ts` | 1 | Serialization |
| `src/core/persistence/types.ts` | 1 | Types |
| `src/core/ignore/IgnoreManager.ts` | 1 | File protection |
| `webview-ui/src/components/TaskHistory.tsx` | 1 | History UI |
| `webview-ui/src/components/TaskHistoryDetail.tsx` | 1 | History detail |
| `src/core/checkpoints/CheckpointManager.ts` | 2 | Checkpoint logic |
| `src/core/checkpoints/ShadowGitManager.ts` | 2 | Git operations |
| `src/core/checkpoints/types.ts` | 2 | Types |
| `src/core/mcp/MCPClientManager.ts` | 2 | MCP server management |
| `src/core/mcp/MCPToolBridge.ts` | 2 | Tool integration |
| `src/core/mcp/MCPResourceAccess.ts` | 2 | Resource reading |
| `src/core/mcp/MCPTransport.ts` | 2 | Transport abstraction |
| `src/core/mcp/MCPConfigLoader.ts` | 2 | Config loading |
| `src/core/mcp/types.ts` | 2 | Types |
| `src/core/tools/PostToolActions.ts` | 2 | Post-execution checks |
| `src/core/testing/TestRunnerIntegration.ts` | 2 | Test runner |
| `webview-ui/src/components/CheckpointTimeline.tsx` | 2 | Checkpoint UI |
| `src/core/context/TreeSitterManager.ts` | 3 | Tree-sitter init |
| `src/core/context/RepoMapGenerator.ts` | 3 | Repo map generation |
| `src/core/context/relevance/GraphRanker.ts` | 3 | Relevance ranking |
| `src/core/context/relevance/SymbolIndex.ts` | 3 | Symbol index |
| `src/core/memory/ProjectMemory.ts` | 3 | Cross-session memory |
| `src/core/browser/BrowserManager.ts` | 4 | Puppeteer lifecycle |
| `src/core/browser/types.ts` | 4 | Browser types |
| `src/core/tools/definitions/BrowserActionTool.ts` | 4 | Browser tool |
| `src/core/modes/ModeManager.ts` | 4 | Mode management |
| `src/core/modes/types.ts` | 4 | Mode types |
| `src/core/hooks/HookManager.ts` | 4 | Hook orchestration |
| `src/core/hooks/types.ts` | 4 | Hook types |
| `src/core/agent/SubagentManager.ts` | 4 | Subagent orchestration |
| `src/core/tools/definitions/DelegateSubtaskTool.ts` | 4 | Delegation tool |
| `src/core/context/SemanticIndex.ts` | 5 | Embedding index |
| `src/core/context/ChunkingStrategy.ts` | 5 | File chunking |
| `src/core/tools/definitions/SemanticSearchTool.ts` | 5 | Search tool |

**Total: 39 new files across 5 phases**

---

## NEW CONFIGURATION OPTIONS SUMMARY

```json
{
  "mitraHelix.maxHistoryEntries": { "type": "number", "default": 100 },
  "mitraHelix.historyMaxAge": { "type": "number", "default": 30 },
  "mitraHelix.repoMapTokens": { "type": "number", "default": 1024 },
  "mitraHelix.chromePath": { "type": "string", "default": "" },
  "mitraHelix.autoLintAfterEdit": { "type": "boolean", "default": true },
  "mitraHelix.autoTestCommand": { "type": "string", "default": "" },
  "mitraHelix.autoTestEnabled": { "type": "boolean", "default": false },
  "mitraHelix.architectPlannerModel": { "type": "string", "default": "claude-opus-4-6" },
  "mitraHelix.architectExecutorModel": { "type": "string", "default": "claude-haiku-4-5" },
  "mitraHelix.crossSessionMemory": { "type": "boolean", "default": true },
  "mitraHelix.memoryTokenBudget": { "type": "number", "default": 500 }
}
```

---

## COMPETITIVE POSITION AFTER FULL IMPLEMENTATION

| Feature | Cline | Continue | Aider | Cursor | Windsurf | Roo Code | **MitraHelix (After)** |
|---------|-------|----------|-------|--------|----------|----------|----------------------|
| Streaming + Multi-model | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Plan/Act/Architect modes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diff view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkpoints | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| MCP integration | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Parallel tools | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Task history | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| AST repo map | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Semantic search | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Vision input | ✅ | ❌ | 🟡 | ✅ | ✅ | ✅ | ✅ |
| Browser automation | ✅ | ❌ | 🟡 | ✅ | ✅ | ❌ | ✅ |
| Linter integration | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Custom modes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Hooks system | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Subagent orchestration | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Cross-session memory | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| File ignore | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Budget controls | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rules/workflows | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

**After full implementation: MitraHelix would have 19/19 features checked — the most comprehensive open-source AI-IDE extension available.**

No single competitor currently covers all these features. MitraHelix's unique combination of:
- Subagent orchestration (Boomerang pattern) — only Roo Code has this
- Custom modes — only Roo Code has this
- Hooks system — only Claude Code and Windsurf have this
- Plus all table-stakes features

...would make it the most feature-complete open-source option.

---

## RISK ASSESSMENT

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tree-sitter WASM bundle size (5-10MB) | Large extension | Lazy-load, download on demand |
| Puppeteer dependency weight | Extension size | Use puppeteer-core, detect Chrome |
| MCP server crashes affecting extension | Stability | Process isolation, auto-restart, timeouts |
| Semantic index memory usage | Large repos | Cap index size, incremental indexing, file limits |
| Shadow git storage | Disk usage | Auto-prune, configurable retention |
| Parallel tool execution race conditions | Correctness | Strict dependency analysis, conservative defaults |
| Cross-session memory relevance decay | Stale context | Time-based decay, user curation UI |
| Subagent cost multiplication | Budget overrun | Per-subtask budget caps, total task budget |

---

*This plan covers 16 major features, 10 quick improvements, 39 new files, 11 new configuration options, and 7 new dependencies. Total estimated effort: ~74-100 days of development across 5 phases (16 weeks).*
