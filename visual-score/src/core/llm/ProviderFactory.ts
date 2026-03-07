import type { LLMProvider } from './LLMProvider.js';
import type { ConfigManager } from '../config/ConfigManager.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { getModelInfo } from './models.js';

export function createProvider(config: ConfigManager): LLMProvider {
  const provider = config.getProvider();
  const apiKey = config.getApiKey();
  const model = config.getModel();
  const modelInfo = getModelInfo(model, provider);
  const nativeToolUse = modelInfo?.supportsToolUse ?? true;

  switch (provider) {
    case 'anthropic': {
      if (!apiKey) {
        throw new Error('Anthropic API key is not configured. Go to Settings → MitraHelix → Anthropic API Key.');
      }
      return new AnthropicProvider(apiKey, model);
    }
    case 'openai': {
      if (!apiKey) {
        throw new Error('OpenAI API key is not configured. Go to Settings → MitraHelix → OpenAI API Key.');
      }
      return new OpenAIProvider(apiKey, model, undefined, nativeToolUse, 'openai');
    }
    case 'google': {
      if (!apiKey) {
        throw new Error('Google API key is not configured. Go to Settings → MitraHelix → Google API Key.');
      }
      return new OpenAIProvider(apiKey, model, 'https://generativelanguage.googleapis.com/v1beta/openai/', nativeToolUse, 'google');
    }
    case 'deepseek': {
      if (!apiKey) {
        throw new Error('DeepSeek API key is not configured. Go to Settings → MitraHelix → DeepSeek API Key.');
      }
      return new OpenAIProvider(apiKey, model, 'https://api.deepseek.com', nativeToolUse, 'deepseek');
    }
    case 'openrouter': {
      if (!apiKey) {
        throw new Error('OpenRouter API key is not configured. Go to Settings → MitraHelix → OpenRouter API Key.');
      }
      return new OpenAIProvider(apiKey, model, 'https://openrouter.ai/api/v1', nativeToolUse, 'openrouter');
    }
    case 'ollama': {
      const baseUrl = config.getOllamaBaseUrl();
      return new OpenAIProvider('ollama', model, `${baseUrl}/v1`, false, 'ollama');
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
