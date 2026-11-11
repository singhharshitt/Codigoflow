import { Router } from 'express';
import { z } from 'zod';
import {
  getPuppetStatus,
  listModules,
  validateManifest,
  puppetApply,
  puppetAgentRun,
  listCertificates,
  signCertificate,
  puppetFacts,
  puppetDrift,
} from '../integrations/puppet';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPuppetStatus() });
  } catch (err) {
    next(err);
  }
});

router.get('/agents', async (_req, res, next) => {
  try {
    // Agent inventory is environment-specific; surface certificates + status honestly.
    const certs = await listCertificates();
    res.json({
      success: true,
      data: {
        note: 'Agent list is derived from Puppet CA when puppetserver is available.',
        certificates: certs,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/certificates', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listCertificates() });
  } catch (err) {
    next(err);
  }
});

router.post('/certificates/:certname/sign', async (req, res, next) => {
  try {
    const body = z.object({ approve: z.boolean() }).parse(req.body);
    res.json({
      success: true,
      data: await signCertificate(req.params.certname, body.approve),
      message: 'Certificate signed after explicit approval',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/manifests/validate', async (req, res, next) => {
  try {
    const body = z.object({ manifest: z.string().min(1) }).parse(req.body);
    res.json({ success: true, data: await validateManifest(body.manifest) });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    const body = z
      .object({
        manifest: z.string().min(1),
        noop: z.boolean().optional().default(false),
        approve: z.boolean(),
      })
      .parse(req.body);
    res.json({
      success: true,
      data: await puppetApply(body.manifest, body.noop, body.approve),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/agent/run', async (req, res, next) => {
  try {
    const body = z.object({ approve: z.boolean() }).parse(req.body);
    res.json({ success: true, data: await puppetAgentRun(false, body.approve) });
  } catch (err) {
    next(err);
  }
});

router.post('/agent/noop', async (req, res, next) => {
  try {
    res.json({ success: true, data: await puppetAgentRun(true, true) });
  } catch (err) {
    next(err);
  }
});

router.get('/facts', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await puppetFacts() });
  } catch (err) {
    next(err);
  }
});

router.get('/modules', (_req, res, next) => {
  try {
    res.json({ success: true, data: listModules() });
  } catch (err) {
    next(err);
  }
});

router.get('/drift', async (req, res, next) => {
  try {
    const manifest = z.string().min(1).parse(req.query.manifest ?? 'manifests/site.pp');
    res.json({ success: true, data: await puppetDrift(manifest) });
  } catch (err) {
    next(err);
  }
});

export default router;
