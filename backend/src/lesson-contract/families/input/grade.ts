// `input` family — pure validators (LESSON_ENGINE.md §5.3, §6).
// Malformed answers → score 0, never throw. All helpers are dependency-free so
// Core can reuse them server-side.

import type { FamilyGrader, GradeOutcome } from '../../core/types.js'
import { fuzzyEquals, keywordCoverage, linearFalloff, numericTextEquals, ratio, toleranceBands } from '../../core/scoring.js'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

const MALFORMED: GradeOutcome = { score: 0 }

// ---- type_answer -----------------------------------------------------------------

const gradeTypeAnswer: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const text = a ? str(a.text) : null
  const accept = key ? strArray(key.accept) : null
  if (text === null || !key || !accept) return MALFORMED
  const caseSensitive = key.case_sensitive === true
  const reveal = { accept }
  // Accept "5" for "cinco" and vice versa — a number typed as a digit or
  // spelled out is the same correct answer, not a different one.
  if (accept.some((expected) => fuzzyEquals(text, expected, caseSensitive) || numericTextEquals(text, expected))) {
    return { score: 100, reveal }
  }
  const keywords = strArray(key.keywords)
  if (keywords && keywords.length > 0) {
    return { score: keywordCoverage(text, keywords, caseSensitive), reveal }
  }
  return { score: 0, reveal }
}

// ---- fill_blank ----------------------------------------------------------------

const gradeFillBlank: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const gaps = a ? obj(a.gaps) : null
  const keyGaps = key && Array.isArray(key.gaps) ? (key.gaps as unknown[]) : null
  if (!gaps || !keyGaps || keyGaps.length === 0) return MALFORMED
  const mode = segment.payload.mode === 'bank' ? 'bank' : 'typed'
  let hits = 0
  for (const raw of keyGaps) {
    const g = obj(raw)
    const gapNo = g ? num(g.gap) : null
    if (!g || gapNo === null) return MALFORMED
    const user = str(gaps[String(gapNo)])
    if (user === null) continue
    if (mode === 'bank') {
      if (str(g.bank_id) !== null && user === g.bank_id) hits++
    } else {
      const accept = strArray(g.accept)
      if (accept && accept.some((expected) => fuzzyEquals(user, expected) || numericTextEquals(user, expected))) hits++
    }
  }
  return { score: ratio(hits, keyGaps.length), reveal: { gaps: keyGaps } }
}

// ---- number_input ---------------------------------------------------------------

const gradeNumberInput: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const value = a ? num(a.value) : null
  const target = key ? num(key.value) : null
  const tolerance = key ? num(key.tolerance) : null
  if (value === null || target === null || tolerance === null) return MALFORMED
  return { score: toleranceBands(value, target, tolerance), reveal: { value: target } }
}

// ---- estimate_slider ---------------------------------------------------------------

const gradeEstimateSlider: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const value = a ? num(a.value) : null
  const target = key ? num(key.value) : null
  const full = key ? num(key.full_credit_delta) : null
  const zero = key ? num(key.zero_credit_delta) : null
  if (value === null || target === null || full === null || zero === null) return MALFORMED
  const scale = segment.payload.scale === 'log' ? 'log' : 'linear'
  return { score: linearFalloff(value, target, full, zero, scale), reveal: { value: target } }
}

// ---- count_objects ------------------------------------------------------------------

const gradeCountObjects: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const value = a ? num(a.value) : null
  const target = key ? num(key.value) : null
  if (value === null || target === null) return MALFORMED
  // Young-kid tolerance (§5.3 #18): an off-by-one count usually means one object was
  // missed or double-tapped, not a broken counting concept — worth the "almost" band
  // (40), never the "within 2× tolerance" 50 of toleranceBands. Anything further off
  // is a real miss and scores 0.
  const delta = Math.abs(value - target)
  const score = delta === 0 ? 100 : delta === 1 ? 40 : 0
  return { score, reveal: { value: target } }
}

// ---- equation_builder ---------------------------------------------------------------

type EvalToken = { kind: 'num'; value: number } | { kind: 'op'; op: '+' | '-' | '*' | '/' }

