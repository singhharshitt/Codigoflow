import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generateCommitMessages,
  explainError,
  analyzeDockerLogs,
  askAssistant,
  getAIStatus,
} from '../integrations/ai';

const router = Router();

// GET /api/ai/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAIStatus() });
});

// POST /api/ai/commit-messages
const CommitMsgSchema = z.object({ diff: z.string().min(1).max(50000) });

router.post('/commit-messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { diff } = CommitMsgSchema.parse(req.body);
    const messages = await generateCommitMessages(diff);
    res.json({ success: true, data: { messages } });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/explain-error
const ExplainSchema = z.object({ error: z.string().min(1).max(20000) });

router.post('/explain-error', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = ExplainSchema.parse(req.body);
    const result = await explainError(error);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/analyze-docker-logs
const DockerLogsSchema = z.object({ logs: z.string().min(1).max(50000) });

router.post('/analyze-docker-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { logs } = DockerLogsSchema.parse(req.body);
    const result = await analyzeDockerLogs(logs);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/ask
const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  codeContext: z.string().max(20000).optional(),
});

router.post('/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, codeContext } = AskSchema.parse(req.body);
    const answer = await askAssistant(question, codeContext);
    res.json({ success: true, data: { answer } });
  } catch (err) {
    next(err);
  }
});

export default router;
