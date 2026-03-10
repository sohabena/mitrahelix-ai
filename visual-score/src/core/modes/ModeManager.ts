import * as path from 'path';
import * as fs from 'fs/promises';
import type { ModeDefinition } from './types.js';

export class ModeManager {
  private builtinModes: ModeDefinition[];
  private customModes: ModeDefinition[] = [];
  private loaded = false;

  constructor(private workspaceRoot: string) {
    this.builtinModes = [
      {
        name: 'Code',
        slug: 'act',
        icon: 'code',
        description: 'Full coding assistant with all tools',
        rolePrompt: '',
        isBuiltin: true,
      },
      {
        name: 'Plan',
        slug: 'plan',
        icon: 'map',
        description: 'Explore codebase and create structured plans — read-only tools only',
        rolePrompt: '',
        allowedTools: ['read_file', 'search_files', 'list_files', 'list_code_definition_names', 'ask_followup_question'],
        isBuiltin: true,
      },
      {
        name: 'Architect',
        slug: 'architect',
        icon: 'compass',
        description: 'High-level design and architecture — explore codebase, then generate a plan',
        rolePrompt: 'You are an expert software architect. Explore the codebase using read-only tools, then create a detailed, step-by-step implementation plan. Break complex work into clear, numbered steps. Specify which files to create or modify and what changes to make. Be precise and thorough.',
        allowedTools: ['read_file', 'search_files', 'list_files', 'list_code_definition_names', 'ask_followup_question'],
        isBuiltin: true,
      },
      {
        name: 'Ask',
        slug: 'ask',
        icon: 'help-circle',
        description: 'Read-only Q&A about the codebase',
        rolePrompt: 'You are a knowledgeable code assistant. Answer questions about the codebase using read-only tools. Do NOT modify any files.',
        allowedTools: ['read_file', 'search_files', 'list_files', 'list_code_definition_names', 'ask_followup_question', 'attempt_completion'],
        isBuiltin: true,
      },
      {
        name: 'Debug',
        slug: 'debug',
        icon: 'bug',
        description: 'Troubleshoot and fix bugs systematically',
        rolePrompt: 'You are an expert debugger. Systematically investigate bugs by reading code, checking diagnostics, running tests, and tracing logic flows. When you identify the issue, fix it.',
        isBuiltin: true,
      },
      {
        name: 'Review',
        slug: 'review',
        icon: 'eye',
        description: 'Code review — analyze quality, security, and best practices',
        rolePrompt: 'You are a senior code reviewer. Analyze the code for bugs, security vulnerabilities, performance issues, and best practices. Provide actionable feedback with severity ratings.',
        allowedTools: ['read_file', 'search_files', 'list_files', 'list_code_definition_names', 'ask_followup_question', 'attempt_completion'],
        isBuiltin: true,
      },
    ];
  }

  async loadCustomModes(): Promise<void> {
    if (this.loaded) return;

    const modesDir = path.join(this.workspaceRoot, '.mitrahelix', 'modes');
    try {
      const entries = await fs.readdir(modesDir);
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(path.join(modesDir, entry), 'utf-8');
          const mode = JSON.parse(data) as Partial<ModeDefinition>;
          if (mode.name && mode.slug) {
            this.customModes.push({
              name: mode.name,
              slug: mode.slug,
              icon: mode.icon || 'settings',
              description: mode.description || '',
              rolePrompt: mode.rolePrompt || '',
              allowedTools: mode.allowedTools,
              restrictedTools: mode.restrictedTools,
              preferredModel: mode.preferredModel,
              isBuiltin: false,
            });
          }
        } catch { /* skip invalid files */ }
      }
    } catch { /* no modes directory */ }
    this.loaded = true;
  }

  getAllModes(): ModeDefinition[] {
    return [...this.builtinModes, ...this.customModes];
  }

  getMode(slug: string): ModeDefinition | undefined {
    return this.builtinModes.find(m => m.slug === slug) || this.customModes.find(m => m.slug === slug);
  }

  isToolAllowed(modeSlug: string, toolName: string): boolean {
    const mode = this.getMode(modeSlug);
    if (!mode) return false;

    if (mode.allowedTools && mode.allowedTools.length > 0) {
      return mode.allowedTools.includes(toolName);
    }

    if (mode.restrictedTools) {
      if (mode.restrictedTools.includes('*') || mode.restrictedTools.includes(toolName)) {
        return false;
      }
    }

    return true;
  }

  invalidateCache(): void {
    this.loaded = false;
    this.customModes = [];
  }
}
