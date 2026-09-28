/*
 * Product C.21 + C.24: THE CONTINUOUS EVALUATION LOOP (Appendix E §3.1 Tier 3).
 *
 * One pass, run hourly by `.github/workflows/mentor-evaluation-loop.yml`
 * through Core's internal route (`POST /api/v1/tutor/internal/evaluation/run`)
 * or by an operator (`npm --prefix backend run tutor:evaluate`):
 *
 *   1. SCORE. Every ended session not yet scored (oldest first, after a short
 *      grace so its close writes have landed) is scored against the rubric by
 *      the deterministic scorer, and the rows land in `tutor_transcript_score`
 *      with the rubric hash. The session is then stamped
 *      (`tutor_sessions.evaluation_rubric_hash`): that stamp is the Evaluation
 *      Pipeline Coverage numerator. Scoring happens well inside the 90-day
 *      transcript retention, and the scores keep no text and no learner id,
 *      so they outlive the conversation without keeping anything about the child.
 *   2. MEASURE. Every consolidated signal (`mentorQuality.ts`) is computed
 *      from the source tables over the current window.
 *   3. FLAG. Each anomaly opens a flag assigned to the signal's owner role,
 *      or refreshes the flag already open for it. Flags are never closed by
 *      the machine: a named owner acknowledges and resolves them in words.
 *   4. RECORD. The readings are stored as a snapshot and the pass as a run
 *      row, which is how the dashboard proves its own freshness.
 *
 * FAIL CLOSED, NEVER PARTIAL. A session whose rows cannot all be read is not
 * scored (a missing honesty ledger would read as a clean session); a signal
 * whose source cannot be read is `unavailable` and opens a flag, never a
 * reassuring zero (AGENTS.md §1.14). No model call: zero spend (OD-23).
 */

import { countServiceRows, serviceRest, serviceRestRaw } from '../supabaseRest.js';
import { getLiveContentGate, resetLiveContentGateCache, RISK_CATEGORIES } from './liveContentGovernance.js';
import { readCalibrationRows } from './judgeCalibration.js';
import { MENTOR_INTEGRITY_THRESHOLDS, type TrajectoryEvidenceRow } from './mentorIntegrity.js';
import { DISPOSITION_THRESHOLDS } from './disposition.js';
import { ROUTING_SELECT, type RoutingRow } from './spacedReview.js';
import { readCalibrationOutcomes } from './dialogueCalibration.js';
import type { AllianceSessionRow, RenegotiationRow } from './alliance.js';
import type { LadderEventRow } from './liveContentGovernance.js';
import type { SignalEventRow } from './sessionEnd.js';
import { scoreSession, type ScoringHonestyRow, type SessionBundle } from './transcriptScoring.js';
import { TRANSCRIPT_RUBRIC_HASH, TRANSCRIPT_RUBRIC_VERSION } from './transcriptRubric.js';
import {
  dedupKey,
  evaluateSignals,
  MENTOR_QUALITY_THRESHOLDS as T,
  type Anomaly,
  type AuditRow,
  type FiringRow,
  type KcAttemptRow,
  type QualitySources,
  type ScoreRow,
  type SignalReading,
  type WindowSessionRow,
} from './mentorQuality.js';

const PAGE = 1000;
const MAX_ROWS = 200_000;
const DAY = 86_400_000;
export const SNAPSHOT_SCHEMA = 'mentor-quality.v1';

/** Retention of the loop's own artifacts (no personal data; kept for trends). */
export const EVALUATION_RETENTION = { scoreDays: 400, snapshotDays: 90, runDays: 400 } as const;

/** Every row of a query, paginated; null on ANY failed page (never a partial read). */
export async function readAll<T>(path: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await serviceRest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    if (page === null || !Array.isArray(page)) return null;
    out.push(...page);
    if (page.length < PAGE) return out;
  }
  return out;
}

const iso = (d: Date) => encodeURIComponent(d.toISOString());

// ── 1. Scoring ──────────────────────────────────────────────────────────────

interface BacklogSession {
  id: string;
  character: string;
  tier: number;
  locale: string;
  close_reason: string | null;
  closing_script: string | null;
  ended_at: string;
}

