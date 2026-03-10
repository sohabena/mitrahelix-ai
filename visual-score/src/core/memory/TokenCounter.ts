import type { LLMMessage } from '../llm/types.js';

type TiktokenEncoder = { encode: (text: string) => number[] };

let encoder: TiktokenEncoder | null = null;
let initAttempted = false;
let initPromise: Promise<void> | null = null;

async function initEncoder(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const mod = await import('js-tiktoken');
    encoder = mod.encodingForModel('gpt-4o') as TiktokenEncoder;
  } catch {
    encoder = null;
  }
}

function ensureInit(): void {
  if (!initPromise) {
    initPromise = initEncoder();
  }
}

ensureInit();

export async function ensureReady(): Promise<void> {
  if (initPromise) await initPromise;
}

function fallbackCount(text: string): number {
  return Math.ceil(text.length / 3);
}

export function countTokens(text: string): number {
  if (!text) return 0;
  if (encoder) return encoder.encode(text).length;
  return fallbackCount(text);
}

export function countMessageTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content) + 4;
    if (msg.toolCallId) {
      total += countTokens(msg.toolCallId) + 2;
    }
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += countTokens(JSON.stringify(tc.arguments)) + 15;
      }
    }
    if (msg.imageContent) {
      for (const part of msg.imageContent) {
        if (part.type === 'image' || part.type === 'image_url') {
          total += 1000;
        } else if (part.type === 'text') {
          total += countTokens(part.text);
        }
      }
    }
  }
  return total;
}
