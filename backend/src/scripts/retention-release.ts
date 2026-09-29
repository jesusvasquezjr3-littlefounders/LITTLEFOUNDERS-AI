#!/usr/bin/env node
/*
 * `npm run learning:retention-release` — freezes a release's Delayed
 * Retention (Appendix C 1.1, GAP-FIX-R4) so the next release is judged
 * against it: "establish release-1 baseline per KC, then require no decline
 * release over release".
 *
 * The first release recorded is the release-1 baseline (log it as the
 * baseline row in docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md). Each
 * later release records the reviews of its own period: from the previous
 * recorded release's period end to now. A release is recorded once; running
 * it again for the same id changes nothing.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run learning:retention-release -- --release=<id> [--since=YYYY-MM-DD] [--dry-run]
 *
 *   --since    the start of the FIRST period (default: 120 days ago, the
 *              longest window's reach); ignored once a release is recorded.
 *   --dry-run  prints the cells the release would freeze and records nothing.
 *
 * Operator tool, run at release time (after release:readiness passes). Reads
 * and one service-role write; no model call, costs nothing. Exit code 1 when
 * a read or the write fails.
 */

import { serviceRest } from '../services/supabaseRest.js';
import { MENTOR_QUALITY_THRESHOLDS as T } from '../services/pedagogy/mentorQuality.js';

export const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<number> {
  const release = arg('release');
  if (!release || !RELEASE_ID.test(release)) {
    console.error('usage: npm run learning:retention-release -- --release=<id> [--since=YYYY-MM-DD] [--dry-run]');
    return 1;
  }
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(Date.now() - 120 * 86_400_000);
  if (Number.isNaN(since.getTime())) {
    console.error('--since must be YYYY-MM-DD');
    return 1;
  }
  const now = new Date();
  if (process.argv.includes('--dry-run')) {
    const cells = await serviceRest<{ kc_key: string; window_days: number; learners: number; correct: number }[]>('/rpc/learning_delayed_retention', {
      method: 'POST', body: JSON.stringify({ p_since: since.toISOString(), p_until: now.toISOString(), p_mastery: T.masteryPosterior }),
    });
    if (!Array.isArray(cells)) {
      console.error('learning_delayed_retention could not be read');
      return 1;
    }
    for (const c of cells) console.log(`${c.kc_key}\t${c.window_days} days\t${c.correct}/${c.learners}`);
    console.log(`${cells.length} cell(s); nothing recorded (dry run)`);
    return 0;
  }
  const written = await serviceRest<number>('/rpc/record_learning_retention_release', {
    method: 'POST', body: JSON.stringify({ p_release_id: release, p_since: since.toISOString(), p_until: now.toISOString() }),
  });
  if (typeof written !== 'number') {
    console.error('record_learning_retention_release failed');
    return 1;
  }
  console.log(written === 0 ? `release ${release}: already recorded, or no review fell in its period` : `release ${release}: ${written} KC x window cell(s) frozen`);
  return 0;
}

main().then((code) => { process.exitCode = code; }, (error: unknown) => { console.error(error); process.exitCode = 1; });