/** Loads every row the scorer needs for a batch of sessions; null if any read fails. */
export async function loadBundles(sessions: BacklogSession[]): Promise<SessionBundle[] | null> {
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id).join(',');
  const [turns, honesty, firings, alliance, explanations, dialogue] = await Promise.all([
    readAll<{ session_id: string; seq: number; speaker: 'learner' | 'tutor' | 'system'; text: string; source: string }>(
      `/tutor_turns?select=session_id,seq,speaker,text,source&session_id=in.(${ids})&order=session_id.asc,seq.asc`,
    ),
    readAll<ScoringHonestyRow>(
      `/tutor_turn_honesty?select=session_id,character,turn_seq,sequence_kind,hint_level,reveal_sanctioned,reveal_key_match,reveal_self_answered,reveal_phrase,false_affirmation_caught,false_affirmation_delivered,praise&session_id=in.(${ids})&order=turn_seq.asc`,
    ),
    readAll<{ session_id: string; mode: string; outcome: string }>(`/tutor_telemetry_firing?select=session_id,mode,outcome&session_id=in.(${ids})&order=observation.asc`),
    readAll<{ session_id: string; learner_turns: number; goal_agreement: string }>(`/tutor_session_alliance?select=session_id,learner_turns,goal_agreement&session_id=in.(${ids})&order=session_id.asc`),
    readAll<{ session_id: string; mode: string; first_quality: string | null }>(`/tutor_self_explanation_event?select=session_id,mode,first_quality&session_id=in.(${ids})&order=observation.asc`),
    readAll<{ session_id: string; variant: string | null; band: string | null; controlling_delivered: number | null }>(
      `/tutor_dialogue_calibration?select=session_id,variant,band,controlling_delivered&session_id=in.(${ids})&order=session_id.asc`,
    ),
  ]);
  if (!turns || !honesty || !firings || !alliance || !explanations || !dialogue) return null;
  return sessions.map((s) => ({
    session: s,
    turns: turns.filter((t) => t.session_id === s.id).map(({ seq, speaker, text, source }) => ({ seq, speaker, text, source })),
    honesty: honesty.filter((h) => h.session_id === s.id),
    firings: firings.filter((f) => f.session_id === s.id),
    alliance: alliance.find((a) => a.session_id === s.id) ?? null,
    selfExplanation: explanations.filter((e) => e.session_id === s.id),
    dialogue: dialogue.find((d) => d.session_id === s.id) ?? null,
  }));
}

export interface ScoringResult {
  scored: number;
  failed: number;
  backlogBefore: number | null;
  rows: number;
}

