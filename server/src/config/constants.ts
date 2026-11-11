/** Shared backend constants for CódigoFlow */

export const APP_NAME = 'CódigoFlow';
export const APP_VERSION = '1.0.0';

export const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_DEFAULT_MODEL = 'qwen/qwen2.5-coder-32b-instruct';

export const REQUEST_JSON_LIMIT = '2mb';
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 200;

export const AI_MAX_DIFF_CHARS = 8_000;
export const AI_MAX_LOG_CHARS = 6_000;
export const AI_MAX_CODE_CHARS = 6_000;
export const AI_MAX_ERROR_CHARS = 4_000;
export const AI_MAX_HISTORY_MESSAGES = 20;

export const GIT_DEFAULT_TIMEOUT_MS = 30_000;
export const DOCKER_DEFAULT_TIMEOUT_MS = 30_000;
export const STATUS_CACHE_TTL_MS = 15_000;

export const JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
