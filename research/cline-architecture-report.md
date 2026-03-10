# Cline VS Code Extension - Comprehensive Architecture Report

## 1. Project Overview

**Repository**: https://github.com/cline/cline  
**Version**: 3.71.0  
**Package Name**: `claude-dev` (historical)  
**Display Name**: Cline  
**License**: Apache-2.0  
**Entry Point**: `./dist/extension.js` (compiled from `src/extension.ts`)

### Top-Level Directory Structure
```
src/                  # Main extension source
  core/               # Core agent logic (task, controller, prompts, tools, context, etc.)
  exports/            # Public API exports
  hosts/              # Host-specific adapters (VSCode, standalone)
  integrations/       # Checkpoints, editor, terminal, diagnostics
  packages/           # Internal packages
  services/           # Browser, MCP, telemetry, auth, search
  shared/             # Shared types, tools enum, messages, storage
  utils/              # Utility functions
  standalone/         # Standalone/CLI mode
  dev/                # Development tools
  types/              # Type declarations
webview-ui/           # React webview UI
  src/
    components/       # Chat, settings, MCP, history, account views
    context/          # React contexts (ExtensionState, Auth)
    hooks/            # Custom React hooks
    services/         # gRPC client services
cli/                  # CLI tool for running Cline outside VSCode
evals/                # Evaluation/smoke test infrastructure
testing-platform/     # Testing platform
standalone/           # Standalone distribution configs
proto/                # Protobuf definitions
docs/                 # Documentation site
```

### Key Dependencies
- **LLM SDKs**: `@anthropic-ai/sdk`, `openai`, `@google/genai`, `@mistralai/mistralai`, `ollama`, `@cerebras/cerebras_cloud_sdk`
- **Cloud**: `@aws-sdk/client-bedrock-runtime`, `@google-cloud/vertexai`, `@azure/identity`
- **MCP**: `@modelcontextprotocol/sdk` v1.25.1
- **Browser**: `puppeteer-core`, `puppeteer-chromium-resolver`, `chrome-launcher`
- **Editor**: `diff`, `tree-sitter-wasms`, `web-tree-sitter`, `ts-morph`
- **Search**: ripgrep (bundled binary from VSCode), `globby`, `fzf`
- **Storage**: `better-sqlite3`, file-based JSON
- **UI**: React (webview-ui), Tailwind CSS v4
- **Communication**: gRPC (`@grpc/grpc-js`), Protobuf (`@bufbuild/protobuf`)
- **Telemetry**: OpenTelemetry, PostHog

---

## 2. Extension Entry Point (`src/extension.ts`)

**File**: `src/extension.ts` (~715 lines)

### Key Functions
- **`activate(context)`**: Main VS Code activation function
- **`setupHostProvider(context)`**: Initializes the HostProvider abstraction for VSCode-specific APIs
- **`deactivate()`**: Cleanup on extension deactivation

### Activation Flow
1. **Set up HostProvider** for VSCode (creates webview, diff view, comment review, terminal manager)
2. **Run legacy storage migrations** (API keys, custom instructions → rules, task history → file, workspace → global storage)
3. **Export VSCode storage to shared file-backed stores** (`~/.cline/data/`) for cross-platform support (VSCode, CLI, JetBrains)
4. **Initialize common services** via `initialize(storageContext)` which returns the `VscodeWebviewProvider`
5. **Register VS Code commands**: New Task, MCP, History, Settings, Account, Add to Chat, Terminal Output, Jupyter commands, etc.
6. **Register diff content provider** using virtual document scheme (`DIFF_VIEW_URI_SCHEME`)
7. **Register URI handler** for deep links (task URIs)
8. **Register code action provider** (Add/Explain/Improve/Fix with Cline)
9. **Set up secrets listener** for cross-window auth sync
10. **Return Cline API** via `createClineAPI()`

### Notable Details
- Uses a **HostProvider abstraction** to decouple from VSCode APIs - enables CLI/JetBrains support
- Hot reload in dev mode via file watcher on `src/**/*`
- Registers as sidebar webview provider with `retainContextWhenHidden: true`
- Supports Jupyter notebook integration (generate/explain/improve cells)
- Git commit message generation command

---

## 3. Core Agent Loop / Task Execution

