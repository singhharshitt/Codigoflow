import { assessPipelineReadiness } from './pipelineReadiness';

describe('pipeline readiness', () => {
  it(
    'reports honest blocked stages when tools are missing',
    async () => {
      const report = await assessPipelineReadiness();
      expect(report.stages.length).toBeGreaterThanOrEqual(5);
      expect(report).toHaveProperty('pipelineExecutable');
      expect(report).toHaveProperty('realInfrastructureExecutable');
      // On this Windows host without tool installs, full infra must not be claimed ready.
      if (!report.realInfrastructureExecutable) {
        expect(report.pipelineExecutable).toBe(false);
        expect(report.blockedStages.length + report.degradedStages.length).toBeGreaterThan(0);
      }
      expect(report.notes.join(' ')).toMatch(/Do not claim cloud provisioning success/i);
    },
    60_000,
  );
});
