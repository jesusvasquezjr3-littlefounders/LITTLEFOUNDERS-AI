import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { dPrime } from './v2VisualScorer.js';
import { TEACHING_VISUAL_COVERAGE } from './teachingVisualCoverage.generated.js';

/*
 * GAP-FIX-R2 learning: the Appendix P Part 8 metrics and the Appendix C
 * Part 1.3 QA metrics the first round left out, for the staff
 * learning-quality panel.
 *
 *   scorer parity          0215 learning_scorer_parity + scorer_parity_miss events
 *   d-prime pre/post       0215 learning_detection_cells_by_phase
 *   cue hits               0215 learning_cue_hits (diagnostic)
 *   representation A/B     0215 learning_variant_transfer (diagnostic)
 *   CPA entry stages       0215 learning_cpa_entry_stage_distribution (diagnostic)
 *   B.1 / B.2 / B.4        0217 learning_qa_rates
 *   defect escape rate     0217 content_defect_escape_rate
 *   tap / locale coverage  the committed teaching-visual coverage snapshot
 *                          (agent/tools/teaching-visual-coverage.mjs writes
 *                          teachingVisualCoverage.generated.ts)
 *
 * Every read is null until its migration is applied; the rest of the report
 * never depends on it. Diagnostic metrics carry `diagnostic: true` and no target.
 */

const count = z.coerce.number().int().nonnegative();
const share = z.coerce.number().min(0).max(1).nullable();
const ParityRow = z.object({ graded: count, reported: count, agreed: count, agreement_share: share });
const PhaseRow = z.object({ item_phase: z.enum(['pre', 'post', 'practice']), responses: count, hits: count, misses: count, false_alarms: count, correct_rejections: count });
const CueRow = z.object({ responses: count, hits: count, missed: count, false_ticks: count });
const VariantRow = z.object({ kc: z.string(), variant: z.string(), first_attempts: count, successes: count, success_share: z.coerce.number().min(0).max(1) });
const EntryRow = z.object({ entry_stage: z.enum(['concrete', 'pictorial', 'abstract']), runs: count });
const QaRow = z.object({ event: z.string(), detail: z.string(), events: count });
const EscapeRow = z.object({ gate_id: z.string().nullable(), escapes: count, published_versions: count });

const CoverageReport = z.object({
  generated_at: z.string(),
  tap_alternative: z.object({ drag_interactions: count, with_alternative: count, share, missing: z.array(z.string()) }),
  locale_rendering: z.object({ kinds: count, covered: count, share, missing: z.array(z.string()) }),
});
export type TeachingVisualCoverage = z.infer<typeof CoverageReport>;

export interface LearningQaSignals {
  scorerParity: z.infer<typeof ParityRow> & { refusedButClientValid: number; target: 1 };
  detectionByPhase: Array<z.infer<typeof PhaseRow> & { dPrime: number }>;
  cueHits: z.infer<typeof CueRow> & { diagnostic: true };
  variantTransfer: { rows: z.infer<typeof VariantRow>[]; diagnostic: true };
  cpaEntryStages: { rows: z.infer<typeof EntryRow>[]; diagnostic: true };
  placementCommit: { ok: number; failed: number; successRate: number | null; byMethod: Record<string, number>; target: 1 };
  prerequisiteGate: { refused: number; passed: number; target: 1 };
  forcedUpdate: { blocked: number; target: 1 };
  defectEscapes: { escapes: number; publishedVersions: number; byGate: Array<{ gateId: string; escapes: number }>; target: 0 };
  coverage: TeachingVisualCoverage | null;
}

