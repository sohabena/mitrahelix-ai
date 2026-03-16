# Mitra Helix AI - Upstream Tracking

This document tracks all differences between Mitra Helix AI (agent name: MitraH) and the upstream Cline codebase to facilitate easy upstream merges.

## Base

- **Upstream:** https://github.com/cline/cline
- **Base commit:** `9824d8d` (Cline main, post v3.72.0)
- **Import date:** 2026-03-10
- **Last merge:** 2026-03-16
- **Product name:** Mitra Helix AI
- **Agent name:** MitraH
- **Rebrand strategy:** Tier 1 (merge-friendly) -- only user-facing strings changed, all internal identifiers identical to Cline

## Upstream Remote

```bash
git remote -v
# cline-upstream  https://github.com/cline/cline.git (fetch)
# origin          https://github.com/sohabena/mitrahelix-ai.git (push)
```

## Merge Instructions

To pull the latest features from upstream Cline:

```bash
# 1. Fetch upstream changes
git fetch cline-upstream

# 2. Merge into your working branch
git merge cline-upstream/main

# 3. Resolve conflicts (only in files listed below)
#    Most conflicts will be simple "Cline" vs "MitraHelix" text replacements

# 4. Build and verify
npm install
npm run build:webview
npx tsc --noEmit
node esbuild.mjs

# 5. Update this document
#    - Update "Base commit" to new commit hash
#    - Add any new modified files if the merge introduced changes to our rebranded files

# 6. Commit
git add -A
git commit -m "merge: sync with upstream Cline <commit-hash>"
```

## Modified Files (diff from upstream)

All changes below are **Tier 1 rebrand only** -- user-facing display strings "Cline" replaced with "MitraH" (agent persona) or "Mitra Helix AI" (product name). No internal identifiers, file names, command IDs, or code logic was changed.

### Extension Manifest and Registry

| File | Change Description |
|------|--------------------|
| `package.json` | name, displayName, publisher, author, description, repository, keywords, command categories/titles, walkthrough text, activity bar title, configuration title |
| `src/registry.ts` | Added `mitra-helix` to prefix/viewPrefix mapping so command IDs (`cline.*`) and view IDs (`claude-dev.*`) resolve correctly with the new package name |

### Documentation

| File | Change Description |
|------|--------------------|
| `README.md` | Project name, self-referencing GitHub URLs |
| `CONTRIBUTING.md` | Project name, self-referencing GitHub URLs, clone command |
| `LICENSE` | Copyright holder: "Cline Bot Inc." -> "MitraHelix" |
| `SECURITY.md` | Project name references |
| `CHANGELOG.md` | New entry at top for MitraHelix rebrand |

### Walkthrough

| File | Change Description |
|------|--------------------|
| `walkthrough/step1.md` | "Cline" -> "MitraHelix" in text |
| `walkthrough/step2.md` | "Cline" -> "MitraHelix" in text |
| `walkthrough/step3.md` | "Cline" -> "MitraHelix" in text |
| `walkthrough/step4.md` | "Cline" -> "MitraHelix" in text |
| `walkthrough/step5.md` | "Cline" -> "MitraHelix" in text |

### Assets

| File | Change Description |
|------|--------------------|
| `assets/icons/icon.png` | Replaced with MitraHelix icon |

### Webview UI - Core

| File | Change Description |
|------|--------------------|
| `webview-ui/index.html` | Page title |
| `webview-ui/src/context/ExtensionStateContext.tsx` | Bypassed Cline welcome/onboarding/login screen -- users go straight to chat and configure API keys in settings |

### Naming Convention
- **Product name (branding, titles, about pages):** "Mitra Helix AI"
- **Agent persona (chat actions, commands, where the agent speaks/acts):** "MitraH"

### Webview UI - Chat Components

