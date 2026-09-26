import { app } from './helpers.mjs';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. The guest's age screen, before any product route opens (A.3).
 */
export const lane = 'site';

export const states = [
  app('/onboarding@age-screen', '/onboarding', 'age-screen', '.lf-age-date'),
];

export const scenarios = {
  'age-screen': { population: 'guest', guest: true, ageBand: null },
};

export function respond() {
  return undefined;
}
