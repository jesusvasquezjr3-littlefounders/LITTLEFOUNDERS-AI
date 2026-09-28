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
    // Each case spawns the watcher as a Node child process; a loaded full run
    // can exceed the 5 s default, so the budget is explicit.
  }, 30_000);

  it('an overdue retroactive release check (G.2, Appendix N 2.3(b)) notifies a human through the same watchdog', async () => {
    const result = await runOpsJobDrill('content_retro_checks', new Date('2026-09-27T12:00:00Z'));
    expect(result.stale).toBe(true);
    expect(result.watcherExit).toBe(1);
    expect(result.notice).toContain('retroactive release check');
    expect(result.passed).toBe(true);
  }, 30_000);

  it('a healthy status carries the retroactive checks and does not fail the watcher', async () => {
    const result = await runOpsJobDrill('vault_backup', new Date('2026-09-27T12:00:00Z'));
    expect(result.notice).not.toContain('retroactive release check');
  }, 30_000);
});