| File | Change Description |
|------|--------------------|
| `webview-ui/src/components/chat/ChatRow.tsx` | ~20 user-facing status strings |
| `webview-ui/src/components/chat/ChatTextArea.tsx` | Mode tooltip text |
| `webview-ui/src/components/chat/BrowserSessionRow.tsx` | Browser action status text |
| `webview-ui/src/components/chat/SubagentStatusRow.tsx` | Subagent status text |
| `webview-ui/src/components/chat/ErrorRow.tsx` | Error messages, sign-in text |
| `webview-ui/src/components/chat/ReportBugPreview.tsx` | Version label |
| `webview-ui/src/components/chat/auto-approve-menu/AutoApproveModal.tsx` | Description text |
| `webview-ui/src/components/chat/chat-view/components/messages/ToolGroupRenderer.tsx` | Tool group label |
| `webview-ui/src/components/chat/chat-view/components/layout/WelcomeSection.tsx` | Worktree descriptions |

### Webview UI - Settings Components

| File | Change Description |
|------|--------------------|
| `webview-ui/src/components/settings/SettingsView.tsx` | About tooltip |
| `webview-ui/src/components/settings/sections/AboutSection.tsx` | Version heading, description |
| `webview-ui/src/components/settings/sections/TerminalSettingsSection.tsx` | 4 setting descriptions |
| `webview-ui/src/components/settings/sections/GeneralSettingsSection.tsx` | Telemetry description |
| `webview-ui/src/components/settings/sections/FeatureSettingsSection.tsx` | 3 feature descriptions |
| `webview-ui/src/components/settings/sections/BrowserSettingsSection.tsx` | 2 setting descriptions |
| `webview-ui/src/components/settings/PreferredLanguageSetting.tsx` | Language description |
| `webview-ui/src/components/settings/ClineAccountInfoCard.tsx` | Sign-up button text |
| `webview-ui/src/components/settings/ClineModelPicker.tsx` | Model list description |
| `webview-ui/src/components/settings/OpenRouterModelPicker.tsx` | Model recommendation text |
| `webview-ui/src/components/settings/RequestyModelPicker.tsx` | Model recommendation text |
| `webview-ui/src/components/settings/GroqModelPicker.tsx` | Model recommendation text |
| `webview-ui/src/components/settings/BasetenModelPicker.tsx` | Model recommendation text |
| `webview-ui/src/components/settings/providers/XaiProvider.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/TogetherProvider.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/OllamaProvider.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/OpenAICompatible.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/NebiusProvider.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/NousresearchProvider.tsx` | Provider note |
| `webview-ui/src/components/settings/providers/LMStudioProvider.tsx` | Provider note |

### Webview UI - Other Components

| File | Change Description |
|------|--------------------|
| `webview-ui/src/components/welcome/WelcomeView.tsx` | Greeting text |
| `webview-ui/src/components/welcome/SuggestedTasks.tsx` | Section heading |
| `webview-ui/src/components/common/TelemetryBanner.tsx` | Banner heading and description |
| `webview-ui/src/components/common/WhatsNewModal.tsx` | Support text |
| `webview-ui/src/components/common/WhatsNewItems.tsx` | 3 announcement strings |
| `webview-ui/src/components/onboarding/data-steps.ts` | 3 onboarding strings |
| `webview-ui/src/components/mcp/configuration/tabs/installed/ConfigureServersView.tsx` | MCP description |
| `webview-ui/src/components/cline-rules/ClineRulesToggleModal.tsx` | 8 rule/workflow descriptions |
| `webview-ui/src/components/cline-rules/NewRuleRow.tsx` | Hook description |
| `webview-ui/src/components/account/AccountView.tsx` | Environment label |
| `webview-ui/src/components/account/AccountWelcomeView.tsx` | Sign-up button text |
| `webview-ui/src/components/worktrees/WorktreesView.tsx` | 2 worktree descriptions |

### MuleSoft Persona (Domain Focus)

MitraH is configured as a **MuleSoft-only** agent. The following files contain MuleSoft-specific persona overrides (in addition to Tier 1 rebrand):

