#!/usr/bin/env node
/*
 * `npm run tutor:spaced-review-report` — the monitor for Product C.11 (the
 * two-tier spaced review), Appendix F §1.1 "Spaced-Review Routing Accuracy"
 * and the router's Part 3 Stage 7 rollback.
 *
 *   Routing picture   tiers, reasons and outcomes of every recorded routing
 *                     decision in the window; the share of within-session
 *                     routings retired in-session versus handed off.
 *   Routing Accuracy  every recorded decision RE-EVALUATED against the
 *                     Appendix D §2.4 rule from its recorded inputs (a
 *                     mismatch is a misroute, and a defect), plus the
 *                     systematic pattern check (within-session routings that
 *                     mostly never got their re-check before the session
 *                     ended).
 *   Quarterly audit   `--sample=N [--seed=...]` draws a REPRODUCIBLE,
 *                     tier-stratified sample for the human spot check (the
 *                     same seed draws the same rows); after reading it the
 *                     auditor records the result with
 *                     `--record-audit="what was found" --seed=... --sampled=N --misroutes=K`.
 *                     The report is a defect when the router has more than a
 *                     quarter of history and no audit was recorded within the
 *                     cadence (99 days).
 *   Stage 7           the Kill-Switch Trigger Log.
 *
 * Reads only, except `--record-audit` and `--resolve="root cause"` (records an
 * operator's resolution of a trip in force, lifting the rollback for new
 * sessions). No model call; costs nothing. Operator tool:
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run tutor:spaced-review-report -- [--since=YYYY-MM-DD] [--json] [--markdown]
 *       [--sample=N --seed=S] [--record-audit="..." --seed=S --sampled=N --misroutes=K] [--resolve="..."]
 *
 * Exit code 1 on a defect; "insufficient data" is printed, never passed off
 * as healthy. Every threshold is provisional — see
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */

import { serviceRest } from '../services/supabaseRest.js';
import { pct } from '../services/pedagogy/mentorIntegrity.js';
import {
  drawAuditSample,
  recordRoutingAudit,
  resolveSpacedReviewKillSwitch,
  ROUTING_AUDIT_CADENCE_DAYS,
  ROUTING_AUDIT_RECORDED,
  ROUTING_SELECT,
  routingAuditCadence,
  SPACED_REVIEW_KILL_SWITCH_RESOLVED,
  SPACED_REVIEW_KILL_SWITCH_TRIGGERED,
  spacedReviewKillSwitchLog,
  summarizeRouting,
  type RoutingRow,
} from '../services/pedagogy/spacedReview.js';

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

function intArg(name: string): number | null {
  const raw = arg(name);
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10_000) throw new Error(`--${name} must be a whole number between 0 and 10000`);
  return n;
}

