import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ContextPayload } from '../context/ContextManager.js';
import { getSystemInfo } from './SystemInfo.js';

export class SystemPromptBuilder {
  constructor(private toolRegistry: ToolRegistry) {}

  build(context: ContextPayload, mode: 'act' | 'plan' = 'act', nativeToolUse: boolean = false): string {
    const sections: string[] = [];

    // Identity
    sections.push(`You are MitraHelix, an expert AI coding assistant operating inside Visual Studio Code.
You help users with coding tasks by reading files, writing code, running commands, and managing their projects.
You are thorough, precise, and always verify your work.`);

    // Mode
    if (mode === 'plan') {
      sections.push(`# MODE
You are in PLAN MODE. Discuss and plan with the user. Do NOT use any tools. Only provide analysis, suggestions, and step-by-step plans.`);
    } else {
      sections.push(`# MODE
You are in ACT MODE. You have full access to tools. Execute tasks step by step, using tools as needed.`);
    }

    // Tool definitions
    if (mode === 'act') {
      if (nativeToolUse) {
        // When using native tool use, tools are sent via the API tools parameter.
        // Only include guidelines, not XML format instructions.
        sections.push(`# TOOL USE GUIDELINES
1. Assess the task and determine which tools to use.
2. Use one tool at a time per response, then wait for the result.
3. Think step-by-step about what information you need before acting.
4. Prefer read_file over asking the user for file contents.
5. Prefer replace_in_file for small edits to existing files, write_to_file for new files.
6. Always verify your changes succeeded before moving on.
7. Use attempt_completion when the task is fully done.
8. If you need clarification, use ask_followup_question.
9. When running commands, explain what each command does.
10. After making file changes, verify by reading the file.`);
      } else {
        // Fallback: include full XML tool definitions for models without native tool use
        const toolDefs = this.toolRegistry.getXMLToolDefinitions();
        sections.push(`# TOOLS
You have access to the following tools:

${toolDefs}

# TOOL USE FORMAT
To use a tool, respond with XML-style tags:
<tool_name>
  <parameter_name>value</parameter_name>
</tool_name>

# TOOL USE GUIDELINES
1. Assess the task and determine which tools to use.
2. Use one tool at a time per response, then wait for the result.
3. Think step-by-step about what information you need before acting.
4. Prefer read_file over asking the user for file contents.
5. Prefer replace_in_file for small edits to existing files, write_to_file for new files.
6. Always verify your changes succeeded before moving on.
7. Use attempt_completion when the task is fully done.
8. If you need clarification, use ask_followup_question.
9. When running commands, explain what each command does.
10. After making file changes, verify by reading the file.`);
      }
    }

    // System information
    sections.push(`# SYSTEM INFORMATION
${getSystemInfo(context.workspaceRoot)}`);

    // User rules
    if (context.userRules) {
      sections.push(`# USER RULES
The following rules are defined by the user in .mitrahelixrules and must be followed:
${context.userRules}`);
    }

    // Workspace context
    if (context.fileTree) {
      sections.push(`# WORKSPACE STRUCTURE
${context.fileTree}`);
    }

    if (context.activeFile) {
      sections.push(`# ACTIVE FILE
${context.activeFile}`);
    }

    if (context.diagnostics) {
      sections.push(`# CURRENT DIAGNOSTICS (errors/warnings)
${context.diagnostics}`);
    }

    return sections.join('\n\n====\n\n');
  }
}
