// S05.4b — lesson-policy gates 14-16: B.17 concept cap, B.11 mentor
// misjudgment, B.16 regional adaptation. Adversarial by design: each gate is
// shown blocking a deliberately non-compliant sample (Appendix C DoD "Gated")
// and passing a compliant one, at both the catalog and the document boundary.

import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { analyzeConceptCatalog, workingMemoryBand, CONCEPT_CEILINGS } from '../contentGates/conceptCap.js';
import { scanShame, voicedMoments, SHAME_LEXICON } from '../contentGates/misjudgment.js';
import {
  adaptationBrief,
  analyzeRegionalLesson,
  checkRegionalDocument,
  loadMarketInventory,
  marketContextIn,
  regionalRequirement,
  MARKETS,
} from '../contentGates/regional.js';
import { buildCoursePolicy, runLessonPolicyGates, POLICY_GATE, type LessonPolicy } from '../contentGates/policyGates.js';
import { lessonPolicyGuidance } from '../contentGates/guidance.js';
import { runAllGates } from '../pipeline/gates.js';
import { localizeLesson, LocalizeContentGateError, translationSystemPrompt } from '../pipeline/localize.js';
import { loadCourseCatalog } from '../catalog/loader.js';
import type { MarketScenario } from '../catalog/schema.js';
import { buildFacts, buildTaxonomy } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '../..');
const RED_TEAM = path.join(PACKAGE_ROOT, 'src/contentGates/fixtures/red-team');
const markets = loadMarketInventory();
const taxonomy = buildTaxonomy();

function sample(name: string): { tier: string; policy: LessonPolicy; document: Record<string, unknown> } {
  return JSON.parse(readFileSync(path.join(RED_TEAM, `${name}.json`), 'utf8'));
}

const SCENARIOS: Record<'es-MX' | 'en-US' | 'pt-BR', MarketScenario> = {
  'es-MX': { scenario: 'Liruf compra fruta en el tianguis del domingo y paga en pesos.', problem_refs: ['mx-cash-and-informal-commerce'], anchors: ['tianguis'] },
  'en-US': { scenario: 'Liruf buys fruit at a neighbourhood yard sale on Saturday morning.', problem_refs: ['us-parent-silence'], anchors: ['yard sale'] },
  'pt-BR': { scenario: 'Liruf compra frutas na feira livre do bairro e paga em reais.', problem_refs: ['br-baseline-literacy-gap'], anchors: ['feira livre'] },
};

