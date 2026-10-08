// Every PAID invocation of a spending entry point states the
// owner-approved USD ceiling on the command line; dry-runs need none.
//
// Echo is an independent package and cannot import Forge, so this is a
// VERBATIM copy of `spendCeilingRefusal` from coursegen/src/pipeline/spendGuard.ts
// (the interface and the function body). Keep the two copies identical: change both.

export interface SpendCeilingInput {
  command: 'generate' | 'generate:track' | 'images:backfill' | 'narrate:all';
  flag: '--max-usd' | '--budget-usd';
  dryRun: boolean;
  ceilingUsd: number | undefined;
}

/** The refusal message for a paid run without an approved ceiling, or null when the run may proceed. */
export function spendCeilingRefusal(input: SpendCeilingInput): string | null {
  if (input.dryRun) return null;
  if (input.ceilingUsd !== undefined && Number.isFinite(input.ceilingUsd) && input.ceilingUsd > 0) return null;
  return (
    `${input.command}: a paid run needs the owner-approved USD ceiling (${input.flag} <n>). ` +
    'OD-23: paid generation is an owner-run step; ' +
    'add --dry-run for the zero-spend rehearsal.'
  );
}
