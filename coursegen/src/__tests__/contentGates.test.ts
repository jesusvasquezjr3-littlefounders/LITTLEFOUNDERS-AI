import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { countSentences, countWords, plainText } from '../contentGates/text.js';
import { audienceForTier, captionLimit, wordLimit } from '../contentGates/budgets.js';
import { classifyPath, narrationUnits, screenBlocks } from '../contentGates/lessonModel.js';
import { verbatimCoverage } from '../contentGates/redundancy.js';
import { scanTone } from '../contentGates/tone.js';
import { runLessonContentGates, CONTENT_GATE } from '../contentGates/lessonGates.js';
import { runAllGates } from '../pipeline/gates.js';
import { lessonDocumentSchema } from '../contract/schema.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';
import { buildDocument, buildFacts, buildTaxonomy } from './fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RED_TEAM = path.resolve(here, '../contentGates/fixtures/red-team');
const young = audienceForTier(buildTaxonomy(), 'tier1');
const teen = { young: false, label: 'teen' };

function redTeam(name: string) {
  return JSON.parse(readFileSync(path.join(RED_TEAM, `${name}.json`), 'utf8')) as { tier: string; document: unknown };
}

describe('text measurement mirrors the Bible 06 reference audit', () => {
  it('counts words the way the copy-budget tool does', () => {
    // Bible 06 §3: "25%", "Sofía's" and "60" each count as one word.
    expect(countWords("25% of Sofía's 60 coins")).toBe(5);
    // Bible 06 §6 "within budget" examples.
    expect(countWords('We use it to keep you safe.')).toBe(7);
    expect(countWords('A parent creates your account.')).toBe(5);
    expect(countWords('Tricky one. Want to see it together?')).toBe(7);
    expect(countWords('Pay coins for bonus tasks only. Everyday help stays unpaid.')).toBe(10);
  });

  it('counts sentences, keeping abbreviations and Spanish openers', () => {
    expect(countSentences('Tricky one. Want to see it together?')).toBe(2);
    expect(countSentences('Dr. Rho helps you think.')).toBe(1);
    expect(countSentences('Mira el frasco. ¿Cuántas monedas hay?')).toBe(2);
  });

  it('strips MarkdownLite before measuring', () => {
    expect(plainText('**5** pesos\n- uno\n- ==dos==')).toBe('5 pesos uno dos');
  });
});

describe('OD-13 budgets', () => {
  it('applies Bible 06 §3.1 limits, 6–9 reductions and the ×1.25 es/pt factor rounded up', () => {
    expect(wordLimit('prompt', 'en-US', teen)).toBe(20);
    expect(wordLimit('prompt', 'en-US', young)).toBe(12);
    expect(wordLimit('prompt', 'es-MX', young)).toBe(15);
    expect(wordLimit('option', 'pt-BR', young)).toBe(7); // ceil(5 × 1.25)
    expect(wordLimit('option', 'en-US', teen)).toBe(8);
    expect(wordLimit('mentor', 'es-MX', teen)).toBe(25);
    expect(wordLimit('heading', 'es-MX', young)).toBe(8); // headings have no 6–9 reduction
    expect(wordLimit('body', 'en-US', young)).toBe(12);
    expect(wordLimit('detail', 'en-US', teen)).toBe(60);
    expect(captionLimit('en-US', young)).toEqual({ words: 12, sentences: 2 });
  });

  it('resolves the audience conservatively from the tier ages', () => {
    const taxonomy = buildTaxonomy({
      age_tiers: {
        ...buildTaxonomy().age_tiers,
        tier4: { ages: '12-18', forbidden_vocabulary: { 'es-MX': [], 'en-US': [], 'pt-BR': [] } },
      },
    });
    expect(audienceForTier(taxonomy, 'tier1').young).toBe(true); // 6-7
    expect(audienceForTier(taxonomy, 'tier2').young).toBe(true); // 8-10 still serves 8- and 9-year-olds
    expect(audienceForTier(taxonomy, 'tier4').young).toBe(false); // 12-18
    expect(audienceForTier(taxonomy, 'tier1', 'adult').young).toBe(false);
    expect(audienceForTier(taxonomy, 'tier9').young).toBe(true); // unknown ages: the stricter reading
  });
});

