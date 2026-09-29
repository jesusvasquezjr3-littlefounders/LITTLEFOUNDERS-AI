import { describe, expect, it } from 'vitest';
import { OPS_JOBS } from '../services/opsJobs.js';
import { DRILL_TARGETS, runOpsJobDrill } from '../scripts/opsJobDrill.js';

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
    // Only the drilled job is named: the retention sweep and the access reviews were healthy.
    expect(result.notice).not.toContain('**tutor_retention**');
    expect(result.notice).not.toContain('**access_reviews**');
  }, 30_000);

  it('Appendix O 1.3 / 2.3(b): a stale Mentor retention sweep trail (tutor.retention.swept) notifies a human through the watchdog', async () => {
    const result = await runOpsJobDrill('tutor_retention', new Date('2026-09-27T12:00:00Z'));
    expect(result.stale).toBe(true);
    expect(result.watcherExit).toBe(1);
    expect(result.notice).toContain('**tutor_retention**: last successful run 48 h ago (window 36 h)');
    expect(result.notice).not.toContain('**vault_backup**');
    expect(result.passed).toBe(true);
  }, 30_000);

  it('G.4: an elevated grant past the 90-day access review notifies the access owner through the same watchdog', async () => {
    const result = await runOpsJobDrill('access_reviews', new Date('2026-09-27T12:00:00Z'));
    expect(result.stale).toBe(true);
    expect(result.watcherExit).toBe(1);
    expect(result.notice).toContain('**access_reviews**: 1 elevated staff grant(s) past the 90-day access review (G.4)');
    expect(result.passed).toBe(true);
  }, 30_000);

  it('the drill covers the three Appendix O 1.3 jobs and every other watched condition', () => {
    expect(DRILL_TARGETS).toEqual(expect.arrayContaining([...OPS_JOBS, 'tutor_retention', 'content_retro_checks', 'access_reviews']));
  });
});
