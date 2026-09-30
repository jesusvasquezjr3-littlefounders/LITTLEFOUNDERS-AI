import { z } from 'zod';

/*
 * S05.3d: the client side of Core's staff learning-quality report
 * (GET /admin/content/learning-quality). B.19 practice success band per lesson,
 * the calibration reviews it opens and the recalibration log; B.12's judgment
 * signal differentiation; B.5's replay-notice display rate. Every status and
 * threshold is computed by Core; this module only validates the shape.
 */

const count = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);
const localized = z.record(z.string(), z.unknown()).nullable();

export const learningQualityReportSchema = z.object({
  window: z.object({ since: z.string(), until: z.string(), days: z.number().int().positive() }),
  defaultBand: z.object({
    lower_pct: z.number().int(), upper_pct: z.number().int(), min_sample: z.number().int(),
    rationale: z.string(), set_at: z.string(), reviewDue: z.boolean(),
  }).nullable(),
  lessons: z.array(z.object({
    lesson_id: z.string().uuid(), lesson_slug: z.string(), lesson_title: localized,
    first_attempts: count, successes: count, assisted: count, success_pct: pct,
    lower_pct: z.number().int(), upper_pct: z.number().int(), min_sample: z.number().int(),
    band_scope: z.enum(['default', 'lesson']),
    status: z.enum(['insufficient_sample', 'below_band', 'in_band', 'above_band']),
    families: z.array(z.object({ family: z.string(), first_attempts: count, successes: count })).nullable(),
  })),
  reviews: z.array(z.object({
    id: z.string().uuid(), lesson_id: z.string().uuid(), direction: z.enum(['below_band', 'above_band']),
    window_days: z.number().int(), evidence: z.record(z.string(), z.unknown()),
    status: z.enum(['open', 'resolved']),
    decision: z.enum(['make_harder', 'make_easier', 'adjust_band', 'no_change']).nullable(),
    decision_note: z.string().nullable(), opened_at: z.string(), resolved_at: z.string().nullable(),
  })),
  bandLog: z.array(z.object({
    lesson_id: z.string().uuid().nullable(), previous: z.record(z.string(), z.unknown()).nullable(),
    next: z.record(z.string(), z.unknown()), rationale: z.string(), review_id: z.string().uuid().nullable(), changed_at: z.string(),
  })),
  judgment: z.array(z.object({
    lesson_id: z.string().uuid(), attempts: count, correct_sound: count, correct_not_sound: count,
    incorrect_sound: count, incorrect_not_sound: count, divergent_share: z.number().min(0).max(1),
    correlation: z.number().min(-1).max(1).nullable(), status: z.enum(['insufficient_sample', 'distinct', 'tracks_correctness']),
  })),
  replayNotice: z.object({
    below_best: count, shown: count, display_rate: z.number().min(0).max(1).nullable(), target: z.number(), belowTarget: z.boolean(),
  }),
  thresholds: z.object({
    judgmentDivergenceFloor: z.number(), judgmentMinAttempts: z.number().int(), replayNoticeTarget: z.number(), bandReviewCadenceDays: z.number().int(),
  }),
  /*
   * S05.3e (B.21, B.24): Appendix C's rest-day utilization and autonomy
   * adoption. Null until the motivation migration is applied; absent from an
   * older Core. Diagnostic: the adoption baseline is set after release.
   */
  motivation: z.object({
    restDays: z.object({ learners_with_lapse: count, kept_by_rest_days: count, restarted: count,
      utilization_rate: z.number().min(0).max(1).nullable(), rest_days_used: count }),
    autonomy: z.array(z.object({ lever: z.enum(['path', 'approach', 'enrichment', 'mentor', 'pace']), offered: count, exercised: count,
      adoption_rate: z.number().min(0).max(1).nullable() })),
  }).nullable().optional(),
  /*
   * GAP-FIX-R1 (Appendix C 1.1, Appendix P Parts 4.5 and 8): transfer versus
   * practice per KC, the structure-versus-answer split of first-try errors,
   * the M1 first unaided stage and d-prime on the scam families. Null until
   * 0207 is applied; absent from an older Core.
   */
  v2Signals: z.object({
    transfer: z.array(z.object({ kc: z.string(), item_role: z.enum(['practice', 'transfer']), first_attempts: count, successes: count,
      success_share: z.number().min(0).max(1) })),
    errorSplit: z.object({ structure: count, answer: count,
      byDiagnostic: z.array(z.object({ family: z.enum(['structure', 'answer']), diagnostic: z.string(), errors: count })) }),
    firstUnaided: z.array(z.object({ stage: z.enum(['concrete', 'pictorial', 'abstract']), learners: count })),
    detection: z.array(z.object({ lesson_id: z.string().uuid(), responses: count, hits: count, misses: count, false_alarms: count,
      correct_rejections: count, dPrime: z.number() })),
  }).nullable().optional(),
  /*
   * GAP-FIX-R7 (Appendix C 1.1, B.9): Decision Journal Coverage & Resurfacing
   * Rate. Coverage = story choices journaled / story choices made (the
   * best-effort journal's lost writes made visible); learners without the
   * journal's consent are reported apart. Null until the coverage migration
   * is applied; absent from an older Core.
   */
  decisionJournal: z.object({
    decisionsMade: count, decisionsJournaled: count, withoutConsent: count, coverage: z.number().min(0).max(1).nullable(),
    recorded: count, resurfaced: count, resurfacingRate: z.number().min(0).max(1).nullable(), baseline: z.literal('release-1'),
  }).nullable().optional(),
  /*
   * GAP-FIX-R2 (Appendix P Part 8; Appendix C 1.3): scorer parity, d′ by
   * phase, cue hits, representation A/B, CPA entry stages, B.1/B.2/B.4 and
   * defect escapes, and the committed coverage snapshot. Null until 0216 and
   * 0218 are applied; absent from an older Core.
   */
  qaSignals: z.object({
    scorerParity: z.object({ graded: count, reported: count, agreed: count, agreement_share: z.number().min(0).max(1).nullable(), refusedButClientValid: count, target: z.literal(1) }),
    detectionByPhase: z.array(z.object({ item_phase: z.enum(['pre', 'post', 'practice']), responses: count, hits: count, misses: count, false_alarms: count,
      correct_rejections: count, dPrime: z.number() })),
    cueHits: z.object({ responses: count, hits: count, missed: count, false_ticks: count, diagnostic: z.literal(true) }),
    variantTransfer: z.object({ rows: z.array(z.object({ kc: z.string(), variant: z.string(), first_attempts: count, successes: count,
      success_share: z.number().min(0).max(1) })), diagnostic: z.literal(true) }),
    cpaEntryStages: z.object({ rows: z.array(z.object({ entry_stage: z.enum(['concrete', 'pictorial', 'abstract']), runs: count })), diagnostic: z.literal(true) }),
    placementCommit: z.object({ ok: count, failed: count, successRate: z.number().min(0).max(1).nullable(), byMethod: z.record(z.string(), count), target: z.literal(1) }),
    prerequisiteGate: z.object({ refused: count, passed: count, target: z.literal(1) }),
    forcedUpdate: z.object({ blocked: count, target: z.literal(1) }),
    defectEscapes: z.object({ escapes: count, publishedVersions: count, byGate: z.array(z.object({ gateId: z.string(), escapes: count })), target: z.literal(0) }),
    /* Gap-fix round 7 (Appendix C 1.3 / Stage 6): every escape opens a gate-effectiveness review; null before its migration, absent from an older Core. */
    gateReviews: z.object({
      open: z.array(z.object({
        reviewId: z.string().uuid(), escapeId: z.string().uuid(), lessonId: z.string().uuid(), gateId: z.string(), gateDescription: z.string(),
        ownerRole: z.enum(['pedagogical_lead', 'content_engineering']), defectKind: z.string(), openedAt: z.string(), ageDays: count, overdue: z.boolean(),
      })),
      overdue: count, maxOpenDays: count,
    }).nullable().optional(),
    coverage: z.object({
      generated_at: z.string(),
      tap_alternative: z.object({ drag_interactions: count, with_alternative: count, share: z.number().min(0).max(1).nullable(), missing: z.array(z.string()) }),
      locale_rendering: z.object({ kinds: count, covered: count, share: z.number().min(0).max(1).nullable(), missing: z.array(z.string()) }),
    }).nullable(),
  }).nullable().optional(),
});
export type LearningQualityReport = z.infer<typeof learningQualityReportSchema>;
export type ReviewDecision = 'make_harder' | 'make_easier' | 'adjust_band' | 'no_change';
export type ReviewDecisionBody = { decision: ReviewDecision; note: string; lowerPct?: number; upperPct?: number };
/** Appendix C 1.3 / Stage 6 (gap-fix round 7): how a gate-effectiveness review closes; only a changed gate names its commit or version. */
export type GateReviewOutcome = 'gate_changed' | 'lexicon_extended' | 'accepted_limitation';
export type GateReviewBody = { outcome: GateReviewOutcome; note: string; gateChangeRef?: string };

/** The same guard rails the database CHECK enforces; the form refuses early, Core and SQL refuse for real. */
export function bandInsideGuardRails(lower: number, upper: number): boolean {
  return Number.isInteger(lower) && Number.isInteger(upper) && lower >= 50 && upper <= 95 && upper - lower >= 5;
}

/** Decisions that move a lesson toward its band; the database refuses the others. */
export function decisionsFor(direction: 'below_band' | 'above_band'): ReviewDecision[] {
  return [direction === 'above_band' ? 'make_harder' : 'make_easier', 'adjust_band', 'no_change'];
}
