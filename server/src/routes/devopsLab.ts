import { Router } from 'express';
import { runDevOpsPreflight } from '../devops/services/preflight';
import { assessPipelineReadiness } from '../devops/services/pipelineReadiness';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    const preflight = await runDevOpsPreflight();
    res.json({
      success: true,
      data: {
        ...preflight,
        checklist: [
          'WSL2 Ubuntu or SSH control node available',
          'Terraform / Ansible / Puppet / Nagios installed on control node',
          'Inventory IPs and SSH access configured',
          'Credentials kept outside git (.env / tfvars ignored)',
        ],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/pipeline', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await assessPipelineReadiness() });
  } catch (err) {
    next(err);
  }
});

export default router;
