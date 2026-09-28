import { OPS_JOBS } from '../services/opsJobs.js';
import { runOpsJobDrill } from './opsJobDrill.js';

/*
 * `npm run ops:drill` — H.4 / Appendix O 2.3's simulated job-failure drill,
 * once per watched job (see opsJobDrill.ts). Local, read-nothing, zero spend.
 */
async function main(): Promise<void> {
  let failed = 0;
  for (const job of OPS_JOBS) {
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
