import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { generatePack, loadSituations, packSchema, validatePack, type MoneyMomentPack } from '../tutor/moneyMoments.js';

/*
 * Money Moments contract: the curated taxonomy loads and stays closed;
 * generation retries on bad JSON; deterministic validation catches the
 * defects a pack must never ship with (two corrects, tier-forbidden words,
 * adult-paragraph text).
 */

const GOOD: MoneyMomentPack = {
  terms: [
    { term: 'mesada', kid_definition: 'El dinero que te dan cada semana. Es tuyo y tú decides.' },
    { term: 'apartar', kid_definition: 'Guardar una parte antes de gastar para tu meta.' },
    { term: 'meta', kid_definition: 'Eso grande que quieres comprar con tu ahorro.' },
  ],
  phrases: [
    { say_md: 'Antes de gastar, aparto diez pesos.', why_md: 'Así tu meta avanza cada semana sin pensarlo.' },
    { say_md: '¿De verdad lo quiero hoy?', why_md: 'Esperar un día mata casi todos los antojos.' },
  ],
  quick_check: {
    question_md: 'Te dan cincuenta pesos. ¿Qué haces primero?',
    options: [
      { id: 'a', text_md: 'Aparto una parte para mi meta.', correct: true, rationale_md: 'Apartar primero hace crecer tu ahorro siempre.' },
      { id: 'b', text_md: 'Gasto todo hoy mismo.', correct: false, rationale_md: 'Sin apartar primero, la meta nunca avanza.' },
      { id: 'c', text_md: 'No gasto nada nunca.', correct: false, rationale_md: 'Ahorrar es decidir, no castigarte.' },
    ],
  },
};

describe('situations catalog', () => {
  it('loads the curated taxonomy — closed set, unique ids, position-ordered', () => {
    const situations = loadSituations(path.join('curriculum', 'money-moments', 'situations.yaml'));
    expect(situations.length).toBeGreaterThanOrEqual(8);
    expect(new Set(situations.map((s) => s.id)).size).toBe(situations.length);
    expect(situations[0]?.id).toBe('mesada');
    // Every situation is fully trilingual BY SCHEMA — no mechanical translation later.
    for (const s of situations) {
      expect(s.title['pt-BR'].length).toBeGreaterThan(0);
      expect(s.description['en-US'].length).toBeGreaterThan(0);
    }
  });
});

describe('validatePack', () => {
  it('accepts a good pack', () => {
    expect(validatePack(GOOD, 'es-MX', ['interés compuesto'])).toEqual([]);
  });

  it('rejects two correct options', () => {
    const bad = structuredClone(GOOD);
    bad.quick_check.options[1]!.correct = true;
    expect(validatePack(bad, 'es-MX', [])).toEqual([expect.stringContaining('EXACTLY one correct')]);
  });

  it('rejects tier-forbidden vocabulary anywhere in the pack', () => {
    const bad = structuredClone(GOOD);
    bad.terms[0]!.kid_definition = 'Tu dinero crece con interés compuesto cada semana.';
    expect(validatePack(bad, 'es-MX', ['interés compuesto'])).toEqual([expect.stringContaining('forbidden vocabulary')]);
  });

  it('rejects duplicate option ids', () => {
    const bad = structuredClone(GOOD);
    bad.quick_check.options[2]!.id = 'a';
    expect(validatePack(bad, 'es-MX', [])).toEqual([expect.stringContaining('unique')]);
  });
});

describe('generatePack', () => {
  const situation = loadSituations(path.join('curriculum', 'money-moments', 'situations.yaml'))[0]!;

  it('parses a valid model reply against the pack schema', async () => {
    const complete = vi.fn().mockResolvedValue({ content: JSON.stringify(GOOD), promptTokens: 1, completionTokens: 1, cachedPromptTokens: 0 });
    const pack = await generatePack(situation, 'tier2', 'es-MX', { complete: complete as never });
    expect(packSchema.safeParse(pack).success).toBe(true);
    // The situation and locale made it into the prompt; free text from a kid never can (closed taxonomy).
    const sent = complete.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(sent.messages.map((m) => m.content).join('\n')).toContain('Día de mesada');
  });

  it('feeds Zod issues back and succeeds on the corrective retry', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({ content: '{"terms": []}', promptTokens: 1, completionTokens: 1, cachedPromptTokens: 0 })
      .mockResolvedValueOnce({ content: JSON.stringify(GOOD), promptTokens: 1, completionTokens: 1, cachedPromptTokens: 0 });
    const pack = await generatePack(situation, 'tier2', 'es-MX', { complete: complete as never });
    expect(pack.terms).toHaveLength(3);
    expect(complete).toHaveBeenCalledTimes(2);
    const retry = complete.mock.calls[1]?.[0] as { messages: { content: string }[] };
    expect(retry.messages[retry.messages.length - 1]?.content).toContain('falló');
  });
});