### File: `src/core/task/index.ts` (~3647 lines - THE core file)

### Key Class: `Task`

This is the central class that orchestrates the entire agent loop. It's massive (~3600 lines).

#### Constructor Dependencies
```typescript
class Task {
  taskState: TaskState              // Mutable state for the current task
  api: ApiHandler                   // LLM API abstraction
  terminalManager: ITerminalManager // Terminal execution
  browserSession: BrowserSession    // Puppeteer browser
  contextManager: ContextManager    // Context window management
  diffViewProvider: DiffViewProvider // File diff display
  checkpointManager?: ICheckpointManager // Git-based checkpoints
  toolExecutor: ToolExecutor        // Tool execution coordinator
  streamHandler: StreamResponseHandler // Stream parsing
  fileContextTracker: FileContextTracker
  modelContextTracker: ModelContextTracker
  messageStateHandler: MessageStateHandler
  stateManager: StateManager
  FocusChainManager?: FocusChainManager // Task progress tracking
  commandExecutor: CommandExecutor   // Shell command execution
}
```

#### Core Methods (Agent Loop)

1. **`startTask(task, images, files)`** (line ~981):
   - Initializes clineMessages and apiConversationHistory to `[]`
   - Wraps task in `<task>\n...\n</task>` XML tags
   - Runs `TaskStart` hook (can inject context or cancel)
   - Runs `UserPromptSubmit` hook
   - Calls `initiateTaskLoop(userContent)`

2. **`initiateTaskLoop(userContent)`** (line ~1376):
   - Main while loop: `while (!this.taskState.abort)`
   - Calls `recursivelyMakeClineRequests(userContent, includeFileDetails)`
   - If AI responds with only text (no tools), sends `noToolsUsed` prompt to force tool use
   - Increments `consecutiveMistakeCount` when no tools used

3. **`recursivelyMakeClineRequests(userContent, includeFileDetails)`** (line ~2262):
   - The core recursive function that:
     a. Checks consecutive mistake limit
     b. Initializes checkpoints on first request
     c. Determines if context window should be compacted (auto-condense)
     d. Builds environment details (file listing, open tabs, mode, etc.)
     e. Calls the LLM API with streaming
     f. Parses streaming response into text blocks and tool use blocks
     g. Calls `presentAssistantMessage()` to execute tools
     h. Returns `didEndLoop` (true if task complete or user denied continuation)

4. **`presentAssistantMessage()`** (line ~2120):
   - Processes the accumulated assistant message content
   - For each tool use block, calls `toolExecutor.executeTool(block)`
   - Handles partial streaming updates for UI

5. **`resumeTaskFromHistory()`** (line ~1104):
   - Loads saved clineMessages and apiConversationHistory from disk
   - Strips any previous resume_task messages
   - Shows resume button via `ask("resume_task")`
   - Runs `TaskResume` hook
   - Rebuilds user content from the last response and calls `initiateTaskLoop()`

#### State Management
- Uses a **single Mutex** (`stateMutex`) for ALL state modifications
- `TaskState` class holds mutable state: `abort`, `askResponse`, `didRejectTool`, `consecutiveMistakeCount`, `userMessageContent`, `isStreaming`, etc.
- `MessageStateHandler` manages `clineMessages` (UI) and `apiConversationHistory` (API)

---

## 4. Controller (`src/core/controller/index.ts`)

**Key Class**: `Controller` (~1045 lines)

The Controller is the intermediary between the webview and the Task. It:
- Creates/manages `Task` instances
- Manages `McpHub` for MCP server connections
- Manages `AuthService`, `OcaAuthService`, `AccountService`
- Handles `StateManager` for persistent settings
- Routes webview messages to appropriate handlers (organized in `controller/` subdirectories)

### Controller Subdirectories (Command Pattern)
```
controller/
  account/       # Auth/login handlers
  browser/       # Browser discovery/connection
  checkpoints/   # Checkpoint diff/restore
  commands/      # Add to Cline, explain, fix, improve
  file/          # File operations, rules, hooks management
  mcp/           # MCP server management
  models/        # Model list refresh for each provider
  state/         # Settings updates, state subscriptions
  task/           # Task lifecycle (new, cancel, clear, history)
  ui/            # Webview initialization, navigation events
  web/           # URL/OpenGraph operations
  worktree/      # Git worktree management
```

