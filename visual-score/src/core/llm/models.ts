export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutput: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsToolUse: boolean;
  supportsVision: boolean;
  isDefault?: boolean;
}

export type ProviderType = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'deepseek' | 'ollama';

export const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google Gemini',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  ollama: 'Ollama (Local)',
};

const MODEL_CATALOG: ModelInfo[] = [
  // ── Anthropic (March 2026) ──
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 65536,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    supportsToolUse: true,
    supportsVision: true,
    isDefault: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 131072,
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 65536,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    inputCostPer1M: 1.0,
    outputCostPer1M: 5.0,
    supportsToolUse: true,
    supportsVision: true,
  },

  // ── OpenAI (March 2026) ──
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2 (Reasoning)',
    provider: 'openai',
    contextWindow: 400000,
    maxOutput: 128000,
    inputCostPer1M: 1.75,
    outputCostPer1M: 14.0,
    supportsToolUse: true,
    supportsVision: true,
    isDefault: true,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    contextWindow: 400000,
    maxOutput: 128000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    contextWindow: 400000,
    maxOutput: 16384,
    inputCostPer1M: 0.30,
    outputCostPer1M: 1.25,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 16384,
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.40,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini (Reasoning)',
    provider: 'openai',
    contextWindow: 200000,
    maxOutput: 100000,
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'o3-pro',
    name: 'o3 Pro (Reasoning)',
    provider: 'openai',
    contextWindow: 200000,
    maxOutput: 100000,
    inputCostPer1M: 20.0,
    outputCostPer1M: 80.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 16384,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    supportsToolUse: true,
    supportsVision: true,
  },

  // ── Google Gemini (March 2026) ──
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsToolUse: true,
    supportsVision: true,
    isDefault: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    provider: 'google',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'google',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputCostPer1M: 2.0,
    outputCostPer1M: 12.0,
    supportsToolUse: true,
    supportsVision: true,
  },

  // ── DeepSeek (March 2026 — V3.2 unified model) ──
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    contextWindow: 128000,
    maxOutput: 8192,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    supportsToolUse: true,
    supportsVision: false,
    isDefault: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Reasoning)',
    provider: 'deepseek',
    contextWindow: 128000,
    maxOutput: 65536,
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    supportsToolUse: false,
    supportsVision: false,
  },

  // ── OpenRouter (popular models via OpenRouter) ──
  {
    id: 'anthropic/claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 200000,
    maxOutput: 65536,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    supportsToolUse: true,
    supportsVision: true,
    isDefault: true,
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2 (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 400000,
    maxOutput: 128000,
    inputCostPer1M: 1.75,
    outputCostPer1M: 14.0,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsToolUse: true,
    supportsVision: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3.2 (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 128000,
    maxOutput: 8192,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    supportsToolUse: true,
    supportsVision: false,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 131072,
    maxOutput: 4096,
    inputCostPer1M: 2.0,
    outputCostPer1M: 2.0,
    supportsToolUse: true,
    supportsVision: false,
  },

  // ── Ollama (local, free) ──
  {
    id: 'llama3.1',
    name: 'Llama 3.1 8B',
    provider: 'ollama',
    contextWindow: 131072,
    maxOutput: 4096,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsToolUse: false,
    supportsVision: false,
    isDefault: true,
  },
  {
    id: 'llama3.1:70b',
    name: 'Llama 3.1 70B',
    provider: 'ollama',
    contextWindow: 131072,
    maxOutput: 4096,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsToolUse: false,
    supportsVision: false,
  },
  {
    id: 'qwen2.5:0.5b',
    name: 'Qwen 2.5 0.5B',
    provider: 'ollama',
    contextWindow: 32768,
    maxOutput: 2048,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsToolUse: false,
    supportsVision: false,
  },
  {
    id: 'qwen2.5-coder',
    name: 'Qwen 2.5 Coder',
    provider: 'ollama',
    contextWindow: 131072,
    maxOutput: 4096,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsToolUse: false,
    supportsVision: false,
  },
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'ollama',
    contextWindow: 128000,
    maxOutput: 4096,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsToolUse: false,
    supportsVision: false,
  },
];

export function getModelsForProvider(provider: string): ModelInfo[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

export function getModelInfo(modelId: string, provider?: string): ModelInfo | undefined {
  if (provider) {
    return MODEL_CATALOG.find((m) => m.id === modelId && m.provider === provider);
  }
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function getDefaultModelForProvider(provider: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.provider === provider && m.isDefault)
    || MODEL_CATALOG.find((m) => m.provider === provider);
}

export function getAllProviders(): ProviderType[] {
  return ['anthropic', 'openai', 'google', 'deepseek', 'openrouter', 'ollama'];
}

export function getModelCatalog(): ModelInfo[] {
  return [...MODEL_CATALOG];
}
