#!/usr/bin/env node
/*
 * `npm run tutor:live-content-report` — Product C.5 and C.6, read by a human.
 *
 * Read-only by default (no model call, zero spend). It prints:
 *   - the judge's calibration (state, age, model, agreement per category)
 *   - per content-risk category: the current staff-sampling rate (baseline
 *     or elevated, and how many clean decisions restore the baseline),
 *     whether live generation is suspended and why, the Judge
 *     Approval-Quality Concordance Rate, the review coverage against the
 *     Appendix E floor, and the backlog past the review SLA
 *   - the content ladder (C.6): the share of served activities per rung, the
 *     weekly live share (it must fall as curated packs land), and the unmet
 *     demand ranked by request pattern — the next packs to author
 *   - the Kill-Switch Trigger Log for the live-content judge
 * It exits 1 when something needs a human (a suspension, an uncalibrated or
 * stale judge, a row below the floor, an overdue backlog).
 *
 * Operator writes (service role; each prints what it did):
 *   --resolve=<standard|sensitive>:<concordance_below_floor|review_rate_below_floor> --note="…"
 *       closes a Stage 7 trip. Refused while the condition still holds, and a
 *       concordance trip only after a PASSED calibration recorded after it.
 *   --record-calibration=<file> --recorded-by="…" --note="…"
 *       records a judge calibration run produced by
 *       `npm --prefix oracle run content-judge:calibrate` (Appendix E
 *       §2.1/§3.2). Core recomputes every number from the raw verdicts and
 *       labels and REFUSES a dry run, a replay, or ratings not from the human
 *       panel.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { serviceRest } from '../services/supabaseRest.js';
import {
  computeCalibration,
  concordance,
  getLiveContentGate,
  LIVE_CONTENT_KILL_SWITCH_RESOLVED,
  LIVE_CONTENT_KILL_SWITCH_TRIGGERED,
  LIVE_CONTENT_THRESHOLDS,
  liveContentKillSwitchLog,
  recordJudgeCalibration,
  resolveLiveContentKillSwitch,
  reviewCoverage,
  RISK_CATEGORIES,
  summarizeLadder,
  summarizeLiveLog,
  type CalibrationInput,
  type LadderEventRow,
  type LiveLogRow,
} from '../services/pedagogy/liveContentGovernance.js';
import { canonicalJson } from '../services/tutorPacks.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);

/** The seed-set hash is recomputed here from the items, never taken from the file. */
export function seedSetHash(items: unknown[]): string {
  return createHash('sha256').update(canonicalJson(items)).digest('hex');
}

export interface CalibrationFile {
  seedSet: { version: string; items: { id: string; category: 'standard' | 'sensitive'; [k: string]: unknown }[] };
  ratings: CalibrationInput['ratings'];
  judge: CalibrationInput['judge'];
}

export function calibrationInputFrom(file: CalibrationFile): CalibrationInput {
  return {
    seedSet: {
      version: file.seedSet.version,
      hash: seedSetHash(file.seedSet.items),
      // The judged text's length feeds the verbosity-bias check (C.23).
      items: file.seedSet.items.map((i) => ({ id: i.id, category: i.category, length: JSON.stringify(i.segment ?? i).length })),
    },
    ratings: file.ratings,
    judge: file.judge,
  };
}