describe('screen-role classification is total over the v1 contract', () => {
  interface ZodDefLite {
    type: string;
    shape?: Record<string, z.ZodTypeAny>;
    element?: z.ZodTypeAny;
    innerType?: z.ZodTypeAny;
    in?: z.ZodTypeAny;
    options?: z.ZodTypeAny[];
    items?: z.ZodTypeAny[];
    valueType?: z.ZodTypeAny;
  }
  const defOf = (schema: z.ZodTypeAny) => (schema as unknown as { _zod?: { def?: ZodDefLite } })._zod?.def;

  function stringPaths(schema: z.ZodTypeAny, path: Array<string | number>, out: Array<Array<string | number>>): void {
    const def = defOf(schema);
    if (!def) return;
    switch (def.type) {
      case 'string':
        out.push(path);
        return;
      case 'optional':
      case 'nullable':
      case 'default':
        if (def.innerType) stringPaths(def.innerType, path, out);
        return;
      case 'pipe':
        if (def.in) stringPaths(def.in, path, out);
        return;
      case 'array':
        if (def.element) stringPaths(def.element, [...path, 0], out);
        return;
      case 'tuple':
        (def.items ?? []).forEach((item, i) => stringPaths(item, [...path, i], out));
        return;
      case 'union':
        for (const option of def.options ?? []) stringPaths(option, path, out);
        return;
      case 'record':
        if (def.valueType) stringPaths(def.valueType, [...path, 'key'], out);
        return;
      case 'object':
        for (const [key, value] of Object.entries(def.shape ?? {})) stringPaths(value, [...path, key], out);
        return;
      default:
        return;
    }
  }

  it('gives every string field of all segment schemas a role (or an explicit skip)', () => {
    const unclassified: string[] = [];
    let total = 0;
    for (const [type, schema] of TYPE_TO_SCHEMA) {
      const paths: Array<Array<string | number>> = [];
      stringPaths(schema, [], paths);
      for (const p of paths) {
        if (p.length === 1 && (p[0] === 'id' || p[0] === 'type')) continue;
        total += 1;
        if (classifyPath(p, type) === undefined) unclassified.push(`${type}: ${p.join('.')}`);
      }
    }
    expect(total).toBeGreaterThan(150); // the walker really walked the 56 schemas
    expect(unclassified, `add a role in lessonModel.ts classifyPath for: ${unclassified.join(', ')}`).toEqual([]);
  });

  it('classifies the fields that decide the budget correctly', () => {
    expect(classifyPath(['prompt_md'], 'quiz_mcq')).toBe('prompt');
    expect(classifyPath(['payload', 'options', 0, 'text_md'], 'quiz_mcq')).toBe('option');
    expect(classifyPath(['payload', 'lines', 1, 'text_md'], 'story_dialogue')).toBe('mentor');
    expect(classifyPath(['payload', 'body_md'], 'story_scene')).toBe('mentor');
    expect(classifyPath(['payload', 'ideas', 0, 'body_md'], 'key_ideas')).toBe('body');
    expect(classifyPath(['payload', 'text_md'], 'fill_blank')).toBe('prompt');
    expect(classifyPath(['payload', 'rows', 0, 'label'], 'compare_table')).toBe('data');
    expect(classifyPath(['explanation_md'], 'quiz_mcq')).toBe('body');
    expect(classifyPath(['hints', 0], 'quiz_mcq')).toBe('detail');
    expect(classifyPath(['answer', 'reveal_md'], 'would_you_rather')).toBe('body');
    expect(classifyPath(['answer', 'accept', 0], 'type_answer')).toBe('skip');
    expect(classifyPath(['narration', 'script_md'], 'quiz_mcq')).toBe('skip');
    expect(classifyPath(['audio_segment_id'], 'quiz_mcq')).toBe('skip');
  });
});

