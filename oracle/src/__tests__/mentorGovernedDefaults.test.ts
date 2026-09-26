import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigCache } from '../env.js';

/*
 * S06.15 lane review: the Stage 7 kill switches ship ON. `src/test-setup.ts`
 * turns several of them off for the older unit suites, so this file clears
 * those values and reads the production defaults. A mode switch can only make
 * the Mentor do less, and an unknown value falls back to the active mode,
 * never to a silent off. `env.ts` is a Tier 1 file in the governance
 * registry, so changing any of these defaults also needs a signed row in the
 * Tier 1 change record.
 */
const ACTIVE = {
  TUTOR_BEHAVIORAL_TELEMETRY: 'act',
  TUTOR_ALLIANCE_CONTROLLER: 'act',
  TUTOR_SELF_EXPLANATION: 'act',
  TUTOR_SPACED_REVIEW: 'act',
  TUTOR_DIALOGUE_CALIBRATION: 'act',
  TUTOR_SESSION_END_SIGNAL: 'offer',
} as const;
type Key = keyof typeof ACTIVE;
const KEYS = Object.keys(ACTIVE) as Key[];

describe('Mentor kill-switch defaults in the Oracle configuration', () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetConfigCache();
  });

  it('every Block C component is active by default', () => {
    for (const key of KEYS) delete process.env[key];
    resetConfigCache();
    const config = getConfig();
    for (const key of KEYS) expect(config[key], key).toBe(ACTIVE[key]);
  });

  it('an unknown value falls back to the active mode, never to off', () => {
    for (const key of KEYS) process.env[key] = 'disabled-by-typo';
    resetConfigCache();
    const config = getConfig();
    for (const key of KEYS) expect(config[key], key).toBe(ACTIVE[key]);
  });
});
