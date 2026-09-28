import { describe, expect, it } from 'vitest';
import { OPS_JOBS } from '../services/opsJobs.js';
import { runOpsJobDrill } from '../scripts/opsJobDrill.js';

/*
 * H.4 / Appendix O 2.3: a simulated failure of EACH watched job is shown to
 * produce stale=true in Core's status and a notification from the watcher the
 * scheduled workflow runs.
 */
describe('the simulated job-failure drill', () => {
  it.each(OPS_JOBS)('a stale %s heartbeat is reported stale and notifies a human', async (job) => {
    const result = await runOpsJobDrill(job, new Date('2026-09-27T12:00:00Z'));
    expect(result.stale).toBe(true);
    expect(result.watcherExit).toBe(1);
    expect(result.notice).toContain(`**${job}**`);
    expect(result.passed).toBe(true);
  });
});
