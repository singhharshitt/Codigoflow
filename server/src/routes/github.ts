import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  parseGitHubUrl,
  getRepoInfo,
  getRepoCommits,
  getRepoContributors,
  getRepoBranches,
  getGitHubStatus,
} from '../integrations/github';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getGitHubStatus() });
});

router.get('/repositories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = z.string().url().parse(req.query.url);
    const { owner, repo } = parseGitHubUrl(url);
    const info = await getRepoInfo(owner, repo);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/repositories/:owner/:repo',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const info = await getRepoInfo(owner, repo);
      res.json({ success: true, data: info });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/repositories/:owner/:repo/commits',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const commits = await getRepoCommits(owner, repo);
      res.json({ success: true, data: commits });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/repositories/:owner/:repo/contributors',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const contributors = await getRepoContributors(owner, repo);
      res.json({ success: true, data: contributors });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/repositories/:owner/:repo/branches',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const branches = await getRepoBranches(owner, repo);
      res.json({ success: true, data: branches });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
