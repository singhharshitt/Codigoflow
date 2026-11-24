import OpenAI from 'openai';
import { NVIDIA_DEFAULT_BASE_URL, NVIDIA_DEFAULT_MODEL } from '../../config/constants';
import { createError, type ApiError } from '../../middleware/errorHandler';
import { getSetting } from '../../services/appSettings';
import { logger } from '../../utils/logger';

/**
 * Multi-provider LLM registry.
 *
 * Both Google Gemini and NVIDIA NIM expose OpenAI-compatible chat APIs, so one
 * adapter (the `openai` SDK pointed at each base URL) covers them; per-provider
 * differences (labels, timeouts, reasoning fields, error shapes) are handled here.
 *
 * Env slots (server-only, never VITE_*):
 *   Slot 1: LLM_API_KEY  / LLM_BASE_URL  / LLM_MODEL  / LLM_TIMEOUT_MS   (legacy: AI_API_KEY / AI_BASE_URL / AI_MODEL)
 *   Slot 2: LLM_API_KEY2 / LLM_BASE_URL2 / LLM_MODEL2 / LLM_TIMEOUT_MS2  (falls back to LLM_TIMEOUT_MS)
 *   Slot 3: NVIDIA_API_KEY / NVIDIA_BASE_URL / NVIDIA_MODEL               (legacy)
 * LLM_API_KEY2 without LLM_BASE_URL2 keeps the old meaning: a second key for slot 1.
 * Default provider: AI settings (DB) > LLM_DEFAULT_PROVIDER > first configured.
 */

export type ProviderKind = 'gemini' | 'nvidia' | 'openai' | 'openai-compatible';

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  /** env var names this provider came from (for docs/UI; never values) */
  source: string[];
  apiKeys: string[];
}

export type PublicProvider = Omit<ProviderConfig, 'apiKeys'> & {
  configured: boolean;
  keyCount: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

function env(name: string): string | undefined {
  const v = process.env[name]?.trim().replace(/^["']|["']$/g, '');
  return v ? v : undefined;
}

function detectKind(baseUrl: string): ProviderKind {
  const host = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return '';
    }
  })();
  if (host.endsWith('generativelanguage.googleapis.com')) return 'gemini';
  if (host.endsWith('nvidia.com')) return 'nvidia';
  if (host === 'api.openai.com') return 'openai';
  return 'openai-compatible';
}

const LABELS: Record<ProviderKind, string> = {
  gemini: 'Google Gemini',
  nvidia: 'NVIDIA',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI-compatible',
};

function timeout(...names: string[]): number {
  for (const n of names) {
    const v = Number(env(n));
    if (Number.isFinite(v) && v >= 1_000 && v <= 600_000) return v;
  }
  return DEFAULT_TIMEOUT_MS;
}