export async function scoreBacklog(opts: { now: Date; limit: number; batchSize?: number; dryRun?: boolean }): Promise<ScoringResult> {
  const due = new Date(opts.now.getTime() - T.scoringGraceMinutes * 60_000);
  const filter = `ended_at=not.is.null&ended_at=lte.${iso(due)}&evaluation_rubric_hash=is.null&turn_count=gt.0`;
  const backlogBefore = await countServiceRows(`/tutor_sessions?${filter}&select=id`);
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 50, 200));
  const result: ScoringResult = { scored: 0, failed: 0, backlogBefore, rows: 0 };
  const skip = new Set<string>();
  while (result.scored + result.failed < opts.limit) {
    const take = Math.min(batchSize, opts.limit - result.scored - result.failed);
    const batch = await serviceRest<BacklogSession[]>(
      `/tutor_sessions?select=id,character,tier,locale,close_reason,closing_script,ended_at&${filter}` +
        (skip.size > 0 ? `&id=not.in.(${[...skip].join(',')})` : '') +
        `&order=ended_at.asc&limit=${take}`,
    );
    if (batch === null || !Array.isArray(batch)) {
      result.failed += 1;
      break;
    }
    if (batch.length === 0) break;
    const bundles = await loadBundles(batch);
    if (bundles === null) {
      // Could not read everything: score nothing from this batch, try again next pass.
      result.failed += batch.length;
      break;
    }
    const rows = bundles.flatMap((b) =>
      scoreSession(b).map((s) => ({
        session_id: b.session.id,
        character: b.session.character,
        tier: b.session.tier,
        locale: b.session.locale,
        rubric_version: TRANSCRIPT_RUBRIC_VERSION,
        rubric_hash: TRANSCRIPT_RUBRIC_HASH,
        scorer: 'rules',
        criterion: s.criterion,
        outcome: s.outcome,
        numerator: s.numerator,
        denominator: s.denominator,
        session_ended_at: b.session.ended_at,
      })),
    );
    if (opts.dryRun) {
      result.scored += batch.length;
      result.rows += rows.length;
      for (const s of batch) skip.add(s.id);
      continue;
    }
    const inserted = await serviceRest<unknown>('/tutor_transcript_score?on_conflict=session_id,scorer,rubric_hash,criterion', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    if (inserted === null) {
      result.failed += batch.length;
      break;
    }
    const stamped = await serviceRest<unknown>(`/tutor_sessions?id=in.(${batch.map((s) => s.id).join(',')})&evaluation_rubric_hash=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ evaluation_rubric_hash: TRANSCRIPT_RUBRIC_HASH }),
    });
    if (stamped === null) {
      // The scores landed (idempotent); the stamp did not. Retried next pass.
      result.failed += batch.length;
      break;
    }
    result.scored += batch.length;
    result.rows += rows.length;
    if (batch.length < take) break;
  }
  return result;
}

// ── 2. The sources of every consolidated signal ─────────────────────────────

export async function collectSources(now: Date): Promise<QualitySources> {
  const since = new Date(now.getTime() - T.windowDays * DAY);
  const priorSince = new Date(since.getTime() - T.windowDays * DAY);
  const baselineSince = new Date(since.getTime() - T.bondBaselineDays * DAY);
  const trajectorySince = new Date(since.getTime() - MENTOR_INTEGRITY_THRESHOLDS.masteryReversalWindowDays * DAY);
  const currentProfiles = new Date(now.getTime() - DISPOSITION_THRESHOLDS.currentDays * DAY);
  const scoreCols = 'session_id,character,tier,locale,criterion,outcome,numerator,denominator,session_ended_at';
  const hash = TRANSCRIPT_RUBRIC_HASH;

  resetLiveContentGateCache();
  const [
    sessions, scores, priorScores, firings, endSignals, alliance, allianceBaseline, renegotiations,
    trajectory, routing, dialogue, ladder, gate, killSwitchAudit, activeRows, profiles, kcAttempts, retention, judgeCalibrations, transfer,
  ] = await Promise.all([
    readAll<WindowSessionRow>(
      `/tutor_sessions?select=id,character,tier,locale,ended_at,turn_count,evaluation_rubric_hash,close_reason,closing_script,opening,end_signal_evaluated,telemetry_mode,telemetry_evaluated_turns,telemetry_action_turns` +
        `&ended_at=gte.${iso(since)}&order=ended_at.asc`,
    ),
    readAll<ScoreRow>(`/tutor_transcript_score?select=${scoreCols}&rubric_hash=eq.${hash}&scorer=eq.rules&session_ended_at=gte.${iso(since)}&order=session_ended_at.asc`),
    readAll<ScoreRow>(
      `/tutor_transcript_score?select=${scoreCols}&rubric_hash=eq.${hash}&scorer=eq.rules&session_ended_at=gte.${iso(priorSince)}&session_ended_at=lt.${iso(since)}&order=session_ended_at.asc`,
    ),
    readAll<FiringRow>(`/tutor_telemetry_firing?select=session_id,character,mode,outcome&created_at=gte.${iso(since)}&order=created_at.asc`),
    readAll<SignalEventRow>(`/tutor_session_end_signal?select=session_id,character,remaining_ms,mode,outcome,confirmed&created_at=gte.${iso(since)}&order=created_at.asc`),
    readAll<AllianceSessionRow>(
      `/tutor_session_alliance?select=character,mode,continuity,continuity_move,goal_agreement,learner_turns,adaptation_offers,adaptation_declines,bond_specific_turns,bond_generic_turns,bond_proxy,bond_proxy_at,created_at&created_at=gte.${iso(since)}&order=created_at.asc`,
    ),
    readAll<AllianceSessionRow>(
      `/tutor_session_alliance?select=character,mode,continuity,continuity_move,goal_agreement,learner_turns,adaptation_offers,adaptation_declines,bond_specific_turns,bond_generic_turns,bond_proxy,bond_proxy_at,created_at&created_at=gte.${iso(baselineSince)}&created_at=lt.${iso(since)}&order=created_at.asc`,
    ),
    readAll<RenegotiationRow>(`/tutor_alliance_renegotiation?select=character,mode,outcome,improved,created_at&created_at=gte.${iso(since)}&order=created_at.asc`),
    readAll<TrajectoryEvidenceRow>(
      `/tutor_trajectory_step?select=user_id,kc_id,strategy,strategy_before,evidence_rule,evidence_observations,evidence_required,mastery_revoked,created_at&created_at=gte.${iso(trajectorySince)}&order=created_at.asc`,
    ),
    readAll<RoutingRow>(`/tutor_review_routing?select=${ROUTING_SELECT}&created_at=gte.${iso(since)}&order=created_at.asc`),
    readCalibrationOutcomes(since),
    readAll<LadderEventRow>(`/tutor_content_ladder_events?select=outcome,route,kc_id,skill_key,tier,locale,reason,created_at&created_at=gte.${iso(since)}&order=created_at.asc`),
    getLiveContentGate(now),
    readAll<AuditRow>(`/audit_logs?select=action,created_at,detail&action=like.mentor.kill_switch.*&order=created_at.asc`),
    readAll<{ user_id: string }>(`/tutor_sessions?select=user_id&started_at=gte.${iso(currentProfiles)}&order=started_at.asc`),
    countServiceRows(`/learner_disposition_profile?updated_at=gte.${iso(currentProfiles)}&select=user_id`),
    readAll<KcAttemptRow>(`/kc_attempt?select=user_id,kc_id,correct,p_known_after,created_at&source=eq.segment_grade&created_at=gte.${iso(since)}&order=created_at.asc`),
    serviceRest<{ bucket: string; n: number; avg_first_attempt_score: number }[]>('/rpc/admin_retention_at_distance', { method: 'POST', body: '{}' }),
    readCalibrationRows(),
    // GAP-FIX-R1 (Appendix C 1.1): v2 practice vs transfer first-try success (0195).
    serviceRest<{ kc: string; item_role: 'practice' | 'transfer'; first_attempts: number; successes: number }[]>('/rpc/learning_transfer_success', {
      method: 'POST', body: JSON.stringify({ p_since: iso(since), p_until: iso(now) }),
    }),
  ]);

  return {
    now,
    rubricHash: hash,
    sessions,
    scores,
    priorScores,
    firings,
    endSignals,
    alliance,
    allianceBaseline,
    renegotiations,
    trajectory,
    routing,
    dialogue: dialogue === null ? null : dialogue.rows,
    ladder,
    liveGate: gate.degraded
      ? null
      : {
          calibration: gate.calibration.state,
          suspended: RISK_CATEGORIES.filter((c) => gate.categories[c].suspended).map((c) => ({ category: c, reasons: [...gate.categories[c].reasons] })),
        },
    judgeCalibrations,
    killSwitchAudit,
    completeness: activeRows === null || profiles === null ? null : { active: new Set(activeRows.map((r) => r.user_id)).size, current: profiles },
    kcAttempts,
    retention: Array.isArray(retention) ? retention : null,
    transfer: Array.isArray(transfer) ? transfer.map((r) => ({ ...r, first_attempts: Number(r.first_attempts), successes: Number(r.successes) })) : null,
  };
}

// ── 3. Flags ────────────────────────────────────────────────────────────────

const clampMetric = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.max(-9999, Math.min(9999, Math.round(v * 10_000) / 10_000)));

export async function upsertFlags(anomalies: Anomaly[], now: Date): Promise<{ opened: number; refreshed: number; failed: number } | null> {
  const active = await readAll<{ id: string; dedup_key: string; seen_count: number }>(
    '/mentor_quality_flag?select=id,dedup_key,seen_count&status=in.(open,acknowledged)&order=opened_at.asc',
  );
  if (active === null) return null;
  const byKey = new Map(active.map((f) => [f.dedup_key, f]));
  const out = { opened: 0, refreshed: 0, failed: 0 };
  const seen = new Set<string>();
  for (const a of anomalies) {
    const key = dedupKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = byKey.get(key);
    if (existing) {
      const res = await serviceRest<unknown>(`/mentor_quality_flag?id=eq.${existing.id}&status=in.(open,acknowledged)`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_seen_at: now.toISOString(), seen_count: existing.seen_count + 1, metric_value: clampMetric(a.value) }),
      });
      if (res === null) out.failed += 1;
      else out.refreshed += 1;
      continue;
    }
    const res = await serviceRestRaw('/mentor_quality_flag', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        signal_id: a.signalId,
        kind: a.kind,
        requirement: a.requirement,
        owner_role: a.owner,
        severity: a.severity,
        dedup_key: key,
        scope: a.scope,
        metric_value: clampMetric(a.value),
        threshold: clampMetric(a.threshold),
        evidence: a.evidence,
        opened_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      }),
    });
    // A conflict on the one-active-flag-per-key index means a concurrent pass opened it: not a failure to hide, but not a new flag.
    if (res.ok) out.opened += 1;
    else out.failed += 1;
  }
  return out;
}

// ── 4. The pass ─────────────────────────────────────────────────────────────

export interface EvaluationPassResult {
  runId: string | null;
  snapshotId: string | null;
  rubricHash: string;
  scoring: ScoringResult;
  signals: { total: number; breach: number; unavailable: number };
  flags: { opened: number; refreshed: number; failed: number } | null;
  status: 'ok' | 'partial' | 'failed';
  readings?: SignalReading[];
  anomalies?: Anomaly[];
}

export async function runEvaluationPass(opts: {
  now?: Date;
  trigger: 'schedule' | 'operator';
  limit?: number;
  dryRun?: boolean;
}): Promise<EvaluationPassResult> {
  const now = opts.now ?? new Date();
  const scoring = await scoreBacklog({ now, limit: Math.max(1, Math.min(opts.limit ?? 500, 5000)), dryRun: opts.dryRun });
  const sources = await collectSources(now);
  const { readings, anomalies } = evaluateSignals(sources);
  const signals = {
    total: readings.length,
    breach: readings.filter((r) => r.status === 'breach').length,
    unavailable: readings.filter((r) => r.status === 'unavailable').length,
  };
  if (opts.dryRun) {
    return { runId: null, snapshotId: null, rubricHash: TRANSCRIPT_RUBRIC_HASH, scoring, signals, flags: null, status: 'ok', readings, anomalies };
  }

  const flags = await upsertFlags(anomalies, now);
  const status: EvaluationPassResult['status'] =
    flags === null || scoring.failed > 0 || signals.unavailable > 0 || flags.failed > 0 ? 'partial' : 'ok';

  const run = await serviceRest<{ id: string }[]>('/tutor_evaluation_run', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      trigger: opts.trigger,
      rubric_hash: TRANSCRIPT_RUBRIC_HASH,
      started_at: now.toISOString(),
      finished_at: new Date().toISOString(),
      backlog_before: scoring.backlogBefore,
      scored: scoring.scored,
      failed: scoring.failed,
      flags_opened: flags?.opened ?? 0,
      flags_refreshed: flags?.refreshed ?? 0,
      signals_breached: signals.breach,
      signals_unavailable: signals.unavailable,
      status,
    }),
  });
  const runId = Array.isArray(run) && run[0] ? run[0].id : null;
  const snapshot = await serviceRest<{ id: string }[]>('/mentor_quality_snapshot', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      run_id: runId,
      schema_version: SNAPSHOT_SCHEMA,
      computed_at: now.toISOString(),
      window_days: T.windowDays,
      rubric_hash: TRANSCRIPT_RUBRIC_HASH,
      signals: readings,
    }),
  });
  const snapshotId = Array.isArray(snapshot) && snapshot[0] ? snapshot[0].id : null;
  await pruneEvaluationArtifacts(now);
  return {
    runId,
    snapshotId,
    rubricHash: TRANSCRIPT_RUBRIC_HASH,
    scoring,
    signals,
    flags,
    status: runId === null || snapshotId === null ? 'failed' : status,
  };
}

/** Best-effort retention of the loop's own artifacts (none holds personal data). */
export async function pruneEvaluationArtifacts(now: Date): Promise<boolean> {
  const before = (days: number) => iso(new Date(now.getTime() - days * DAY));
  const results = await Promise.all([
    serviceRest<unknown>(`/tutor_transcript_score?created_at=lt.${before(EVALUATION_RETENTION.scoreDays)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    serviceRest<unknown>(`/mentor_quality_snapshot?computed_at=lt.${before(EVALUATION_RETENTION.snapshotDays)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    serviceRest<unknown>(`/tutor_evaluation_run?started_at=lt.${before(EVALUATION_RETENTION.runDays)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  ]);
  return results.every((r) => r !== null);
}