describe('B.17 working-memory bands and ceilings', () => {
  it('uses the SPEC ranges: upper end blocks, lower end is the review target', () => {
    expect(CONCEPT_CEILINGS).toEqual({ '6-9': { target: 2, ceiling: 3 }, '10-12': { target: 3, ceiling: 4 }, '13+': { target: 4, ceiling: 6 } });
  });

  it('decides the band by the youngest age a tier serves', () => {
    const tiers = buildTaxonomy({
      age_tiers: {
        tier1: { ages: '6-7', forbidden_vocabulary: {} },
        tier2: { ages: '8-10', forbidden_vocabulary: {} },
        tier3: { ages: '10-12', forbidden_vocabulary: {} },
        tier4: { ages: '12-18', forbidden_vocabulary: {} },
        tier5: { ages: '13-17', forbidden_vocabulary: {} },
      },
    });
    expect(['tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((t) => workingMemoryBand(tiers, t))).toEqual(['6-9', '6-9', '10-12', '10-12', '13+']);
    expect(workingMemoryBand(tiers, 'tier1', 'adult')).toBe('13+');
    expect(workingMemoryBand(tiers, 'missing')).toBe('6-9');
  });
});

describe('B.17 concept-cap gate over the catalog (course order)', () => {
  const lesson = (slug: string, declared?: string[], extra: { tier?: string; review?: boolean } = {}) => ({
    slug,
    path: `a/s/t/${slug}`,
    tier: extra.tier ?? 'tier1',
    review: extra.review ?? false,
    ...(declared ? { declared } : {}),
  });

  it('blocks undeclared density, a re-declared concept, new concepts in a review lesson and a lesson over the ceiling', () => {
    const result = analyzeConceptCatalog(
      [
        lesson('l1', ['precio', 'costo']),
        lesson('l2'),
        lesson('l3', ['precio']),
        lesson('l4', ['ganancia'], { review: true }),
        lesson('l5', ['a', 'b', 'c', 'd']),
      ],
      taxonomy,
      undefined,
    );
    const blocks = result.findings.filter((f) => f.severity === 'block');
    expect(blocks.map((f) => f.lesson)).toEqual(['l2', 'l3', 'l4', 'l5']);
    expect(blocks[0]!.message).toMatch(/new_concepts is not declared/);
    expect(blocks[1]!.message).toMatch(/"precio" was already introduced in a\/s\/t\/l1; it is reinforcement/);
    expect(blocks[2]!.message).toMatch(/review lesson consolidates/);
    expect(blocks[3]!.message).toMatch(/4 new concepts exceed the 6-9 working-memory ceiling of 3 — split the lesson/);
    expect(result.declaredLessons).toBe(4);
  });

  it('sends a count above the target but within the ceiling to Stage 3 review, and passes the target', () => {
    const result = analyzeConceptCatalog([lesson('l1', ['a', 'b']), lesson('l2', ['c', 'd', 'e'])], taxonomy, undefined);
    expect(result.findings).toEqual([expect.objectContaining({ lesson: 'l2', severity: 'review' })]);
    const teen = analyzeConceptCatalog([lesson('l1', ['a', 'b', 'c', 'd', 'e', 'f'])], taxonomy, undefined, 'adult');
    expect(teen.findings.filter((f) => f.severity === 'block')).toEqual([]);
  });

  it('never counts a prerequisite course concept as new, and lists later concepts with terms for the document gate', () => {
    const registry = {
      schema_version: 1 as const,
      concepts: {
        moneda: { label: { 'en-US': 'coin', 'es-MX': 'moneda', 'pt-BR': 'moeda' }, from_course: 'financial-education' },
        ahorro: { label: { 'en-US': 'saving', 'es-MX': 'ahorro', 'pt-BR': 'poupança' }, terms: { 'es-MX': ['ahorrar'] } },
        huerfano: { label: { 'en-US': 'x', 'es-MX': 'x', 'pt-BR': 'x' } },
      },
    };
    const result = analyzeConceptCatalog([lesson('l1', ['moneda']), lesson('l2', ['ahorro'])], taxonomy, registry);
    expect(result.findings.find((f) => f.lesson === 'l1')?.message).toMatch(/prerequisite course financial-education/);
    expect(result.policies.get('l1')!.future).toEqual([{ id: 'ahorro', lesson: 'a/s/t/l2', terms: { 'es-MX': ['ahorrar'] } }]);
    expect(result.policies.get('l2')!.future).toEqual([]);
    expect(result.findings.some((f) => f.severity === 'review' && /"huerfano" is registered but no lesson introduces it/.test(f.message))).toBe(true);
  });
});

describe('B.11 mentor misjudgment', () => {
  it('counts a mentor\'s voiced moments across narration, dialogue lines and scenes', () => {
    const document = {
      segments: [
        { id: 'a', type: 'story_scene', narrator: { character: 'rho' }, payload: { character: 'liruf', body_md: 'Liruf corre.' } },
        { id: 'b', type: 'story_dialogue', payload: { lines: [{ character: 'liruf', text_md: 'Hola.' }, { character: 'dina', text_md: 'Hola.' }] } },
      ],
    };
    expect(voicedMoments(document as never, 'liruf')).toBe(2);
    expect(voicedMoments(document as never, 'rho')).toBe(1);
    expect(voicedMoments(document as never, 'zara')).toBe(0);
  });

  it('flags self-global shame language in every locale and leaves decision language alone', () => {
    expect(scanShame('¡Soy un desastre! Las gasté todas.', 'es-MX')).toEqual(['soy un desastre']);
    expect(scanShame("I'm so stupid, I forgot the bag.", 'en-US')).toContain("i'm so stupid");
    expect(scanShame('Que burro eu sou!', 'pt-BR')).toEqual(['que burro eu sou']);
    expect(scanShame('Olvidé contar la bolsita. La próxima vez la sumo primero.', 'es-MX')).toEqual([]);
    expect(scanShame('That was a costly mistake; next time I compare prices.', 'en-US')).toEqual([]);
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(SHAME_LEXICON[locale].length).toBeGreaterThan(15);
  });
});

describe('B.16 market inventory and requirement', () => {
  it('loads the inventory: three markets, each with a cited research problem and its own currency', () => {
    expect(Object.keys(markets.markets).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    for (const locale of MARKETS) {
      const market = markets.markets[locale];
      expect(market.problems.some((p) => p.evidence === 'cited' && p.sources.length > 0)).toBe(true);
    }
    expect(markets.markets['pt-BR'].research_profile).toMatch(/45%.*18%/s);
    expect(markets.markets['es-MX'].research_profile).toMatch(/80%/);
    expect(markets.markets['pt-BR'].currency.code).toBe('BRL');
  });

  it('requires scenarios for money facts and Mexico-specific briefs, not for a neutral lesson', () => {
    const facts = buildFacts();
    const input = (briefs: string[], factRefs: string[] = []) => ({ slug: 'l', path: 'a/s/t/l', factRefs, briefs });
    expect(regionalRequirement(input(['Dina reparte semillas en la isla.']), facts, markets)).toEqual({ required: false, reasons: [] });
    expect(regionalRequirement(input(['x'], ['mxn.reference_prices.paleta']), facts, markets).reasons).toEqual(['cites the MXN fact mxn.reference_prices.paleta']);
    expect(regionalRequirement(input(['Liruf cobra 20 pesos en el tianguis.']), facts, markets).reasons).toEqual([
      'its brief carries Mexico context "20 pesos"',
      'its brief carries Mexico context "tianguis"',
    ]);
    expect(marketContextIn('Cada vaso cuesta $5.', markets.markets['es-MX'])).toEqual(['$5']);
  });

  it('validates the market-scenario contract: research link, currency, anchors and a real rewrite per market', () => {
    const facts = buildFacts({ facts: { 'brl.reference_prices.suco': { value: 5, unit: 'BRL', verified: false } } } as never);
    const base = { slug: 'l', path: 'a/s/t/l', factRefs: ['mxn.reference_prices.paleta'], briefs: ['x'] };
    const ok = analyzeRegionalLesson({ ...base, scenarios: SCENARIOS }, facts, markets);
    expect(ok.findings.filter((f) => f.severity === 'block')).toEqual([]);
    expect(ok.findings.filter((f) => f.severity === 'review').length).toBeGreaterThan(0); // hypothesis + content-team sign-off

    const bad = analyzeRegionalLesson(
      {
        ...base,
        scenarios: {
          'es-MX': SCENARIOS['es-MX'],
          'en-US': { ...SCENARIOS['en-US'], problem_refs: ['mx-access-without-wellbeing'] },
          'pt-BR': { scenario: SCENARIOS['es-MX'].scenario, problem_refs: ['br-baseline-literacy-gap'], anchors: ['tianguis'], fact_refs: ['mxn.reference_prices.paleta'] },
        },
      },
      facts,
      markets,
    );
    const messages = bad.findings.filter((f) => f.severity === 'block').map((f) => f.message).join('\n');
    expect(messages).toMatch(/en-US scenario cites "mx-access-without-wellbeing", which is not a United States problem/);
    expect(messages).toMatch(/pt-BR scenario uses the MXN fact/);
    expect(messages).toMatch(/pt-BR anchor "tianguis" also marks Mexico/);
    expect(messages).toMatch(/the pt-BR scenario repeats the es-MX brief/);
  });

  it('refuses "market-neutral" for a lesson with market context and reviews it otherwise', () => {
    const facts = buildFacts();
    const universal = { universal: 'Una isla de fantasía sin moneda real ni lugar concreto.' };
    const refused = analyzeRegionalLesson({ slug: 'l', path: 'p', factRefs: ['mxn.reference_prices.paleta'], briefs: [], scenarios: universal }, facts, markets);
    expect(refused.findings[0]).toMatchObject({ severity: 'block' });
    const neutral = analyzeRegionalLesson({ slug: 'l', path: 'p', factRefs: [], briefs: ['Dina cuenta conchas.'], scenarios: universal }, facts, markets);
    expect(neutral.findings.map((f) => f.severity)).toEqual(['review']);
  });
});

describe('B.16 document gate: translated, not localized', () => {
  const text = (s: string, locale: 'es-MX' | 'en-US' | 'pt-BR') => checkRegionalDocument(s, locale, undefined, markets).map((f) => f.kind);

  it('rejects another market\'s currency and context even without a catalog', () => {
    expect(text('Cada copo custa 5 pesos.', 'pt-BR')).toEqual(['foreign-currency']);
    expect(text('Cada copo custa $5.', 'pt-BR')).toEqual(['foreign-currency']);
    expect(text('Vamos ao tianguis.', 'en-US')).toEqual(['foreign-anchor']);
    expect(text('Pagué con Pix.', 'es-MX')).toEqual(['foreign-anchor']);
    expect(text('It costs 20 reais.', 'en-US')).toEqual(['foreign-currency']);
  });

  it('accepts each market\'s own currency and ordinary words that look like currency', () => {
    expect(text('Cada copo custa R$ 5.', 'pt-BR')).toEqual([]);
    expect(text('O peso da caixa é grande.', 'pt-BR')).toEqual([]); // "peso" is weight in Portuguese
    expect(text('Cada vaso cuesta $5.', 'es-MX')).toEqual([]);
    expect(text('A cup costs $5.', 'en-US')).toEqual([]);
    expect(text('Ahorra en dólares: 20 dollars.', 'es-MX')).toEqual([]); // the reference currency is not foreign
  });

  it('requires the market\'s own scenario for a lesson that needs one', () => {
    const policy = { required: true, reasons: ['r'], scenarios: SCENARIOS };
    expect(checkRegionalDocument('Liruf compra frutas no mercado.', 'pt-BR', policy, markets).map((f) => f.kind)).toEqual(['scenario-not-applied']);
    expect(checkRegionalDocument('Liruf compra frutas na feira livre.', 'pt-BR', policy, markets)).toEqual([]);
    const none = { required: true, reasons: ['cites the MXN fact x'] };
    expect(checkRegionalDocument('Liruf compra frutas na feira livre.', 'pt-BR', none, markets).map((f) => f.kind)).toEqual(['untranslated-scenario']);
    expect(checkRegionalDocument('Liruf compra fruta en el tianguis.', 'es-MX', none, markets)).toEqual([]); // the authoring market is the source, not a translation
  });
});

describe('gates 14-16 run inside runAllGates and block their red-team lessons (Appendix C DoD "Gated")', () => {
  const ctx = (s: ReturnType<typeof sample>) => ({ taxonomy, tier: s.tier, facts: buildFacts(), lessonPolicy: s.policy });

  it.each([
    ['b17-concept-cap', POLICY_GATE.conceptCap],
    ['b11-misjudgment', POLICY_GATE.misjudgment],
    ['b16-regional', POLICY_GATE.regional],
  ])('%s fails only its own gate among the content gates', (name, gate) => {
    const s = sample(name);
    const report = runAllGates(s.document, ctx(s));
    expect(report.ok).toBe(false);
    expect([...new Set(report.problems.filter((p) => p.gate >= 11).map((p) => p.gate))]).toEqual([gate]);
  });

  it('a compliant localized episode passes every content gate (11-16)', () => {
    const s = sample('compliant-localized');
    expect(runAllGates(s.document, ctx(s)).problems.filter((p) => p.gate >= 11)).toEqual([]);
  });

  it('without a policy only the context-free residue check applies', () => {
    const s = sample('b17-concept-cap');
    expect(runLessonPolicyGates(s.document as never, undefined).problems).toEqual([]);
    const b16 = sample('b16-regional');
    expect(runLessonPolicyGates(b16.document as never, undefined).problems.map((p) => p.gate)).toEqual([16, 16]);
  });
});

describe('the course policy over a real catalog shape', () => {
  function writeCourse(lessons: Array<Record<string, unknown>>, topicFacts: string[] = []): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'lf-policy-'));
    mkdirSync(path.join(dir, 'adventures'));
    writeFileSync(path.join(dir, 'taxonomy.yaml'), stringify({ ...taxonomy, age_tiers: { tier1: taxonomy.age_tiers.tier1 }, family_allowlist_by_tier: { tier1: ['story', 'choice'] } }));
    writeFileSync(path.join(dir, 'facts.yaml'), stringify(buildFacts()));
    writeFileSync(
      path.join(dir, 'catalog.yaml'),
      stringify({
        schema_version: 1,
        course: { slug: 'policy-course', badge_asset: 'course-badges/policy-course.png', subject: 'money', title: { 'en-US': 'T', 'es-MX': 'T', 'pt-BR': 'T' }, description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' }, authoring_locale: 'es-MX' },
        adventures: [{ file: 'adventures/01.yaml' }],
      }),
    );
    writeFileSync(
      path.join(dir, 'adventures/01.yaml'),
      stringify({
        schema_version: 1,
        adventure: { position: 1, slug: 'adv', theme: 'archipelago', age_tier: 'tier1', title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' }, description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' }, narrative_arc: 'x' },
        sagas: [{
          position: 1, slug: 'saga', icon: 'waves', title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' }, description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
          topics: [{ position: 1, slug: 'topic', title_es: 'Tema', concept: 'Comparar antes de comprar.', learning_objective: 'Compara dos precios.', key_vocabulary: ['comparar'], prior_knowledge: 'Ninguno.', fact_refs: topicFacts, lessons }],
        }],
      }),
    );
    return dir;
  }
  const blueprint = (slug: string, extra: Record<string, unknown> = {}) => ({ position: Number(slug.slice(-1)), slug, micro_objective: 'Compara dos precios.', narrative_beat: 'Liruf mira dos puestos de fruta.', difficulty: 1, suggested_families: ['story'], ...extra });

  it('reports coverage, blocks a course with no misjudgment episode, and passes a compliant one', () => {
    const none = loadCourseCatalog(writeCourse([blueprint('l1', { new_concepts: ['comparar'] })]));
    expect(none.ok).toBe(true);
    const policyNone = buildCoursePolicy(none.course);
    expect(policyNone.findings.filter((f) => f.severity === 'block').map((f) => f.spec)).toEqual(['B.11']);

    const episode = { character: 'liruf', misjudgment: 'Liruf gasta todo en el primer puesto sin comparar.', recovery: 'Liruf compara en el siguiente puesto y lo cuenta sin culpa.' };
    const compliant = loadCourseCatalog(writeCourse([blueprint('l1', { new_concepts: ['comparar'], mentor_misjudgment: episode })]));
    expect(compliant.ok).toBe(true);
    const policy = buildCoursePolicy(compliant.course);
    expect(policy.findings.filter((f) => f.severity === 'block')).toEqual([]);
    expect(policy.metrics).toEqual({ lessons: 1, densityDeclared: 1, misjudgmentEpisodes: 1, misjudgmentMinimum: 1, regionalRequired: 0, regionalDeclared: 0 });
    expect(policy.lessons.get('l1')!.misjudgment?.character).toBe('liruf');
    expect(lessonPolicyGuidance(policy.lessons.get('l1'))).toMatch(/ceiling 3\): this lesson introduces ONLY: comparar[\s\S]*MENTOR MISJUDGMENT EPISODE \(B\.11, hard gate 15\): liruf/);
  });

  it('rejects an unregistered concept once concepts.yaml exists, and a malformed episode or scenario at load time', () => {
    const dir = writeCourse([blueprint('l1', { new_concepts: ['comparar'] })]);
    writeFileSync(path.join(dir, 'concepts.yaml'), stringify({ schema_version: 1, concepts: { otro: { label: { 'en-US': 'x', 'es-MX': 'x', 'pt-BR': 'x' } } } }));
    expect(loadCourseCatalog(dir).issues.some((i) => /new_concepts "comparar" is not in concepts.yaml/.test(i.message))).toBe(true);
    const badEpisode = loadCourseCatalog(writeCourse([blueprint('l1', { mentor_misjudgment: { character: 'bob', misjudgment: 'x', recovery: 'y' } })]));
    expect(badEpisode.ok).toBe(false);
    const partial = loadCourseCatalog(writeCourse([blueprint('l1', { regional_scenarios: { 'es-MX': SCENARIOS['es-MX'] } })]));
    expect(partial.ok).toBe(false);
  });
});

