# MitraHelix AI Agent — Complete Test Plan

> **93 test cases across 22 categories** covering all features implemented through Round 35.

## Table of Contents
1. [Environment Setup](#1-environment-setup)
2. [Build Verification](#2-build-verification)
3. [Extension Activation](#3-extension-activation)
4. [UI / Webview Tests](#4-ui--webview-tests)
5. [LLM Provider Tests](#5-llm-provider-tests)
6. [Tool Execution Tests](#6-tool-execution-tests)
7. [Approval / Safety System Tests](#7-approval--safety-system-tests)
8. [Context Gathering Tests](#8-context-gathering-tests)
9. [Conversation Memory & Compression Tests](#9-conversation-memory--compression-tests)
10. [Cost Tracking & Budget Tests](#10-cost-tracking--budget-tests)
11. [Mode Switching Tests](#11-mode-switching-tests)
12. [Error Handling & Edge Case Tests](#12-error-handling--edge-case-tests)
13. [Security Tests](#13-security-tests)
14. [Performance Tests](#14-performance-tests)
15. [Workflow & Slash Command Tests](#15-workflow--slash-command-tests)
16. [Rules System Tests](#16-rules-system-tests)
17. [Enhanced @Mention Tests](#17-enhanced-mention-tests)
18. [Model Selector Tests](#18-model-selector-tests)
19. [Right Panel Chat Tests](#19-right-panel-chat-tests)
20. [React Error Boundary Tests](#20-react-error-boundary-tests)
21. [Context Menu Tests](#21-context-menu-tests)
22. [Streaming Performance Tests](#22-streaming-performance-tests)

---

## 1. Environment Setup

### 1.1 Prerequisites

| Requirement | Minimum Version | Verify Command |
|------------|----------------|----------------|
| Node.js | v18+ | `node --version` |
| npm | v9+ | `npm --version` |
| VS Code | v1.85+ | `code --version` |
| Git | any | `git --version` |

### 1.2 Clone & Install Dependencies

```bash
# Step 1: Navigate to the project
cd c:\Users\sohai\Downloads\sohabena\visual-score

# Step 2: Install extension dependencies
npm install

# Step 3: Install webview UI dependencies
cd webview-ui
npm install
cd ..
```

**Expected**: Both `npm install` commands complete without errors. `node_modules` folders appear in both root and `webview-ui/`.

### 1.3 API Keys Setup

You need at least ONE of these configured to test LLM features:

| Provider | VS Code Setting | How to Get |
|----------|----------------|-----------|
| **Anthropic** (recommended) | `mitraHelix.anthropicApiKey` | https://console.anthropic.com → API Keys |
| OpenAI | `mitraHelix.openaiApiKey` | https://platform.openai.com/api-keys |
| OpenRouter | `mitraHelix.openrouterApiKey` | https://openrouter.ai/keys |
| Ollama (free, local) | No key needed | Install from https://ollama.ai, run `ollama pull llama3.1` |

**To configure**: Open VS Code → `Ctrl+,` (Settings) → search "MitraHelix" → paste your API key.

### 1.4 Test Workspace Setup

Create a dedicated test workspace to avoid affecting real projects:

```bash
mkdir C:\temp\mitra-helix-test
cd C:\temp\mitra-helix-test
mkdir src
echo console.log("hello"); > src\index.js
echo # Test Project > README.md
echo node_modules/ > .gitignore
echo Always respond concisely. > .mitrahelixrules
```

Open this folder in VS Code: **File → Open Folder → `C:\temp\mitra-helix-test`**

---

## 2. Build Verification

### Test 2.1: TypeScript Compilation

```bash
cd c:\Users\sohai\Downloads\sohabena\visual-score
npx tsc --noEmit
```

**Expected**: Exit code 0, zero errors, zero output.
**FAIL criteria**: Any TypeScript errors printed.

### Test 2.2: Extension Bundle Build

```bash
node esbuild.mjs
```

**Expected**: Output `[esbuild] Build complete.` File `out/extension.js` exists and is > 100KB.
**FAIL criteria**: Any error output or missing `out/extension.js`.

### Test 2.3: Webview Build

```bash
cd webview-ui
npx vite build
```

**Expected**: Output `✓ built in Xs`. Files exist: `webview-ui/dist/index.html`, `webview-ui/dist/index.js`, `webview-ui/dist/index.css`.
**FAIL criteria**: Build errors or missing dist files.

### Test 2.4: Full Production Build

```bash
cd c:\Users\sohai\Downloads\sohabena\visual-score
npm run build
```

**Expected**: Both webview and extension build without errors.

---

## 3. Extension Activation

### Test 3.1: Launch Extension in Development Mode

1. Open the extension project folder in VS Code: `c:\Users\sohai\Downloads\sohabena\visual-score`
2. Press **F5** (or Run → Start Debugging)
3. A new VS Code window opens (Extension Development Host)
4. In the new window, open the test workspace: **File → Open Folder → `C:\temp\mitra-helix-test`**

**Expected**: 
- The Extension Development Host window opens without errors
- A "MitraHelix" icon appears in the Activity Bar (left sidebar)
- The Output panel (View → Output → select "MitraHelix") shows:
  ```
  MitraHelix AI Agent is now active!
  Registered 9 tools.
  MitraHelix AI Agent ready.
  ```

**FAIL criteria**: Error notifications, missing sidebar icon, or activation errors in Output.

### Test 3.2: Webview Panel Opens

1. Click the **MitraHelix** icon in the Activity Bar

**Expected**:
- The chat panel opens in the sidebar
- Shows an input box at the bottom
- No error messages visible
- The panel is styled correctly (dark theme matching VS Code)

**FAIL criteria**: Blank panel, error messages, or unstyled raw HTML.

### Test 3.3: Command Palette Commands

1. Press `Ctrl+Shift+P` → type "MitraHelix"

**Expected**: Two commands appear:
- `MitraHelix: New Chat`
- `MitraHelix: Focus Chat Input`

2. Run `MitraHelix: Focus Chat Input`

**Expected**: Cursor moves to the chat input box.

### Test 3.4: Keyboard Shortcut

1. Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)

**Expected**: Chat input box gains focus.

---

## 4. UI / Webview Tests

### Test 4.1: Send a Simple Message

1. Type "Hello, what can you do?" in the input box
2. Press Enter or click Send

**Expected**:
- Your message appears as a user bubble (right-aligned or distinctly styled)
- State changes to "thinking" (loading indicator visible)
- After 1-5 seconds, an assistant message streams in token-by-token
- The assistant message describes its capabilities
- State returns to "idle" when complete
- Input box is re-enabled

**FAIL criteria**: No response, frozen UI, error message, or input stays disabled.

### Test 4.2: Markdown Rendering

1. Send: "Show me a JavaScript code example with a bulleted list"

**Expected**:
- Code blocks render with **syntax highlighting** (colored syntax, dark background)
- Bullet lists render as actual bullet points
- Inline code renders with `monospace` styling

**FAIL criteria**: Raw markdown text shown, no syntax coloring in code blocks.

### Test 4.3: Code Block Copy Button

1. After receiving a response with a code block
2. Hover over the code block

**Expected**: A copy button appears. Clicking it copies the code to clipboard.

### Test 4.4: Streaming Display

1. Send a message that requires a long response: "Explain the SOLID principles in detail"

**Expected**:
- Text appears word-by-word (streaming), not all at once
- The message bubble updates smoothly
- No flickering or jumping

### Test 4.5: New Chat

1. After having a conversation with messages
2. Click the "New Chat" button (or run `MitraHelix: New Chat` command)

**Expected**:
- All messages are cleared
- Cost counter resets to $0.00
- State is idle
- Input box is ready

### Test 4.6: Error Boundary

1. This is hard to trigger manually. If at any point the UI crashes:

**Expected**: An error message appears with a "Try Again" button instead of a blank panel.

---

## 5. LLM Provider Tests

### Test 5.1: Anthropic Provider

1. Settings: `mitraHelix.provider` = `anthropic`, `mitraHelix.anthropicApiKey` = your key
2. Send: "What model are you?"

**Expected**: Response mentions Claude. Cost counter updates.

### Test 5.2: OpenAI Provider

1. Settings: `mitraHelix.provider` = `openai`, `mitraHelix.openaiApiKey` = your key
2. Send: "What model are you?"

**Expected**: Response mentions GPT. Cost counter updates.

### Test 5.3: OpenRouter Provider

1. Settings: `mitraHelix.provider` = `openrouter`, `mitraHelix.openrouterApiKey` = your key, `mitraHelix.model` = `anthropic/claude-sonnet-4-6`
2. Send: "Hello"

**Expected**: Response received. Cost counter updates.

### Test 5.4: Ollama Provider (Local)

**Prerequisite**: Ollama installed and running (`ollama serve`), model pulled (`ollama pull llama3.1`)

1. Settings: `mitraHelix.provider` = `ollama`, `mitraHelix.model` = `llama3.1`
2. Send: "Hello"

**Expected**: Response received from local model. No API key needed. Cost shows $0.00 (local model).

### Test 5.5: Invalid API Key

1. Settings: `mitraHelix.anthropicApiKey` = `sk-invalid-key-12345`
2. Send: "Hello"

**Expected**: Error message appears: "Invalid API key. Please check your Anthropic API key in VS Code settings." State returns to idle.

**FAIL criteria**: Crash, hang, or generic unhelpful error.

### Test 5.6: Provider Switch Mid-Conversation

1. Start with Anthropic, send a message, get a response
2. Change settings to OpenAI provider
3. Send another message

**Expected**: Second message uses OpenAI (different response style). No crash. Conversation continues.

---

## 6. Tool Execution Tests

### Test 6.1: read_file

1. Ensure `C:\temp\mitra-helix-test\src\index.js` exists
2. Send: "Read the file src/index.js and tell me what it does"

**Expected**:
- A tool call card appears showing `read_file` with parameter `path: src/index.js`
- If `autoApproveReads` is true (default), it auto-executes
- Tool card shows green checkmark and file contents in the result
- The assistant explains what the code does

### Test 6.2: write_to_file

1. Send: "Create a new file called src/hello.ts with a function that prints hello world"

**Expected**:
- Tool call card shows `write_to_file` with `path: src/hello.ts`
- **Approval required** (unless `autoApproveWrites` is true)
- Approval buttons appear: "Approve" and "Reject"
- Click **Approve**
- File is created at `C:\temp\mitra-helix-test\src\hello.ts`
- Tool card shows green checkmark
- Verify the file exists and contains valid TypeScript

### Test 6.3: replace_in_file

1. Send: "In src/index.js, change 'hello' to 'world'"

**Expected**:
- Tool call card shows `replace_in_file` with SEARCH/REPLACE blocks
- Approval required → Click Approve
- File is modified in place
- Open the file to verify the change was made correctly

### Test 6.4: execute_command

1. Send: "Run the command `echo hello from MitraHelix`"

**Expected**:
- Tool call card shows `execute_command` with `command: echo hello from MitraHelix`
- **Approval required** (always for commands by default)
- Click Approve
- Tool result shows STDOUT with "hello from MitraHelix", exit code 0

### Test 6.5: search_files

1. Create several test files with known content first
2. Send: "Search for the word 'hello' across all files in the project"

**Expected**:
- Tool call card shows `search_files` with regex `hello`
- Auto-executes (read operation)
- Results show file paths and matching lines

### Test 6.6: list_files

1. Send: "List all files in the src directory"

**Expected**:
- Tool call card shows `list_files` with `path: src`
- Auto-executes
- Shows directory listing with file names

### Test 6.7: list_code_definition_names

1. Create a file `src/example.ts` with functions and classes:
   ```typescript
   export class MyService {
     getData() { return []; }
   }
   export function helper() {}
   export interface Config { key: string; }
   ```
2. Send: "List all code definitions in src/example.ts"

**Expected**:
- Tool call card shows `list_code_definition_names`
- Shows extracted definitions: `class MyService`, `function helper`, `interface Config`

### Test 6.8: ask_followup_question

1. Send an ambiguous request: "Refactor the code"

**Expected**:
- The agent calls `ask_followup_question` tool
- A follow-up question appears asking for clarification
- State returns to idle so you can type an answer
- Type your answer → the conversation continues

### Test 6.9: attempt_completion

1. Send: "Create a file called done.txt with the text 'task complete'"

**Expected**:
- Agent creates the file (write_to_file tool)
- Agent calls `attempt_completion` with a summary
- "Task completed" message appears
- State returns to idle

### Test 6.10: Multi-Tool Execution

1. Send: "Read src/index.js and src/hello.ts, then create a new file src/combined.ts that imports both"

**Expected**:
- Multiple tool call cards appear
- Tools execute in sequence
- read_file calls auto-approve, write_to_file requires approval
- All tool results visible in expandable cards

---

## 7. Approval / Safety System Tests

### Test 7.1: Auto-Approve Reads (Default ON)

1. Verify setting: `mitraHelix.autoApproveReads` = `true`
2. Send: "Read README.md"

**Expected**: read_file executes immediately, no approval prompt.

### Test 7.2: Disable Auto-Approve Reads

1. Change setting: `mitraHelix.autoApproveReads` = `false`
2. Send: "Read README.md"

**Expected**: Approval buttons appear for read_file. Must click Approve to proceed.

### Test 7.3: Auto-Approve Writes (Default OFF)

1. Verify setting: `mitraHelix.autoApproveWrites` = `false`
2. Send: "Create a file test.txt with content 'test'"

**Expected**: write_to_file shows approval buttons. Must click Approve.

### Test 7.4: Enable Auto-Approve Writes

1. Change setting: `mitraHelix.autoApproveWrites` = `true`
2. Send: "Create a file test2.txt with content 'test'"

**Expected**: write_to_file executes immediately, no approval prompt.

### Test 7.5: Auto-Approve Specific Commands

1. Setting: `mitraHelix.autoApproveCommands` = `["echo", "ls", "dir"]`
2. Send: "Run echo hello"

**Expected**: `echo hello` executes without approval (matches "echo" prefix).

3. Send: "Run `rm -rf`"

**Expected**: Approval required (not in auto-approve list).

### Test 7.6: Reject a Tool Call

1. Setting: `autoApproveWrites` = `false`
2. Send: "Create a file rejected.txt with content 'should not exist'"
3. When approval appears, click **Reject**

**Expected**:
- Tool card shows "rejected" status
- File `rejected.txt` does NOT exist on disk
- The agent acknowledges the rejection and may ask what to do instead
- Conversation continues normally

### Test 7.7: Cancel During Approval

1. Trigger a tool call that needs approval
2. Instead of clicking Approve/Reject, click **Cancel Task**

**Expected**:
- The agent loop stops
- State returns to idle
- No pending approval UI left
- Can start a new conversation

---

## 8. Context Gathering Tests

### Test 8.1: Active File Context

1. Open `src/index.js` in the editor (make it the active tab)
2. Send: "What file do I have open?"

**Expected**: The agent knows about `src/index.js` and may reference its contents (gathered from active editor context).

### Test 8.2: Workspace File Tree

1. Send: "What files are in this project?"

**Expected**: Agent references the workspace structure without needing to call list_files first (gathered from WorkspaceIndexer context).

### Test 8.3: Diagnostics Context

1. Create a TypeScript file with an error:
   ```typescript
   // src/broken.ts
   const x: number = "hello";  // type error
   ```
2. Wait for VS Code to show the red squiggly
3. Send: "Are there any errors in my project?"

**Expected**: Agent references the TypeScript diagnostic without needing to run a command.

### Test 8.4: @mentions — File

1. Send: `@src/index.js explain this file`

**Expected**: The file content is automatically attached to the message. Agent explains it without calling read_file.

### Test 8.5: @mentions — Folder

1. Send: `@src/ what's in this directory?`

**Expected**: Folder listing is automatically attached.

### Test 8.6: @mentions — Problems

1. Have a diagnostic error in the workspace
2. Send: `@problems how do I fix these?`

**Expected**: Current VS Code diagnostics are attached to the message.

### Test 8.7: User Rules (.mitrahelixrules)

1. Ensure `.mitrahelixrules` contains: `Always respond concisely.`
2. Send: "Explain what JavaScript is"

**Expected**: Response is noticeably shorter/more concise than without the rule.

---

## 9. Conversation Memory & Compression Tests

### Test 9.1: Multi-Turn Context Retention

1. Send: "My name is Alice"
2. Send: "What is my name?"

**Expected**: Agent remembers "Alice" from the previous message.

### Test 9.2: Tool Result Memory

1. Send: "Read src/index.js"
2. After the tool executes, send: "Now modify line 1 of that file to add a comment"

**Expected**: Agent remembers the file contents from the previous tool call and modifies correctly.

### Test 9.3: Long Conversation (Compression Trigger)

1. Have a long back-and-forth conversation (10+ messages with tool calls)
2. Continue sending messages

**Expected**:
- Conversation continues to work even after many messages
- Earlier messages may be summarized (check Output panel for compression activity)
- Recent messages are still fully intact
- No API errors about context length

### Test 9.4: Compression Doesn't Break Tool Pairs

1. Have a conversation with multiple tool calls
2. Continue until compression triggers (watch Output panel)
3. Send another message that triggers a tool call

**Expected**: No Anthropic API errors about missing tool_results. Tool calls work normally after compression.

---

## 10. Cost Tracking & Budget Tests

### Test 10.1: Cost Display

1. Send a message and get a response

**Expected**: Cost counter at the bottom of the chat panel shows non-zero values (e.g., `$0.003 | 150 in / 200 out`).

### Test 10.2: Cost Accumulation

1. Send 3 messages in a row

**Expected**: Cost increases with each message, accumulating correctly. No sudden jumps or double-counting.

### Test 10.3: Cost Reset on New Chat

1. Have accumulated some cost
2. Click "New Chat"

**Expected**: Cost resets to `$0.00 | 0 in / 0 out`.

### Test 10.4: Budget Enforcement

1. Setting: `mitraHelix.maxBudgetPerTask` = `0.001` (very low — $0.001)
2. Send a message that requires a long response

**Expected**: After 1-2 iterations, the agent stops with: "Task budget exceeded ($X.XXX > $0.00 limit). Task stopped." State returns to idle.

3. Reset: Set `mitraHelix.maxBudgetPerTask` back to `1.0`

### Test 10.5: Budget Disabled (0)

1. Setting: `mitraHelix.maxBudgetPerTask` = `0`
2. Send multiple messages

**Expected**: No budget error. 0 means "no budget limit."

---

## 11. Mode Switching Tests

### Test 11.1: Act Mode (Default)

1. Verify mode indicator shows "Act"
2. Send: "Create a file called act-test.txt"

**Expected**: Agent uses tools to create the file. Tool call cards visible.

### Test 11.2: Plan Mode

1. Click the mode toggle to switch to "Plan"
2. Send: "Create a file called plan-test.txt"

**Expected**:
- Agent does NOT use any tools
- Instead, provides a text-only plan/analysis of how it would create the file
- No tool call cards appear
- File `plan-test.txt` does NOT exist

### Test 11.3: Mode Switch Mid-Conversation

1. Start in Act mode, send a message, get a response with tool calls
2. Switch to Plan mode
3. Send another message

**Expected**: Second response is text-only analysis, no tool calls.

---

## 12. Error Handling & Edge Case Tests

### Test 12.1: Empty Message

1. Try to send an empty message (just spaces or empty input)

**Expected**: Message is NOT sent. Input validation prevents it.

### Test 12.2: No Workspace Open

1. Close all folders in VS Code (File → Close Folder)
2. Try to send a message

**Expected**: Error message: "No workspace folder open. Please open a folder first."

### Test 12.3: Non-Existent File

1. Send: "Read the file this-does-not-exist.txt"

**Expected**: Tool executes but returns an error: "No such file or directory." Agent acknowledges the error and suggests alternatives.

### Test 12.4: Cancel During Streaming

1. Send a message that triggers a long response
2. While the response is streaming, click **Cancel**

**Expected**:
- Streaming stops
- Partial response remains visible
- State returns to idle
- Can send new messages

### Test 12.5: Cancel During Tool Execution

1. Send: "Run the command `ping localhost -n 30`" (long-running command)
2. Approve the command
3. While it's running, click Cancel

**Expected**: Command is interrupted. State returns to idle.

### Test 12.6: Rapid Message Sending

1. Send a message, then immediately send another before the first completes

**Expected**: First request is cancelled, second request proceeds. No crash or garbled output.

### Test 12.7: Very Large File

1. Create a large file (> 100KB):
   ```bash
   python -c "print('x' * 200000)" > big-file.txt
   ```
2. Send: "Read big-file.txt"

**Expected**: File is truncated at MAX_FILE_SIZE (100,000 chars) with a truncation notice. No crash.

### Test 12.8: Command Timeout

1. Send: "Run the command `ping localhost -n 120`" (runs > 60 seconds)
2. Approve it

**Expected**: After 60 seconds (DEFAULT_COMMAND_TIMEOUT), command is killed with "Command timed out after 60 seconds."

### Test 12.9: Maximum Iterations

1. Give the agent a task that requires many steps: "Create 30 separate files named file1.txt through file30.txt"

**Expected**: After 25 iterations (MAX_ITERATIONS), the agent stops with "Reached maximum iterations (25). Task may be incomplete."

---

## 13. Security Tests

### Test 13.1: Path Traversal — Sibling Directory

1. Create a sibling directory with a secret:
   ```bash
   mkdir C:\temp\mitra-helix-secret
   echo TOP_SECRET > C:\temp\mitra-helix-secret\secret.txt
   ```
2. Send: "Read the file ../mitra-helix-secret/secret.txt"

**Expected**: Error: "Access denied: path is outside the workspace." The file is NOT read.

### Test 13.2: Path Traversal — Absolute Path

1. Send: "Read the file C:\Windows\System32\config\SAM"

**Expected**: Error: "Access denied: path is outside the workspace."

### Test 13.3: Path Traversal — Write Outside Workspace

1. Send: "Create a file at ../outside/hack.txt with content 'pwned'"

**Expected**: Error: "Access denied: path is outside the workspace." File is NOT created.

### Test 13.4: Command Injection via Tool Parameters

1. Send: "Read the file `; rm -rf /`"

**Expected**: The path is treated as a literal filename (which doesn't exist). No command injection occurs.

### Test 13.5: CSP — Script Injection

1. Send a message containing `<script>alert('xss')</script>`

**Expected**: The script tag is rendered as text, not executed. No alert popup. (CSP blocks inline scripts in the webview.)

---

## 14. Performance Tests

### Test 14.1: Extension Activation Time

1. Press F5 to launch the extension
2. Time how long until "MitraHelix AI Agent ready." appears in Output

**Expected**: < 2 seconds. The extension should activate quickly.

### Test 14.2: Webview Load Time

1. Click the MitraHelix icon in the Activity Bar
2. Time how long until the chat panel is fully rendered

**Expected**: < 1 second. The webview should load instantly.

### Test 14.3: Streaming Responsiveness

1. Send a message and observe the streaming output

**Expected**: Tokens appear with < 100ms latency between chunks. No visible lag or buffering.

### Test 14.4: Large Workspace

1. Open a large project (> 1000 files) as the workspace
2. Send a message

**Expected**: Context gathering (file tree, diagnostics) completes without hanging. File tree is truncated to manageable size.

### Test 14.5: Memory Retention Across Panel Hides

1. Have a conversation with several messages
2. Click a different panel in the sidebar (e.g., Explorer)
3. Click back to MitraHelix

**Expected**: All messages are still visible. No re-rendering or data loss. (`retainContextWhenHidden: true`)

---

## Test Results Template

Use this template to record your test results:

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 2.1 | TypeScript Compilation | ⬜ PASS / ⬜ FAIL | |
| 2.2 | Extension Bundle Build | ⬜ PASS / ⬜ FAIL | |
| 2.3 | Webview Build | ⬜ PASS / ⬜ FAIL | |
| 2.4 | Full Production Build | ⬜ PASS / ⬜ FAIL | |
| 3.1 | Launch Extension Dev Mode | ⬜ PASS / ⬜ FAIL | |
| 3.2 | Webview Panel Opens | ⬜ PASS / ⬜ FAIL | |
| 3.3 | Command Palette Commands | ⬜ PASS / ⬜ FAIL | |
| 3.4 | Keyboard Shortcut | ⬜ PASS / ⬜ FAIL | |
| 4.1 | Send Simple Message | ⬜ PASS / ⬜ FAIL | |
| 4.2 | Markdown Rendering | ⬜ PASS / ⬜ FAIL | |
| 4.3 | Code Block Copy Button | ⬜ PASS / ⬜ FAIL | |
| 4.4 | Streaming Display | ⬜ PASS / ⬜ FAIL | |
| 4.5 | New Chat | ⬜ PASS / ⬜ FAIL | |
| 4.6 | Error Boundary | ⬜ PASS / ⬜ FAIL | |
| 5.1 | Anthropic Provider | ⬜ PASS / ⬜ FAIL | |
| 5.2 | OpenAI Provider | ⬜ PASS / ⬜ FAIL | |
| 5.3 | OpenRouter Provider | ⬜ PASS / ⬜ FAIL | |
| 5.4 | Ollama Provider | ⬜ PASS / ⬜ FAIL | |
| 5.5 | Invalid API Key | ⬜ PASS / ⬜ FAIL | |
| 5.6 | Provider Switch | ⬜ PASS / ⬜ FAIL | |
| 6.1 | read_file | ⬜ PASS / ⬜ FAIL | |
| 6.2 | write_to_file | ⬜ PASS / ⬜ FAIL | |
| 6.3 | replace_in_file | ⬜ PASS / ⬜ FAIL | |
| 6.4 | execute_command | ⬜ PASS / ⬜ FAIL | |
| 6.5 | search_files | ⬜ PASS / ⬜ FAIL | |
| 6.6 | list_files | ⬜ PASS / ⬜ FAIL | |
| 6.7 | list_code_definition_names | ⬜ PASS / ⬜ FAIL | |
| 6.8 | ask_followup_question | ⬜ PASS / ⬜ FAIL | |
| 6.9 | attempt_completion | ⬜ PASS / ⬜ FAIL | |
| 6.10 | Multi-Tool Execution | ⬜ PASS / ⬜ FAIL | |
| 7.1 | Auto-Approve Reads ON | ⬜ PASS / ⬜ FAIL | |
| 7.2 | Auto-Approve Reads OFF | ⬜ PASS / ⬜ FAIL | |
| 7.3 | Auto-Approve Writes OFF | ⬜ PASS / ⬜ FAIL | |
| 7.4 | Auto-Approve Writes ON | ⬜ PASS / ⬜ FAIL | |
| 7.5 | Auto-Approve Commands | ⬜ PASS / ⬜ FAIL | |
| 7.6 | Reject Tool Call | ⬜ PASS / ⬜ FAIL | |
| 7.7 | Cancel During Approval | ⬜ PASS / ⬜ FAIL | |
| 8.1 | Active File Context | ⬜ PASS / ⬜ FAIL | |
| 8.2 | Workspace File Tree | ⬜ PASS / ⬜ FAIL | |
| 8.3 | Diagnostics Context | ⬜ PASS / ⬜ FAIL | |
| 8.4 | @mention File | ⬜ PASS / ⬜ FAIL | |
| 8.5 | @mention Folder | ⬜ PASS / ⬜ FAIL | |
| 8.6 | @mention Problems | ⬜ PASS / ⬜ FAIL | |
| 8.7 | User Rules | ⬜ PASS / ⬜ FAIL | |
| 9.1 | Multi-Turn Context | ⬜ PASS / ⬜ FAIL | |
| 9.2 | Tool Result Memory | ⬜ PASS / ⬜ FAIL | |
| 9.3 | Long Conversation | ⬜ PASS / ⬜ FAIL | |
| 9.4 | Compression + Tools | ⬜ PASS / ⬜ FAIL | |
| 10.1 | Cost Display | ⬜ PASS / ⬜ FAIL | |
| 10.2 | Cost Accumulation | ⬜ PASS / ⬜ FAIL | |
| 10.3 | Cost Reset | ⬜ PASS / ⬜ FAIL | |
| 10.4 | Budget Enforcement | ⬜ PASS / ⬜ FAIL | |
| 10.5 | Budget Disabled | ⬜ PASS / ⬜ FAIL | |
| 11.1 | Act Mode | ⬜ PASS / ⬜ FAIL | |
| 11.2 | Plan Mode | ⬜ PASS / ⬜ FAIL | |
| 11.3 | Mode Switch | ⬜ PASS / ⬜ FAIL | |
| 12.1 | Empty Message | ⬜ PASS / ⬜ FAIL | |
| 12.2 | No Workspace | ⬜ PASS / ⬜ FAIL | |
| 12.3 | Non-Existent File | ⬜ PASS / ⬜ FAIL | |
| 12.4 | Cancel Streaming | ⬜ PASS / ⬜ FAIL | |
| 12.5 | Cancel Tool Execution | ⬜ PASS / ⬜ FAIL | |
| 12.6 | Rapid Messages | ⬜ PASS / ⬜ FAIL | |
| 12.7 | Very Large File | ⬜ PASS / ⬜ FAIL | |
| 12.8 | Command Timeout | ⬜ PASS / ⬜ FAIL | |
| 12.9 | Max Iterations | ⬜ PASS / ⬜ FAIL | |
| 13.1 | Path Traversal Sibling | ⬜ PASS / ⬜ FAIL | |
| 13.2 | Path Traversal Absolute | ⬜ PASS / ⬜ FAIL | |
| 13.3 | Path Traversal Write | ⬜ PASS / ⬜ FAIL | |
| 13.4 | Command Injection | ⬜ PASS / ⬜ FAIL | |
| 13.5 | CSP Script Injection | ⬜ PASS / ⬜ FAIL | |
| 14.1 | Activation Time | ⬜ PASS / ⬜ FAIL | |
| 14.2 | Webview Load Time | ⬜ PASS / ⬜ FAIL | |
| 14.3 | Streaming Responsiveness | ⬜ PASS / ⬜ FAIL | |
| 14.4 | Large Workspace | ⬜ PASS / ⬜ FAIL | |
| 14.5 | Panel Hide/Show | ⬜ PASS / ⬜ FAIL | |

---

---

## 15. Workflow & Slash Command Tests

### Test 15.1: Workflow Discovery

1. Create `.mitrahelix/workflows/code-review.md`:
   ```markdown
   ---
   description: Perform a code review
   ---
   Review the code for bugs and style issues.
   ```
2. Open MitraHelix chat

**Expected**: Typing `/` in the input box shows a dropdown with "code-review" workflow.

### Test 15.2: Slash Command Execution

1. Type `/code-review` and select it
2. Add " src/index.js" after the workflow name
3. Press Enter

**Expected**: The workflow instructions are prepended to your message. The agent reviews the file.

### Test 15.3: Workflow Keyboard Navigation

1. Type `/` to open the slash menu
2. Press ArrowDown / ArrowUp

**Expected**: Selection highlight moves between workflows. Enter selects the highlighted one.

### Test 15.4: Workflow File Watcher

1. Create a new workflow file `.mitrahelix/workflows/test-flow.md`
2. Type `/` in the input

**Expected**: The new workflow appears in the list without needing to restart.

### Test 15.5: Invalid Workflow File

1. Create a workflow file larger than 50KB

**Expected**: File is silently skipped. Other workflows still load correctly.

---

## 16. Rules System Tests

### Test 16.1: Simple Rules File

1. Create `.mitrahelixrules` with: `Always respond in bullet points.`
2. Send: "What is TypeScript?"

**Expected**: Response uses bullet points.

### Test 16.2: Rules Directory with Frontmatter

1. Create `.mitrahelix/rules/ts-rules.md`:
   ```markdown
   ---
   globs: ["**/*.ts"]
   ---
   - Use strict TypeScript
   - Prefer const over let
   ```
2. Open a `.ts` file as active editor
3. Send: "Write a function"

**Expected**: The rule is activated (matching `.ts` glob). Code follows the rules.

### Test 16.3: Always-Apply Rule

1. Create `.mitrahelix/rules/global.md`:
   ```markdown
   ---
   alwaysApply: true
   ---
   Be very concise in all responses.
   ```
2. Send any message

**Expected**: Response is notably concise (rule always active).

### Test 16.4: AGENTS.md Compatibility

1. Create `AGENTS.md` in workspace root with rules content
2. Send a message

**Expected**: Rules from AGENTS.md are included in context.

### Test 16.5: .cursorrules Compatibility

1. Create `.cursorrules` in workspace root with rules content
2. Send a message

**Expected**: Rules from .cursorrules are included in context.

### Test 16.6: Rules Budget (30KB)

1. Create many large rule files exceeding 30KB total

**Expected**: Rules are truncated with a notice: "[Rules truncated — N more rules omitted to fit context budget]"

---

## 17. Enhanced @Mention Tests

### Test 17.1: @git Mention

1. Make some git changes in the workspace (stage, modify files)
2. Send: `@git what have I changed?`

**Expected**: Git diff and status are attached to the message. Agent knows about your changes.

### Test 17.2: @selection Mention

1. Select some code in the editor
2. Send: `@selection explain this code`

**Expected**: The selected text is attached with file path and line range.

### Test 17.3: @terminal Mention

1. Have at least one terminal open in VS Code
2. Send: `@terminal what terminals do I have?`

**Expected**: Terminal names are listed in the context.

### Test 17.4: @file with Spaces in Path

1. Create a file with spaces: `src/My Component.tsx`
2. Send: `@file "src/My Component.tsx" explain this`

**Expected**: File is correctly resolved using quoted path syntax.

### Test 17.5: @url with Redirects

1. Send: `@url https://httpbin.org/redirect/3 what is this?`

**Expected**: URL is fetched following redirects (up to 10). Content is included.

### Test 17.6: Mention Budget (150K)

1. Attach many large files via @file and UI attachments

**Expected**: After reaching 150K chars total, additional mentions are skipped. No context overflow.

### Test 17.7: Cross-Deduplication

1. Type `@file README.md` in the message AND attach README.md via the UI file picker

**Expected**: The file content appears only once in context, not duplicated.

---

## 18. Model Selector Tests

### Test 18.1: Model Picker UI

1. Click the model name in TaskHeader

**Expected**: A dropdown opens showing models grouped by provider (Anthropic, OpenAI, Google, etc.).

### Test 18.2: Switch Model

1. Select a different model from the dropdown
2. Send a message

**Expected**: The new model is used. Cost tracking reflects the new model's pricing.

### Test 18.3: Model Picker Disabled During Task

1. Start a task (send a message)
2. Try to open the model picker while the agent is running

**Expected**: Model picker is disabled/grayed out during active tasks.

---

## 19. Right Panel Chat Tests

### Test 19.1: Open Panel

1. Press `Ctrl+Shift+L` (or `Cmd+Shift+L`)

**Expected**: A chat panel opens in the editor area beside your files.

### Test 19.2: Panel Sync

1. Have both sidebar and panel open
2. Send a message from either

**Expected**: Both views show the same messages and state.

### Test 19.3: Panel Close Cleanup

1. Have the panel open with an active task
2. Close the panel tab

**Expected**: The agent task is properly cancelled.

---

## 20. React Error Boundary Tests

### Test 20.1: Error Recovery

1. If the webview ever crashes (blank panel)

**Expected**: An error message appears with "Something went wrong", the error details, and a "Retry" button. Clicking Retry recovers the UI.

---

## 21. Context Menu Tests

### Test 21.1: Editor Context Menu

1. Select some code in the editor
2. Right-click → "Ask MitraHelix About This"

**Expected**: MitraHelix sidebar opens with the selected code attached as context.

### Test 21.2: Explorer Context Menu

1. Right-click a file in the Explorer
2. Click "Add to MitraHelix Context"

**Expected**: The file is added as an attachment in the MitraHelix input box.

---

## 22. Streaming Performance Tests

### Test 22.1: Token Buffer Performance

1. Send a message that generates a long response (500+ words)

**Expected**: Tokens appear smoothly without visible jank. The 50ms buffer batches tokens efficiently. No O(n²) rendering lag.

### Test 22.2: React.memo Optimization

1. During streaming, observe the TaskHeader and InputBox

**Expected**: TaskHeader and InputBox do NOT visibly re-render during token streaming (they're wrapped in React.memo).

---

## Updated Test Results Template

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 15.1 | Workflow Discovery | ⬜ PASS / ⬜ FAIL | |
| 15.2 | Slash Command Execution | ⬜ PASS / ⬜ FAIL | |
| 15.3 | Workflow Keyboard Nav | ⬜ PASS / ⬜ FAIL | |
| 15.4 | Workflow File Watcher | ⬜ PASS / ⬜ FAIL | |
| 15.5 | Invalid Workflow File | ⬜ PASS / ⬜ FAIL | |
| 16.1 | Simple Rules File | ⬜ PASS / ⬜ FAIL | |
| 16.2 | Rules with Globs | ⬜ PASS / ⬜ FAIL | |
| 16.3 | Always-Apply Rule | ⬜ PASS / ⬜ FAIL | |
| 16.4 | AGENTS.md Compat | ⬜ PASS / ⬜ FAIL | |
| 16.5 | .cursorrules Compat | ⬜ PASS / ⬜ FAIL | |
| 16.6 | Rules Budget | ⬜ PASS / ⬜ FAIL | |
| 17.1 | @git Mention | ⬜ PASS / ⬜ FAIL | |
| 17.2 | @selection Mention | ⬜ PASS / ⬜ FAIL | |
| 17.3 | @terminal Mention | ⬜ PASS / ⬜ FAIL | |
| 17.4 | @file with Spaces | ⬜ PASS / ⬜ FAIL | |
| 17.5 | @url with Redirects | ⬜ PASS / ⬜ FAIL | |
| 17.6 | Mention Budget | ⬜ PASS / ⬜ FAIL | |
| 17.7 | Cross-Deduplication | ⬜ PASS / ⬜ FAIL | |
| 18.1 | Model Picker UI | ⬜ PASS / ⬜ FAIL | |
| 18.2 | Switch Model | ⬜ PASS / ⬜ FAIL | |
| 18.3 | Picker Disabled | ⬜ PASS / ⬜ FAIL | |
| 19.1 | Open Panel | ⬜ PASS / ⬜ FAIL | |
| 19.2 | Panel Sync | ⬜ PASS / ⬜ FAIL | |
| 19.3 | Panel Close | ⬜ PASS / ⬜ FAIL | |
| 20.1 | Error Recovery | ⬜ PASS / ⬜ FAIL | |
| 21.1 | Editor Context Menu | ⬜ PASS / ⬜ FAIL | |
| 21.2 | Explorer Context Menu | ⬜ PASS / ⬜ FAIL | |
| 22.1 | Token Buffer Perf | ⬜ PASS / ⬜ FAIL | |
| 22.2 | React.memo Opt | ⬜ PASS / ⬜ FAIL | |

---

## Quick Smoke Test (5-Minute Checklist)

If you only have 5 minutes, run these tests to verify core functionality:

1. ⬜ **Build**: `npm run build` succeeds
2. ⬜ **Launch**: F5 → Extension Host opens, sidebar icon appears
3. ⬜ **Chat**: Send "Hello" → get a streamed response
4. ⬜ **Tool**: Send "Read README.md" → file contents shown
5. ⬜ **Approval**: Send "Create test.txt" → approval buttons appear, approve → file created
6. ⬜ **Cancel**: Send a message, click Cancel → stops gracefully
7. ⬜ **Security**: Send "Read ../outside.txt" → access denied error
8. ⬜ **New Chat**: Click New Chat → messages cleared, cost reset
9. ⬜ **Mode**: Toggle to Plan mode → send "Create a file" → no tool calls, text-only plan
10. ⬜ **Workflow**: Type `/` → slash menu appears with workflows
11. ⬜ **Model**: Click model name → selector dropdown shows models grouped by provider
