import { assessPipelineReadiness } from '../src/devops/services/pipelineReadiness.ts';

const r = await assessPipelineReadiness();
console.log(
  JSON.stringify(
    {
      mode: r.control.mode,
      available: r.control.available,
      detail: r.control.detail,
      missing: r.missingTools,
      pipelineExecutable: r.pipelineExecutable,
      realInfrastructureExecutable: r.realInfrastructureExecutable,
      stages: r.stages.map((s) => ({
        id: s.id,
        status: s.status,
        blockers: s.blockers,
      })),
    },
    null,
    2,
  ),
);
