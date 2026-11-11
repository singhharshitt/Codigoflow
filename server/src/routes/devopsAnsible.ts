import { Router } from 'express';
import { z } from 'zod';
import {
  getAnsibleStatus,
  listInventories,
  listPlaybooks,
  listRoles,
  validateInventory,
  ansiblePing,
  ansibleFacts,
  validatePlaybook,
  checkPlaybook,
  runPlaybook,
  ansibleAdHoc,
} from '../integrations/ansible';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getAnsibleStatus() });
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', (_req, res, next) => {
  try {
    res.json({ success: true, data: listInventories() });
  } catch (err) {
    next(err);
  }
});

router.post('/inventory/validate', async (req, res, next) => {
  try {
    const body = z.object({ inventory: z.string().min(1) }).parse(req.body);
    res.json({ success: true, data: await validateInventory(body.inventory) });
  } catch (err) {
    next(err);
  }
});

router.post('/ping', async (req, res, next) => {
  try {
    const body = z
      .object({ inventory: z.string().min(1), limit: z.string().optional() })
      .parse(req.body);
    res.json({ success: true, data: await ansiblePing(body.inventory, body.limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/facts', async (req, res, next) => {
  try {
    const body = z
      .object({ inventory: z.string().min(1), limit: z.string().optional() })
      .parse(req.body);
    res.json({ success: true, data: await ansibleFacts(body.inventory, body.limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/playbooks', (_req, res, next) => {
  try {
    res.json({ success: true, data: listPlaybooks() });
  } catch (err) {
    next(err);
  }
});

router.post('/playbooks/validate', async (req, res, next) => {
  try {
    const body = z.object({ playbook: z.string().min(1) }).parse(req.body);
    res.json({ success: true, data: await validatePlaybook(body.playbook) });
  } catch (err) {
    next(err);
  }
});

router.post('/playbooks/check', async (req, res, next) => {
  try {
    const body = z
      .object({
        playbook: z.string().min(1),
        inventory: z.string().min(1),
        approve: z.boolean().default(true),
      })
      .parse(req.body);
    res.json({
      success: true,
      data: await checkPlaybook(body.playbook, body.inventory, body.approve),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/playbooks/run', async (req, res, next) => {
  try {
    const body = z
      .object({
        playbook: z.string().min(1),
        inventory: z.string().min(1),
        approve: z.boolean(),
      })
      .parse(req.body);
    res.json({
      success: true,
      data: await runPlaybook(body.playbook, body.inventory, body.approve),
      message: 'Playbook completed',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/roles', (_req, res, next) => {
  try {
    res.json({ success: true, data: listRoles() });
  } catch (err) {
    next(err);
  }
});

router.post('/ad-hoc', async (req, res, next) => {
  try {
    const body = z
      .object({
        inventory: z.string().min(1),
        module: z.string().min(1),
        args: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(req.body);
    res.json({ success: true, data: await ansibleAdHoc(body) });
  } catch (err) {
    next(err);
  }
});

export default router;