/** Build the provider list from env on every call (cheap), so tests and restarts are predictable. */
export function listProviders(): ProviderConfig[] {
  const slots: Array<Omit<ProviderConfig, 'id' | 'label' | 'kind'>> = [];

  const key1 = env('LLM_API_KEY') ?? env('AI_API_KEY');
  const base1 = (env('LLM_BASE_URL') ?? env('AI_BASE_URL') ?? NVIDIA_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model1 = env('LLM_MODEL') ?? env('AI_MODEL') ?? NVIDIA_DEFAULT_MODEL;
  const key2 = env('LLM_API_KEY2');
  const base2 = env('LLM_BASE_URL2')?.replace(/\/+$/, '');

  if (key1 || (key2 && !base2)) {
    const keys = [key1, key2 && !base2 ? key2 : undefined].filter((k): k is string => Boolean(k));
    slots.push({
      baseUrl: base1,
      model: model1,
      timeoutMs: timeout('LLM_TIMEOUT_MS'),
      source: ['LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL'],
      apiKeys: [...new Set(keys)],
    });
  }

  if (key2 && base2) {
    slots.push({
      baseUrl: base2,
      model: env('LLM_MODEL2') ?? model1,
      timeoutMs: timeout('LLM_TIMEOUT_MS2', 'LLM_TIMEOUT_MS'),
      source: ['LLM_API_KEY2', 'LLM_BASE_URL2', 'LLM_MODEL2'],
      apiKeys: [key2],
    });
  }

  const nvKey = env('NVIDIA_API_KEY');
  if (nvKey) {
    slots.push({
      baseUrl: (env('NVIDIA_BASE_URL') ?? NVIDIA_DEFAULT_BASE_URL).replace(/\/+$/, ''),
      model: env('NVIDIA_MODEL') ?? NVIDIA_DEFAULT_MODEL,
      timeoutMs: timeout('NVIDIA_TIMEOUT_MS', 'LLM_TIMEOUT_MS'),
      source: ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'NVIDIA_MODEL'],
      apiKeys: [nvKey],
    });
  }

  const used = new Map<string, number>();
  return slots.map((slot) => {
    const kind = detectKind(slot.baseUrl);
    const n = (used.get(kind) ?? 0) + 1;
    used.set(kind, n);
    return {
      ...slot,
      kind,
      id: n === 1 ? kind : `${kind}-${n}`,
      label: n === 1 ? LABELS[kind] : `${LABELS[kind]} (${n})`,
    };
  });
}

export function toPublic(p: ProviderConfig): PublicProvider {
  // Explicit allow-list: never spread apiKeys into anything sent to a client.
  return {
    id: p.id,
    kind: p.kind,
    label: p.label,
    baseUrl: p.baseUrl,
    model: p.model,
    timeoutMs: p.timeoutMs,
    source: p.source,
    configured: p.apiKeys.length > 0,
    keyCount: p.apiKeys.length,
  };
}

export function isAnyProviderConfigured(): boolean {
  return listProviders().length > 0;
}

export function getDefaultProviderId(): string | null {
  const providers = listProviders();
  if (providers.length === 0) return null;
  const preferred = getSetting<string | null>('ai.defaultProvider', null) ?? env('LLM_DEFAULT_PROVIDER') ?? null;
  return providers.find((p) => p.id === preferred)?.id ?? providers[0].id;
}

export function resolveProvider(providerId?: string | null): ProviderConfig {
  const providers = listProviders();
  if (providers.length === 0) {
    throw createError(
      'AI is not configured. Set LLM_API_KEY / LLM_BASE_URL / LLM_MODEL (and optionally the *2 variants) in server/.env',
      503,
      'AI_NOT_CONFIGURED',
    );
  }
  const id = providerId || getDefaultProviderId();
  const found = providers.find((p) => p.id === id);
  if (!found) {
    throw createError(`Unknown AI provider '${String(providerId)}'`, 400, 'AI_PROVIDER_UNKNOWN');
  }
  return found;
}

// ── Clients ───────────────────────────────────────────────────────────────────

const clientCache = new Map<string, OpenAI>();

