import OpenAI from 'openai';
import { config, isAIConfigured } from '../../../config';
import { createError } from '../../../middleware/errorHandler';

let clients: OpenAI[] = [];
let activeKeyIndex = 0;

function buildClients(): OpenAI[] {
  return config.AI_API_KEYS.map(
    (apiKey) =>
      new OpenAI({
        apiKey,
        baseURL: config.AI_BASE_URL,
        timeout: 60_000,
        maxRetries: 0, // we handle failover ourselves
      }),
  );
}

function ensureClients(): OpenAI[] {
  if (!isAIConfigured()) {
    throw createError(
      'AI is not configured. Set LLM_API_KEY (and optionally LLM_API_KEY2), or NVIDIA_API_KEY / AI_API_KEY in server/.env',
      503,
      'AI_NOT_CONFIGURED',
    );
  }
  if (clients.length === 0) {
    clients = buildClients();
    activeKeyIndex = 0;
  }
  return clients;
}

/** Primary reusable NVIDIA / OpenAI-compatible client. Never log the API key. */
export function getNvidiaClient(): OpenAI {
  const pool = ensureClients();
  return pool[Math.min(activeKeyIndex, pool.length - 1)];
}

export function resetNvidiaClient(): void {
  clients = [];
  activeKeyIndex = 0;
}

function isRetriableWithFailover(status?: number): boolean {
  return status === 401 || status === 403 || status === 429;
}

/**
 * Run an AI request with automatic failover to LLM_API_KEY2 (and other configured keys)
 * on auth failure or rate limit.
 */
export async function withAiClientFailover<T>(
  operation: (client: OpenAI) => Promise<T>,
): Promise<T> {
  const pool = ensureClients();
  let lastError: unknown;

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const index = (activeKeyIndex + attempt) % pool.length;
    const client = pool[index];
    try {
      const result = await operation(client);
      activeKeyIndex = index;
      return result;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const moreKeys = attempt < pool.length - 1;
      if (moreKeys && isRetriableWithFailover(status)) {
        continue;
      }
      mapAiError(err);
    }
  }

  mapAiError(lastError);
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
      'AI model not found. Check NVIDIA_MODEL / LLM_MODEL / AI_MODEL in server/.env',
      503,
      'AI_MODEL_NOT_FOUND',
    );
  }
  if (status === 429) {
    throw createError('AI provider rate limit exceeded', 429, 'AI_RATE_LIMIT');
  }

  throw createError(message.replace(/sk-[a-zA-Z0-9]+/g, '[redacted]'), 502, 'AI_PROVIDER_ERROR');
}
