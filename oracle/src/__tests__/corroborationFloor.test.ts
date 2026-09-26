import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigCache } from '../env.js';

/*
 * C.10 at the configuration boundary (S06.15 lane review). "No mastery or
 * remediation decision executes on a single observation" is a
 * non-negotiable Block C constraint, so no environment value may switch the
 * corroborating-evidence rule off for every knowledge component at once. The
 * only single-observation path is the per-KC Stage 7 rollback, which names
 * the affected KCs and is logged in the Kill-Switch Trigger Log.
 */
describe('C.10 corroboration floor in the Oracle configuration', () => {
  const original = process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS;

  afterEach(() => {
    if (original === undefined) delete process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS;
    else process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS = original;
    resetConfigCache();
  });

  it('defaults to two consecutive observations', () => {
    delete process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS;
    resetConfigCache();
    expect(getConfig().TUTOR_CORROBORATION_MIN_OBSERVATIONS).toBe(2);
  });

  it.each(['1', '0', '-1'])('refuses to boot with %s, rather than weakening the rule', (value) => {
    process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS = value;
    resetConfigCache();
    expect(() => getConfig()).toThrow(/TUTOR_CORROBORATION_MIN_OBSERVATIONS/);
  });

  it('accepts a stricter requirement', () => {
    process.env.TUTOR_CORROBORATION_MIN_OBSERVATIONS = '3';
    resetConfigCache();
    expect(getConfig().TUTOR_CORROBORATION_MIN_OBSERVATIONS).toBe(3);
  });
});