---

## 5. Tool Definitions

### File: `src/shared/tools.ts`

**All 26 tools defined in `ClineDefaultTool` enum:**

| Tool Name | Enum Key | Handler File |
|-----------|----------|-------------|
| `ask_followup_question` | ASK | AskFollowupQuestionToolHandler.ts |
| `attempt_completion` | ATTEMPT | AttemptCompletionHandler.ts |
| `execute_command` | BASH | ExecuteCommandToolHandler.ts |
| `replace_in_file` | FILE_EDIT | WriteToFileToolHandler.ts (shared) |
| `read_file` | FILE_READ | ReadFileToolHandler.ts |
| `write_to_file` | FILE_NEW | WriteToFileToolHandler.ts |
| `search_files` | SEARCH | SearchFilesToolHandler.ts |
| `list_files` | LIST_FILES | ListFilesToolHandler.ts |
| `list_code_definition_names` | LIST_CODE_DEF | ListCodeDefinitionNamesToolHandler.ts |
| `browser_action` | BROWSER | BrowserToolHandler.ts |
| `use_mcp_tool` | MCP_USE | UseMcpToolHandler.ts |
| `access_mcp_resource` | MCP_ACCESS | AccessMcpResourceHandler.ts |
| `load_mcp_documentation` | MCP_DOCS | LoadMcpDocumentationHandler.ts |
| `new_task` | NEW_TASK | NewTaskHandler.ts |
| `plan_mode_respond` | PLAN_MODE | PlanModeRespondHandler.ts |
| `act_mode_respond` | ACT_MODE | ActModeRespondHandler.ts |
| `focus_chain` | TODO | (no handler - used for UI) |
| `web_fetch` | WEB_FETCH | WebFetchToolHandler.ts |
| `web_search` | WEB_SEARCH | WebSearchToolHandler.ts |
| `condense` | CONDENSE | CondenseHandler.ts |
| `summarize_task` | SUMMARIZE_TASK | SummarizeTaskHandler.ts |
| `report_bug` | REPORT_BUG | ReportBugHandler.ts |
| `new_rule` | NEW_RULE | WriteToFileToolHandler.ts (shared) |
| `apply_patch` | APPLY_PATCH | ApplyPatchHandler.ts |
| `generate_explanation` | GENERATE_EXPLANATION | GenerateExplanationToolHandler.ts |
| `use_skill` | USE_SKILL | UseSkillToolHandler.ts |
| `use_subagents` | USE_SUBAGENTS | SubagentToolHandler.ts |

### Read-Only Tools (safe for parallel execution with checkpoints)
`list_files`, `read_file`, `search_files`, `list_code_definition_names`, `browser_action`, `ask_followup_question`, `web_search`, `web_fetch`, `use_skill`, `use_subagents`

### Tool Execution Architecture

**`ToolExecutorCoordinator`** (`src/core/task/tools/ToolExecutorCoordinator.ts`):
- Registry pattern: maps tool names to handler instances
- Supports `IToolHandler` (basic), `IPartialBlockHandler` (streaming UI), `IFullyManagedTool` (both)
- `SharedToolHandler` wrapper allows multiple names to share one handler (e.g., `replace_in_file` and `write_to_file` share `WriteToFileToolHandler`)
- Dynamic subagent tools registered at runtime

**`ToolExecutor`** (`src/core/task/ToolExecutor.ts`):
- Main entry point called by Task
- Handles: rejection cascading, plan mode restrictions, parallel tool calling control
- Runs PreToolUse/PostToolUse hooks around execution
- Manages auto-approval via `AutoApprove` class

### Tool Parameter Names (from assistant-message/index.ts)
`command`, `requires_approval`, `path`, `content`, `diff`, `regex`, `file_pattern`, `recursive`, `action`, `url`, `coordinate`, `text`, `query`, `prompt`, `server_name`, `tool_name`, `arguments`, `uri`, `question`, `options`, `response`, `result`, `context`, `title`, `timeout`, `input`, `skill_name`, `prompt_1`-`prompt_5`, etc.

---

## 6. System Prompt / Prompt Building

### Architecture: Template + Variant + Component System

**Files**: `src/core/prompts/system-prompt/`

