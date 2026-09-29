/*
 * The Mentor-integrity monitor for Product C.10 and C.18 (Appendix F §1.1,
 * §1.2 and Part 3 Stage 7) — PURE summaries over rows the caller fetched, so
 * the thresholds and the defect logic are unit-tested without a database —
 * and the Extended Mastery Engine's Stage 7 AUTOMATIC ROLLBACK
 * (`getMasteryKillSwitch`, at the end), which judges the same summaries per
 * knowledge component and logs every trip to `audit_logs`.
 * `npm run tutor:integrity-report` (src/scripts/mentor-integrity-report.ts)
 * is the operator entry point that reads the two tables and prints this.
 *
 *   C.10  Corroborating-Evidence Compliance Rate — every mastery declaration
 *         and every remediation/rescue trigger in the Extended Mastery
 *         Engine event log (`tutor_trajectory_step`) must carry evidence
 *         meeting the requirement in force. A HARD INVARIANT: anything under
 *         100% is a defect, not a tuning choice.
 *         Mastery Declaration Reversal Rate — declarations later contradicted
 *         (an in-session revocation, or a corroborated remediation of the
 *         same KC) within the rolling window. Above the ceiling is the Stage 7
 *         kill-switch condition.
 *   C.18  Answer-Reveal Rate, per SESSION and per PERSONA — unsanctioned
 *         reveals over Mentor turns inside a hint-ladder / repair / open-
 *         activity sequence (`tutor_turn_honesty`). An elevated rate, or any
 *         upward drift against the prior window, is a CONTROLLER DEFECT
 *         requiring investigation — never an acceptable cost of "helpful".
 *         Sycophancy audit — the zero-tolerance count of delivered false
 *         affirmations, plus the specific-vs-generic praise share.
 *
 * EVERY THRESHOLD BELOW IS "PROPOSED, PENDING CALIBRATION" (Appendix F
 * Part 1.4 / Stage 7). They are recorded, with their provenance, in
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md and change only through
 * that log's quarterly review — they are Tier 1/Tier 2 governance values
 * (C.22), not knobs.
 */

import { insertAuditLog, serviceRest } from '../supabaseRest.js';

export const MENTOR_INTEGRITY_THRESHOLDS = {
  /** Hard invariant (Appendix F §1.1): 100%. */
  corroborationComplianceTarget: 1,
  /** Appendix F Stage 7 provisional ceiling: 8%. */
  masteryReversalCeiling: 0.08,
  /** Rolling post-mastery window (Appendix F §1.1, provisional): 90 days. */
  masteryReversalWindowDays: 90,
  /** Below this many declarations the reversal rate is reported as insufficient data. */
  masteryReversalMinDeclarations: 20,
  /**
   * Answer-reveal ceiling per persona. Appendix F asks for it to be set from
   * a human-rated baseline batch, which does not exist yet; 10% is the
   * provisional placeholder (MathDial's untutored baseline is 66%).
   */
  answerRevealCeiling: 0.1,
  /** Below this many sequence turns a persona/session rate is insufficient data, never a pass. */
  answerRevealMinTurns: 50,
  /** Upward drift against the prior window that counts as a defect (absolute). */
  answerRevealDriftTolerance: 0.02,
} as const;

export type Thresholds = typeof MENTOR_INTEGRITY_THRESHOLDS;

// ── C.18: the per-turn honesty rows ─────────────────────────────────────────

export interface HonestyRow {
  session_id: string | null;
  character: string;
  sequence_kind: 'hint_ladder' | 'repair' | 'open_activity' | 'none';
  reveal_sanctioned: boolean;
  reveal_key_match: boolean | null;
  reveal_self_answered: boolean;
  reveal_phrase: boolean;
  false_affirmation_caught: boolean;
  false_affirmation_delivered: boolean;
  praise: 'specific' | 'generic' | null;
}

/** In a sequence, not sanctioned by the learner's own request, and the answer was stated. */
export function isUnsanctionedReveal(row: HonestyRow): boolean {
  return (
    row.sequence_kind !== 'none' &&
    !row.reveal_sanctioned &&
    (row.reveal_key_match === true || row.reveal_self_answered || row.reveal_phrase)
  );
}

export type RateStatus = 'ok' | 'defect' | 'drift' | 'insufficient_data';

