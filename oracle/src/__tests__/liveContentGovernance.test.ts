import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_JUDGE_PROMPT_HASH, generateSegment, type GenerationRequest } from '../content/generate.js';
import { classifyGeneratedContent, lexicalRiskSignals } from '../content/contentRisk.js';
import {
  authorIntendedRatings,
  dryRunVerdicts,
  parseRatingSet,
  previewAgreement,
  readSeedSet,
  seedSetProblems,
} from '../content/judgeCalibration/harness.js';
import { requestSegment } from '../core/client.js';

/*
 * S06.12 — Oracle's half of C.5: the judge's identity (model + prompt hash)
 * and the content-risk signals ride every generated candidate to Core; a
 * live-generation suspension from Core stops Oracle from authoring (no paid
 * call for an item Core would refuse); and the calibration harness runs at
 * zero spend.
 */

const REQUEST: GenerationRequest = {
  skillKey: 'financial-education/cobrar-y-dar-cambio',
  tier: 2,
  locale: 'es-MX',
  difficulty: 2,
  framing: 'Vamos a practicar con monedas en la pantalla.',
  rationale: 'reinforce change-making',
  allowedTypes: ['quiz_mcq'],
  recentTutorLines: [],
  isMinor: true,
};

const segment = (prompt = '¿Cuánto cambio das si pagan con 50 y algo cuesta 30?') =>
  JSON.stringify({
    id: 'seg-1',
    type: 'quiz_mcq',
    prompt_md: prompt,
    difficulty: 2,
    xp: 10,
    explanation_md: 'Restas 50 menos 30 para saber el cambio.',
    payload: {
      options: [
        { id: 'a', text_md: '20 monedas' },
        { id: 'b', text_md: '30 monedas', rationale_md: 'confunde el precio con el cambio' },
      ],
    },
    answer: { correct_option_id: 'a' },
  });

const chat = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  delete process.env.JUDGE_API_KEY;
});