#### Entry Point
```typescript
// src/core/prompts/system-prompt/index.ts
async function getSystemPrompt(context: SystemPromptContext) {
  const registry = PromptRegistry.getInstance()
  const systemPrompt = await registry.get(context)
  const tools = context.enableNativeToolCalls ? registry.nativeTools : undefined
  return { systemPrompt, tools }
}
```

#### PromptRegistry (Singleton)
- Loads all **variants** (model-family-specific prompt customizations)
- Loads all **components** (reusable prompt sections)
- Matches model to variant via `matcher` functions
- Falls back to `GENERIC` variant

#### System Prompt Components (13 sections)
1. **AGENT_ROLE**: "You are Cline, a highly skilled software engineer..."
2. **SYSTEM_INFO**: OS, shell, CWD, home dir, language settings
3. **MCP**: MCP server descriptions, tools, resources
4. **USER_INSTRUCTIONS**: Custom rules (.clinerules, .cursorrules, etc.)
5. **TOOL_USE**: Tool definitions and usage instructions
6. **EDITING_FILES**: File editing guidelines (search/replace format)
7. **CAPABILITIES**: What the agent can do (file ops, search, browser, MCP)
8. **SKILLS**: Available skills (specialized capabilities)
9. **RULES**: Behavioral rules and constraints
10. **OBJECTIVE**: How to approach the task
11. **ACT_VS_PLAN**: Plan mode vs Act mode instructions
12. **FEEDBACK**: How to handle user feedback
13. **TASK_PROGRESS**: Focus chain / task progress tracking

#### Model-Specific Variants
```
variants/
  generic/        # Default for most models
  next-gen/       # For Claude 3.5 Sonnet+ family
  devstral/       # Mistral Devstral
  gemini-3/       # Google Gemini 3
  gpt-5/          # OpenAI GPT-5
  glm/            # GLM models
  hermes/         # Hermes models
  trinity/        # Arcee Trinity
  xs/             # Extra-small/local models
  native-gpt-5/   # GPT-5 with native tool calling
  native-gpt-5-1/ # GPT-5.1 native
  native-next-gen/ # Next-gen native tool calling
```

Each variant can override: component templates, tool specs, section ordering, and context requirements.

#### Tool Prompt Definitions
Each tool has its own spec file in `tools/`:
- `read_file.ts`, `write_to_file.ts`, `replace_in_file.ts`, `execute_command.ts`
- `browser_action.ts`, `use_mcp_tool.ts`, `apply_patch.ts`
- `web_fetch.ts`, `web_search.ts`, `use_skill.ts`, `subagent.ts`, etc.

Tool specs define: name, description, parameters (with `required` flag and `instruction`), `contextRequirements` (conditional inclusion), and multiple variant-specific versions.

---

## 7. Webview UI

### Framework: React + Tailwind CSS v4

**Entry Point**: `webview-ui/src/main.tsx` → `App.tsx`

### Top-Level Views
```typescript
// App.tsx
<OnboardingView />     // First-time setup
<WelcomeView />        // Welcome/API key entry
<SettingsView />       // Settings panel
<HistoryView />        // Task history browser
<McpView />            // MCP server configuration
<AccountView />        // Account management
<WorktreesView />      // Git worktree management
<ChatView />           // Main chat interface (always loaded)
```

### Chat UI Architecture (`components/chat/`)
- **`ChatView.tsx`** - Main chat container with refactored architecture:
  - `chat-view/components/layout/` - Layout components (ChatLayout, InputSection, MessagesArea, etc.)
  - `chat-view/hooks/` - State management hooks (useChatState, useMessageHandlers, useScrollBehavior)
- **`ChatTextArea.tsx`** - Input with mentions support, context menu, slash commands
- **`ChatRow.tsx`** - Individual message row renderer
- **`ToolCallCard.tsx`** / Various row components for specific content types
- **`TaskHeader.tsx`** - Shows task info, context window usage, checkpoint controls
- **`auto-approve-menu/`** - Auto-approve settings modal and bar

