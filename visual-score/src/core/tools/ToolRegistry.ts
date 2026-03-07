import type { Tool, LLMToolDefinition } from '../../shared/ToolTypes.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getNativeToolDefinitions(): LLMToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(tool.parameterSchema.properties).map(([key, val]) => [
            key,
            { type: val.type, description: val.description, ...(val.enum ? { enum: val.enum } : {}) },
          ])
        ),
        required: tool.parameterSchema.required,
      },
    }));
  }

  getXMLToolDefinitions(): string {
    return this.getAll()
      .map((tool) => {
        const params = Object.entries(tool.parameterSchema.properties)
          .map(([name, schema]) => {
            const req = tool.parameterSchema.required.includes(name) ? '(required)' : '(optional)';
            return `- ${name}: ${req} ${schema.description}`;
          })
          .join('\n');

        const paramExample = Object.entries(tool.parameterSchema.properties)
          .map(([name]) => `  <${name}>value</${name}>`)
          .join('\n');

        return `## ${tool.name}\nDescription: ${tool.description}\nParameters:\n${params}\nUsage:\n<${tool.name}>\n${paramExample}\n</${tool.name}>`;
      })
      .join('\n\n');
  }
}
