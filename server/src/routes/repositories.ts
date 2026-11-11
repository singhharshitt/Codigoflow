import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerRepository,
  listRepositories,
  getRepository,
  deleteRepository,
  getRepoStatus,
  getBranches,
  getCommits,
  getDiff,
  stageFiles,
  commitChanges,
  pushChanges,
} from '../services/repositoryService';

const router = Router();

// GET /api/repositories
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = listRepositories();
    res.json({ success: true, data: repos });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories — register existing local repo
const RegisterSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const repo = await registerRepository(body);
    res.status(201).json({ success: true, data: repo });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repositories/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteRepository(req.params.id);
    res.json({ success: true, message: 'Repository removed from CódigoFlow' });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository(req.params.id);
    res.json({ success: true, data: repo });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/status
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getRepoStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/branches
router.get('/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branches = await getBranches(req.params.id);
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/commits
router.get('/:id/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '30'), 10), 100);
    const commits = await getCommits(req.params.id, limit);
    res.json({ success: true, data: commits });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/diff
router.get('/:id/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = typeof req.query.file === 'string' ? req.query.file : undefined;
    const diff = await getDiff(req.params.id, file);
    res.json({ success: true, data: { diff } });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories/:id/stage
const StageSchema = z.object({ files: z.array(z.string().min(1)).min(1) });

router.post('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { files } = StageSchema.parse(req.body);
    await stageFiles(req.params.id, files);
    res.json({ success: true, message: 'Files staged' });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories/:id/commit
const CommitSchema = z.object({ message: z.string().min(1).max(5000) });

router.post('/:id/commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = CommitSchema.parse(req.body);
    const result = await commitChanges(req.params.id, message);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories/:id/push
const PushSchema = z.object({
  remote: z.string().default('origin'),
  branch: z.string().optional(),
});

router.post('/:id/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { remote, branch } = PushSchema.parse(req.body);
    const output = await pushChanges(req.params.id, remote, branch);
    res.json({ success: true, data: { output } });
  } catch (err) {
    next(err);
  }
});

export default router;