### Key Components
- **`BrowserSessionRow.tsx`** - Shows browser screenshots and console logs
- **`DiffEditRow.tsx`** - Shows file edit diffs
- **`CommandOutputRow.tsx`** - Shows terminal output
- **`MarkdownRow.tsx`** - Renders markdown content
- **`ThinkingRow.tsx`** - Shows AI reasoning/thinking blocks
- **`ContextMenu.tsx`** - @ mentions popup (files, URLs, problems, terminal, git)
- **`SlashCommandMenu.tsx`** - Slash command menu
- **`SubagentStatusRow.tsx`** - Shows subagent execution status

### Communication: gRPC + Protobuf
- Uses protobuf-defined messages for webview ↔ extension communication
- `services/grpc-client.ts` provides typed client stubs
- Migration from direct `postMessage` to gRPC-based communication

---

## 8. MCP Integration

### Files
- `src/services/mcp/McpHub.ts` (~1674 lines) - Main MCP manager
- `src/services/mcp/McpOAuthManager.ts` - OAuth token management
- `src/services/mcp/StreamableHttpReconnectHandler.ts` - HTTP SSE reconnection
- `src/services/mcp/schemas.ts` - Zod validation schemas
- `src/core/controller/mcp/` - 12 handler files for MCP operations

### McpHub Class
```typescript
class McpHub {
  connections: McpConnection[]           // Active MCP connections
  getMcpServersPath: () => Promise<string> // Path to MCP config file
  
  // Operations
  connectToServer(name, config)          // Start MCP server
  disconnectFromServer(name)             // Stop server
  callTool(serverName, toolName, args)   // Execute MCP tool
  readResource(serverName, uri)          // Read MCP resource
  listTools()                            // List all available tools
  listResources()                        // List all available resources
}
```

### MCP Transport Types
- **StdioClientTransport** - Local process via stdin/stdout
- **SSEClientTransport** - Server-Sent Events
- **StreamableHTTPClientTransport** - HTTP with streaming

### MCP Settings
- Config stored in `~/.cline/mcp_settings.json` (or similar)
- File watcher monitors config changes and auto-reconnects
- Supports remote config synchronization
- Per-tool auto-approve toggles
- Configurable timeouts per server

### MCP Tools in System Prompt
Tool definitions from MCP servers are dynamically injected into the system prompt via the `mcp` component. The AI can call MCP tools using `use_mcp_tool` and access resources via `access_mcp_resource`.

---

## 9. Plan/Act Mode

### Implementation

**Plan Mode** and **Act Mode** are two operating modes that the user can toggle:

#### State Management
- Mode stored in `StateManager` as `mode: "plan" | "act"`
- Toggle handler: `src/core/controller/state/togglePlanActModeProto.ts`

#### Tool Restrictions in Plan Mode (Strict)
When `strictPlanModeEnabled` is true, these tools are BLOCKED in Plan mode:
- `write_to_file` (FILE_NEW)
- `replace_in_file` (FILE_EDIT)
- `new_rule` (NEW_RULE)
- `apply_patch` (APPLY_PATCH)

#### Mode-Specific Tools
- **`plan_mode_respond`** - Only available in Plan mode; AI uses this to present plans and discuss with user
- **`act_mode_respond`** - Only available in Act mode; AI uses this to communicate progress

#### System Prompt Section
The `ACT_VS_PLAN` component explains both modes to the AI:
- ACT MODE: Full tool access, execute tasks, use `attempt_completion`
- PLAN MODE: Gather info, create plans, discuss with user via `plan_mode_respond`

#### Mode Switching
- User can switch modes via UI
- AI can request mode switch via `switchToActMode()` callback
- Each mode can have a **different API provider/model** (plan mode can use a cheaper model)

---

## 10. Diff/Apply Mechanism

### Two File Editing Approaches

#### 1. Search/Replace Format (replace_in_file / FILE_EDIT)
**File**: `src/core/assistant-message/diff.ts` (~856 lines)

Uses a custom SEARCH/REPLACE block format:
```
------- SEARCH
<original text>
=======
<replacement text>
+++++++ REPLACE
```

Key features:
- Streaming-capable: processes blocks as they arrive
- **Line-trimmed fallback matching**: If exact match fails, tries matching with trimmed whitespace
- Multiple search/replace blocks per file
- Handles edge cases: empty lines, indentation differences, partial matches
- Legacy format support (`<<<` / `>>>` markers)

#### 2. Apply Patch (APPLY_PATCH tool - newer)
**File**: `src/core/task/tools/handlers/ApplyPatchHandler.ts` (~809 lines)

