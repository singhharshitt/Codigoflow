import OpenAI from 'openai';
import { config, isAIConfigured } from '../../../config';
import { createError } from '../../../middleware/errorHandler';

let client: OpenAI | null = null;

/** Single reusable NVIDIA / OpenAI-compatible client. Never log the API key. */
export function getNvidiaClient(): OpenAI {
  if (!isAIConfigured()) {
    throw createError(
      'NVIDIA AI is not configured. Set NVIDIA_API_KEY (or AI_API_KEY) in server/.env',
      503,
      'AI_NOT_CONFIGURED',
    );
  }

  if (!client) {
    client = new OpenAI({
      apiKey: config.AI_API_KEY,
      baseURL: config.AI_BASE_URL,
      timeout: 60_000,
      maxRetries: 1,
    });
  }

  return client;
}

export function resetNvidiaClient(): void {
  client = null;
}

export function mapAiError(err: unknown): never {
  const anyErr = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: { message?: string; type?: string };
  };

  const status = anyErr.status ?? 502;
  const message = anyErr.error?.message || anyErr.message || 'AI provider request failed';

  if (status === 401 || status === 403) {
    throw createError('AI provider rejected credentials', 503, 'AI_AUTH_FAILED');
  }
  if (status === 404) {
    throw createError(
      'AI model not found. Check NVIDIA_MODEL in server/.env',
      503,
      'AI_MODEL_NOT_FOUND',
    );
  }
  if (status === 429) {
    throw createError('AI provider rate limit exceeded', 429, 'AI_RATE_LIMIT');
  }

  throw createError(message.replace(/sk-[a-zA-Z0-9]+/g, '[redacted]'), 502, 'AI_PROVIDER_ERROR');
}
