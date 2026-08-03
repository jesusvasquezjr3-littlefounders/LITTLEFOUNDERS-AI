// Manual trigger: `npm run narrate:all [-- --course <slug>] [--dry-run]` — same batch as
// AUDIOGEN_RUN_ON_START, runnable on demand without restarting the service.
// Operator-opt-in, paid. Exit codes are MEANINGFUL (2026-07-26 fire-and-forget
// audit): 0 = every pending lesson fully narrated; 1 = any unit/lesson failure
// (the failed lessons stay pending — re-running retries only their missing
// units), rows left untouched because the TTS budget ran out, or a Vault/batch
// error.
import { runBatchNarration } from './batch.js';

function parseCourse(argv: string[]): string | undefined {
  const i = argv.indexOf('--course');
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith('--')) {
    console.error('narrate:all: --course needs a value');
    process.exit(1);
  }
  return value;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

runBatchNarration(parseCourse(argv), { dryRun })
  .then((summary) => {
    process.exit(summary.lessonErrors > 0 || summary.unitFailures > 0 || summary.budgetSkippedLessons > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('[audiogen] narrate:all failed:', err);
    process.exit(1);
  });