Uses a unified diff-like format for multi-file changes:
- Supports `ADD`, `DELETE`, `UPDATE` operations per file
- Uses `PatchParser` to parse the diff format
- `FileProviderOperations` handles the actual file writes
- Validates paths, checks permissions, shows diffs for approval

#### 3. DiffViewProvider
**File**: `src/integrations/editor/DiffViewProvider.ts`

Shows side-by-side diff in VSCode editor:
- Left side: original (readonly virtual document)
- Right side: modified (editable)
- User can accept/reject changes
- `FileEditProvider` alternative for background edits (no UI stealing)

---

## 11. Browser Action / Computer Use

### Files
- `src/services/browser/BrowserSession.ts` (~603 lines) - Puppeteer browser management
- `src/core/task/tools/handlers/BrowserToolHandler.ts` (~211 lines) - Tool handler
- `src/services/browser/BrowserDiscovery.ts` - Chrome/Chromium discovery
- `src/services/browser/utils.ts` - Chromium bundling

### BrowserSession Class
```typescript
class BrowserSession {
  private browser?: Browser       // Puppeteer Browser instance
  private page?: Page             // Active page
  private currentMousePosition?: string
  
  // Connection methods
  launchBrowser(url)              // Launch local or connect to remote
  closeBrowser()                  // Cleanup
  
  // Actions (6 browser actions)
  navigateToUrl(url)              // Navigate
  click(coordinate)               // Click at x,y
  type(text)                      // Type text
  scrollDown() / scrollUp()       // Scroll
  screenshot()                    // Capture screenshot
}
```

### Browser Actions
1. **launch** - Launch browser at URL (local Chrome, bundled Chromium, or remote)
2. **click** - Click at x,y coordinates
3. **type** - Type text (keyboard input)
4. **scroll_down** - Scroll down one page
5. **scroll_up** - Scroll up one page
6. **close** - Close browser

### Notable Details
- Viewport: configurable (default 900x600, up to 1920x1080)
- Screenshots returned as base64 (WebP when supported, PNG fallback)
- Console logs captured and returned with screenshots
- Remote browser support via `remoteBrowserHost` setting
- Chrome detection: system Chrome → bundled Chromium (via `puppeteer-chromium-resolver`)
- Browser must be closed before using other tools (enforced in ToolExecutor)

---

## 12. Auto-Approve / Permissions System

### Files
- `src/core/task/tools/autoApprove.ts` (~169 lines) - Auto-approval logic
- `src/shared/AutoApprovalSettings.ts` - Settings types
- `src/core/permissions/CommandPermissionController.ts` - Command-level permissions

### AutoApprove Class

Three levels of auto-approval:

1. **YOLO Mode** (`yoloModeToggled`): Approves EVERYTHING automatically
2. **Auto-Approve All** (`autoApproveAllToggled`): Approves all tool types
3. **Granular Settings** (`autoApprovalSettings`):
   - `readFiles` / `readFilesExternally` - Read operations
   - `editFiles` / `editFilesExternally` - Write operations
   - `executeSafeCommands` / `executeAllCommands` - Command execution
   - `useBrowser` - Browser actions
   - `useMcp` - MCP tool calls
   - `enableNotifications` - System notifications when approval needed

### Path-Based Auto-Approval
The `shouldAutoApproveToolWithPath()` method checks:
- Is the file within the workspace? (local vs external)
- Multi-root workspace support: checks ALL workspace roots
- Returns `[localApproval, externalApproval]` tuple for file operations

### Command Permission Controller
- `CommandPermissionController` manages command-level permissions
- Separate from auto-approve (more fine-grained)

### Approval Flow
For each tool execution:
1. Check auto-approve settings
2. If not auto-approved, show approval dialog via `ask()` 
3. User can approve, reject, or provide feedback
4. Rejected tool cascades: subsequent tools in same message also rejected

---

## 13. Conversation History / Resume Mechanism

### Storage
- **UI Messages**: `clineMessages` - stored in `{taskDir}/ui_messages.json`
- **API History**: `apiConversationHistory` - stored in `{taskDir}/api_conversation_history.json`
- **Task Metadata**: `taskHistory.json` in global storage

