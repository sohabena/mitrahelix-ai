# MitraHelix Upstream Tracking

This document tracks all differences between MitraHelix and the upstream Cline codebase to facilitate easy upstream merges.

## Base

- **Upstream:** https://github.com/cline/cline
- **Base commit:** `6129caa` (Cline v3.71.0)
- **Import date:** 2026-03-10
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

All changes below are **Tier 1 rebrand only** -- user-facing display strings "Cline" replaced with "MitraHelix". No internal identifiers, file names, command IDs, or code logic was changed.

### Extension Manifest

| File | Change Description |
|------|--------------------|
| `package.json` | name, displayName, publisher, author, description, repository, keywords, command categories/titles, walkthrough text, activity bar title, configuration title |

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
