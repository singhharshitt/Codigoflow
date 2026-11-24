import { randomUUID } from 'crypto';
import { getDb } from '../../database';
import { asRow, asRows } from '../../utils/dbCast';
import { createError } from '../../middleware/errorHandler';
import { redactSecrets } from './redact';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  contextLabel: string | null;
  errorCode: string | null;
  createdAt: number;
}

const now = () => Math.floor(Date.now() / 1000);

/** Conversations are scoped to the signed-in user (null = pre-accounts / token admin). */
function ownerClause(userId: string | null): [string, (string | null)[]] {
  return userId ? ['user_id = ?', [userId]] : ['user_id IS NULL', []];
}

export function listConversations(userId: string | null, limit = 50): Conversation[] {
  const [where, params] = ownerClause(userId);
  return asRows<{ id: string; title: string; created_at: number; updated_at: number }>(
    getDb()
      .prepare(`SELECT id, title, created_at, updated_at FROM ai_conversations WHERE ${where} ORDER BY updated_at DESC LIMIT ?`)
      .all(...params, limit),
  ).map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function assertConversationOwner(id: string, userId: string | null): void {
  const [where, params] = ownerClause(userId);
  const row = getDb().prepare(`SELECT 1 FROM ai_conversations WHERE id = ? AND ${where}`).get(id, ...params);
  if (!row) throw createError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
}

export function createConversation(userId: string | null, firstPrompt: string): Conversation {
  const id = randomUUID();
  const title = redactSecrets(firstPrompt.replace(/\s+/g, ' ').trim()).slice(0, 80) || 'New conversation';
  const t = now();
  getDb()
    .prepare('INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, title, t, t);
  return { id, title, createdAt: t, updatedAt: t };
}

export function getMessages(conversationId: string, userId: string | null): StoredMessage[] {
  assertConversationOwner(conversationId, userId);
  return asRows<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    provider: string | null;
    model: string | null;
    context_label: string | null;
    error_code: string | null;
    created_at: number;
  }>(getDb().prepare('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid').all(conversationId)).map(
    (r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      provider: r.provider,
      model: r.model,
      contextLabel: r.context_label,
      errorCode: r.error_code,
      createdAt: r.created_at,
    }),
  );
}

export function addMessage(
  conversationId: string,
  msg: { role: 'user' | 'assistant'; content: string; provider?: string; model?: string; contextLabel?: string | null; errorCode?: string },
): string {
  const id = randomUUID();
  const t = now();
  getDb()
    .prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, provider, model, context_label, error_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      conversationId,
      msg.role,
      // Prompts are stored redacted; repository/log context itself is never stored.
      redactSecrets(msg.content).slice(0, 50_000),
      msg.provider ?? null,
      msg.model ?? null,
      msg.contextLabel ?? null,
      msg.errorCode ?? null,
      t,
    );
  getDb().prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?').run(t, conversationId);
  return id;
}

/** History for the model: successful turns only. */
export function historyForModel(conversationId: string, userId: string | null, max = 20) {
  return getMessages(conversationId, userId)
    .filter((m) => !m.errorCode && m.content.trim())
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function deleteConversation(id: string, userId: string | null): void {
  assertConversationOwner(id, userId);
  getDb().prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(id);
  getDb().prepare('DELETE FROM ai_conversations WHERE id = ?').run(id);
}

export function clearConversations(userId: string | null): number {
  const [where, params] = ownerClause(userId);
  const ids = asRows<{ id: string }>(getDb().prepare(`SELECT id FROM ai_conversations WHERE ${where}`).all(...params));
  for (const { id } of ids) {
    getDb().prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(id);
  }
  getDb().prepare(`DELETE FROM ai_conversations WHERE ${where}`).run(...params);
  return ids.length;
}

export function _countMessagesForTests(): number {
  return Number(asRow<{ n: number }>(getDb().prepare('SELECT COUNT(*) AS n FROM ai_messages').get()).n);
}