### MessageStateHandler
```typescript
class MessageStateHandler {
  getClineMessages(): ClineMessage[]
  getApiConversationHistory(): Anthropic.Messages.MessageParam[]
  addToClineMessages(message)
  updateClineMessage(index, updates)
  saveClineMessagesAndUpdateHistory()
}
```

### Resume Flow (`resumeTaskFromHistory()`)
1. Load saved `clineMessages` from disk
2. Strip any previous `resume_task`/`resume_completed_task` messages
3. Load saved `apiConversationHistory`
4. Initialize context history
5. Determine resume type: `resume_task` or `resume_completed_task`
6. Show resume button via `ask(askType)`
7. Run `TaskResume` hook (can inject context)
8. Run `UserPromptSubmit` hook
9. Rebuild user content and call `initiateTaskLoop()`

### Conversation History Compaction
- `ContextManager` tracks context window usage
- `shouldCompactContextWindow()` checks if approaching token limit
- Auto-condense via `summarize_task` tool or `condense` tool
- `conversationHistoryDeletedRange` masks old messages from API calls
- File read optimization: replaces full file contents with abbreviated versions

### Task History Management
- `src/core/controller/task/` handles: `newTask`, `cancelTask`, `clearTask`, `showTaskWithId`, `deleteTasksWithIds`, `exportTaskWithId`, `getTaskHistory`
- Each task gets a unique directory: `{globalStoragePath}/tasks/{taskId}/`

---

## 14. Context Management (Mentions, File Context)

### Mentions System
**File**: `src/core/mentions/index.ts` (~451 lines)

Supports `@` mentions in user messages:
- **`@/path/to/file`** - Include file contents
- **`@/path/to/dir/`** - Include directory listing
- **`@problems`** - Include workspace diagnostics
- **`@terminal`** - Include terminal output
- **`@git-changes`** - Include working directory changes
- **`@<commit-hash>`** - Include git commit info
- **`@https://...`** - Fetch and include URL content

`parseMentions()` function:
1. Parses mention syntax from text
2. Replaces mentions with descriptive text
3. Appends actual content (file contents, diagnostics, etc.) at the end
4. Handles binary files, large directories, workspace-prefixed paths

### File Context Tracker
**File**: `src/core/context/context-tracking/FileContextTracker.ts`
- Tracks which files the AI has read/modified
- Used by focus chain and checkpoint systems
- Provides file modification history for context

### Model Context Tracker
**File**: `src/core/context/context-tracking/ModelContextTracker.ts`
- Records which models/providers were used during a task
- Useful for error reporting and analytics

### Environment Context Tracker
**File**: `src/core/context/context-tracking/EnvironmentContextTracker.ts`
- Tracks environment details (OS, shell, CWD)

### Context Window Management
**File**: `src/core/context/context-management/ContextManager.ts` (~1296 lines)
- Tracks context history updates (what was read, what was modified)
- `shouldCompactContextWindow()` - determines when to trigger summarization
- `attemptFileReadOptimization()` - replaces verbose file reads with abbreviated versions
- Serializable context history for checkpoint support

### User Instructions / Rules
**Files**: `src/core/context/instructions/user-instructions/`
- **`.clinerules`** - Cline-specific rules
- **`.cursorrules`** / **`.windsurfrules`** / **`AGENTS.md`** - External rule formats
- **Rule Context Builder** - Assembles all active rules into system prompt
- **Frontmatter parsing** - Rules can have YAML frontmatter with conditions
- **Rule conditionals** - Rules can be conditional on file patterns, globs
- **Skills** - Specialized capabilities defined as markdown files
- **Workflows** - Multi-step workflow definitions

---

## 15. Checkpoint / Undo System

### Architecture: Git-based Checkpoints

**Files**:
- `src/integrations/checkpoints/index.ts` (~932 lines) - `TaskCheckpointManager`
- `src/integrations/checkpoints/CheckpointTracker.ts` - Git operations
- `src/integrations/checkpoints/CheckpointGitOperations.ts` - Low-level git
- `src/integrations/checkpoints/CheckpointExclusions.ts` - Ignore patterns
- `src/integrations/checkpoints/CheckpointMigration.ts` - Legacy migration
- `src/integrations/checkpoints/factory.ts` - Factory for creating managers
- `src/integrations/checkpoints/MultiRootCheckpointManager.ts` - Multi-root support