- All agent role definitions (agent_role.ts, variant overrides: hermes, devstral, gemini-3, xs, native-gpt-5-1)
- `src/core/prompts/system-prompt-legacy/families/local-models/compact-system-prompt.ts`
- `src/core/controller/task/explainChangesShared.ts`
- `src/core/prompts/system-prompt/components/capabilities.ts` (MuleSoft context)
- `src/core/prompts/system-prompt/components/objective.ts` (MuleSoft context)
- `src/core/prompts/commands.ts` (new_task/condense MuleSoft context)
- Deep-planning variants: gpt51.ts, gemini3.ts, anthropic.ts
- `src/core/task/tools/subagent/SubagentBuilder.ts`
- `docs/features/memory-bank.mdx`
- `evals/benchmarks/tool-precision/replace-in-file/prompts/claude4SystemPrompt-06-06-25.ts`
- `src/core/prompts/system-prompt/README.md` (documentation example)
- `src/core/prompts/system-prompt/__tests__/PromptBuilder.test.ts` (test fixtures)
- `src/core/prompts/commands/deep-planning/variants/gemini.ts`, `generic.ts`
- `src/core/prompts/contextManagement.ts`
- `src/core/prompts/system-prompt-legacy/families/next-gen-models/gpt-5.ts` (new_task Key Technical Concepts)

### System Prompts (Agent Persona)

| File | Change Description |
|------|--------------------|
| `src/core/prompts/system-prompt/components/agent_role.ts` | "You are Cline" -> "You are MitraH", software engineer -> MuleSoft integration specialist |
| `src/core/prompts/system-prompt/components/feedback.ts` | User-facing help text: "Cline" -> "MitraH" |
| `src/core/prompts/system-prompt/variants/hermes/overrides.ts` | Agent role: "You are Cline" -> "You are MitraH" |
| `src/core/prompts/system-prompt/variants/xs/overrides.ts` | Agent role: "You are Cline" -> "You are MitraH" |
| `src/core/prompts/system-prompt/variants/native-gpt-5-1/overrides.ts` | Agent role: "You are Cline" -> "You are MitraH" |
| `src/core/prompts/system-prompt/variants/gemini-3/overrides.ts` | Agent role: "You are Cline" -> "You are MitraH" |
| `src/core/prompts/system-prompt/variants/devstral/overrides.ts` | Agent role: "You are Cline" -> "You are MitraH" |
| `src/core/prompts/system-prompt-legacy/families/next-gen-models/gpt-5.ts` | Agent role + feedback text |
| `src/core/prompts/commands.ts` | Rule file prompts, bug report prompt: "Cline" -> "MitraH" |

### Tool Handlers (Notification Strings)

