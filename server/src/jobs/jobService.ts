import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketServer } from 'socket.io';
import { getDb } from '../database';
import { asRow, asRows } from '../utils/dbCast';
import { createError } from '../middleware/errorHandler';
import type { JobStatus } from '../config';

export interface JobRecord {
  id: string;
  operation: string;
  type?: string | null;
  repo_id?: string | null;
  status: JobStatus;
  summary?: string | null;
  log_ref?: string | null;
  error_message?: string | null;
  started_at?: number | null;
  finished_at?: number | null;
  duration_ms?: number | null;
  created_at: number;
}

export interface JobLogRecord {
  id: string;
  job_id: string;
  timestamp: number;
  level: string;
  message: string;
}

const activeByRepo = new Map<string, string>();
const cancelFlags = new Set<string>();
let ioRef: SocketServer | null = null;

export function setJobIo(io: SocketServer): void {
  ioRef = io;
}

function emit(event: string, payload: unknown): void {
  ioRef?.emit(event, payload);
}

export function createJob(input: {
  operation: string;
  type?: string;
  repoId?: string;
  summary?: string;
}): JobRecord {
  if (input.repoId && activeByRepo.has(input.repoId)) {
    throw createError(
      'Another job is already running for this repository',
      409,
      'REPO_BUSY',
    );
  }

  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO jobs (id, operation, type, repo_id, status, summary, created_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
    )
    .run(id, input.operation, input.type ?? input.operation, input.repoId ?? null, input.summary ?? null, now);

  const job = getJob(id);
  emit('job:queued', job);
  return job;
}

export function getJob(id: string): JobRecord {
  const job = asRow<JobRecord | undefined>(
    getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id),
  );
  if (!job) throw createError(`Job ${id} not found`, 404, 'JOB_NOT_FOUND');
  return job;
}

export function listJobs(limit = 50): JobRecord[] {
  return asRows<JobRecord>(
    getDb()
      .prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?')
      .all(Math.min(limit, 200)),
  );
}

export function appendJobLog(
  jobId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
): void {
  const safe = message.replace(/sk-[A-Za-z0-9]+/g, '[redacted]').slice(0, 4000);
  const id = uuidv4();
  const ts = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO job_logs (id, job_id, timestamp, level, message) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, jobId, ts, level, safe);
  emit('job:log', { jobId, id, timestamp: ts, level, message: safe });
}

export function listJobLogs(jobId: string): JobLogRecord[] {
  getJob(jobId);
  return asRows<JobLogRecord>(
    getDb()
      .prepare('SELECT * FROM job_logs WHERE job_id = ? ORDER BY timestamp ASC')
      .all(jobId),
  );
}

export function markJobRunning(jobId: string): JobRecord {
  const job = getJob(jobId);
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(`UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?`)
    .run(now, jobId);
  if (job.repo_id) activeByRepo.set(job.repo_id, jobId);
  const updated = getJob(jobId);
  emit('job:started', updated);
  return updated;
}

export function markJobFinished(
  jobId: string,
  status: 'succeeded' | 'failed' | 'cancelled',
  errorMessage?: string,
): JobRecord {
  const job = getJob(jobId);
  const now = Math.floor(Date.now() / 1000);
  const duration =
    job.started_at != null ? (now - job.started_at) * 1000 : null;
  getDb()
    .prepare(
      `UPDATE jobs
       SET status = ?, finished_at = ?, duration_ms = ?, error_message = ?
       WHERE id = ?`,
    )
    .run(status, now, duration, errorMessage ?? null, jobId);
  if (job.repo_id) activeByRepo.delete(job.repo_id);
  cancelFlags.delete(jobId);
  const updated = getJob(jobId);
  emit(status === 'succeeded' ? 'job:succeeded' : status === 'cancelled' ? 'job:cancelled' : 'job:failed', updated);
  return updated;
}

export function requestCancel(jobId: string): JobRecord {
  const job = getJob(jobId);
  if (job.status !== 'queued' && job.status !== 'running') {
    throw createError('Only queued or running jobs can be cancelled', 400, 'JOB_NOT_CANCELLABLE');
  }
  cancelFlags.add(jobId);
  if (job.status === 'queued') {
    return markJobFinished(jobId, 'cancelled', 'Cancelled before start');
  }
  appendJobLog(jobId, 'Cancellation requested', 'warn');
  return getJob(jobId);
}

export function isCancelRequested(jobId: string): boolean {
  return cancelFlags.has(jobId);
}

export async function runJob<T>(
  input: { operation: string; type?: string; repoId?: string; summary?: string },
  worker: (ctx: {
    jobId: string;
    log: (msg: string, level?: 'info' | 'warn' | 'error') => void;
    isCancelled: () => boolean;
  }) => Promise<T>,
): Promise<{ job: JobRecord; result?: T }> {
  const job = createJob(input);
  markJobRunning(job.id);
  appendJobLog(job.id, `Started ${input.operation}`);

  try {
    if (isCancelRequested(job.id)) {
      return { job: markJobFinished(job.id, 'cancelled', 'Cancelled') };
    }
    const result = await worker({
      jobId: job.id,
      log: (msg, level) => appendJobLog(job.id, msg, level),
      isCancelled: () => isCancelRequested(job.id),
    });
    if (isCancelRequested(job.id)) {
      return { job: markJobFinished(job.id, 'cancelled', 'Cancelled after work') };
    }
    appendJobLog(job.id, 'Completed successfully');
    return { job: markJobFinished(job.id, 'succeeded'), result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendJobLog(job.id, message, 'error');
    return { job: markJobFinished(job.id, 'failed', message) };
  }
}