### How It Works

1. **Initialization**: When a task starts, a **shadow git repository** is created in the task directory
2. **First Checkpoint**: Before any modifications, commits the current workspace state
3. **Subsequent Checkpoints**: After each tool execution that modifies files, creates a new commit
4. **Restore**: Can restore workspace to any previous checkpoint by checking out the commit
5. **Diff View**: Can show multi-file diff between any two checkpoints

### TaskCheckpointManager (ICheckpointManager interface)
```typescript
interface ICheckpointManager {
  saveCheckpoint(isAttemptCompletion?, completionMessageTs?)
  restoreCheckpoint(messageTs, restoreType, offset?)
  doesLatestTaskCompletionHaveNewChanges()
  commit(): Promise<string | undefined>
  presentMultifileDiff?(messageTs, seeNewChanges)
}
```

### Restore Types
- **Restore workspace only** - Revert files but keep conversation
- **Restore workspace and task** - Revert files AND conversation history to that point

### Notable Details
- Uses `simple-git` library for git operations
- Checkpoint exclusions: `.git`, `node_modules`, etc. (via CheckpointExclusions)
- Checkpoints are tied to `clineMessages` timestamps
- Each checkpoint message includes `lastCheckpointHash`
- Multi-root workspaces: checkpoints NOT currently supported (shown as warning)
- Initial checkpoint runs in parallel with first read-only tool (performance optimization)
- SQLite-based lock management for concurrent task access

---

## 16. Additional Notable Systems

### Subagent System
**Files**: `src/core/task/tools/subagent/`
- `SubagentRunner.ts` - Runs child Task instances
- `SubagentBuilder.ts` - Configures subagent tasks
- `AgentConfigLoader.ts` - Loads agent configs from files
- Supports up to 5 parallel subagent prompts
- Dynamic tool registration for configured subagents

### Hook System
**Files**: `src/core/hooks/`
- 6 hook types: `TaskStart`, `TaskComplete`, `TaskCancel`, `TaskResume`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`
- Hooks are shell scripts discovered from `.cline/hooks/` directory
- Can: inject context, cancel operations, modify behavior
- `HookDiscoveryCache` with file watcher for performance

### Focus Chain (Task Progress Tracking)
**Files**: `src/core/task/focus-chain/`
- AI maintains a list of what it's working on
- Updated via `task_progress` parameter in tool calls
- Displayed in TaskHeader UI
- Helps with context and task management

### Slash Commands
**File**: `src/core/slash-commands/index.ts`
- `/condense` - Summarize conversation
- `/reportBug` - File a bug report
- Custom slash commands configurable

### Web Tools (Cline Provider Only)
- `web_search` - Search the web (via Cline's search API)
- `web_fetch` - Fetch and extract content from URLs

### Deep Planning
**Files**: `src/core/prompts/commands/deep-planning/`
- Multiple planning variants
- Registry-based architecture
- Used for complex task decomposition

### Multi-Provider Support
40+ LLM providers supported:
- Anthropic, OpenAI, Google (Gemini/Vertex), AWS Bedrock, Azure
- Mistral, Ollama, LM Studio, Groq, Cerebras
- OpenRouter, Requesty, DeepSeek, Together, Fireworks
- SAP AI Core, HuggingFace, and many more

### gRPC Communication Layer
- Extension uses gRPC for structured communication
- Protobuf definitions in `proto/` directory
- Both client and server implementations
- Supports recording/replay for testing

---

## Summary: Key Architectural Patterns

1. **Host Provider Abstraction**: Decouples from VS Code APIs, enabling CLI/JetBrains support
2. **Template + Variant System**: Model-specific prompt customization without code duplication
3. **Coordinator Pattern**: Tool execution through registered handlers with shared interfaces
4. **Mutex-Based State**: Single mutex for all state modifications preventing race conditions
5. **Shadow Git Checkpoints**: Full workspace undo via git commit/restore
6. **Hook System**: Extensible lifecycle hooks for customization
7. **Context Window Management**: Automatic summarization and file content optimization
8. **Streaming Architecture**: Real-time UI updates during LLM response streaming
9. **Multi-Provider**: Adapter pattern for 40+ LLM providers
10. **gRPC + Protobuf**: Structured, typed communication between extension and webview