export interface RevealRate {
  sequenceTurns: number;
  unsanctionedReveals: number;
  rate: number | null;
}

function revealRate(rows: readonly HonestyRow[]): RevealRate {
  const inSequence = rows.filter((r) => r.sequence_kind !== 'none');
  const reveals = inSequence.filter(isUnsanctionedReveal).length;
  return {
    sequenceTurns: inSequence.length,
    unsanctionedReveals: reveals,
    rate: inSequence.length === 0 ? null : reveals / inSequence.length,
  };
}

export interface PersonaReveal extends RevealRate {
  character: string;
  priorRate: number | null;
  status: RateStatus;
}

export interface HonestySummary {
  personas: PersonaReveal[];
  sessions: Array<RevealRate & { sessionId: string; character: string; status: RateStatus }>;
  falseAffirmations: { caught: number; delivered: number };
  praise: { specific: number; generic: number; specificShare: number | null };
  defects: string[];
}

function statusFor(current: RevealRate, prior: number | null, t: Thresholds): RateStatus {
  if (current.rate === null || current.sequenceTurns < t.answerRevealMinTurns) return 'insufficient_data';
  if (current.rate > t.answerRevealCeiling) return 'defect';
  if (prior !== null && current.rate - prior > t.answerRevealDriftTolerance) return 'drift';
  return 'ok';
}

export function summarizeHonesty(
  current: readonly HonestyRow[],
  prior: readonly HonestyRow[],
  t: Thresholds = MENTOR_INTEGRITY_THRESHOLDS,
): HonestySummary {
  const defects: string[] = [];
  const characters = [...new Set(current.map((r) => r.character))].sort();
  const personas = characters.map((character): PersonaReveal => {
    const now = revealRate(current.filter((r) => r.character === character));
    const before = revealRate(prior.filter((r) => r.character === character));
    const priorRate = before.sequenceTurns >= t.answerRevealMinTurns ? before.rate : null;
    const status = statusFor(now, priorRate, t);
    if (status === 'defect') {
      defects.push(
        `C.18 answer-reveal rate for persona ${character} is ${pct(now.rate)} (> ${pct(t.answerRevealCeiling)} ceiling) — controller defect, investigate`,
      );
    }
    if (status === 'drift') {
      defects.push(
        `C.18 answer-reveal rate for persona ${character} drifted up ${pct(priorRate)} → ${pct(now.rate)} — controller defect, investigate`,
      );
    }
    return { character, ...now, priorRate, status };
  });

  const bySession = new Map<string, HonestyRow[]>();
  for (const row of current) {
    if (row.session_id === null) continue;
    bySession.set(row.session_id, [...(bySession.get(row.session_id) ?? []), row]);
  }
  const sessions = [...bySession.entries()].map(([sessionId, rows]) => {
    const rate = revealRate(rows);
    // A single session rarely reaches the persona floor; it is flagged for
    // REVIEW (never a pass/fail verdict) when its own rate is over the ceiling.
    const status: RateStatus =
      rate.rate === null ? 'insufficient_data' : rate.rate > t.answerRevealCeiling ? 'defect' : 'ok';
    return { sessionId, character: rows[0]!.character, ...rate, status };
  });

  const caught = current.filter((r) => r.false_affirmation_caught).length;
  const delivered = current.filter((r) => r.false_affirmation_delivered).length;
  if (delivered > 0) {
    defects.push(
      `C.18 zero-tolerance: ${delivered} delivered turn(s) affirmed a verified-wrong answer or an unsound idea`,
    );
  }
  const specific = current.filter((r) => r.praise === 'specific').length;
  const generic = current.filter((r) => r.praise === 'generic').length;

  return {
    personas,
    sessions: sessions.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)),
    falseAffirmations: { caught, delivered },
    praise: { specific, generic, specificShare: specific + generic === 0 ? null : specific / (specific + generic) },
    defects,
  };
}

// ── C.10: the Extended Mastery Engine event log ─────────────────────────────

export interface TrajectoryEvidenceRow {
  user_id: string;
  kc_id: string | null;
  strategy: string;
  strategy_before: string;
  evidence_rule: 'mastery' | 'remediation' | 'rescue' | null;
  evidence_observations: number | null;
  evidence_required: number | null;
  mastery_revoked: boolean;
  created_at: string;
}

