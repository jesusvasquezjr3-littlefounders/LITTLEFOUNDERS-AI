import type { AgeScreenState } from './ageScreen.js';
import { DIALOGUE_EXPERIMENT_OPENABLE_BANDS, type DialogueBand } from './pedagogy/dialogueCalibration.js';

/*
 * M-12 (OD-26): which consent screen must SAY that it also enrols a learner in
 * the C.17 dialogue-style experiment. A display hint only: the consent itself
 * stays the analytics consent OD-26 names (the teen's own opt-in, the
 * guardian's consent for a 10-12 child), and `resolveDialogueCalibration`
 * re-decides eligibility and consent on every Mentor session.
 *
 * The hint is true only where turning that consent on can actually enrol the
 * learner: the band is in the configured list AND in the openable set (never
 * a 6-9 child), and for a guardian the child's exact age is known from the
 * profile birth date (the resolver refuses a tween without an exact age).
 * A parent-created teen (13-17) is false: they need their own opt-in too, which only
 * a self-managed account has, so the guardian's consent alone enrols nobody.
 */

const opened = (band: DialogueBand, configured: readonly DialogueBand[]) =>
  configured.includes(band) && DIALOGUE_EXPERIMENT_OPENABLE_BANDS.includes(band);

/** The self-managed analytics toggle (teen, or a teen who moved to adult by birth month). */
export function ownOptInEnrols(screening: Pick<AgeScreenState, 'ageBand' | 'protectedOrigin' | 'adultByBirthMonth'>, configured: readonly DialogueBand[]): boolean {
  if (screening.protectedOrigin) return false;
  if (screening.ageBand === '13_to_17') return opened('teen', configured);
  if (screening.ageBand === 'adult' && screening.adultByBirthMonth === true) return opened('adult', configured);
  return false;
}

