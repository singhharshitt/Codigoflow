import { Router } from 'express';
import { z } from 'zod';
import {
  getTerraformStatus,
  listTerraformProjects,
  terraformFmt,
  terraformInit,
  terraformValidate,
  terraformPlan,
  getTerraformPlan,
  approveTerraformPlan,
  terraformApply,
  terraformWorkspaces,
  terraformWorkspaceNew,
  terraformWorkspaceSelect,
  terraformOutputs,
  listStoredPlans,
} from '../integrations/terraform';

const router = Router();
const ProjectSchema = z.object({ projectPath: z.string().min(1) });

router.get('/status', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getTerraformStatus() });
  } catch (err) {
    next(err);
  }
});

router.get('/projects', (_req, res, next) => {
  try {
    res.json({ success: true, data: listTerraformProjects() });
  } catch (err) {
    next(err);
  }
});

router.get('/plans', (_req, res, next) => {
  try {
    res.json({ success: true, data: listStoredPlans() });
  } catch (err) {
    next(err);
  }
});

router.get('/plans/:planId', (req, res, next) => {
  try {
    res.json({ success: true, data: getTerraformPlan(req.params.planId) });
  } catch (err) {
    next(err);
  }
});

router.post('/fmt', async (req, res, next) => {
  try {
    const { projectPath } = ProjectSchema.parse(req.body);
    res.json({ success: true, data: await terraformFmt(projectPath) });
  } catch (err) {
    next(err);
  }
});

router.post('/init', async (req, res, next) => {
  try {
    const { projectPath } = ProjectSchema.parse(req.body);
    res.json({ success: true, data: await terraformInit(projectPath), message: 'Init completed' });
  } catch (err) {
    next(err);
  }
});

router.post('/validate', async (req, res, next) => {
  try {
    const { projectPath } = ProjectSchema.parse(req.body);
    res.json({ success: true, data: await terraformValidate(projectPath) });
  } catch (err) {
    next(err);
  }
});

router.post('/plan', async (req, res, next) => {
  try {
    const body = ProjectSchema.extend({ workspace: z.string().optional() }).parse(req.body);
    res.json({ success: true, data: await terraformPlan(body.projectPath, body.workspace) });
  } catch (err) {
    next(err);
  }
});

router.post('/plans/:planId/approve', (req, res, next) => {
  try {
    const body = z.object({ approvedBy: z.string().min(1).default('operator') }).parse(req.body);
    res.json({
      success: true,
      data: approveTerraformPlan(req.params.planId, body.approvedBy),
      message: 'Plan approved',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    const body = z
      .object({
        planId: z.string().min(1),
        approve: z.boolean(),
        approvedBy: z.string().optional(),
      })
      .parse(req.body);
    res.json({
      success: true,
      data: await terraformApply(body.planId, body.approve, body.approvedBy),
      message: 'Apply completed for approved saved plan',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/workspaces', async (req, res, next) => {
  try {
    const projectPath = z.string().min(1).parse(req.query.projectPath);
    res.json({ success: true, data: await terraformWorkspaces(projectPath) });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces', async (req, res, next) => {
  try {
    const body = ProjectSchema.extend({ name: z.string().min(1) }).parse(req.body);
    res.json({ success: true, data: await terraformWorkspaceNew(body.projectPath, body.name) });
  } catch (err) {
    next(err);
  }
});

router.post('/workspaces/select', async (req, res, next) => {
  try {
    const body = ProjectSchema.extend({ name: z.string().min(1) }).parse(req.body);
    res.json({
      success: true,
      data: await terraformWorkspaceSelect(body.projectPath, body.name),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/outputs', async (req, res, next) => {
  try {
    const projectPath = z.string().min(1).parse(req.query.projectPath);
    res.json({ success: true, data: await terraformOutputs(projectPath) });
  } catch (err) {
    next(err);
  }
});

export default router;