/** The two consequential moves (and their re-declaration forms) C.10 governs. */
export function isConsequentialTrigger(row: TrajectoryEvidenceRow): boolean {
  if (row.strategy === 'CELEBRATE' || row.strategy === 'TRANSFER') return true;
  return (row.strategy === 'REMEDIATE' || row.strategy === 'RESCUE') && row.strategy_before !== row.strategy;
}

/** A trigger that carries evidence meeting the requirement in force (C.10). */
function isCompliant(r: TrajectoryEvidenceRow): boolean {
  return (
    r.evidence_rule !== null &&
    r.evidence_observations !== null &&
    r.evidence_required !== null &&
    r.evidence_required >= 1 &&
    r.evidence_observations >= r.evidence_required
  );
}

/** The reversal status of one rate: a thin sample is insufficient data, never a pass or a trip. */
function reversalStatusOf(declarations: number, reversals: number, t: Thresholds): RateStatus {
  if (declarations === 0 || declarations < t.masteryReversalMinDeclarations) return 'insufficient_data';
  return reversals / declarations > t.masteryReversalCeiling ? 'defect' : 'ok';
}

/**
 * One knowledge component's share of the C.10 numbers. Appendix F Stage 7
 * rolls back "for AFFECTED knowledge components", so the reversal rate and
 * the compliance are judged per KC as well as in aggregate; the 20-declaration
 * floor applies to each KC on its own.
 */
export interface KcEvidenceSummary {
  kcId: string;
  triggers: number;
  compliant: number;
  /** Consequential moves on this KC without qualifying evidence (any one is a defect). */
  complianceMisses: number;
  complianceRate: number | null;
  underRollback: number;
  declarations: number;
  reversals: number;
  reversalRate: number | null;
  reversalStatus: RateStatus;
}

export interface MasteryEvidenceSummary {
  triggers: number;
  compliant: number;
  complianceRate: number | null;
  /** Triggers that executed under a Stage 7 rollback (requirement below the default). */
  underRollback: number;
  declarations: number;
  reversals: number;
  reversalRate: number | null;
  reversalStatus: RateStatus;
  /** Per knowledge component, sorted by kc id (rows without a KC are not attributable). */
  byKc: KcEvidenceSummary[];
  /** Compliance misses on a trigger with no KC: a defect no per-KC rollback can address. */
  unattributedMisses: number;
  defects: string[];
}

