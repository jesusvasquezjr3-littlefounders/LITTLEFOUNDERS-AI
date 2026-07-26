import { describe, expect, it } from 'vitest';
import { learnerText, readabilityScore, runReadabilityGate, syllableCount } from '../pipeline/readability.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/*
 * Gate 9 contract: catch OUTLIERS (adult-paragraph text in a kids' lesson)
 * deterministically, and NEVER fail judge-approved content — the bands were
 * calibrated against the 186 published documents (0 problems, verified
 * 2026-07-25 with the live corpus; the distribution facts are pinned in
 * readability.ts). These tests pin the formulas and both sides of each band.
 */

function doc(locale: string, texts: string[]): LessonDocumentParsed {
  return {
    schema_version: 1,
    meta: { slug: 'r', title: 'R', locale, subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: texts.map((text, i) => ({ id: `s${i}`, type: 'story_scene', prompt_md: text, difficulty: 1, xp: 0, payload: {} })),
  } as unknown as LessonDocumentParsed;
}

const KID_ES = 'Dina vende limonada. Cada vaso cuesta cinco pesos. Hoy vino mucha gente. Todos quieren un vaso frío. Dina cuenta sus monedas con calma. Luego guarda una parte para su meta. Así crece su ahorro cada semana. Su amigo Liruf la ayuda a contar.';
const ADULT_ES = 'La determinación sistemática de la rentabilidad operativa correspondiente requiere consideraciones metodológicas extraordinariamente sofisticadas, incorporando simultáneamente la contabilización pormenorizada de las obligaciones tributarias, la depreciación acumulada de los activos institucionales y la periodificación de los ingresos extraordinarios provenientes de instrumentos financieros internacionales.';

describe('syllableCount', () => {
  it.each([
    ['limonada', 'es-MX', 4],
    ['peso', 'es-MX', 2],
    ['tienda', 'es-MX', 2], // ie diphthong = one group
    ['dinheiro', 'pt-BR', 3],
    ['money', 'en-US', 2],
    ['make', 'en-US', 1], // silent e
    ['table', 'en-US', 2], // -le keeps its syllable
  ])('%s (%s) = %d', (word, locale, expected) => {
    expect(syllableCount(word, locale as 'en-US' | 'es-MX' | 'pt-BR')).toBe(expected);
  });
});

describe('readabilityScore', () => {
  it('returns null under 30 words — too short for a verdict', () => {
    expect(readabilityScore('Hola. Compra pan.', 'es-MX')).toBeNull();
  });

  it('scores kid Spanish far EASIER than adult bureaucratic Spanish', () => {
    const kid = readabilityScore(KID_ES, 'es-MX');
    const adult = readabilityScore(ADULT_ES, 'es-MX');
    expect(kid).not.toBeNull();
    expect(adult).not.toBeNull();
    expect(kid!).toBeGreaterThan(adult! + 40); // higher = easier on FH
  });
});

describe('runReadabilityGate', () => {
  it('passes kid-level text for its tier', () => {
    expect(runReadabilityGate(doc('es-MX', [KID_ES]), 'tier2')).toEqual([]);
  });

  it('fails adult-paragraph Spanish in a kids tier, naming score and floor', () => {
    const problems = runReadabilityGate(doc('es-MX', [ADULT_ES, ADULT_ES]), 'tier2');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.gate).toBe(9);
    expect(problems[0]?.message).toMatch(/Fernández-Huerta/);
  });

  it('tier bands tighten downward: text passing tier3 can fail tier1', () => {
    // Mid-difficulty Spanish MEASURED between the tier1 floor (66) and tier3
    // floor (54): 1 adult sentence + 5 kid paragraphs scores 58.6 (measured
    // 2026-07-25 — blends were measured, not guessed, after the first guess
    // landed outside the band).
    const MID = ADULT_ES + ' ' + Array(5).fill(KID_ES).join(' ');
    const score = readabilityScore(learnerText(doc('es-MX', [MID])), 'es-MX')!;
    expect(score).toBeGreaterThan(54);
    expect(score).toBeLessThan(66);
    expect(runReadabilityGate(doc('es-MX', [MID]), 'tier3')).toEqual([]);
    expect(runReadabilityGate(doc('es-MX', [MID]), 'tier1')).toHaveLength(1);
  });

  it('unknown tier passes (catalog schema owns tier vocabulary)', () => {
    expect(runReadabilityGate(doc('es-MX', [ADULT_ES, ADULT_ES]), 'tier9')).toEqual([]);
  });

  it('too-little text passes — no verdict is not a failure', () => {
    expect(runReadabilityGate(doc('es-MX', ['Corto.']), 'tier1')).toEqual([]);
  });
});
