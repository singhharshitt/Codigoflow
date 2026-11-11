import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generateCommitMessages,
  explainError,
  analyzeDockerLogs,
  analyzeExecutionFailure,
  askAssistant,
  getAIStatus,
  checkConnection,
} from '../integrations/ai';
import { getContainerLogs } from '../integrations/docker';
import { getJob, listJobLogs } from '../jobs/jobService';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAIStatus() });
});

router.get('/connection', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checkConnection();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const CommitMsgSchema = z.object({
  diff: z.string().min(1).max(50000),
  repositoryId: z.string().optional(),
  style: z.string().optional(),
});

router.post('/commit-messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { diff } = CommitMsgSchema.parse(req.body);
    const messages = await generateCommitMessages(diff);
    res.json({ success: true, data: { messages, suggestions: messages } });
  } catch (err) {
    next(err);
  }
});

const ExplainSchema = z.object({
  error: z.string().min(1).max(20000),
  codeContext: z.string().max(20000).optional(),
  category: z.string().optional(),
});

router.post('/explain-error', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, codeContext } = ExplainSchema.parse(req.body);
    const payload = codeContext ? `${error}\n\nCode context:\n${codeContext}` : error;
    const result = await explainError(payload);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const DockerLogsSchema = z.object({
  logs: z.string().max(50000).optional(),
  containerId: z.string().optional(),
}).refine((v) => Boolean(v.logs || v.containerId), {
  message: 'logs or containerId is required',
});

router.post('/analyze-docker-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = DockerLogsSchema.parse(req.body);
    let logs = body.logs ?? '';
    if (body.containerId) {
      logs = await getContainerLogs(body.containerId, 200);
    }
    if (!logs.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No logs available to analyze' },
      });
      return;
    }
    const result = await analyzeDockerLogs(logs);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const AskSchema = z.object({
  question: z.string().min(1).max(2000).optional(),
  message: z.string().min(1).max(2000).optional(),
  codeContext: z.string().max(20000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional(),
}).refine((v) => Boolean(v.question || v.message), {
  message: 'question or message is required',
});

async function handleChat(req: Request, res: Response, next: NextFunction) {
  try {
    const body = AskSchema.parse(req.body);
    const question = (body.question || body.message)!;
    const answer = await askAssistant(question, body.codeContext, body.history);
    res.json({ success: true, data: { answer } });
  } catch (err) {
    next(err);
  }
}

router.post('/ask', handleChat);
router.post('/chat', handleChat);

const AnalyzeJobSchema = z.object({
  jobId: z.string().uuid(),
});

/**
 * Grounded troubleshooting: uses persisted job metadata + job_logs only.
 * Does not execute infrastructure commands.
 */
router.post('/analyze-job', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = AnalyzeJobSchema.parse(req.body);
    const job = getJob(jobId);
    const logs = listJobLogs(jobId)
      .map((l) => `[${l.level}] ${l.message}`)
      .join('\n');
    const result = await analyzeExecutionFailure({
      operation: job.operation,
      status: job.status,
      summary: job.summary,
      errorMessage: job.error_message,
      logs,
    });
    res.json({
      success: true,
      data: {
        jobId: job.id,
        operation: job.operation,
        status: job.status,
        analysis: result,
        disclaimer:
          'Analysis is advisory. Destructive remediation must go through existing approval-gated executors.',
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
