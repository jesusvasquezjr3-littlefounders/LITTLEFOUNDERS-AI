// OD-23 (owner log, 24 September 2026): no paid model, image or voice
// generation runs during the migration build; live execution is a documented
// OWNER-RUN step (docs/content/FORGE-OWNER-RUN-GENERATION.md).
//
// The run budget in run.ts is a kill switch scaled to the enumerated work,
// with floors (FORGE_MAX_USD_PER_RUN, default $50) that exist so a long course
// run is not killed early. That makes it the wrong control for "how much did
// the owner approve": a one-slot run is allowed the whole floor. So every PAID
// invocation of a spending entry point must state its approved USD ceiling on
// the command line, where it is recorded with the run, and the ceiling only
// ever lowers the scaled budget. Dry-runs need none: they spend nothing.
//
// OD-28 (owner review D-03, 27 September 2026) extends the rule to the two
// remaining paid tools: `images:backfill` in any mode that can call Prism, and
// Echo's `narrate:all`. Echo cannot import this package, so
// `audiogen/src/spendGuard.ts` carries a verbatim copy of the function below;
// `agent/tools/spend-guard-parity.test.mjs` (tools:test) keeps them identical.

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
