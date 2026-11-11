import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parseGitHubUrl, getRepoInfo, getRepoCommits, getRepoContributors } from '../integrations/github';

const router = Router();

// GET /api/github/repositories?url=<github-url>
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

// GET /api/github/repositories/:owner/:repo/commits
router.get('/repositories/:owner/:repo/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, repo } = req.params;
    const commits = await getRepoCommits(owner, repo);
    res.json({ success: true, data: commits });
  } catch (err) {
    next(err);
  }
});

// GET /api/github/repositories/:owner/:repo/contributors
router.get('/repositories/:owner/:repo/contributors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, repo } = req.params;
    const contributors = await getRepoContributors(owner, repo);
    res.json({ success: true, data: contributors });
  } catch (err) {
    next(err);
  }
});

export default router;