async function rpc<T>(name: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T | null> {
  const result = await serviceRest<unknown>(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  const parsed = schema.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** The committed coverage snapshot (tap and keyboard alternatives, three-locale rendering), or null when malformed. */
export function loadTeachingVisualCoverage(raw: unknown = TEACHING_VISUAL_COVERAGE): TeachingVisualCoverage | null {
  const parsed = CoverageReport.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Assembles the rates from the raw rows; pure, so the arithmetic is testable without a database. */
export function assembleLearningQaSignals(input: {
  parity: z.infer<typeof ParityRow>; phases: z.infer<typeof PhaseRow>[]; cues: z.infer<typeof CueRow>; variants: z.infer<typeof VariantRow>[];
  entries: z.infer<typeof EntryRow>[]; qa: z.infer<typeof QaRow>[]; escapes: z.infer<typeof EscapeRow>[]; coverage: TeachingVisualCoverage | null;
}): LearningQaSignals {
  const sum = (event: string) => input.qa.filter((row) => row.event === event).reduce((total, row) => total + row.events, 0);
  const ok = sum('placement_commit_ok'); const failed = sum('placement_commit_failed');
  return {
    scorerParity: { ...input.parity, refusedButClientValid: sum('scorer_parity_miss'), target: 1 },
    detectionByPhase: input.phases.map((row) => ({ ...row, dPrime: dPrime({ hits: row.hits, misses: row.misses, false_alarms: row.false_alarms, correct_rejections: row.correct_rejections }) })),
    cueHits: { ...input.cues, diagnostic: true },
    variantTransfer: { rows: input.variants, diagnostic: true },
    cpaEntryStages: { rows: input.entries, diagnostic: true },
    placementCommit: { ok, failed, successRate: ok + failed === 0 ? null : Math.round(ok / (ok + failed) * 10_000) / 10_000,
      byMethod: Object.fromEntries(input.qa.filter((row) => row.event === 'placement_commit_ok').map((row) => [row.detail, row.events])), target: 1 },
    prerequisiteGate: { refused: sum('prerequisite_refused'), passed: sum('prerequisite_passed'), target: 1 },
    forcedUpdate: { blocked: sum('lesson_update_required'), target: 1 },
    defectEscapes: {
      escapes: input.escapes.reduce((total, row) => total + row.escapes, 0),
      publishedVersions: input.escapes[0]?.published_versions ?? 0,
      byGate: input.escapes.filter((row) => row.gate_id !== null && row.escapes > 0).map((row) => ({ gateId: row.gate_id!, escapes: row.escapes })),
      target: 0,
    },
    coverage: input.coverage,
  };
}

/** Null until 0215 and 0217 are applied. */
export async function loadLearningQaSignals(window: { p_since: string; p_until: string }): Promise<LearningQaSignals | null> {
  const [parity, phases, cues, variants, entries, qa, escapes] = await Promise.all([
    rpc('learning_scorer_parity', window, z.array(ParityRow)),
    rpc('learning_detection_cells_by_phase', window, z.array(PhaseRow)),
    rpc('learning_cue_hits', window, z.array(CueRow)),
    rpc('learning_variant_transfer', window, z.array(VariantRow)),
    rpc('learning_cpa_entry_stage_distribution', window, z.array(EntryRow)),
    rpc('learning_qa_rates', window, z.array(QaRow)),
    rpc('content_defect_escape_rate', window, z.array(EscapeRow)),
  ]);
  if (!parity || !phases || !cues || !variants || !entries || !qa || !escapes) return null;
  return assembleLearningQaSignals({
    parity: parity[0] ?? { graded: 0, reported: 0, agreed: 0, agreement_share: null }, phases,
    cues: cues[0] ?? { responses: 0, hits: 0, missed: 0, false_ticks: 0 }, variants, entries, qa, escapes, coverage: loadTeachingVisualCoverage(),
  });
}

export const DEFECT_KINDS = ['pedagogical', 'psychological', 'factual', 'regional', 'copy'] as const;

/** Records a defect found in released content and the gate that should have caught it (audited in the same transaction). */
export async function recordContentDefectEscape(input: { lessonId: string; gateId: string; kind: (typeof DEFECT_KINDS)[number]; actorId: string }): Promise<string | null> {
  const result = await serviceRest<unknown>('/rpc/record_content_defect_escape', { method: 'POST', body: JSON.stringify({
    p_lesson_id: input.lessonId, p_gate_id: input.gateId, p_defect_kind: input.kind, p_actor: input.actorId,
  }) });
  const parsed = z.string().uuid().safeParse(result);
  return parsed.success ? parsed.data : null;
}