export function summarizeMasteryEvidence(
  rows: readonly TrajectoryEvidenceRow[],
  t: Thresholds = MENTOR_INTEGRITY_THRESHOLDS,
  defaultRequirement = 2,
): MasteryEvidenceSummary {
  const defects: string[] = [];
  const triggers = rows.filter(isConsequentialTrigger);
  const compliant = triggers.filter(isCompliant);
  const isUnderRollback = (r: TrajectoryEvidenceRow): boolean =>
    r.evidence_required !== null && r.evidence_required < defaultRequirement;
  const underRollback = triggers.filter(isUnderRollback);
  const complianceRate = triggers.length === 0 ? null : compliant.length / triggers.length;
  if (complianceRate !== null && complianceRate < t.corroborationComplianceTarget) {
    defects.push(
      `C.10 corroborating-evidence compliance is ${pct(complianceRate)} (${triggers.length - compliant.length} consequential move(s) without qualifying evidence) — a hard invariant and a Stage 7 trigger: the affected KCs are rolled back automatically, investigate every one`,
    );
  }

  const windowMs = t.masteryReversalWindowDays * 24 * 60 * 60 * 1000;
  const time = (r: TrajectoryEvidenceRow): number => new Date(r.created_at).getTime();
  const declarations = rows.filter(
    (r) => (r.strategy === 'CELEBRATE' || r.strategy === 'TRANSFER') && r.evidence_rule === 'mastery' && r.kc_id !== null,
  );
  const reversed = new Set(
    declarations.filter((d) =>
      rows.some(
        (later) =>
          later.user_id === d.user_id &&
          later.kc_id === d.kc_id &&
          time(later) > time(d) &&
          time(later) - time(d) <= windowMs &&
          (later.mastery_revoked || later.evidence_rule === 'remediation'),
      ),
    ),
  );
  const reversalRate = declarations.length === 0 ? null : reversed.size / declarations.length;
  const reversalStatus = reversalStatusOf(declarations.length, reversed.size, t);
  if (reversalStatus === 'defect') {
    defects.push(
      `C.10 mastery declaration reversal rate is ${pct(reversalRate)} (> ${pct(t.masteryReversalCeiling)} Stage 7 ceiling) — kill-switch condition: every KC over the ceiling on its own is rolled back automatically and logged (mentor.kill_switch.mastery.*)`,
    );
  }

  const kcIds = [...new Set(rows.map((r) => r.kc_id).filter((id): id is string => id !== null))].sort();
  const byKc = kcIds.map((kcId): KcEvidenceSummary => {
    const kcTriggers = triggers.filter((r) => r.kc_id === kcId);
    const kcCompliant = kcTriggers.filter(isCompliant).length;
    const kcDeclarations = declarations.filter((r) => r.kc_id === kcId);
    const kcReversals = kcDeclarations.filter((d) => reversed.has(d)).length;
    return {
      kcId,
      triggers: kcTriggers.length,
      compliant: kcCompliant,
      complianceMisses: kcTriggers.length - kcCompliant,
      complianceRate: kcTriggers.length === 0 ? null : kcCompliant / kcTriggers.length,
      underRollback: kcTriggers.filter(isUnderRollback).length,
      declarations: kcDeclarations.length,
      reversals: kcReversals,
      reversalRate: kcDeclarations.length === 0 ? null : kcReversals / kcDeclarations.length,
      reversalStatus: reversalStatusOf(kcDeclarations.length, kcReversals, t),
    };
  });
  for (const kc of byKc) {
    if (kc.reversalStatus === 'defect') {
      defects.push(
        `C.10 KC ${kc.kcId}: reversal rate ${pct(kc.reversalRate)} (${kc.reversals}/${kc.declarations}) is over the ${pct(t.masteryReversalCeiling)} ceiling — Stage 7 rollback for this KC`,
      );
    }
  }
  const unattributedMisses = triggers.filter((r) => r.kc_id === null && !isCompliant(r)).length;

  return {
    triggers: triggers.length,
    compliant: compliant.length,
    complianceRate,
    underRollback: underRollback.length,
    declarations: declarations.length,
    reversals: reversed.size,
    reversalRate,
    reversalStatus,
    byKc,
    unattributedMisses,
    defects,
  };
}

// ── Appendix F Part 3 Stage 7: the Extended Mastery Engine automatic rollback ──

/*
 * The Stage 7 row for the Extended Mastery Engine: "Mastery Declaration
 * Reversal Rate exceeds 8% ... or the Corroborating-Evidence Compliance Rate
 * drops below 100%" → "Revert to single-observation BKT thresholds for
 * affected knowledge components until root-caused". Same pattern as the
 * Behavioral Telemetry Layer, Alliance Controller and spaced-review switches:
 * Core evaluates the condition, writes the trip to `audit_logs` (the
 * Kill-Switch Trigger Log, Appendix F §1.3), holds it until an operator
 * resolves it (`tutor:integrity-report -- --resolve="…"`), and sends the
 * tripped `kc.key`s to Oracle as the negotiated context field
 * `corroborationRollbackKcKeys` (never part of the sealed model context).
 * Oracle's controller applies the union of that field and the operator's
 * TUTOR_CORROBORATION_ROLLBACK_KC_KEYS.
 */

export const MASTERY_KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.mastery.triggered';
export const MASTERY_KILL_SWITCH_RESOLVED = 'mentor.kill_switch.mastery.resolved';
export type MasteryKillSwitchCause = 'reversal_above_ceiling' | 'compliance_below_target';

/** Engineering defaults for the automatic rollback (THRESHOLD-RECALIBRATION-LOG.md). */
export const MASTERY_KILL_SWITCH = {
  /** Compliance is judged over consequential moves in this trailing window. */
  complianceWindowDays: 14,
  /** How long one Core process reuses its verdict. */
  killSwitchCacheMs: 10 * 60_000,
  /** At most this many of the most recent trajectory rows are read per evaluation. */
  readLimit: 20_000,
  /** Oracle's context field accepts at most this many keys. */
  maxRolledBackKcs: 200,
} as const;