function classifyToken(text: string): EvalToken | null {
  const t = text.trim()
  if (/^\d+(\.\d+)?$/.test(t)) return { kind: 'num', value: Number(t) }
  if (t === '+') return { kind: 'op', op: '+' }
  if (t === '-') return { kind: 'op', op: '-' }
  if (t === '*' || t === '×') return { kind: 'op', op: '*' }
  if (t === '/' || t === '÷') return { kind: 'op', op: '/' }
  return null
}

/**
 * TINY safe evaluator — NO eval()/new Function(). Only literal numbers and
 * + - × ÷ * / with standard precedence (× ÷ before + −), left-to-right.
 * Returns null on ANY malformed sequence: unknown token, leading/trailing
 * operator, two adjacent operators (or numbers), or division by zero.
 */
export function evaluateTokenTexts(texts: string[]): number | null {
  if (texts.length === 0 || texts.length % 2 === 0) return null
  const tokens: EvalToken[] = []
  for (const text of texts) {
    const tok = classifyToken(text)
    if (!tok) return null
    tokens.push(tok)
  }
  // Strict alternation number/operator/number… rejects leading/trailing/adjacent operators.
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (!tok) return null
    if (i % 2 === 0 && tok.kind !== 'num') return null
    if (i % 2 === 1 && tok.kind !== 'op') return null
  }
  const first = tokens[0]
  if (!first || first.kind !== 'num') return null
  // Pass 1: fold × and ÷ into running terms; defer + and −.
  const terms: number[] = []
  const addOps: Array<'+' | '-'> = []
  let current = first.value
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const op = tokens[i]
    const rhs = tokens[i + 1]
    if (!op || op.kind !== 'op' || !rhs || rhs.kind !== 'num') return null
    if (op.op === '*') {
      current *= rhs.value
    } else if (op.op === '/') {
      if (rhs.value === 0) return null
      current /= rhs.value
    } else {
      terms.push(current)
      addOps.push(op.op)
      current = rhs.value
    }
  }
  terms.push(current)
  // Pass 2: + and − left-to-right.
  let result = terms[0] ?? 0
  addOps.forEach((op, i) => {
    const v = terms[i + 1] ?? 0
    result = op === '+' ? result + v : result - v
  })
  return Number.isFinite(result) ? result : null
}

/** Ignore spaces and unify operator glyphs so authors can write `4 × 5` or `4*5`. */
function normalizeExpression(s: string): string {
  return s.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/')
}

const gradeEquationBuilder: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const order = a ? strArray(a.order) : null
  const accepted = key ? strArray(key.accepted) : null
  const tokens = Array.isArray(segment.payload.tokens)
    ? (segment.payload.tokens as Array<{ id?: unknown; text?: unknown }>)
    : null
  const target = num(segment.payload.target_result)
  if (!order || order.length === 0 || !accepted || !tokens || target === null) return MALFORMED
  if (new Set(order).size !== order.length) return MALFORMED // each tile is placeable once
  const byId = new Map<string, string>()
  for (const tok of tokens) {
    if (typeof tok?.id === 'string' && typeof tok?.text === 'string') byId.set(tok.id, tok.text)
  }
  const texts: string[] = []
  for (const id of order) {
    const text = byId.get(id)
    if (text === undefined) return MALFORMED // only given tokens count
    texts.push(text)
  }
  const built = normalizeExpression(texts.join(''))
  const reveal = { accepted }
  if (accepted.some((expr) => normalizeExpression(expr) === built)) return { score: 100, reveal }
  const result = evaluateTokenTexts(texts)
  if (result !== null && Math.abs(result - target) < 1e-9) return { score: 100, reveal }
  return { score: 0, reveal }
}

export const inputGraders: Record<string, FamilyGrader> = {
  type_answer: gradeTypeAnswer,
  fill_blank: gradeFillBlank,
  number_input: gradeNumberInput,
  estimate_slider: gradeEstimateSlider,
  count_objects: gradeCountObjects,
  equation_builder: gradeEquationBuilder,
}