| File | Change Description |
|------|--------------------|
| `src/core/task/tools/handlers/WebSearchToolHandler.ts` | "Cline wants to search" -> "MitraH wants to search" |
| `src/core/task/tools/handlers/ApplyPatchHandler.ts` | "Cline wants to edit" -> "MitraH wants to edit" |
| `src/core/task/tools/handlers/CondenseHandler.ts` | "Cline wants to condense" -> "MitraH wants to condense" |
| `src/core/task/tools/handlers/ReportBugHandler.ts` | "Cline wants to create" -> "MitraH wants to create" |
| `src/core/task/tools/handlers/NewTaskHandler.ts` | "Cline wants to start" -> "MitraH wants to start" |
| `src/core/task/tools/handlers/WriteToFileToolHandler.ts` | "Cline tried/wants" -> "MitraH tried/wants" |
| `src/core/task/tools/handlers/ReadFileToolHandler.ts` | "Cline wants to read" -> "MitraH wants to read" |
| `src/core/task/tools/handlers/WebFetchToolHandler.ts` | "Cline web tools/wants" -> "MitraH web tools/wants" |
| `src/core/task/tools/handlers/ExecuteCommandToolHandler.ts` | "Cline wants to execute" -> "MitraH wants to execute" |
| `src/core/task/tools/handlers/BrowserToolHandler.ts` | "Cline wants to use a browser" -> "MitraH wants to use a browser" |
| `src/core/task/tools/handlers/ListFilesToolHandler.ts` | "Cline wants to view" -> "MitraH wants to view" |
| `src/core/task/tools/handlers/SubagentToolHandler.ts` | "Cline wants to use" -> "MitraH wants to use" |
| `src/core/task/tools/handlers/AccessMcpResourceHandler.ts` | "Cline wants to access" -> "MitraH wants to access" |
| `src/core/task/tools/handlers/SearchFilesToolHandler.ts` | "Cline wants to search files" -> "MitraH wants to search files" |
| `src/core/task/tools/handlers/AskFollowupQuestionToolHandler.ts` | "Cline has a question" -> "MitraH has a question" |
| `src/core/task/tools/handlers/UseMcpToolHandler.ts` | "Cline tried/wants to use" -> "MitraH tried/wants to use" |
| `src/core/task/tools/handlers/AttemptCompletionHandler.ts` | "Cline wants to execute" -> "MitraH wants to execute" |
| `src/core/task/tools/handlers/ListCodeDefinitionNamesToolHandler.ts` | "Cline wants to analyze" -> "MitraH wants to analyze" |

### Task Engine and Core

| File | Change Description |
|------|--------------------|
| `src/core/task/index.ts` | "Cline instance aborted", error messages, troubleshooting text |
| `src/core/task/tools/subagent/AgentConfigLoader.ts` | Agents config path: ~/Documents/Cline/ -> ~/Documents/MitraH/ |
| `src/core/controller/task/explainChangesShared.ts` | Explainer system prompt persona |
| `src/core/controller/checkpoints/checkpointRestore.ts` | Logger message |
| `src/core/controller/models/refreshClineModels.ts` | Logger/error messages |
| `src/core/controller/models/refreshClineRecommendedModels.ts` | Logger/error messages |
| `src/core/api/providers/cline.ts` | API error messages |
| `src/core/api/providers/vscode-lm.ts` | Language Model API error/logger messages, permission justification |
| `src/core/api/transform/vscode-lm-format.ts` | Logger messages |
| `src/integrations/terminal/standalone/StandaloneTerminalManager.ts` | Terminal tab name |
| `src/integrations/checkpoints/CheckpointGitOperations.ts` | Git checkpoint author name |
| `src/hosts/vscode/review/VscodeCommentReviewController.ts` | Review controller label |
| `src/shared/cline/banner.ts` | CLI banner title |
| `src/common.ts` | Version notification messages |
| `src/config.ts` | Logger message |
| `src/services/temp/ClineTempManager.ts` | Logger message |
| `src/utils/cli-detector.ts` | Added MitraH version detection alongside Cline |

## What Was NOT Changed (preserved for merge compatibility)

- All TypeScript identifiers (createClineAPI, ClineAuthContext, addToCline, etc.)
- All file names (cline-core.ts, ClineProvider.tsx, etc.)
- All directory names (.clinerules/, proto/cline/, etc.)
- All VS Code command IDs (cline.plusButtonClicked, cline.addToChat, etc.)
- All view container/view IDs (claude-dev-ActivityBar, claude-dev.SidebarProvider)
- All context keys (cline.isDevMode, cline-ai-review)
- All icon font IDs (cline-icon, cline-bot.woff)
- All proto file paths and package declarations
- All environment variables (CLINE_ENVIRONMENT)
- All storage paths (~/.cline/)
- All build configuration (esbuild.mjs, tsconfig.json, biome.jsonc)
- All test files
- All code comments (except where they appeared in user-visible walkthrough/doc text)

## New Files (not in upstream)

| File | Description |
|------|--------------------|
| `UPSTREAM_TRACKING.md` | This tracking document |
