// Manual trigger: `npm run narrate:all [-- --course <slug>] [--dry-run] [--max-usd <n>]` —
// same batch as AUDIOGEN_RUN_ON_START, runnable on demand without restarting the service.
// Operator-opt-in, paid. Exit codes are MEANINGFUL (2026-07-26 fire-and-forget
// audit): 0 = every pending lesson fully narrated; 1 = any unit/lesson failure
// (the failed lessons stay pending — re-running retries only their missing
// units), rows left untouched because the TTS budget ran out, a refused run,
// or a Vault/batch error.
//
// OD-28 (owner review D-03): a paid run (no --dry-run) refuses to start without
// the owner-approved USD ceiling `--max-usd <n>`, mirroring Forge's
// generate/generate:track. The refusal comes before any config, Vault or
// provider is touched. The ceiling binds per character at
// AUDIOGEN_USD_PER_1K_CHARS (see batch.ts).
import { spendCeilingRefusal } from './spendGuard.js';

function valueOf(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`narrate:all: ${flag} needs a value`);
    process.exit(1);
  }
  return value;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const courseSlug = valueOf(argv, '--course');
const maxUsdRaw = valueOf(argv, '--max-usd');
const maxUsd = maxUsdRaw === undefined ? undefined : Number(maxUsdRaw);

const refusal = spendCeilingRefusal({ command: 'narrate:all', flag: '--max-usd', dryRun, ceilingUsd: maxUsd });
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

// Imported only after the refusal check: batch.ts pulls in the Vault and TTS
// clients, and a refused run should load none of them.
const { runBatchNarration } = await import('./batch.js');

runBatchNarration(courseSlug, { dryRun, ...(maxUsd !== undefined ? { maxUsd } : {}) })
  .then((summary) => {
    // Do not force-exit while Undici is still closing the Vault connection.
    // On Windows that can abort inside libuv after a completely successful
    // dry run. Setting exitCode preserves the result and lets handles drain.
    process.exitCode = summary.lessonErrors > 0 || summary.unitFailures > 0 || summary.budgetSkippedLessons > 0 ? 1 : 0;
  })
  .catch((err) => {
    console.error('[audiogen] narrate:all failed:', err);
    process.exitCode = 1;
  });
