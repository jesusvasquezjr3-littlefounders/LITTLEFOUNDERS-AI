#!/usr/bin/env node
/*
 * `npm run tutor:session-end-report` — the monitor for Product C.16 and
 * C.8/C.12 (Appendix F §1.1–1.2).
 *
 *   C.16    Session-Closing Script Accuracy: every closed session's recorded
 *           closing script against the one its close reason requires. A HARD
 *           target of 100% — one safety stop closed with the positive script
 *           is a defect, whatever the sample. Also how often each queued
 *           re-engagement opening was delivered.
 *   C.8/12  Early-Warning Signal Trigger Rate: the share of evaluated sessions
 *           where the behavioral-signature signal fired before the hard cap,
 *           the precision of those firings, offer outcomes, shadow firings
 *           (the Stage 7 kill switch) and the split by persona. DIAGNOSTIC —
 *           no fixed target; it establishes the baseline.
 *
 * Reads only; writes nothing; costs nothing (no model call). Operator tool,
 * same posture as `tutor:integrity-report`:
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npm run tutor:session-end-report -- [--since=YYYY-MM-DD] [--json]
 *
 * Exit code 1 on a closing-script defect; "insufficient data" is printed,
 * never passed off as healthy. Every threshold is provisional — see
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */

import { serviceRest } from '../services/supabaseRest.js';
import { pct } from '../services/pedagogy/mentorIntegrity.js';
import {
  summarizeClosingAccuracy,
  summarizeTriggerRate,
  type ClosedSessionRow,
  type SignalEventRow,
} from '../services/pedagogy/sessionEnd.js';

const PAGE = 1000;
const MAX_ROWS = 200_000;

/** Reads every row of a window, paginated. Null on ANY failed page (§1.14: never a partial report). */
async function readAll<T>(path: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await serviceRest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    if (page === null) return null;
    out.push(...page);
    if (page.length < PAGE) return out;
  }
  return out;
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 30 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');

  const [sessions, events] = await Promise.all([
    readAll<ClosedSessionRow>(
      `/tutor_sessions?select=id,character,close_reason,closing_script,opening,end_signal_evaluated` +
        `&ended_at=gte.${since.toISOString()}&order=ended_at.asc`,
    ),
    readAll<SignalEventRow>(
      `/tutor_session_end_signal?select=session_id,character,remaining_ms,mode,outcome,confirmed` +
        `&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
  ]);
  if (sessions === null) throw new Error('could not read tutor_sessions — refusing to report on an unanswered query');
  if (events === null) {
    throw new Error('could not read tutor_session_end_signal — refusing to report on an unanswered query');
  }

  const closing = summarizeClosingAccuracy(sessions);
  const signal = summarizeTriggerRate(sessions, events);
  const defects = closing.defects;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, closing, signal, defects }, null, 2));
  } else {
    console.log(`\ntutor:session-end-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    console.log('\nC.16 Session-Closing Script Accuracy (target 100%)');
    console.log(`  ${pct(closing.accuracy)} of ${closing.recorded} recorded close(s) — ${closing.status}`);
    for (const m of closing.mismatches.slice(0, 20)) {
      console.log(`    ${m.sessionId}: closed '${m.closeReason}' with the '${m.closingScript}' script`);
    }
    const openings = Object.entries(closing.openings)
      .map(([opening, n]) => `${opening}:${n}`)
      .join(' ');
    console.log(`  openings delivered: ${openings || '(none recorded)'}`);
    console.log('\nC.8/C.12 Early-Warning Signal Trigger Rate (diagnostic)');
    console.log(
      `  fired before the hard cap in ${pct(signal.triggerRate)} of ${signal.evaluatedSessions} evaluated session(s) — ${signal.triggerStatus}`,
    );
    console.log(
      `  precision ${pct(signal.precision)} (${signal.confirmedFirings}/${signal.labelledFirings} labelled firing(s)) — ${signal.precisionStatus}`,
    );
    const offers = Object.entries(signal.offers)
      .map(([outcome, n]) => `${outcome}:${n}`)
      .join(' ');
    console.log(`  offers: ${offers || '(none)'}; shadow firings: ${signal.shadowFirings}`);
    for (const [character, p] of Object.entries(signal.byPersona)) {
      console.log(`  ${character.padEnd(6)} ${p.fired}/${p.evaluated}`);
    }
    console.log(defects.length === 0 ? '\nNo defects.' : `\nDEFECTS (${defects.length}):\n  - ${defects.join('\n  - ')}`);
  }
  if (defects.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
