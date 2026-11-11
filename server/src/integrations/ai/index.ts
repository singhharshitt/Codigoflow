import { config, isAIConfigured } from '../../config';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!isAIConfigured()) {
    throw createError(
      'AI API key is not configured. Set AI_API_KEY in server/.env',
      503,
      'AI_NOT_CONFIGURED',
    );
  }

  if (!client) {
    client = new OpenAI({
      apiKey: config.AI_API_KEY,
      baseURL: config.AI_BASE_URL,
    });
  }

  return client;
}

const MAX_DIFF_CHARS = 8000;
const MAX_LOG_CHARS = 6000;
const MAX_CODE_CHARS = 6000;
const MAX_ERROR_CHARS = 4000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[... truncated, ${text.length - max} chars omitted]`;
}

export async function generateCommitMessages(diff: string): Promise<string[]> {
  const ai = getClient();
  const safeDiff = truncate(diff, MAX_DIFF_CHARS);

  const completion = await ai.chat.completions.create({
    model: config.AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that generates professional Git commit messages. ' +
          'Generate exactly 3 concise, meaningful commit messages in the conventional commit format. ' +
          'Return only a JSON array of 3 strings, nothing else.',
      },
      {
        role: 'user',
        content: `Generate 3 commit messages for this diff:\n\n${safeDiff}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content ?? '[]';

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
  } catch {
    // If the model didn't return JSON, split by newlines
    return text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 3);
  }

  return [];
}

export async function explainError(errorText: string): Promise<{
  explanation: string;
  suggestions: string[];
}> {
  const ai = getClient();
  const safeError = truncate(errorText, MAX_ERROR_CHARS);

  const completion = await ai.chat.completions.create({
    model: config.AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior developer assistant. Explain the error concisely and provide ' +
          '2-4 actionable next steps. Return JSON: { "explanation": string, "suggestions": string[] }',
      },
      {
        role: 'user',
        content: `Explain this error and suggest fixes:\n\n${safeError}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(text);
    return {
      explanation: String(parsed.explanation ?? text),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
    };
  } catch {
    return { explanation: text, suggestions: [] };
  }
}

export async function analyzeDockerLogs(logs: string): Promise<{
  summary: string;
  likelyCauses: string[];
  recommendations: string[];
}> {
  const ai = getClient();
  const safeLogs = truncate(logs, MAX_LOG_CHARS);

  const completion = await ai.chat.completions.create({
    model: config.AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a DevOps expert. Analyze Docker/container logs and identify issues. ' +
          'Return JSON: { "summary": string, "likelyCauses": string[], "recommendations": string[] }',
      },
      {
        role: 'user',
        content: `Analyze these container logs:\n\n${safeLogs}`,
      },
    ],
    max_tokens: 600,
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(text);
    return {
      summary: String(parsed.summary ?? 'Unable to parse response'),
      likelyCauses: Array.isArray(parsed.likelyCauses) ? parsed.likelyCauses.map(String) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    };
  } catch {
    return { summary: text, likelyCauses: [], recommendations: [] };
  }
}

export async function askAssistant(question: string, codeContext?: string): Promise<string> {
  const ai = getClient();
  const safeCode = codeContext ? truncate(codeContext, MAX_CODE_CHARS) : undefined;

  const userContent = safeCode
    ? `Question: ${question}\n\nCode context:\n\`\`\`\n${safeCode}\n\`\`\``
    : question;

  const completion = await ai.chat.completions.create({
    model: config.AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful senior developer assistant. Provide clear, concise explanations ' +
          'and practical suggestions. Do not execute harmful code or reveal secrets.',
      },
      { role: 'user', content: userContent },
    ],
    max_tokens: 800,
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content ?? 'No response from AI provider.';
}

export function getAIStatus(): { configured: boolean; model: string; baseUrl: string } {
  return {
    configured: isAIConfigured(),
    model: config.AI_MODEL,
    baseUrl: config.AI_BASE_URL,
    // Never expose the key
  };
}