describe('B.16 adaptation layer in localization', () => {
  const policy: LessonPolicy = {
    lesson: 'l',
    path: 'a/s/t/l',
    tier: 'tier1',
    concepts: { band: '6-9', target: 2, ceiling: 3, declared: [], declaredLabels: [], future: [] },
    regional: { required: true, reasons: ['cites the MXN fact x'], scenarios: SCENARIOS },
  };
  const source = {
    schema_version: 1,
    meta: { slug: 'l', title: 'Liruf en el tianguis', locale: 'es-MX', subject: 'money', estimated_minutes: 3, objectives: ['Comparar precios.'], cast: ['liruf'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: [{ id: 's1', type: 'story_dialogue', prompt_md: 'Escucha a Liruf.', difficulty: 1, xp: 0, payload: { lines: [{ character: 'liruf', text_md: 'Hoy compro fruta en el tianguis.' }] } }],
  };
  const gateCtx = { taxonomy, tier: 'tier1', facts: buildFacts(), lessonPolicy: policy };
  const translator = (rewrite: (value: string) => string) => async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
    const map = JSON.parse(req.messages[req.messages.length - 1]!.content.split('\n').pop()!) as Record<string, string>;
    const system = req.messages[0]!.content;
    expect(system).toContain('REGIONAL ADAPTATION (B.16, hard gate 16)');
    expect(system).toContain('feira livre');
    return { content: JSON.stringify(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, rewrite(v)]))), promptTokens: 1, completionTokens: 1 };
  };

  it('tells the es-MX author the Mexican scenario and its anchors', () => {
    const text = lessonPolicyGuidance(policy);
    expect(text).toContain('MARKET SCENARIO (B.16, hard gate 16)');
    expect(text).toContain('Use at least one of: tianguis');
    expect(text).toContain("Never use the other markets' context (yard sale, feira livre)");
  });

  it('hands the translator the market scenario and anchors', () => {
    const brief = adaptationBrief(policy.regional, 'pt-BR', markets)!;
    expect(brief).toMatch(/localized for Brazil, not translated/i);
    expect(brief).toMatch(/must NOT keep any of: .*tianguis/);
    expect(translationSystemPrompt('pt-BR', undefined, brief)).toContain(brief);
    expect(adaptationBrief({ required: false, reasons: [] }, 'pt-BR', markets)).toBeUndefined();
  });

  it('refuses a literal translation that keeps the Mexican scenario', async () => {
    const literal = translator((v) => v.replace('Hoy compro fruta en el tianguis.', 'Hoje compro fruta no tianguis.').replace('Escucha a Liruf.', 'Escute o Liruf.').replace('Liruf en el tianguis', 'Liruf no tianguis'));
    const error = await localizeLesson(source as never, 'pt-BR', gateCtx, { translate: literal as never }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocalizeContentGateError);
    expect((error as LocalizeContentGateError).problems.filter((p) => p.gate === 16).map((p) => p.message).join(' ')).toMatch(/tianguis.*Mexico context[\s\S]*feira livre/);
  });

  it('accepts a localization that applies the Brazilian scenario', async () => {
    const adapted = translator((v) => v.replace('Hoy compro fruta en el tianguis.', 'Hoje compro fruta na feira livre.').replace('Escucha a Liruf.', 'Escute o Liruf.').replace('Liruf en el tianguis', 'Liruf na feira'));
    const result = await localizeLesson(source as never, 'pt-BR', gateCtx, { translate: adapted as never });
    expect(result.document.meta.locale).toBe('pt-BR');
  });
});

describe('the repository catalogs under gates 14-16', () => {
  it('build a policy for every course; the three flagged episodes are real mentor misjudgments on file', () => {
    const flagged: Record<string, string> = {};
    for (const course of ['financial-education', 'entrepreneurship', 'investing', 'first-lemonade-stand']) {
      const load = loadCourseCatalog(path.join(PACKAGE_ROOT, 'curriculum', course));
      expect(load.ok).toBe(true);
      const policy = buildCoursePolicy(load.course);
      expect(policy.metrics.lessons).toBeGreaterThan(0);
      for (const lesson of policy.lessons.values()) if (lesson.misjudgment) flagged[course] = `${lesson.lesson}:${lesson.misjudgment.character}`;
    }
    expect(flagged).toMatchObject({
      'financial-education': 'que-paso-despues-del-error:liruf',
      entrepreneurship: 'que-le-falto-a-esta-lista:liruf',
      investing: 'rho-comete-un-error-barato:rho',
    });
  });
});
