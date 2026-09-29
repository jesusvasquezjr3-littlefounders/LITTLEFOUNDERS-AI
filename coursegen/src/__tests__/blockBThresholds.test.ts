import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audienceForTier, COPY_BUDGETS, LOCALE_FACTOR, YOUNG_AUDIENCE_MAX_AGE } from '../contentGates/budgets.js';
import { VERBATIM_RUN_WORDS, REDUNDANCY_THRESHOLD, SCRIPT_REPEAT_THRESHOLD, verbatimCoverage } from '../contentGates/redundancy.js';
import { NEGATION_WINDOW_WORDS, TONE_LEXICON, WARNING_CUE_WINDOW_WORDS } from '../contentGates/tone.js';
import { CONCEPT_CEILINGS, WORKING_MEMORY_BAND_MAX_AGE, workingMemoryBand } from '../contentGates/conceptCap.js';
import { MIN_EPISODE_VOICED_MOMENTS, MIN_MISJUDGMENT_EPISODES_PER_COURSE, SHAME_LEXICON } from '../contentGates/misjudgment.js';
import { loadMarketInventory, MARKETS, SCENARIO_COPY_THRESHOLD } from '../contentGates/regional.js';
import type { TaxonomyFile } from '../catalog/schema.js';

/*
 * GAP-FIX-R6 (Appendix C Part 1.3, Threshold Recalibration Log; B.11, B.14,
 * B.16, B.17, B.18, OD-13): the Forge half of Block B's log. Every value in
 * docs/operations/BLOCK-B-THRESHOLD-LOG.md must equal the constant Forge's
 * gates use, including the lexicon and market-anchor counts the repo gate
 * (agent/tools/check-block-b-thresholds.mjs) marks as `twin` because no text
 * match can read them. A lexicon or anchor change is a recalibration: it
 * fails here until the log records it.
 */

const root = fileURLToPath(new URL('../../../', import.meta.url));
const log = readFileSync(join(root, 'docs/operations/BLOCK-B-THRESHOLD-LOG.md'), 'utf8').replace(/\r\n/g, '\n');
const values = new Map([...log.matchAll(/^\| `([a-z0-9_.]+)` \| ([^|]+) \|/gm)].map((m) => [m[1]!, m[2]!.trim()]));
const list = (key: string) => {
  const raw = values.get(key);
  if (raw === undefined) throw new Error(`threshold ${key} is missing from the log`);
  return raw.split(',').map((part) => Number(part.trim()));
};
const num = (key: string) => list(key)[0]!;
const tiers = (ages: string): TaxonomyFile => ({ age_tiers: { t: { ages } } }) as unknown as TaxonomyFile;

describe('Block B threshold log, Forge half (Appendix C Part 1.3)', () => {
  it('matches the OD-13 Copy Budget', () => {
    expect(list('copy_budget.heading')).toEqual([COPY_BUDGETS.heading.words, COPY_BUDGETS.heading.sentences]);
    for (const role of ['prompt', 'option', 'mentor'] as const) {
      expect(list(`copy_budget.${role}`), role).toEqual([COPY_BUDGETS[role].words, COPY_BUDGETS[role].youngWords, COPY_BUDGETS[role].sentences]);
    }
    expect(list('copy_budget.body')).toEqual([COPY_BUDGETS.body.words, COPY_BUDGETS.body.sentences]);
    expect(list('copy_budget.detail')).toEqual([COPY_BUDGETS.detail.words]);
    expect(num('copy_budget.es_pt_factor')).toBe(LOCALE_FACTOR['es-MX']);
    expect(LOCALE_FACTOR['pt-BR']).toBe(LOCALE_FACTOR['es-MX']);
    const young = num('copy_budget.young_max_age');
    expect(young).toBe(YOUNG_AUDIENCE_MAX_AGE);
    expect(audienceForTier(tiers(`${young}-10`), 't').young).toBe(true);
    expect(audienceForTier(tiers(`${young + 1}-12`), 't').young).toBe(false);
  });

  it('matches the B.18 redundancy thresholds', () => {
    const run = num('redundancy.verbatim_run_words');
    expect(run).toBe(VERBATIM_RUN_WORDS);
    // A run one word shorter than the logged length never counts as verbatim.
    const screen = ['a', 'b', 'x', 'c', 'd', 'y', 'e', 'f'];
    expect(verbatimCoverage(screen, ['a', 'b', 'q', 'c', 'd', 'q', 'e', 'f'])).toBe(run > 2 ? 0 : 0.75);
    expect(num('redundancy.threshold')).toBe(REDUNDANCY_THRESHOLD);
    expect(num('redundancy.script_repeat_threshold')).toBe(SCRIPT_REPEAT_THRESHOLD);
  });

  it('matches the B.14 tone windows and lexicon size', () => {
    expect(num('tone.negation_window_words')).toBe(NEGATION_WINDOW_WORDS);
    expect(num('tone.warning_cue_window_words')).toBe(WARNING_CUE_WINDOW_WORDS);
    expect(list('tone.lexicon_phrases')).toEqual([TONE_LEXICON['en-US'].length, TONE_LEXICON['es-MX'].length, TONE_LEXICON['pt-BR'].length]);
  });

  it('matches the B.17 concept ceilings and bands', () => {
    expect(list('concept_cap.6_9')).toEqual([CONCEPT_CEILINGS['6-9'].target, CONCEPT_CEILINGS['6-9'].ceiling]);
    expect(list('concept_cap.10_12')).toEqual([CONCEPT_CEILINGS['10-12'].target, CONCEPT_CEILINGS['10-12'].ceiling]);
    expect(list('concept_cap.13_plus')).toEqual([CONCEPT_CEILINGS['13+'].target, CONCEPT_CEILINGS['13+'].ceiling]);
    const [young, middle] = list('concept_cap.band_max_ages');
    expect([young, middle]).toEqual([WORKING_MEMORY_BAND_MAX_AGE['6-9'], WORKING_MEMORY_BAND_MAX_AGE['10-12']]);
    expect(workingMemoryBand(tiers(`${young}-10`), 't')).toBe('6-9');
    expect(workingMemoryBand(tiers(`${young! + 1}-12`), 't')).toBe('10-12');
    expect(workingMemoryBand(tiers(`${middle}-18`), 't')).toBe('10-12');
    expect(workingMemoryBand(tiers(`${middle! + 1}-18`), 't')).toBe('13+');
    // The OD-13 young audience and the youngest working-memory band start at the same age.
    expect(young).toBe(YOUNG_AUDIENCE_MAX_AGE);
  });

  it('matches the B.11 misjudgment minimums and shame lexicon size', () => {
    expect(num('misjudgment.min_episodes_per_course')).toBe(MIN_MISJUDGMENT_EPISODES_PER_COURSE);
    expect(num('misjudgment.min_voiced_moments')).toBe(MIN_EPISODE_VOICED_MOMENTS);
    expect(list('misjudgment.shame_lexicon_phrases')).toEqual([SHAME_LEXICON['en-US'].length, SHAME_LEXICON['es-MX'].length, SHAME_LEXICON['pt-BR'].length]);
  });

  it('matches the B.16 scenario-copy threshold and the market anchors', () => {
    expect(num('regional.scenario_copy_threshold')).toBe(SCENARIO_COPY_THRESHOLD);
    const inventory = loadMarketInventory();
    expect(MARKETS).toEqual(['es-MX', 'en-US', 'pt-BR']);
    expect(list('regional.market_anchors')).toEqual(MARKETS.map((market) => inventory.markets[market]!.anchors.length));
  });
});