describe('narration model mirrors Echo (audiogen extractNarratables)', () => {
  it('produces Echo unit ids and links each unit to the block it voices', () => {
    const units = narrationUnits(buildDocument() as never);
    const ids = units.map((u) => u.unitId);
    expect(ids).toContain('s1.prompt');
    expect(ids).toContain('s1.body');
    expect(ids).toContain('s2.choices');
    expect(units.find((u) => u.unitId === 's1.body')?.voices).toEqual(['payload.body_md']);
    expect(units.find((u) => u.unitId === 's2.choices')?.voices).toEqual(['payload.options[0].text_md', 'payload.options[1].text_md']);
  });

  it('honours the B.18 channel declaration exactly as Echo does', () => {
    const document = buildDocument();
    (document.segments[0] as { narration?: unknown }).narration = { mode: 'text_only' };
    (document.segments[1] as { narration?: unknown }).narration = { mode: 'differentiated', script_md: 'Dos y dos, piensa en tus dedos.' };
    const units = narrationUnits(document as never);
    expect(units.some((u) => u.segmentId === 's1')).toBe(false);
    const prompt = units.find((u) => u.unitId === 's2.prompt');
    expect(prompt?.script).toBe(true);
    expect(prompt?.voices).toEqual([]);
    expect(prompt?.text).toBe('Dos y dos, piensa en tus dedos.');
  });

  it('the declaration is part of the contract (and nothing else is accepted)', () => {
    const ok = buildDocument();
    (ok.segments[1] as { narration?: unknown }).narration = { mode: 'differentiated', script_md: 'Explica.' };
    expect(lessonDocumentSchema.safeParse(ok).success).toBe(true);
    const bad = buildDocument();
    (bad.segments[1] as { narration?: unknown }).narration = { mode: 'audio_only' };
    expect(lessonDocumentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('B.18 redundancy gate (gate 11)', () => {
  it('measures verbatim coverage by runs of three words', () => {
    expect(verbatimCoverage(['a', 'b', 'c', 'd'], ['x', 'a', 'b', 'c', 'd'])).toBe(1);
    expect(verbatimCoverage(['a', 'b', 'x', 'd'], ['a', 'b', 'c', 'd'])).toBe(0);
    expect(verbatimCoverage(['hola'], ['hola'])).toBe(1); // a one-word block needs the whole block
  });

  it('lets a caption repeat its narration, and fails a long narrated block', () => {
    const document = buildDocument();
    const long = 'Liruf mira el frasco de monedas y cuenta una por una muy despacio para saber cuántas tiene guardadas hoy en su puesto.';
    (document.segments[0] as { payload: { body_md: string } }).payload.body_md = long;
    // 22 words: over the 6–9 es-MX caption (ceil(12 × 1.25) = 15), within the teen one (25).
    const report = runLessonContentGates(document as never, young);
    expect(report.redundancy.map((f) => [f.segmentId, f.path])).toEqual([['s1', 'payload.body_md']]);
    expect(runLessonContentGates(document as never, teen).redundancy).toEqual([]);
    expect(report.redundancy[0]!.message).toContain('text_only');
    // The same document with short text passes.
    expect(runLessonContentGates(buildDocument() as never, teen).redundancy).toEqual([]);
  });

  it('accepts either remedy: text_only, or a differentiated script with a short cue', () => {
    const long = 'Liruf vende limonada en la plaza. Cada vaso le cuesta 3 monedas de limones y azúcar. ¿Qué precio le conviene?';
    const textOnly = buildDocument();
    (textOnly.segments[1] as { prompt_md: string }).prompt_md = long;
    expect(runLessonContentGates(textOnly as never, teen).redundancy).toHaveLength(1);
    (textOnly.segments[1] as { narration?: unknown }).narration = { mode: 'text_only' };
    expect(runLessonContentGates(textOnly as never, teen).redundancy).toEqual([]);

    const differentiated = buildDocument();
    (differentiated.segments[1] as { narration?: unknown }).narration = { mode: 'differentiated', script_md: long };
    expect(runLessonContentGates(differentiated as never, teen).redundancy).toEqual([]);
  });

  it('fails a differentiated script that only repeats the on-screen cue', () => {
    const document = buildDocument();
    (document.segments[1] as { narration?: unknown }).narration = { mode: 'differentiated', script_md: '¿Cuánto es 2 más 2?' };
    const report = runLessonContentGates(document as never, teen);
    expect(report.redundancy.map((f) => f.kind)).toEqual(['script-repeats-cue']);
  });
});

describe('B.14 Law 2 tone gate (gate 12)', () => {
  it('blocks voiced hype and resource-exhaustion wording in every locale', () => {
    expect(scanTone('Act now and double your money!', 'en-US', 'lesson').map((f) => [f.phrase, f.severity])).toEqual([
      ['double your money', 'block'],
      ['act now', 'block'],
    ]);
    expect(scanTone('No quedan intentos para esta pregunta.', 'es-MX', 'lesson')[0]?.severity).toBe('block');
    expect(scanTone('Não há mais tentativas para esta pergunta.', 'pt-BR', 'ui')[0]?.phrase).toBe('nao ha mais tentativas');
    // The SPEC's own example (B.14 Current State) — reported once, by its most specific phrase.
    expect(scanTone('No attempts left for this question.', 'en-US', 'ui').map((f) => f.phrase)).toEqual(['no attempts left']);
  });

  it('blocks banking-frame wording in system copy but sends it to review in lessons', () => {
    expect(scanTone('Insufficient funds', 'en-US', 'ui')[0]?.severity).toBe('block');
    expect(scanTone('Insufficient funds', 'en-US', 'lesson')[0]?.severity).toBe('review');
    expect(scanTone('Ver el estado de cuenta', 'es-MX', 'ui')[0]?.severity).toBe('block');
  });

  it('downgrades quoted, negated, warned and examined uses to human review — never to a silent pass', () => {
    expect(scanTone('Un mensaje dice: "¡duplica tu dinero hoy!"', 'es-MX', 'lesson')[0]).toMatchObject({ severity: 'review', downgraded: 'quoted' });
    expect(scanTone("Cuando alguien te ofrece 'gana tú, sin riesgo para ti', pregúntate.", 'es-MX', 'lesson')[0]).toMatchObject({ severity: 'review', downgraded: 'quoted' });
    expect(scanTone('No investment is ever risk-free.', 'en-US', 'lesson')[0]).toMatchObject({ severity: 'review', downgraded: 'negated' });
    expect(scanTone('La primera señal: ganancia garantizada.', 'es-MX', 'lesson')[0]).toMatchObject({ severity: 'review', downgraded: 'warned' });
    expect(scanTone('Só hoje! Aja agora!', 'pt-BR', 'lesson', { examined: true }).every((f) => f.downgraded === 'examined')).toBe(true);
  });

  it('never treats an apostrophe as a quotation mark', () => {
    expect(scanTone("Liruf's stand says get rich and don't wait", 'en-US', 'lesson')[0]).toMatchObject({ phrase: 'get rich', severity: 'block' });
  });

  it('does not flag ordinary story language', () => {
    expect(scanTone('Liruf is in a hurry to reach the moon before the balance tips.', 'en-US', 'lesson')).toEqual([]);
    expect(scanTone('Dina tiene tiempo limitado para el reto.', 'es-MX', 'lesson').every((f) => f.severity === 'review')).toBe(true);
  });
});

describe('OD-13 Copy Budget gate (gate 13)', () => {
  it('fails an over-budget prompt, option and Mentor turn with the exact numbers', () => {
    const document = buildDocument();
    (document.segments[1] as { prompt_md: string }).prompt_md = 'Liruf tiene dos monedas en una mano y dos monedas en la otra mano. ¿Cuánto es?';
    (document.segments[1] as { narration?: unknown }).narration = { mode: 'text_only' };
    (document.segments[1] as { payload: { options: Array<{ text_md: string }> } }).payload.options[0]!.text_md = 'Cuatro monedas en total para Liruf hoy mismo';
    const report = runLessonContentGates(document as never, young);
    const roles = report.copyBudget.map((f) => [f.path, f.role, f.words, f.wordLimit]);
    expect(roles).toEqual([
      ['prompt_md', 'prompt', 16, 15],
      ['payload.options[0].text_md', 'option', 8, 7],
    ]);
  });

  it('applies the 6–9 limits and the es/pt factor', () => {
    const document = buildDocument();
    (document.segments[1] as { payload: { options: Array<{ text_md: string }> } }).payload.options[0]!.text_md = 'Cuatro monedas de Liruf para hoy mismo aquí';
    (document.segments[1] as { narration?: unknown }).narration = { mode: 'text_only' };
    expect(runLessonContentGates(document as never, young).copyBudget.map((f) => f.role)).toEqual(['option']); // 8 words > ceil(5 × 1.25) = 7
    expect(runLessonContentGates(document as never, teen).copyBudget).toEqual([]); // 8 ≤ ceil(8 × 1.25) = 10
  });
});

describe('the gates run inside runAllGates and block the red-team lessons (Appendix C DoD "Gated")', () => {
  const ctx = { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() };

  it('a compliant lesson passes every content gate', () => {
    const report = runAllGates(redTeam('compliant').document, ctx);
    expect(report.problems.filter((p) => p.gate >= 11)).toEqual([]);
  });

  it.each([
    ['b18-redundancy', CONTENT_GATE.redundancy],
    ['b14-tone', CONTENT_GATE.tone],
    ['od13-copy-budget', CONTENT_GATE.copyBudget],
  ])('%s fails only its own gate', (name, gate) => {
    const report = runAllGates(redTeam(name).document, ctx);
    expect(report.ok).toBe(false);
    const contentGates = new Set(report.problems.filter((p) => p.gate >= 11).map((p) => p.gate));
    expect([...contentGates]).toEqual([gate]);
  });

  it('screens every learner-visible string, including answer feedback', () => {
    const { blocks } = screenBlocks(redTeam('b14-tone').document as never);
    expect(blocks.map((b) => b.path)).toContain('payload.options[1].rationale_md');
  });

  it('the adult register never gets the 6–9 limits', () => {
    const document = redTeam('od13-copy-budget').document;
    const kid = runAllGates(document, ctx).problems.filter((p) => p.gate === CONTENT_GATE.copyBudget).length;
    const adult = runAllGates(document, { ...ctx, register: 'adult' }).problems.filter((p) => p.gate === CONTENT_GATE.copyBudget).length;
    expect(adult).toBeLessThan(kid);
  });
});

describe('author guidance states the enforced numbers', () => {
  it('derives the write-prompt budgets from the same limits the gates use', async () => {
    const { contentGateGuidance } = await import('../contentGates/guidance.js');
    const text = contentGateGuidance(young);
    expect(text).toContain('<= 15 words and 2 sentences'); // prompt, 6–9, es-MX
    expect(text).toContain('<= 7 words and 1 sentence'); // option, 6–9, es-MX
    expect(text).toContain('"mode": "text_only"');
    expect(contentGateGuidance(teen)).toContain('<= 25 words and 2 sentences');
  });
});
