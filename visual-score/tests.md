Full Test Plan Execution (93 Tests)

Approach

The 93 tests fall into three tiers:





Tier 1 - Fully Automated (~15 tests): Build, compilation, dependency checks, file existence. I run these via shell commands and report PASS/FAIL.



Tier 2 - Code Inspection (~15 tests): Static verification of CSP, ErrorBoundary, React.memo, path security logic, retainContextWhenHidden, command registration, keybindings. I read code and verify correctness.



Tier 3 - Manual with Guidance (~63 tests): Require the Extension Development Host. I will set up test fixtures first, then guide you through batched test groups, asking for your observations after each batch.

Phase 1: Automated Build & Environment Tests (Tests 1.1, 1.2, 2.1-2.4)

I will run in sequence:





node --version, npm --version, git --version -- verify prerequisites



npm install in both visual-score/ and visual-score/webview-ui/



npx tsc --noEmit -- Test 2.1



node esbuild.mjs -- Test 2.2 (verify out/extension.js > 100KB)



cd webview-ui && npx vite build -- Test 2.3 (verify dist files)



npm run build -- Test 2.4

Phase 2: Code Inspection Tests (~15 tests verified statically)

I will read and verify:





Test 3.3: Commands registered in package.json (newChat, focusChat, openPanel, askAboutSelection, addFileToContext)



Test 3.4: Keybindings in package.json (ctrl+shift+i, ctrl+shift+l)



Test 13.5 (CSP): Verify script-src 'nonce-...' blocks inline scripts in WebviewProvider.ts



Test 14.5: Verify retainContextWhenHidden: true in package.json



Test 20.1: Verify ErrorBoundary exists in App.tsx with retry logic



Test 22.2: Verify React.memo wraps TaskHeader, InputBox, MessageBubble



Test 13.4: Verify path security treats tool params as literal filenames (no shell injection in tool execution)



Test 15.5: Verify workflow file size limit in WorkflowManager



Test 16.6: Verify rules budget (30KB) in ContextManager



Test 17.6: Verify mention budget (150K) in MentionsParser/AgentController

Phase 3: Test Fixture Setup

Before manual testing, I will create/verify:





Test workspace at C:\temp\mitra-helix-test with required files



Workflow files in .mitrahelix/workflows/



Rules files (.mitrahelixrules, .mitrahelix/rules/ts-rules.md, .mitrahelix/rules/global.md, AGENTS.md, .cursorrules)



Security test fixtures (sibling directory with secret file)



A large file (>100KB) for Test 12.7



A broken TypeScript file for Test 8.3

Phase 4: Manual Testing (Batched by Category)

I will guide you through these batches, asking for your observations after each:

Batch A - Extension Activation (Tests 3.1-3.2, 14.1-14.2)





Launch F5, verify sidebar icon, output panel messages, webview rendering

Batch B - Basic Chat & UI (Tests 4.1-4.6, 12.1, 22.1)





Send messages, verify streaming, markdown rendering, code blocks, new chat, empty message

Batch C - LLM Providers (Tests 5.1, 5.2, 5.4, 5.5, 5.6)





Anthropic, OpenAI, Ollama (qwen3.5:0.8b), invalid key, provider switch



(Skip 5.3 OpenRouter -- no key)

Batch D - Tool Execution (Tests 6.1-6.10)





read_file, write_to_file, replace_in_file, execute_command, search_files, list_files, list_code_definition_names, ask_followup_question, attempt_completion, multi-tool

Batch E - Approval System (Tests 7.1-7.7)





Auto-approve reads ON/OFF, writes ON/OFF, specific commands, reject, cancel during approval

Batch F - Context & Mentions (Tests 8.1-8.7, 17.1-17.7)





Active file, workspace tree, diagnostics, @file, @folder, @problems, @git, @selection, @terminal, @file with spaces, @url, mention budget, cross-dedup

Batch G - Memory & Cost (Tests 9.1-9.4, 10.1-10.5)





Multi-turn context, tool result memory, long conversation, compression, cost display, accumulation, reset, budget enforcement

Batch H - Mode Switching (Tests 11.1-11.3)





Act mode, Plan mode, mid-conversation switch

Batch I - Error Handling (Tests 12.2-12.9)





No workspace, non-existent file, cancel streaming, cancel tool, rapid messages, large file, command timeout, max iterations

Batch J - Security (Tests 13.1-13.3)





Path traversal (sibling, absolute, write outside)

Batch K - Workflows & Rules (Tests 15.1-15.4, 16.1-16.5)





Workflow discovery, slash command execution, keyboard nav, file watcher, rules files, globs, always-apply, AGENTS.md, .cursorrules

Batch L - Model Selector & Panel (Tests 18.1-18.3, 19.1-19.3)





Model picker UI, switch model, disabled during task, right panel open/sync/close

Batch M - Context Menus (Tests 21.1-21.2)





Editor context menu, explorer context menu

Output

After all phases, I will compile a complete test results table with PASS/FAIL/SKIP for all 93 tests and update TEST_PLAN.md with the results.