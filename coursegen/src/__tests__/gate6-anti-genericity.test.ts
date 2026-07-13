// Gate 6 — anti-genericity (COURSE_ENGINE.md §4 gate stage, deterministic,
// runs BEFORE the judge). Three independent detectors:
//   (a) prompt_md near-duplicate of the lesson/topic title
//   (b) explanation_md too short, or grounded in nothing (no digit, no
//       canon character, no payload-referenced entity)
//   (c) per-locale banned filler phrases

import { describe, expect, it } from 'vitest';
import { runAntiGenericityGate, runAllGates } from '../pipeline/gates.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';

describe('gate 6a: title echo (near-duplicate prompt_md)', () => {
  it('flags a prompt_md that is essentially the lesson title restated', () => {
    const doc = buildDocument({ meta: { ...buildDocument().meta, title: 'Cómo funcionan las monedas' } });
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'irrelevant';
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md = 'Cómo funcionan las monedas';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('near-duplicate'))).toBe(true);
  });

  it('flags a prompt_md near-duplicate of the TOPIC title when provided', () => {
    const doc = buildDocument();
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md = 'El ahorro es importante para todos';
    const problems = runAntiGenericityGate(doc, { topicTitle: 'El ahorro es importante para todos!' });
    expect(problems.some((p) => p.gate === 6 && p.message.includes('near-duplicate'))).toBe(true);
  });

  it('does not flag a prompt_md that meaningfully differs from the title', () => {
    const doc = buildDocument({ meta: { ...buildDocument().meta, title: 'Cómo funcionan las monedas' } });
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md =
      '¿Cuántas monedas de 2 pesos necesita Dina para juntar 10 pesos?';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.message.includes('near-duplicate'))).toBe(false);
  });
});

describe('gate 6b: explanation_md grounding', () => {
  it('flags an explanation_md shorter than 40 chars', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { explanation_md: string }).explanation_md = 'Muy bien hecho.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('too short'))).toBe(true);
  });

  it('flags an explanation_md >=40 chars with no digit, character, or payload entity', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { explanation_md: string }).explanation_md =
      'Es importante entender bien el concepto para poder aplicarlo despues.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('too generic'))).toBe(true);
  });

  it('passes an explanation_md grounded by a digit', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { explanation_md: string }).explanation_md =
      'Sumando 2 más 2 obtienes 4 — por eso la respuesta correcta es esa cantidad exacta.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.filter((p) => p.segmentId === 's2')).toHaveLength(0);
  });

  it('passes an explanation_md grounded by a canon character name', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { explanation_md: string }).explanation_md =
      'Dina cuenta sus monedas despacio para no perderse ni una sola de ellas al pagar.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.filter((p) => p.segmentId === 's2')).toHaveLength(0);
  });

  it('passes an explanation_md grounded by a payload-referenced entity', () => {
    const doc = buildDocument();
    // segment s5 (needs_wants) payload has an item "Videojuego" (i4) among others.
    (doc.segments[4] as unknown as { explanation_md: string }).explanation_md =
      'Un videojuego es un gusto, no una necesidad — por eso no cuenta entre las cosas básicas.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.filter((p) => p.segmentId === 's5')).toHaveLength(0);
  });

  it('is a no-op when explanation_md is absent entirely', () => {
    const doc = buildDocument();
    const problems = runAntiGenericityGate(doc);
    expect(problems.filter((p) => p.message.includes('explanation_md'))).toHaveLength(0);
  });
});

describe('gate 6c: banned filler phrases per locale', () => {
  it('flags an es-MX filler phrase in prompt_md', () => {
    const doc = buildDocument();
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md = 'Esto es muy importante para tu futuro.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('banned filler phrase'))).toBe(true);
  });

  it('flags an es-MX filler phrase accent-insensitively in explanation_md', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { explanation_md: string }).explanation_md =
      'Como ya sabemos, contar monedas nos ayuda mucho en la vida diaria de todos.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('banned filler phrase'))).toBe(true);
  });

  it('flags the en-US equivalent filler list when meta.locale is en-US', () => {
    const doc = buildDocument({ meta: { ...buildDocument().meta, locale: 'en-US' } });
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md = 'As we already know, coins have value.';
    const problems = runAntiGenericityGate(doc);
    expect(problems.some((p) => p.gate === 6 && p.message.includes('banned filler phrase'))).toBe(true);
  });

  it('does not flag clean, concrete text', () => {
    const doc = buildDocument();
    const problems = runAntiGenericityGate(doc);
    expect(problems.filter((p) => p.message.includes('banned filler phrase'))).toHaveLength(0);
  });
});

describe('runAllGates — gate 6 wiring', () => {
  it('runs gate 6 as part of the full cascade and reports gate:6 problems', () => {
    const doc = buildDocument();
    (doc.segments[0] as unknown as { prompt_md: string }).prompt_md = 'Esto es muy importante para tu futuro.';
    const report = runAllGates(doc, { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.gate === 6)).toBe(true);
  });

  it('a clean document still passes the full cascade including gate 6', () => {
    const report = runAllGates(buildDocument(), { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
    expect(report.ok).toBe(true);
  });

  it('skipVocabularyGate omits gate 2 problems entirely (adult register)', () => {
    const doc = buildDocument();
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'Hoy hablamos de préstamo y monedas.';
    const gated = runAllGates(doc, { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
    expect(gated.problems.some((p) => p.gate === 2)).toBe(true);

    const skipped = runAllGates(doc, {
      taxonomy: buildTaxonomy(),
      tier: 'tier1',
      facts: buildFacts(),
      skipVocabularyGate: true,
    });
    expect(skipped.problems.some((p) => p.gate === 2)).toBe(false);
  });
});
