/*
 * The Mentor-integrity monitor for Product C.10 and C.18 (Appendix F §1.1,
 * §1.2 and Part 3 Stage 7) — PURE summaries over rows the caller fetched, so
 * the thresholds and the defect logic are unit-tested without a database.
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
  defects: string[];
}

export function summarizeMasteryEvidence(
  rows: readonly TrajectoryEvidenceRow[],
  t: Thresholds = MENTOR_INTEGRITY_THRESHOLDS,
  defaultRequirement = 2,
): MasteryEvidenceSummary {
  const defects: string[] = [];
  const triggers = rows.filter(isConsequentialTrigger);
  const compliant = triggers.filter(
    (r) =>
      r.evidence_rule !== null &&
      r.evidence_observations !== null &&
      r.evidence_required !== null &&
      r.evidence_required >= 1 &&
      r.evidence_observations >= r.evidence_required,
  );
  const underRollback = triggers.filter((r) => r.evidence_required !== null && r.evidence_required < defaultRequirement);
  const complianceRate = triggers.length === 0 ? null : compliant.length / triggers.length;
  if (complianceRate !== null && complianceRate < t.corroborationComplianceTarget) {
    defects.push(
      `C.10 corroborating-evidence compliance is ${pct(complianceRate)} (${triggers.length - compliant.length} consequential move(s) without qualifying evidence) — a hard invariant, investigate every one`,
    );
  }

  const windowMs = t.masteryReversalWindowDays * 24 * 60 * 60 * 1000;
  const time = (r: TrajectoryEvidenceRow): number => new Date(r.created_at).getTime();
  const declarations = rows.filter(
    (r) => (r.strategy === 'CELEBRATE' || r.strategy === 'TRANSFER') && r.evidence_rule === 'mastery' && r.kc_id !== null,
  );
  const reversals = declarations.filter((d) =>
    rows.some(
      (later) =>
        later.user_id === d.user_id &&
        later.kc_id === d.kc_id &&
        time(later) > time(d) &&
        time(later) - time(d) <= windowMs &&
        (later.mastery_revoked || later.evidence_rule === 'remediation'),
    ),
  );
  const reversalRate = declarations.length === 0 ? null : reversals.length / declarations.length;
  const reversalStatus: RateStatus =
    reversalRate === null || declarations.length < t.masteryReversalMinDeclarations
      ? 'insufficient_data'
      : reversalRate > t.masteryReversalCeiling
        ? 'defect'
        : 'ok';
  if (reversalStatus === 'defect') {
    defects.push(
      `C.10 mastery declaration reversal rate is ${pct(reversalRate)} (> ${pct(t.masteryReversalCeiling)} Stage 7 ceiling) — kill-switch condition: review, and roll affected KCs back only through the logged operator procedure`,
    );
  }

  return {
    triggers: triggers.length,
    compliant: compliant.length,
    complianceRate,
    underRollback: underRollback.length,
    declarations: declarations.length,
    reversals: reversals.length,
    reversalRate,
    reversalStatus,
    defects,
  };
}

export function pct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}