async function recordCalibration(path: string): Promise<number> {
  const recordedBy = arg('recorded-by');
  const note = arg('note');
  if (!recordedBy || !note || note.trim().length < 10) {
    console.error('--record-calibration needs --recorded-by="<who>" and --note="<what was run, 10+ characters>"');
    return 2;
  }
  const file = JSON.parse(readFileSync(path, 'utf8')) as CalibrationFile;
  const input = calibrationInputFrom(file);
  const result = computeCalibration(input);
  console.log(`Seed set ${input.seedSet.version} (${input.seedSet.hash.slice(0, 12)}), ${file.ratings.length} rater(s), judge ${input.judge.model} (${input.judge.mode})`);
  const g = result.general;
  console.log(`  inter-rater agreement ${pct(result.interRater)} (≥ ${pct(g.thresholds.interRater)}), Fleiss kappa ${g.interRaterKappa.toFixed(3)} (≥ ${g.thresholds.interRaterKappa})`);
  console.log(
    `  judge kappa ${g.strata[0]?.questionKappa.toFixed(3) ?? 'n/a'} (≥ ${g.thresholds.judgeKappa}); length-bias gap ${g.lengthBiasGap === null ? 'n/a' : pct(g.lengthBiasGap)}; judge family ${g.judgeFamily}, author family ${g.authorFamily}`,
  );
  if (g.failureReasons.length > 0) console.log(`  failure reasons: ${g.failureReasons.join(', ')}`);
  console.log(`  standard  ${result.itemsStandard} items, judge-human agreement ${pct(result.agreementStandard)}`);
  console.log(`  sensitive ${result.itemsSensitive} items, judge-human agreement ${pct(result.agreementSensitive)}`);
  for (const d of result.disagreements.slice(0, 20)) console.log(`  disagreement ${d.id} (${d.category}): human ${d.human}, judge ${d.judge}`);
  if (!result.recordable) {
    console.error('\nNOT RECORDED:');
    for (const r of result.refusals) console.error(`  - ${r}`);
    return 1;
  }
  const outcome = await recordJudgeCalibration({
    result,
    seedSet: input.seedSet,
    judge: input.judge,
    recordedBy: recordedBy.trim(),
    note: note.trim(),
  });
  if (!outcome.ok) {
    console.error(`The calibration row did not land: ${outcome.why}`);
    return 1;
  }
  console.log(`\nRecorded calibration ${outcome.id}: ${result.verdict.toUpperCase()}.`);
  return result.verdict === 'passed' ? 0 : 1;
}

async function resolve(spec: string): Promise<number> {
  const [category, cause] = spec.split(':');
  const note = arg('note');
  if ((category !== 'standard' && category !== 'sensitive') ||
    (cause !== 'concordance_below_floor' && cause !== 'review_rate_below_floor') || !note || note.trim().length < 10) {
    console.error('--resolve=<standard|sensitive>:<concordance_below_floor|review_rate_below_floor> --note="<root cause, 10+ characters>"');
    return 2;
  }
  const result = await resolveLiveContentKillSwitch({ category, cause, note: note.trim() });
  if (!result.ok) {
    console.error(`Not resolved: ${result.why}`);
    return 1;
  }
  console.log(`Resolved the ${cause} trip for ${category}.`);
  return 0;
}

