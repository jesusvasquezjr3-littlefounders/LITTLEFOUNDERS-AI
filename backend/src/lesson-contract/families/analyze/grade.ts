// `analyze` family — pure validators (LESSON_ENGINE.md §5.6, §6).
// Malformed answers → score 0, never throw. Tier microcopy is the UI's job (i18n).

import type { FamilyGrader, GradeOutcome } from '../../core/types.js'
import { decisionAccuracy, jaccard, positional, ratio, signalDetection } from '../../core/scoring.js'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

/** Record whose values are all strings (cells, answers maps). */
function strRecord(v: unknown): Record<string, string> | null {
  const o = obj(v)
  if (!o) return null
  return Object.values(o).every((x) => typeof x === 'string') ? (o as Record<string, string>) : null
}

const MALFORMED: GradeOutcome = { score: 0 }

const gradeSpotError: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.selected) : null
  const errorIds = key ? strArray(key.error_ids) : null
  const steps = segment.payload.steps as Array<{ id: string }> | undefined
  if (!selected || !errorIds || !steps) return MALFORMED
  return {
    score: decisionAccuracy(selected, errorIds, steps.map((s) => s.id)),
    reveal: { error_ids: errorIds, correction_md: key?.correction_md },
  }
}

const gradeCauseEffect: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const chain = a ? strArray(a.chain) : null
  const correctChain = key ? strArray(key.chain) : null
  if (!chain || !correctChain) return MALFORMED
  return {
    score: positional(chain, correctChain),
    reveal: { chain: correctChain },
  }
}

const gradeCompareTable: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const cells = a ? strRecord(a.cells) : null
  const correctCells = key ? strRecord(key.cells) : null
  if (!cells || !correctCells) return MALFORMED
  const cellKeys = Object.keys(correctCells)
  let hits = 0
  cellKeys.forEach((k) => {
    if (cells[k] === correctCells[k]) hits++
  })
  return {
    score: ratio(hits, cellKeys.length),
    reveal: { cells: correctCells },
  }
}

const gradeReadChart: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const answers = a ? strRecord(a.answers) : null
  const correct = key ? strRecord(key.correct) : null
  if (!answers || !correct) return MALFORMED
  const questionIds = Object.keys(correct)
  let hits = 0
  questionIds.forEach((q) => {
    if (answers[q] === correct[q]) hits++
  })
  return {
    score: ratio(hits, questionIds.length),
    reveal: { correct },
  }
}

const gradeEvidenceHunt: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.selected) : null
  const evidenceIds = key ? strArray(key.evidence_ids) : null
  if (!selected || !evidenceIds) return MALFORMED
  return {
    score: jaccard(selected, evidenceIds),
    reveal: { evidence_ids: evidenceIds },
  }
}

const gradeRedFlags: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.selected) : null
  const redflagIds = key ? strArray(key.redflag_ids) : null
  if (!selected || !redflagIds) return MALFORMED
  // Signal detection: flag-everything gets punished (§5.6 #44).
  return {
    score: signalDetection(selected, redflagIds),
    reveal: { redflag_ids: redflagIds },
  }
}

const gradeFactOpinion: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const factIds = a ? strArray(a.fact_ids) : null
  const correctFactIds = key ? strArray(key.fact_ids) : null
  const statements = segment.payload.statements as Array<{ id: string }> | undefined
  if (!factIds || !correctFactIds || !statements) return MALFORMED
  return {
    score: decisionAccuracy(factIds, correctFactIds, statements.map((s) => s.id)),
    reveal: { fact_ids: correctFactIds },
  }
}

export const analyzeGraders: Record<string, FamilyGrader> = {
  spot_error: gradeSpotError,
  cause_effect: gradeCauseEffect,
  compare_table: gradeCompareTable,
  read_chart: gradeReadChart,
  evidence_hunt: gradeEvidenceHunt,
  red_flags: gradeRedFlags,
  fact_opinion: gradeFactOpinion,
}