export interface MasteryKillSwitchKc {
  kcId: string;
  causes: MasteryKillSwitchCause[];
  declarations: number;
  reversals: number;
  reversalRate: number | null;
  complianceMisses: number;
}

export interface MasteryKillSwitchVerdict {
  tripped: boolean;
  causes: MasteryKillSwitchCause[];
  /** The affected KCs (by id), each with its own cause and numbers. */
  kcs: MasteryKillSwitchKc[];
  /** Compliance misses no KC can be named for: trips (and is logged), rolls nothing back. */
  unattributedMisses: number;
}

/**
 * The Stage 7 condition, per KC (pure). `rows` is the reversal window (the
 * rows after the latest resolution); compliance is judged on the rows of the
 * trailing compliance window only, so a legacy row from before C.10 recorded
 * its evidence does not trip anything months later.
 */
export function evaluateMasteryKillSwitch(
  rows: readonly TrajectoryEvidenceRow[],
  now: Date,
  t: Thresholds = MENTOR_INTEGRITY_THRESHOLDS,
  k: typeof MASTERY_KILL_SWITCH = MASTERY_KILL_SWITCH,
): MasteryKillSwitchVerdict {
  const reversal = summarizeMasteryEvidence(rows, t);
  const complianceStart = now.getTime() - k.complianceWindowDays * 86_400_000;
  const compliance = summarizeMasteryEvidence(
    rows.filter((r) => new Date(r.created_at).getTime() >= complianceStart),
    t,
  );
  const byId = new Map<string, MasteryKillSwitchKc>();
  const entry = (kcId: string): MasteryKillSwitchKc => {
    let e = byId.get(kcId);
    if (e === undefined) {
      const r = reversal.byKc.find((x) => x.kcId === kcId);
      e = {
        kcId,
        causes: [],
        declarations: r?.declarations ?? 0,
        reversals: r?.reversals ?? 0,
        reversalRate: r?.reversalRate ?? null,
        complianceMisses: 0,
      };
      byId.set(kcId, e);
    }
    return e;
  };
  for (const kc of reversal.byKc) if (kc.reversalStatus === 'defect') entry(kc.kcId).causes.push('reversal_above_ceiling');
  for (const kc of compliance.byKc) {
    if (kc.complianceMisses > 0) {
      const e = entry(kc.kcId);
      e.causes.push('compliance_below_target');
      e.complianceMisses = kc.complianceMisses;
    }
  }
  const kcs = [...byId.values()].sort((a, b) => a.kcId.localeCompare(b.kcId));
  const causes = new Set<MasteryKillSwitchCause>(kcs.flatMap((kc) => kc.causes));
  if (compliance.unattributedMisses > 0) causes.add('compliance_below_target');
  const ordered = (['reversal_above_ceiling', 'compliance_below_target'] as const).filter((c) => causes.has(c));
  return { tripped: ordered.length > 0, causes: ordered, kcs, unattributedMisses: compliance.unattributedMisses };
}

export interface MasteryAuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