async function report(): Promise<number> {
  const now = new Date();
  const t = LIVE_CONTENT_THRESHOLDS;
  const gate = await getLiveContentGate(now);
  if (gate.degraded) {
    console.error('Could not read the live-content governance state.');
    return 1;
  }
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const [log, ladder, audit] = await Promise.all([
    serviceRest<LiveLogRow[]>(
      `/tutor_live_content_log?created_at=gte.${encodeURIComponent(since)}&select=risk_category,sampled,sample_rate,elevated,review_verdict,review_issue,reviewed_at,calibration_id,segment_type,created_at&order=created_at.desc&limit=50000`,
    ),
    serviceRest<LadderEventRow[]>(
      `/tutor_content_ladder_events?created_at=gte.${encodeURIComponent(since)}&select=outcome,route,kc_id,skill_key,tier,locale,reason,created_at&order=created_at.desc&limit=50000`,
    ),
    serviceRest<{ action: string; created_at: string; detail: Record<string, unknown> | null }[]>(
      `/audit_logs?action=in.(${LIVE_CONTENT_KILL_SWITCH_TRIGGERED},${LIVE_CONTENT_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=500`,
    ),
  ]);
  if (log === null || ladder === null || audit === null) {
    console.error('Could not read the live-content log, the ladder events or the audit log.');
    return 1;
  }

  let defects = 0;
  const flag = (line: string) => {
    defects += 1;
    console.log(`  DEFECT ${line}`);
  };

  console.log('LIVE-GENERATION CONTENT JUDGE (C.5, Appendix E §3.1.1)');
  const cal = gate.calibration;
  console.log(
    `  calibration: ${cal.state}${cal.row ? ` — ${cal.row.judge_model}, seed ${cal.row.seed_set_version}, ${cal.ageDays} day(s) since verified (per-stratum detail: npm run tutor:judge-calibration -- --status)` : ''}`,
  );
  if (cal.state !== 'passed') flag(`the judge is ${cal.state}: live generation is suspended for every category until a passed calibration is recorded (owner-run, OD-23)`);
  if (gate.ignoredBaselines.length > 0) flag(`configured baseline below the floor ignored for ${gate.ignoredBaselines.join(', ')}`);

  const summaries = summarizeLiveLog(log, now);
  for (const category of RISK_CATEGORIES) {
    const entry = gate.categories[category];
    const s = summaries.find((x) => x.category === category)!;
    const current = cal.row ? log.filter((r) => r.risk_category === category && r.calibration_id === cal.row!.id && r.reviewed_at !== null) : [];
    const conc = concordance(current.slice(0, t.concordanceWindow));
    const from = now.getTime() - t.reviewWindowDays * 86_400_000;
    const to = now.getTime() - t.reviewSlaDays * 86_400_000;
    const coverage = reviewCoverage(category, log.filter((r) => r.risk_category === category && Date.parse(r.created_at) >= from && Date.parse(r.created_at) < to));
    console.log(`\n  [${category}] ${entry.suspended ? `SUSPENDED (${entry.reasons.join(', ')})` : 'open'}`);
    console.log(`    sampling rate ${pct(entry.sampling.rate)} (baseline ${pct(entry.sampling.baseline)}${entry.sampling.elevated ? `, ELEVATED — ${entry.sampling.decisionsToRestore} clean decision(s) to restore` : ''})`);
    console.log(`    last 90 days: ${s.served} served, ${s.sampled} sampled, ${s.decided} decided (${s.approved} approved, ${s.rejectedQuality} quality, ${s.rejectedSafety} safety, ${s.rejectedUnclassified} unclassified rejections)`);
    console.log(`    judge approval-quality concordance ${pct(conc.rate)} over ${conc.decided} decision(s) (floor ${pct(t.concordanceFloor)}${conc.rate === null ? ', insufficient data' : ''})`);
    console.log(`    review coverage ${coverage.reviewed}/${coverage.served} (required ${coverage.required}${coverage.share === null ? ', insufficient data' : ''})`);
    if (s.backlogPastSla > 0) flag(`${category}: ${s.backlogPastSla} sampled item(s) undecided past the ${t.reviewSlaDays}-day SLA`);
    if (s.belowFloorRows > 0) flag(`${category}: ${s.belowFloorRows} row(s) sampled below the floor`);
    if (entry.reasons.some((r) => r === 'concordance_below_floor' || r === 'review_rate_below_floor')) flag(`${category}: Stage 7 suspension in force`);
  }

  const l = summarizeLadder(ladder);
  console.log('\nCONTENT LADDER (C.6), last 90 days');
  console.log(`  served ${l.served}: catalog ${pct(l.catalogShare)}, curated packs ${pct(l.bankShare)}, live ${pct(l.liveShare)}; ${l.refusals} live candidate(s) refused`);
  for (const w of l.weekly.slice(-8)) console.log(`    week of ${w.week}: ${w.served} served, live ${pct(w.served === 0 ? null : w.live / w.served)}`);
  console.log('  unmet demand (fell through to live generation or found it suspended), top 15:');
  for (const d of l.unmetDemand.slice(0, 15)) console.log(`    ${d.pattern}  ${d.invitations} invitation(s), ${d.suspended} suspended`);

  console.log('\nKILL-SWITCH TRIGGER LOG (Appendix F §1.3)');
  const trips = liveContentKillSwitchLog(audit);
  if (trips.length === 0) console.log('  none');
  for (const trip of trips) {
    console.log(`  ${trip.triggeredAt} ${trip.category} ${trip.cause} → ${trip.resolvedAt ? `resolved after ${trip.resolutionHours?.toFixed(1)} h` : 'OPEN'}`);
  }
  console.log(defects === 0 ? '\nOK' : `\n${defects} item(s) need a human.`);
  return defects === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const calibration = arg('record-calibration');
  const resolveSpec = arg('resolve');
  const code = calibration ? await recordCalibration(calibration) : resolveSpec ? await resolve(resolveSpec) : await report();
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
