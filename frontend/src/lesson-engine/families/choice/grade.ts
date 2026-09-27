// `choice` family — pure validators (LESSON_ENGINE.md §5.2, §6).
// Malformed answers → score 0, never throw. feedback_md comes from authored
// content (per-distractor rationale); tier microcopy is the UI's job (i18n).

import type { FamilyGrader, GradeOutcome, SegmentBase } from '../../core/types'
import { balancedDecisionAccuracy, binary, calibration, clampScore, qualityScaleFactor, signalDetection } from '../../core/scoring'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

const MALFORMED: GradeOutcome = { score: 0 }

function optionRationale(segment: SegmentBase, optionId: string): string | undefined {
  const options = segment.payload.options as Array<{ id: string; rationale_md?: string }> | undefined
  return options?.find((o) => o.id === optionId)?.rationale_md
}

const gradeQuizMcq: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const chosen = a ? str(a.option_id) : null
  const key = obj(segment.answer)
  if (!chosen || !key) return MALFORMED
  const correct = chosen === key.correct_option_id
  return {
    score: binary(correct),
    feedback_md: optionRationale(segment, chosen),
    reveal: { correct_option_id: key.correct_option_id },
  }
}

const gradeTrueFalse: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  if (!a || typeof a.is_true !== 'boolean' || !key) return MALFORMED
  const hasJustifications = Array.isArray(segment.payload.justifications)
  const verdictRight = a.is_true === key.is_true
  if (!hasJustifications || !key.correct_justification_id) {
    return { score: binary(verdictRight), reveal: { is_true: key.is_true } }
  }
  const justRight = str(a.justification_id) === key.correct_justification_id
  return {
    score: (verdictRight ? 60 : 0) + (justRight ? 40 : 0),
    reveal: { is_true: key.is_true, correct_justification_id: key.correct_justification_id },
  }
}

const gradeOddOneOut: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  if (!a || !key) return MALFORMED
  const itemRight = str(a.item_id) === key.odd_item_id
  if (!key.correct_reason_id) {
    return { score: binary(itemRight), reveal: { odd_item_id: key.odd_item_id } }
  }
  const reasonRight = str(a.reason_id) === key.correct_reason_id
  return {
    score: (itemRight ? 60 : 0) + (reasonRight ? 40 : 0),
    reveal: { odd_item_id: key.odd_item_id, correct_reason_id: key.correct_reason_id },
  }
}

const gradeBestDecision: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const chosen = a ? str(a.option_id) : null
  const qualities = key ? (obj(key.qualities) as Record<string, number> | null) : null
  if (!chosen || !qualities || typeof qualities[chosen] !== 'number') return MALFORMED
  const best = Object.entries(qualities).sort((x, y) => y[1] - x[1])[0]
  // Rescale 0–1 quality maps to 0–100 (Forge has shipped both scales) so the
  // best option can actually reach a passing score.
  const factor = qualityScaleFactor(Object.values(qualities))
  return {
    score: clampScore(qualities[chosen] * factor),
    feedback_md: optionRationale(segment, chosen),
    reveal: { best_option_id: best?.[0] },
  }
}

const gradeYesNoCases: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.applies_ids) : null
  const positives = key ? strArray(key.applies_ids) : null
  const cases = segment.payload.cases as Array<{ id: string }> | undefined
  if (!selected || !positives || !cases) return MALFORMED
  // naive_strategy_passes — fixed in SCORING, not in the widget: the control set is
  // exactly right (an explicit Yes/No per case, which canSubmit already requires),
  // it was the pooled (TP+TN)/N formula that paid for a thought-free strategy.
  // "Press NO on every case" scored (N−P)/N — 75 at 8 cases with 2 applying, 83 at
  // 6 with 1 — so the child cleared the 70 threshold without ever testing a case
  // against the rule. `balancedDecisionAccuracy` splits the score between finding
  // the applying cases and rejecting the rest, which pins BOTH all-NO and all-YES
  // at 50 for every possible ratio while the exact key still scores 100 and a
  // balanced set grades identically to before. Full numbers in core/scoring.ts.
  // Gate 8 rejects the one-sided keys (P = 0 / P = N) no formula can rescue.
  return {
    score: balancedDecisionAccuracy(selected, positives, cases.map((c) => c.id)),
    reveal: { applies_ids: positives },
  }
}

const gradeSpeedTap: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.selected_ids) : null
  const targets = key ? strArray(key.target_ids) : null
  if (!selected || !targets) return MALFORMED
  const items = Array.isArray(segment.payload.items) ? (segment.payload.items as unknown[]) : []
  // OD-28 (owner review L-01, audit MN-02): running out of time costs nothing.
  // The timer stays and the client still reports `overtime`, but the score is
  // exactly what the answer earned; the old ×0.8 reduction is gone.
  return {
    score: signalDetection(selected, targets, items.length),
    reveal: { target_ids: targets },
  }
}

const gradeConfidenceQuiz: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const chosen = a ? str(a.option_id) : null
  const confidence = a && typeof a.confidence === 'number' ? a.confidence : null
  if (!chosen || confidence === null || !key) return MALFORMED
  const right = chosen === key.correct_option_id
  // Pure calibration payoff (§5.2 #13): confident-and-wrong is the costly cell;
  // hedged answers land in the "almost" band either way — that IS the lesson.
  return {
    score: calibration(right, confidence),
    feedback_md: optionRationale(segment, chosen),
    reveal: { correct_option_id: key.correct_option_id },
  }
}

export const choiceGraders: Record<string, FamilyGrader> = {
  quiz_mcq: gradeQuizMcq,
  true_false: gradeTrueFalse,
  picture_choice: gradeQuizMcq, // same answer/key shape
  odd_one_out: gradeOddOneOut,
  best_decision: gradeBestDecision,
  yes_no_cases: gradeYesNoCases,
  speed_tap: gradeSpeedTap,
  confidence_quiz: gradeConfidenceQuiz,
}