export interface MasteryKillSwitchState {
  /** The `kc.key`s Oracle must roll back to the single-observation baseline. */
  kcKeys: string[];
  /** The earliest unresolved trigger, or null when nothing is in force. */
  trippedAt: string | null;
  causes: MasteryKillSwitchCause[];
  /** True when a read failed: the verdict could not be (re)computed. */
  degraded: boolean;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const MASTERY_CAUSES: readonly MasteryKillSwitchCause[] = ['reversal_above_ceiling', 'compliance_below_target'];

function causeList(value: unknown): MasteryKillSwitchCause[] {
  return stringList(value).filter((c): c is MasteryKillSwitchCause => (MASTERY_CAUSES as readonly string[]).includes(c));
}

/**
 * The trip in force from the audit trail (pure): every trigger after the
 * latest resolution, unioned. A resolution closes the whole trip.
 */
export function masteryTripInForce(rows: readonly MasteryAuditRow[]): {
  open: boolean;
  kcKeys: string[];
  causes: MasteryKillSwitchCause[];
  trippedAt: string | null;
  resolvedAt: string | null;
} {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let open = false;
  let keys = new Set<string>();
  let causes = new Set<MasteryKillSwitchCause>();
  let trippedAt: string | null = null;
  let resolvedAt: string | null = null;
  for (const row of ordered) {
    if (row.action === MASTERY_KILL_SWITCH_TRIGGERED) {
      if (!open) trippedAt = row.created_at;
      open = true;
      for (const key of stringList(row.detail?.kcKeys)) keys.add(key);
      for (const cause of causeList(row.detail?.causes)) causes.add(cause);
    } else if (row.action === MASTERY_KILL_SWITCH_RESOLVED) {
      open = false;
      keys = new Set();
      causes = new Set();
      trippedAt = null;
      resolvedAt = row.created_at;
    }
  }
  return { open, kcKeys: [...keys].sort(), causes: MASTERY_CAUSES.filter((c) => causes.has(c)), trippedAt, resolvedAt };
}

let masteryCache: { at: number; state: MasteryKillSwitchState } | null = null;

/** Test hook: forget the cached verdict. */
export function resetMasteryKillSwitchCache(): void {
  masteryCache = null;
}

/**
 * The Extended Mastery Engine's rollback set for a new session's context.
 * Cached per process for `killSwitchCacheMs`.
 *
 *   - The KCs of the trip in force (every trigger since the latest
 *     resolution) stay rolled back until an operator resolves the trip: a
 *     rollback is lifted by a root cause, never by the window going quiet.
 *   - The condition is re-evaluated over the rows after the latest resolution
 *     (at most the reversal window). A KC that newly meets it, and is not yet
 *     rolled back, is written to `audit_logs` as a trigger with its kc key,
 *     cause and numbers (no learner ids, no text) and joins the set. A
 *     compliance miss with no KC opens a trip that rolls nothing back but is
 *     logged and held until resolved.
 *   - A FAILED read is not evidence (§1.14): nothing new trips, the verdict is
 *     not cached, and the KCs already in force (when the audit read answered)
 *     stay rolled back.
 */
export async function getMasteryKillSwitch(
  now: Date = new Date(),
  t: Thresholds = MENTOR_INTEGRITY_THRESHOLDS,
  k: typeof MASTERY_KILL_SWITCH = MASTERY_KILL_SWITCH,
): Promise<MasteryKillSwitchState> {
  if (masteryCache !== null && now.getTime() - masteryCache.at < k.killSwitchCacheMs) return masteryCache.state;

  const log = await serviceRest<MasteryAuditRow[]>(
    `/audit_logs?action=in.(${MASTERY_KILL_SWITCH_TRIGGERED},${MASTERY_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=500`,
  );
  if (log === null) return { kcKeys: [], trippedAt: null, causes: [], degraded: true };
  const inForce = masteryTripInForce(log);
  const held: MasteryKillSwitchState = {
    kcKeys: inForce.kcKeys.slice(0, k.maxRolledBackKcs),
    trippedAt: inForce.trippedAt,
    causes: inForce.causes,
    degraded: false,
  };

  const windowStart = new Date(now.getTime() - t.masteryReversalWindowDays * 86_400_000);
  const since =
    inForce.resolvedAt !== null && new Date(inForce.resolvedAt) > windowStart ? new Date(inForce.resolvedAt) : windowStart;
  const rows = await serviceRest<TrajectoryEvidenceRow[]>(
    `/tutor_trajectory_step?select=user_id,kc_id,strategy,strategy_before,evidence_rule,evidence_observations,evidence_required,mastery_revoked,created_at` +
      `&created_at=gt.${since.toISOString()}&order=created_at.desc&limit=${k.readLimit}`,
  );
  if (rows === null) return { ...held, degraded: true };

  const verdict = evaluateMasteryKillSwitch(rows, now, t, k);
  if (!verdict.tripped) {
    masteryCache = { at: now.getTime(), state: held };
    return held;
  }

  let keyById = new Map<string, string>();
  if (verdict.kcs.length > 0) {
    const ids = verdict.kcs.map((kc) => kc.kcId);
    const kcRows = await serviceRest<{ id: string; key: string }[]>(`/kc?select=id,key&id=in.(${ids.join(',')})`);
    if (kcRows === null) return { ...held, degraded: true };
    keyById = new Map(kcRows.map((r) => [r.id, r.key]));
  }
  const already = new Set(inForce.kcKeys);
  const fresh = verdict.kcs
    .map((kc) => ({ ...kc, kcKey: keyById.get(kc.kcId) ?? null }))
    .filter((kc): kc is MasteryKillSwitchKc & { kcKey: string } => kc.kcKey !== null && !already.has(kc.kcKey));
  const unattributedTrip = !inForce.open && verdict.unattributedMisses > 0;
  if (fresh.length === 0 && !unattributedTrip) {
    masteryCache = { at: now.getTime(), state: held };
    return held;
  }

  const tripCauses = new Set<MasteryKillSwitchCause>(fresh.flatMap((kc) => kc.causes));
  if (unattributedTrip) tripCauses.add('compliance_below_target');
  const causes = MASTERY_CAUSES.filter((c) => tripCauses.has(c));
  const written = await insertAuditLog(null, MASTERY_KILL_SWITCH_TRIGGERED, 'tutor', {
    component: 'extended_mastery_engine',
    causes,
    kcKeys: fresh.map((kc) => kc.kcKey),
    kcs: fresh.map((kc) => ({
      kcKey: kc.kcKey,
      causes: kc.causes,
      declarations: kc.declarations,
      reversals: kc.reversals,
      reversalRate: kc.reversalRate,
      complianceMisses: kc.complianceMisses,
    })),
    unattributedMisses: verdict.unattributedMisses,
    reversalCeiling: t.masteryReversalCeiling,
    since: since.toISOString(),
  });
  if (!written) console.warn('[tutor] mastery kill switch tripped but its audit row did NOT land');
  console.warn(
    `[tutor] Extended Mastery Engine kill switch TRIPPED (${causes.join(', ')}): single-observation baseline for ${fresh.map((kc) => kc.kcKey).join(', ') || 'no attributable KC'}`,
  );
  const allCauses = new Set<MasteryKillSwitchCause>([...inForce.causes, ...causes]);
  const state: MasteryKillSwitchState = {
    kcKeys: [...new Set([...inForce.kcKeys, ...fresh.map((kc) => kc.kcKey)])].sort().slice(0, k.maxRolledBackKcs),
    trippedAt: inForce.trippedAt ?? now.toISOString(),
    causes: MASTERY_CAUSES.filter((c) => allCauses.has(c)),
    degraded: false,
  };
  masteryCache = { at: now.getTime(), state };
  return state;
}

/** The operator's resolution of the trip in force (root-caused). Returns whether the row landed. */
export async function resolveMasteryKillSwitch(note: string): Promise<boolean> {
  resetMasteryKillSwitchCache();
  return insertAuditLog(null, MASTERY_KILL_SWITCH_RESOLVED, 'tutor', { component: 'extended_mastery_engine', note: note.slice(0, 500) });
}

export interface MasteryKillSwitchLogEntry {
  triggeredAt: string;
  causes: MasteryKillSwitchCause[];
  /** Every KC rolled back during this trip (triggers may add KCs while it is open). */
  kcKeys: string[];
  resolvedAt: string | null;
  /** Hours from the first trigger to the resolution; null while unresolved. */
  resolutionHours: number | null;
}

/** The Kill-Switch Trigger Log for the Extended Mastery Engine (Appendix F §1.3). */
export function masteryKillSwitchLog(rows: readonly MasteryAuditRow[]): MasteryKillSwitchLogEntry[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: MasteryKillSwitchLogEntry[] = [];
  let open: MasteryKillSwitchLogEntry | null = null;
  for (const row of ordered) {
    if (row.action === MASTERY_KILL_SWITCH_TRIGGERED) {
      if (open === null) {
        open = { triggeredAt: row.created_at, causes: [], kcKeys: [], resolvedAt: null, resolutionHours: null };
        out.push(open);
      }
      for (const cause of causeList(row.detail?.causes)) if (!open.causes.includes(cause)) open.causes.push(cause);
      for (const key of stringList(row.detail?.kcKeys)) if (!open.kcKeys.includes(key)) open.kcKeys.push(key);
    } else if (row.action === MASTERY_KILL_SWITCH_RESOLVED && open !== null) {
      open.resolvedAt = row.created_at;
      open.resolutionHours = (Date.parse(row.created_at) - Date.parse(open.triggeredAt)) / 3_600_000;
      open = null;
    }
  }
  return out;
}

export function pct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}
