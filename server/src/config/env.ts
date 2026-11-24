import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import {
  NVIDIA_DEFAULT_BASE_URL,
  NVIDIA_DEFAULT_MODEL,
} from './constants';

// Load order: real environment > server/.env.local (gitignored, machine-specific,
// e.g. EC2 tunnel settings) > server/.env. dotenv never overrides a value that is
// already set, so loading .env.local first gives it priority. Skipped under Jest
// so tests stay hermetic.
if (!process.env.JEST_WORKER_ID && process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
}
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const configSchema = z.object({
  PORT: z.string().default('4000'),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('./data/codigoflow.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Preferred NVIDIA NIM
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().optional(),
  NVIDIA_MODEL: z.string().optional(),
  NVIDIA_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  NVIDIA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),

  // Project LLM keys (OpenAI-compatible / NVIDIA NIM)
  LLM_API_KEY: z.string().optional(),
  LLM_API_KEY2: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  // Second provider (e.g. NVIDIA) — see integrations/ai/providers.ts
  LLM_BASE_URL2: z.string().optional(),
  LLM_MODEL2: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  LLM_TIMEOUT_MS2: z.coerce.number().int().positive().optional(),
  LLM_DEFAULT_PROVIDER: z.string().optional(),

  // Legacy aliases
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),

  GITHUB_TOKEN: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

const raw = parsed.data;

function uniqNonEmpty(keys: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    const v = (k || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Key priority (server-only — never VITE_*):
 * 1. NVIDIA_API_KEY
 * 2. LLM_API_KEY
 * 3. AI_API_KEY (legacy)
 * 4. LLM_API_KEY2 (failover / secondary)
 */
const aiApiKeys = uniqNonEmpty([
  raw.NVIDIA_API_KEY,
  raw.LLM_API_KEY,
  raw.AI_API_KEY,
  raw.LLM_API_KEY2,
]);

const aiApiKey = aiApiKeys[0];

const aiBaseUrl = (
  raw.NVIDIA_BASE_URL ||
  raw.LLM_BASE_URL ||
  raw.AI_BASE_URL ||
  NVIDIA_DEFAULT_BASE_URL
).replace(/\/$/, '');

const aiModel =
  raw.NVIDIA_MODEL || raw.LLM_MODEL || raw.AI_MODEL || NVIDIA_DEFAULT_MODEL;

export const config = {
  ...raw,
  /** Primary resolved key — never log */
  AI_API_KEY: aiApiKey,
  /** Ordered unique keys for primary → secondary failover */
  AI_API_KEYS: aiApiKeys,
  AI_BASE_URL: aiBaseUrl,
  AI_MODEL: aiModel,
  NVIDIA_API_KEY: raw.NVIDIA_API_KEY?.trim() || undefined,
  NVIDIA_BASE_URL: aiBaseUrl,
  NVIDIA_MODEL: aiModel,
  LLM_API_KEY: raw.LLM_API_KEY?.trim() || undefined,
  LLM_API_KEY2: raw.LLM_API_KEY2?.trim() || undefined,
};

export const isAIConfigured = (): boolean => config.AI_API_KEYS.length > 0;

export const isGitHubConfigured = (): boolean =>
  Boolean(config.GITHUB_TOKEN && config.GITHUB_TOKEN.length > 0);

export const getAIProviderLabel = (): string => {
  if (!isAIConfigured()) return 'none';
  if (config.AI_BASE_URL.includes('nvidia.com')) return 'nvidia';
  if (config.AI_BASE_URL.includes('generativelanguage.googleapis.com')) return 'gemini';
  return 'openai-compatible';
};

export const getConfiguredAiKeyCount = (): number => config.AI_API_KEYS.length;
