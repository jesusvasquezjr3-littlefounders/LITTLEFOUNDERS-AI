// OD-23 (owner log, 24 September 2026) and OD-28 (owner review D-03, 27
// September 2026): every PAID invocation of a spending entry point states the
// owner-approved USD ceiling on the command line; dry-runs need none.
//
// Echo is an independent package and cannot import Forge, so this is a
// VERBATIM copy of `spendCeilingRefusal` from coursegen/src/pipeline/spendGuard.ts
// (the interface and the function body). `agent/tools/spend-guard-parity.test.mjs`
// (root `npm run tools:test`) fails when the two copies drift: change both.

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
    'OD-23: paid generation is an owner-run step; follow docs/content/FORGE-OWNER-RUN-GENERATION.md, ' +
    'or add --dry-run for the zero-spend rehearsal.'
  );
}
