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
  unstageFiles,
  commitChanges,
  pushChanges,
  checkoutBranch,
  cloneRepository,
} from '../services/repositoryService';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: listRepositories() });
  } catch (err) {
    next(err);
  }
});

const RegisterSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const repo = await registerRepository(body);
    res.status(201).json({ success: true, data: repo, message: 'Repository registered' });
  } catch (err) {
    next(err);
  }
});

const CloneSchema = z.object({
  url: z.string().url().or(z.string().regex(/^git@/)),
  destination: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
});

router.post('/clone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CloneSchema.parse(req.body);
    const repo = await cloneRepository(body);
    res.status(201).json({ success: true, data: repo, message: 'Repository cloned and registered' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteRepository(req.params.id);
    res.json({
      success: true,
      message: 'Repository removed from CódigoFlow (files were not deleted)',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: getRepository(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getRepoStatus(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getBranches(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '30'), 10), 100);
    res.json({ success: true, data: await getCommits(req.params.id, limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = typeof req.query.file === 'string' ? req.query.file : undefined;
    const diff = await getDiff(req.params.id, file);
    res.json({ success: true, data: { diff } });
  } catch (err) {
    next(err);
  }
});

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

router.post('/:id/unstage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { files } = StageSchema.parse(req.body);
    await unstageFiles(req.params.id, files);
    res.json({ success: true, message: 'Files unstaged' });
  } catch (err) {
    next(err);
  }
});

const CommitSchema = z.object({
  message: z.string().min(1).max(5000),
  confirm: z.boolean().optional(),
});

router.post('/:id/commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, confirm } = CommitSchema.parse(req.body);
    const result = await commitChanges(req.params.id, message, confirm);
    res.json({ success: true, data: result, message: 'Commit created' });
  } catch (err) {
    next(err);
  }
});

const PushSchema = z.object({
  remote: z.string().default('origin'),
  branch: z.string().optional(),
  confirm: z.boolean().optional(),
});

router.post('/:id/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { remote, branch, confirm } = PushSchema.parse(req.body);
    const output = await pushChanges(req.params.id, remote, branch, confirm);
    res.json({ success: true, data: { output }, message: 'Push completed' });
  } catch (err) {
    next(err);
  }
});

const CheckoutSchema = z.object({
  branch: z.string().min(1),
  force: z.boolean().optional(),
});

router.post('/:id/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch, force } = CheckoutSchema.parse(req.body);
    const result = await checkoutBranch(req.params.id, branch, force);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
