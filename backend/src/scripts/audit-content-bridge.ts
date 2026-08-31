#!/usr/bin/env node
/*
 * `npm run audit:content-bridge` — re-runs THE BRIDGE AUDIT
 * (`../services/contentBridgeAudit.ts`) against whatever is CURRENTLY live in
 * Vault, independent of `database/seeds/kc_graph.v1.json`.
 *
 * WHY THIS EXISTS SEPARATELY FROM `seed:kc`. Until RUNBOOK.md Round 105 the
 * bridge audit only ever ran as a side effect of a human dispatching
 * `tutor-deploy.yml`'s `seed-kc` step — the ONLY trigger for the exact defect
 * this audit exists to catch (a `kc.skill_key` that no longer reaches
 * published content) was a human choosing to re-seed. Nothing re-checked it
 * when the CATALOG changed instead of the KC graph: a course unpublished, a
 * topic's lessons archived, a lesson's skill tags edited. All three change
 * what `resolveSkill` and the published-lesson count return WITHOUT touching
 * the seed file, so `git blame` on the seed would never point at the commit
 * that broke the bridge — because there would not be one.
 *
 * This reads the mapped `key -> skill_key` pairs straight from the live `kc`
 * table (`getActiveKcs()`, the same reader the pedagogy engine itself uses),
 * not from the seed JSON — so it needs nothing this repository doesn't
 * already deploy, and it can run on a schedule against production the same
 * way `vault-drift.yml` and `tutor-retention.yml` already do. See
 * `.github/workflows/tutor-content-bridge.yml`.
 *
 * Operator tool, not CI, same posture as seed:kc and placement:verify:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run audit:content-bridge
 */

import { getActiveKcs } from '../services/pedagogy/kcData.js';
import { auditContentBridge } from '../services/contentBridgeAudit.js';

async function main(): Promise<void> {
  const kcs = await getActiveKcs();
  // A null read is a FAILED fetch, never "zero active KCs" (/AGENTS.md
  // §1.14) — collapsing the two would report a healthy bridge on an
  // unanswered query, exactly the silent-miss shape this audit exists to
  // catch in the first place.
  if (kcs === null) {
    throw new Error('could not read the kc table — refusing to report a bridge as healthy on an unanswered query');
  }

  const report = await auditContentBridge(kcs.map((k) => ({ key: k.key, skill_key: k.skill_key })));
  console.log(
    `\naudit:content-bridge OK — all ${report.mappedCount} mapped KCs reach published lessons ` +
      `(${report.unmappedKeys.length} deliberately unmapped).`,
  );
}

main().catch((err) => {
  console.error(`::error::audit:content-bridge FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