function clientFor(p: ProviderConfig, keyIndex: number, timeoutMs: number): OpenAI {
  const cacheKey = `${p.id}|${p.baseUrl}|${keyIndex}|${timeoutMs}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      apiKey: p.apiKeys[keyIndex],
      baseURL: p.baseUrl,
      timeout: timeoutMs,
      maxRetries: 0, // bounded retries are handled below
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

export function resetProviderClients(): void {
  clientCache.clear();
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_UNKNOWN'
  | 'AI_AUTH_FAILED'
  | 'AI_MODEL_NOT_FOUND'
  | 'AI_RATE_LIMIT'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_BAD_REQUEST'
  | 'AI_CANCELLED'
  | 'AI_PROVIDER_ERROR';

function scrub(text: string): string {
  return text
    .replace(/(sk|nvapi|AIza)[-_A-Za-z0-9]{8,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300);
}

/** Normalize SDK/provider errors into a typed, credential-free ApiError. */
export function normalizeAiError(err: unknown, p?: Pick<ProviderConfig, 'label' | 'model'>): ApiError {
  if ((err as ApiError)?.code?.startsWith?.('AI_')) return err as ApiError;
  const e = err as { status?: number; name?: string; message?: string; error?: { message?: string } };
  const who = p ? `${p.label} (${p.model})` : 'AI provider';
  const raw = scrub(String(e?.error?.message ?? e?.message ?? ''));
  const name = e?.name ?? '';

  if (name === 'APIUserAbortError' || name === 'AbortError') {
    return createError('Request cancelled', 499, 'AI_CANCELLED');
  }
  if (name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(raw)) {
    return createError(`${who} did not respond in time`, 504, 'AI_TIMEOUT');
  }
  if (name === 'APIConnectionError') {
    return createError(`Could not reach ${who}. Check network access.`, 503, 'AI_PROVIDER_UNAVAILABLE');
  }
  switch (e?.status) {
    case 400:
      return createError(`${who} rejected the request: ${raw || 'bad request'}`, 400, 'AI_BAD_REQUEST');
    case 401:
    case 403:
      return createError(`${who} rejected the API key`, 502, 'AI_AUTH_FAILED');
    case 402:
      return createError(`${who}: insufficient credits`, 402, 'AI_QUOTA_EXCEEDED');
    case 404:
      return createError(`Model '${p?.model ?? 'unknown'}' is not available on ${p?.label ?? 'this provider'}`, 502, 'AI_MODEL_NOT_FOUND');
    case 429:
      return /quota|credit|billing|exhausted/i.test(raw)
        ? createError(`${who}: quota exhausted`, 429, 'AI_QUOTA_EXCEEDED')
        : createError(`${who} rate limit reached. Try again shortly.`, 429, 'AI_RATE_LIMIT');
    default:
      if (e?.status && e.status >= 500) {
        return createError(`${who} is having problems (HTTP ${e.status})`, 503, 'AI_PROVIDER_UNAVAILABLE');
      }
      return createError(`${who} request failed${raw ? `: ${raw}` : ''}`, 502, 'AI_PROVIDER_ERROR');
  }
}

function isRetryable(err: ApiError): boolean {
  return err.code === 'AI_RATE_LIMIT' || err.code === 'AI_PROVIDER_UNAVAILABLE' || err.code === 'AI_TIMEOUT';
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });

// ── Requests ──────────────────────────────────────────────────────────────────

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatOptions {
  providerId?: string | null;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** extra attempts on rate limit / outage / timeout (default 2, max 3) */
  retries?: number;
  requestId?: string;
}

export interface ChatResult {
  text: string;
  provider: string;
  providerLabel: string;
  model: string;
  latencyMs: number;
}

function effectiveTimeout(p: ProviderConfig, opts: ChatOptions): number {
  const fromSettings = getSetting<number | null>('ai.timeoutMs', null);
  return opts.timeoutMs ?? fromSettings ?? p.timeoutMs;
}

/**
 * One chat completion with bounded exponential backoff (chat requests are
 * read-only, so retrying is safe). Key failover within a provider on 401/429.
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const p = resolveProvider(opts.providerId);
  const tmo = effectiveTimeout(p, opts);
  const maxAttempts = 1 + Math.min(Math.max(opts.retries ?? 2, 0), 3);
  const started = Date.now();
  let lastErr: ApiError | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let k = 0; k < p.apiKeys.length; k++) {
      try {
        const completion = await clientFor(p, k, tmo).chat.completions.create(
          {
            model: p.model,
            messages,
            max_tokens: opts.maxTokens ?? 2048,
            temperature: opts.temperature ?? 0.3,
          },
          { signal: opts.signal },
        );
        const text = completion.choices?.[0]?.message?.content ?? '';
        if (!text.trim()) {
          throw createError(`${p.label} returned an empty response`, 502, 'AI_EMPTY_RESPONSE');
        }
        return { text, provider: p.id, providerLabel: p.label, model: p.model, latencyMs: Date.now() - started };
      } catch (err) {
        lastErr = normalizeAiError(err, p);
        const tryNextKey = k < p.apiKeys.length - 1 && (lastErr.code === 'AI_AUTH_FAILED' || lastErr.code === 'AI_RATE_LIMIT');
        if (!tryNextKey) break;
      }
    }
    if (!lastErr || !isRetryable(lastErr) || attempt === maxAttempts - 1 || opts.signal?.aborted) break;
    const backoff = Math.min(4_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 200);
    logger.warn({ requestId: opts.requestId, provider: p.id, code: lastErr.code, attempt, backoff }, 'AI request retry');
    await sleep(backoff, opts.signal).catch(() => undefined);
  }
  throw lastErr ?? createError('AI request failed', 502, 'AI_PROVIDER_ERROR');
}

export type StreamEvent =
  | { type: 'meta'; provider: string; providerLabel: string; model: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; latencyMs: number; chars: number };

/**
 * Streaming chat. Retries only before the first token arrives (never after
 * partial output has reached the user).
 */
export async function* chatStream(messages: ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamEvent> {
  const p = resolveProvider(opts.providerId);
  const tmo = effectiveTimeout(p, opts);
  const maxAttempts = 1 + Math.min(Math.max(opts.retries ?? 2, 0), 3);
  const started = Date.now();
  yield { type: 'meta', provider: p.id, providerLabel: p.label, model: p.model };

  let lastErr: ApiError | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let emitted = 0;
    try {
      const stream = await clientFor(p, 0, tmo).chat.completions.create(
        {
          model: p.model,
          messages,
          max_tokens: opts.maxTokens ?? 2048,
          temperature: opts.temperature ?? 0.3,
          stream: true,
        },
        { signal: opts.signal },
      );
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          emitted += text.length;
          yield { type: 'delta', text };
        }
      }
      if (emitted === 0) {
        throw createError(`${p.label} returned an empty response`, 502, 'AI_EMPTY_RESPONSE');
      }
      yield { type: 'done', latencyMs: Date.now() - started, chars: emitted };
      return;
    } catch (err) {
      lastErr = normalizeAiError(err, p);
      if (emitted > 0 || !isRetryable(lastErr) || attempt === maxAttempts - 1 || opts.signal?.aborted) break;
      const backoff = Math.min(4_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 200);
      logger.warn({ requestId: opts.requestId, provider: p.id, code: lastErr.code, attempt, backoff }, 'AI stream retry');
      await sleep(backoff, opts.signal).catch(() => undefined);
    }
  }
  throw lastErr ?? createError('AI request failed', 502, 'AI_PROVIDER_ERROR');
}

export interface ProviderTestResult {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number | null;
  code?: string;
  message: string;
  testedAt: string;
}

/** Minimal authenticated request (a few tokens) to prove key + model work. */
export async function testProvider(providerId: string): Promise<ProviderTestResult> {
  const p = resolveProvider(providerId);
  const testedAt = new Date().toISOString();
  try {
    const r = await chat([{ role: 'user', content: 'Reply with the single word: OK' }], {
      providerId,
      maxTokens: 256, // reasoning models spend tokens before visible output
      temperature: 0,
      retries: 0,
    });
    return {
      provider: p.id,
      model: p.model,
      ok: true,
      latencyMs: r.latencyMs,
      message: `Responded: ${scrub(r.text.trim()).slice(0, 40)}`,
      testedAt,
    };
  } catch (err) {
    const e = normalizeAiError(err, p);
    return { provider: p.id, model: p.model, ok: false, latencyMs: null, code: e.code, message: e.message, testedAt };
  }
}