async function main(): Promise<void> {
  const resolution = arg('resolve');
  if (resolution !== null) {
    if (resolution.trim().length < 10) throw new Error('--resolve needs the root cause in words (at least 10 characters)');
    if (!(await resolveSpacedReviewKillSwitch(resolution.trim()))) {
      throw new Error('the resolution row did NOT land in audit_logs — the rollback is still in force');
    }
    console.log('Recorded the resolution. New sessions route and re-check again within the kill-switch cache window (10 minutes).');
    return;
  }
  const auditNote = arg('record-audit');
  if (auditNote !== null) {
    const seed = arg('seed');
    const sampled = intArg('sampled');
    const misroutes = intArg('misroutes');
    if (auditNote.trim().length < 10 || seed === null || sampled === null || misroutes === null) {
      throw new Error('--record-audit needs the finding in words (10+ characters), --seed, --sampled and --misroutes');
    }
    if (!(await recordRoutingAudit({ seed, sampled, misroutesFound: misroutes, note: auditNote.trim() }))) {
      throw new Error('the audit row did NOT land in audit_logs — the quarterly audit is NOT recorded');
    }
    console.log(`Recorded the quarterly routing audit (seed ${seed}, ${sampled} decision(s) read, ${misroutes} misroute(s)).`);
    return;
  }

  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 92 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');

  const [rows, trips, audits, oldest] = await Promise.all([
    readAll<RoutingRow>(`/tutor_review_routing?select=${ROUTING_SELECT}&created_at=gte.${since.toISOString()}&order=created_at.asc`),
    readAll<{ action: string; created_at: string; detail: Record<string, unknown> | null }>(
      `/audit_logs?select=action,created_at,detail&action=in.(${SPACED_REVIEW_KILL_SWITCH_TRIGGERED},${SPACED_REVIEW_KILL_SWITCH_RESOLVED})&order=created_at.asc`,
    ),
    serviceRest<{ created_at: string; detail: Record<string, unknown> | null }[]>(
      `/audit_logs?select=created_at,detail&action=eq.${ROUTING_AUDIT_RECORDED}&order=created_at.desc&limit=1`,
    ),
    serviceRest<{ created_at: string }[]>('/tutor_review_routing?select=created_at&order=created_at.asc&limit=1'),
  ]);
  if (rows === null) throw new Error('could not read tutor_review_routing — refusing to report on an unanswered query');
  if (trips === null || audits === null) throw new Error('could not read audit_logs — refusing to report on an unanswered query');
  if (oldest === null) throw new Error('could not read the routing history start — refusing to report');

  const summary = summarizeRouting(rows);
  const log = spacedReviewKillSwitchLog(trips);
  const inForce = log.length > 0 && log[log.length - 1]!.resolvedAt === null;
  const cadence = routingAuditCadence(audits[0]?.created_at ?? null, oldest[0]?.created_at ?? null, now);
  const sampleSize = intArg('sample');
  const seed = arg('seed') ?? `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  const sample = sampleSize === null ? null : drawAuditSample(rows, sampleSize, seed);
  const defects = [
    ...summary.findings,
    ...(cadence.overdue ? [`the quarterly routing spot check is overdue (last recorded ${cadence.daysSinceAudit ?? 'never'} day(s) ago, cadence ${ROUTING_AUDIT_CADENCE_DAYS})`] : []),
  ];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, summary, audit: { ...cadence, last: audits[0] ?? null, seed, sample }, killSwitch: { inForce, log }, defects }, null, 2));
  } else {
    const md = process.argv.includes('--markdown');
    const h = (text: string) => console.log(md ? `\n#### ${text}` : `\n${text}`);
    console.log(`${md ? '### ' : '\n'}tutor:spaced-review-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    h('C.11 routing picture');
    console.log(`  ${summary.decisions} decision(s) — ${summary.status}`);
    console.log(`  tiers: ${Object.entries(summary.byTier).map(([k, n]) => `${k}:${n}`).join(' ') || '(none)'}`);
    console.log(`  reasons: ${Object.entries(summary.byReason).map(([k, n]) => `${k}:${n}`).join(' ') || '(none)'}`);
    console.log(`  outcomes: ${Object.entries(summary.byOutcome).map(([k, n]) => `${k}:${n}`).join(' ') || '(none)'}`);
    console.log(
      `  within-session (act, final): ${summary.withinFinal} — retired in-session ${pct(summary.retiredShare)}, never re-checked before the end ${pct(summary.undeliveredShare)}`,
    );
    h('Appendix F Spaced-Review Routing Accuracy (target: no systematic misrouting)');
    console.log(`  rule reproduced ${pct(summary.compliance.rate)} of ${summary.compliance.evaluated} recorded decision(s)`);
    for (const m of summary.compliance.mismatches.slice(0, 20)) {
      console.log(`  MISROUTE session ${m.sessionId ?? '(purged)'} #${m.observation}: recorded ${m.recorded}, rule says ${m.rule}`);
    }
    h(`Quarterly human spot check (cadence ${ROUTING_AUDIT_CADENCE_DAYS} days)`);
    console.log(
      `  last recorded: ${audits[0]?.created_at ?? 'never'}${cadence.overdue ? ' — OVERDUE' : ''}`,
    );
    if (sample !== null) {
      console.log(`  sample (seed ${seed}, ${sample.length} decision(s)); read each against Appendix D §2.4, then record the result:`);
      for (const r of sample) {
        console.log(
          `  - ${r.session_id ?? '(purged)'} #${r.observation} ${r.tier}/${r.reason} → ${r.outcome}; P(L) before ${Number(r.p_before).toFixed(2)}, ` +
            `${r.turns_remaining} turn(s) and ${Math.round(r.ms_until_wrap / 60_000)} min to wrap-up, ${r.budget_state}, re-exposures ${r.reexposures_before}, queued ${r.queued_before}, planned ${r.planned}`,
        );
      }
      console.log(`  npm run tutor:spaced-review-report -- --record-audit="<what you found>" --seed=${seed} --sampled=${sample.length} --misroutes=<count>`);
    }
    h('Stage 7 spaced-review router Kill-Switch Trigger Log');
    if (log.length === 0) console.log('  no automatic rollback recorded');
    for (const entry of log) {
      console.log(
        `  ${entry.triggeredAt} ${entry.causes.join(', ')} — ${entry.resolvedAt === null ? 'IN FORCE (routing recorded, no re-checks, no hand-offs)' : `resolved after ${entry.resolutionHours!.toFixed(1)} h`}`,
      );
    }
    console.log(defects.length === 0 ? '\nNo defects.' : `\nDEFECTS (${defects.length}):\n  - ${defects.join('\n  - ')}`);
  }
  if (defects.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
