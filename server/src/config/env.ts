import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import {
  NVIDIA_DEFAULT_BASE_URL,
  NVIDIA_DEFAULT_MODEL,
} from './constants';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const configSchema = z.object({
  PORT: z.string().default('4000'),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('./data/codigoflow.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // NVIDIA (preferred) + legacy OpenAI-compatible fallbacks
  NVIDIA_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  NVIDIA_MODEL: z.string().optional(),
  AI_MODEL: z.string().optional(),
  NVIDIA_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  NVIDIA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),

  GITHUB_TOKEN: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

const raw = parsed.data;

/** Effective API key — prefer NVIDIA_API_KEY, fallback AI_API_KEY. Never log this. */
const aiApiKey = (raw.NVIDIA_API_KEY || raw.AI_API_KEY || '').trim() || undefined;

const aiBaseUrl = (
  raw.NVIDIA_BASE_URL ||
  raw.AI_BASE_URL ||
  NVIDIA_DEFAULT_BASE_URL
).replace(/\/$/, '');

const aiModel = raw.NVIDIA_MODEL || raw.AI_MODEL || NVIDIA_DEFAULT_MODEL;

export const config = {
  ...raw,
  /** Resolved AI credentials — prefer NVIDIA_* */
  AI_API_KEY: aiApiKey,
  AI_BASE_URL: aiBaseUrl,
  AI_MODEL: aiModel,
  NVIDIA_API_KEY: raw.NVIDIA_API_KEY?.trim() || undefined,
  NVIDIA_BASE_URL: aiBaseUrl,
  NVIDIA_MODEL: aiModel,
};

export const isAIConfigured = (): boolean => Boolean(config.AI_API_KEY && config.AI_API_KEY.length > 0);

export const isGitHubConfigured = (): boolean =>
  Boolean(config.GITHUB_TOKEN && config.GITHUB_TOKEN.length > 0);

export const getAIProviderLabel = (): string => {
  if (!isAIConfigured()) return 'none';
  if (config.AI_BASE_URL.includes('nvidia.com')) return 'nvidia';
  return 'openai-compatible';
};
