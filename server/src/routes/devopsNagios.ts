import { Router } from 'express';
import { z } from 'zod';
import {
  getNagiosStatus,
  readNagiosStatus,
  listPlugins,
  runPlugin,
  writeExternalCommand,
  reloadNagios,
} from '../integrations/nagios';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getNagiosStatus() });
  } catch (err) {
    next(err);
  }
});

router.get('/hosts', (_req, res, next) => {
  try {
    const data = readNagiosStatus();
    res.json({ success: true, data: data.hosts });
  } catch (err) {
    next(err);
  }
});

router.get('/services', (_req, res, next) => {
  try {
    const data = readNagiosStatus();
    res.json({ success: true, data: data.services });
  } catch (err) {
    next(err);
  }
});

router.get('/host-groups', (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        note: 'Host groups are defined in devops/nagios/objects; live groups require Nagios status/config integration.',
        groups: ['codigoflow-lab'],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/service-groups', (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        note: 'Service groups are defined in devops/nagios/objects.',
        groups: ['codigoflow-app'],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/downtimes', (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: [],
      message: 'Downtime entries appear once Nagios status.dat includes downtime objects.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/comments', (_req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (err) {
    next(err);
  }
});

router.post('/acknowledge', (req, res, next) => {
  try {
    const body = z
      .object({
        host: z.string().min(1),
        service: z.string().optional(),
        comment: z.string().min(1),
        approve: z.boolean(),
        author: z.string().default('codigoflow'),
      })
      .parse(req.body);
    const cmd = body.service
      ? `ACKNOWLEDGE_SVC_PROBLEM;${body.host};${body.service};1;1;1;${body.author};${body.comment}`
      : `ACKNOWLEDGE_HOST_PROBLEM;${body.host};1;1;1;${body.author};${body.comment}`;
    res.json({ success: true, data: writeExternalCommand(cmd, body.approve) });
  } catch (err) {
    next(err);
  }
});

router.post('/comments', (req, res, next) => {
  try {
    const body = z
      .object({
        host: z.string().min(1),
        service: z.string().optional(),
        comment: z.string().min(1),
        approve: z.boolean(),
        author: z.string().default('codigoflow'),
      })
      .parse(req.body);
    const cmd = body.service
      ? `ADD_SVC_COMMENT;${body.host};${body.service};1;${body.author};${body.comment}`
      : `ADD_HOST_COMMENT;${body.host};1;${body.author};${body.comment}`;
    res.json({ success: true, data: writeExternalCommand(cmd, body.approve) });
  } catch (err) {
    next(err);
  }
});

router.post('/downtime', (req, res, next) => {
  try {
    const body = z
      .object({
        host: z.string().min(1),
        service: z.string().optional(),
        start: z.number().int(),
        end: z.number().int(),
        comment: z.string().min(1),
        approve: z.boolean(),
        author: z.string().default('codigoflow'),
      })
      .parse(req.body);
    const duration = Math.max(0, body.end - body.start);
    const cmd = body.service
      ? `SCHEDULE_SVC_DOWNTIME;${body.host};${body.service};${body.start};${body.end};1;0;${duration};${body.author};${body.comment}`
      : `SCHEDULE_HOST_DOWNTIME;${body.host};${body.start};${body.end};1;0;${duration};${body.author};${body.comment}`;
    res.json({ success: true, data: writeExternalCommand(cmd, body.approve) });
  } catch (err) {
    next(err);
  }
});

router.post('/reload', async (req, res, next) => {
  try {
    const body = z.object({ approve: z.boolean() }).parse(req.body);
    res.json({ success: true, data: await reloadNagios(body.approve) });
  } catch (err) {
    next(err);
  }
});

router.get('/plugins', (_req, res, next) => {
  try {
    res.json({ success: true, data: listPlugins() });
  } catch (err) {
    next(err);
  }
});

router.post('/plugins/run', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        args: z.array(z.string()).optional().default([]),
      })
      .parse(req.body);
    res.json({ success: true, data: await runPlugin(body.name, body.args) });
  } catch (err) {
    next(err);
  }
});

export default router;
