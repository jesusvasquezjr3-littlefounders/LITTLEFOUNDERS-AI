// `choice` family — pure validators (LESSON_ENGINE.md §5.2, §6).
// Malformed answers → score 0, never throw. feedback_md comes from authored
// content (per-distractor rationale); tier microcopy is the UI's job (i18n).

import type { FamilyGrader, GradeOutcome, SegmentBase } from '../../core/types.js'
import { binary, calibration, decisionAccuracy, signalDetection } from '../../core/scoring.js'

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
  return {
    score: qualities[chosen],
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
  return {
    score: decisionAccuracy(selected, positives, cases.map((c) => c.id)),
    reveal: { applies_ids: positives },
  }
}

const gradeSpeedTap: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.selected_ids) : null
  const targets = key ? strArray(key.target_ids) : null
  if (!selected || !targets) return MALFORMED
  const raw = signalDetection(selected, targets)
  const overtime = a?.overtime === true
  return {
    score: overtime ? Math.round(raw * 0.8) : raw,
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
