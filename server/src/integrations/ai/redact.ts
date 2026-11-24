/**
 * Redact credentials before any text is sent to an LLM provider or logged.
 * Applied to prompts, history, repository files, logs and tool output.
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted-private-key]'],
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, '[redacted-aws-key]'],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[redacted-google-key]'],
  [/\bnvapi-[0-9A-Za-z_-]{20,}\b/g, '[redacted-nvidia-key]'],
  [/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[redacted]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[redacted-github-token]'],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g, '[redacted-slack-token]'],
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]'],
  // key = value / key: value for secret-looking names (env files, YAML, HCL, JSON)
  [
    /((?:^|[\s"'{,])[A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|access[_-]?key|client[_-]?secret)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)(["']?)[^\s"',}]+\2/gi,
    '$1"[redacted]"',
  ],
  // URLs with embedded credentials
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, '$1[redacted]@'],
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[... truncated, ${text.length - max} chars omitted]`;
}