describe('C.5 the judge identity and risk signals on every generated candidate', () => {
  it('stamps the judge model, the SHA-256 of its prompt and the risk category', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(chat(segment()))
      .mockResolvedValueOnce(chat(JSON.stringify({ pass: true })))
      .mockResolvedValueOnce(chat(JSON.stringify({ safe: true })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateSegment(REQUEST);
    expect(result?.provenance).toMatchObject({
      judge_model: 'qwen3-max',
      judge_prompt_hash: CONTENT_JUDGE_PROMPT_HASH,
      risk_category: 'standard',
      risk_signals: [],
    });
    expect(CONTENT_JUDGE_PROMPT_HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a sensitive topic found in the item OR in the Mentor\'s brief', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(chat(segment('Si en casa no alcanza el dinero para comer, ¿cuánto cambio das si pagan con 50 y algo cuesta 30?')))
      .mockResolvedValueOnce(chat(JSON.stringify({ pass: true })))
      .mockResolvedValueOnce(chat(JSON.stringify({ safe: true })));
    vi.stubGlobal('fetch', fetchMock);
    const fromItem = await generateSegment(REQUEST);
    expect(fromItem?.provenance).toMatchObject({ risk_category: 'sensitive', risk_signals: ['financial_hardship'] });

    fetchMock
      .mockResolvedValueOnce(chat(segment()))
      .mockResolvedValueOnce(chat(JSON.stringify({ pass: true })))
      .mockResolvedValueOnce(chat(JSON.stringify({ safe: true })));
    const fromBrief = await generateSegment({ ...REQUEST, framing: 'Tus papás están divorciados; practiquemos con el cambio.' });
    expect(fromBrief?.provenance).toMatchObject({ risk_category: 'sensitive', risk_signals: ['family_conflict'] });
  });

  it('the prompt hash is over the judge prompt itself: a different prompt is a different judge', () => {
    const other = createHash('sha256').update(JSON.stringify({ system: 'another prompt', tierRules: {} })).digest('hex');
    expect(other).not.toBe(CONTENT_JUDGE_PROMPT_HASH);
  });
});

describe('C.5 Oracle\'s content-risk classifier', () => {
  it('adds the learner-input safety classifier as a signal', () => {
    expect(classifyGeneratedContent({ prose: 'I want to hurt myself', brief: [], locale: 'en-US' }).signals).toContain('learner_classifier_match');
    expect(classifyGeneratedContent({ prose: 'Split 12 coins into 3 equal parts.', brief: [], locale: 'en-US' })).toEqual({ category: 'standard', signals: [] });
  });

  it('shares Core\'s lexicon block byte for byte (the live-content:check gate enforces the same)', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const block = (file: string) => {
      const text = readFileSync(path.join(root, file), 'utf8');
      return text.slice(text.indexOf('// <content-risk-lexicon>'), text.indexOf('// </content-risk-lexicon>')).replace(/\s+/g, ' ');
    };
    expect(block('oracle/src/content/contentRisk.ts')).toBe(block('backend/src/services/pedagogy/contentRisk.ts'));
    expect(lexicalRiskSignals('Numa aposta você pode perder tudo.')).toEqual(['safety_adjacent']);
  });
});

describe('C.5 a suspension from Core stops Oracle from authoring', () => {
  it('parses Core\'s liveSuspended answer (an older Oracle would read it as "no activity")', async () => {
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { needsGeneration: false, liveSuspended: true, reason: 'uncalibrated' }, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    const served = await requestSegment({ sessionId: '33333333-3333-4333-8333-333333333333', skillKey: 'unknown', difficulty: 2, framing: 'x', rationale: 'y' });
    expect(served).toEqual({ needsGeneration: false, liveSuspended: true, reason: 'uncalibrated' });
  });
});

describe('C.5 the calibration harness (zero spend)', () => {
  const seed = readSeedSet();

  it('the seed set is sound: 22 + 22 items, both labels in each category, every intended fail names its defect', () => {
    expect(seedSetProblems(seed)).toEqual([]);
    expect(seed.items.filter((i) => i.category === 'standard')).toHaveLength(22);
    expect(seed.items.filter((i) => i.category === 'sensitive')).toHaveLength(22);
  });

  it('catches a seed set that cannot tell an approve-everything judge from a reading one', () => {
    const allPass = { ...seed, items: seed.items.map((i) => ({ ...i, intended: 'pass' as const, defect: null })) };
    expect(seedSetProblems(allPass).join()).toContain('needs both intended passes and intended fails');
    expect(seedSetProblems({ ...seed, items: seed.items.slice(0, 10) }).join()).toContain('fewer than 20');
  });

  it('the dry run labels the author\'s intent as such — never as the human panel', () => {
    const author = authorIntendedRatings(seed);
    expect(author.source).toBe('author_intended');
    const preview = previewAgreement({ seedSet: seed, ratings: [author], judge: { model: 'm', promptHash: CONTENT_JUDGE_PROMPT_HASH, mode: 'dry_run', verdicts: dryRunVerdicts(seed) } });
    expect(preview.interRater).toBeNull();
    expect(preview.byCategory.standard).toEqual({ n: 22, agreement: 1 });
  });

  it('parses a human rating file and refuses an incomplete or foreign one', () => {
    const labels = Object.fromEntries(seed.items.map((i) => [i.id, i.intended]));
    expect(parseRatingSet({ rater: 'r1', source: 'human_panel', labels }, seed).ok).toBe(true);
    const missing = { ...labels };
    delete missing['sen-01'];
    expect(parseRatingSet({ rater: 'r1', source: 'human_panel', labels: missing }, seed)).toMatchObject({ ok: false });
    expect(parseRatingSet({ rater: 'r1', source: 'human_panel', labels: { ...labels, 'x-99': 'pass' } }, seed)).toMatchObject({ ok: false });
    expect(parseRatingSet({ source: 'human_panel', labels }, seed)).toMatchObject({ ok: false });
  });
});
