import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigForTests } from '../config.js';
import { LIVE_CONTENT_FLOORS } from '../services/pedagogy/liveContentGovernance.js';

/*
 * S06.15 lane review: Core configuration defaults that carry a Block C or
 * owner-log constraint. `config.ts` is shared by every lane, so it is not a
 * Tier 1 file in the governance registry; these defaults are pinned here
 * instead, so a quiet default change fails CI rather than shipping.
 */
const KEYS = ['MENTOR_DIALOGUE_EXPERIMENT_BANDS', 'TUTOR_LIVE_REVIEW_SAMPLE_RATE', 'TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE'] as const;

describe('Core defaults that carry a Mentor governance constraint', () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetConfigForTests();
  });

  function defaults() {
    for (const key of KEYS) delete process.env[key];
    resetConfigForTests();
    return getConfig();
  }

  it('C.17 / OD-26 / H.7: the dialogue-register experiment may enrol adults, teens and tweens, never a young child', () => {
    expect(defaults().MENTOR_DIALOGUE_EXPERIMENT_BANDS).toEqual(['adult', 'teen', 'tween']);
  });

  it('an unknown band name, or young_child, enrols nobody extra; an operator can narrow to adults', () => {
    process.env.MENTOR_DIALOGUE_EXPERIMENT_BANDS = 'adult, kids ,everyone, young_child';
    resetConfigForTests();
    expect(getConfig().MENTOR_DIALOGUE_EXPERIMENT_BANDS).toEqual(['adult']);
    process.env.MENTOR_DIALOGUE_EXPERIMENT_BANDS = 'adult';
    resetConfigForTests();
    expect(getConfig().MENTOR_DIALOGUE_EXPERIMENT_BANDS).toEqual(['adult']);
  });

  it('C.5 / Appendix E §3.1.1: the default staff-sampling baselines sit at or above the risk-scaled floors', () => {
    const config = defaults();
    expect(config.TUTOR_LIVE_REVIEW_SAMPLE_RATE).toBeGreaterThanOrEqual(LIVE_CONTENT_FLOORS.standard);
    expect(config.TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE).toBeGreaterThanOrEqual(LIVE_CONTENT_FLOORS.sensitive);
    expect(LIVE_CONTENT_FLOORS).toEqual({ standard: 0.15, sensitive: 0.5 });
  });
});
