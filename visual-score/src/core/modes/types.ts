export interface ModeDefinition {
  name: string;
  slug: string;
  icon: string;
  description: string;
  rolePrompt: string;
  allowedTools?: string[];
  restrictedTools?: string[];
  preferredModel?: string;
  isBuiltin: boolean;
}
