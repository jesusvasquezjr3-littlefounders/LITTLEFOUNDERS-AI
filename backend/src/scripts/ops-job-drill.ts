import { DRILL_TARGETS, runOpsJobDrill } from './opsJobDrill.js';

/*
 * `npm run ops:drill` — H.4 / Appendix O 2.3's simulated job-failure drill,
 * once per watched job (the backups, the drift probe, the Mentor retention
 * sweep, and the account-deletion, family, social and learning retention
 * sweeps and the insights prune), plus G.2's overdue retroactive release
 * check, G.4's due access review and E.6's stalled erasure (see opsJobDrill.ts). Local, read-nothing, zero spend.
 */
async function main(): Promise<void> {
  let failed = 0;
  for (const job of DRILL_TARGETS) {
    const result = await runOpsJobDrill(job);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${job}: stale=${result.stale} watcher-exit=${result.watcherExit} notice=${result.notice ? 'written' : 'missing'}`);
    if (!result.passed) failed += 1;
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
