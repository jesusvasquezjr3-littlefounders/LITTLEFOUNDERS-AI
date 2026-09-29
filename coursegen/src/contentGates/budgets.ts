// OD-13 Copy Budget, as numbers (Frontend Bible 06 §3.1 and §4).
//
// Bible 06 is the source: English word budgets per copy role, ages 6–9 lower,
// Spanish and Portuguese ×1.25 rounded up. The owner decision (OD-13) makes
// lesson prompts, options and Mentor turns a Forge content gate "next to B.17
// and B.18". The remaining roles below are the same Bible 06 limits applied to
// the other strings a lesson renders; see the sprint record S05.4a for why
// they are gated too and the owner question raised about it.

import type { TaxonomyFile } from '../catalog/schema.js';

export type ContentLocale = 'en-US' | 'es-MX' | 'pt-BR';

/**
 * The roles Forge content can take on screen. Names follow `data-copy-role`
 * (Bible 06 §3.1) where one exists:
 *   heading  — segment/lesson/card title
 *   prompt   — the lesson question or instruction (context + question)
 *   option   — anything the learner taps or drags: answer options, items, tokens
 *   mentor   — one character turn on the stage (story lines, scene narration)
 *   body     — card text and immediate feedback banners (explanation, rationale, recap)
 *   detail   — text behind a tap (hints, tap-to-explain notes): a layered sheet (§4)
 *   data     — table cells, chart labels, names, numbers: never counted (§3.3)
 */
export type CopyRole = 'heading' | 'prompt' | 'option' | 'mentor' | 'body' | 'detail' | 'data';

export interface RoleBudget {
  words: number;
  /** Ages 6–9 limit (Bible 06 §3.1); absent means the same as `words`. */
  youngWords?: number;
  /** Maximum sentences; absent means not sentence-checked. */
  sentences?: number;
}

export const COPY_BUDGETS: Readonly<Record<Exclude<CopyRole, 'data'>, RoleBudget>> = {
  heading: { words: 6, sentences: 1 },
  prompt: { words: 20, youngWords: 12, sentences: 2 },
  option: { words: 8, youngWords: 5, sentences: 1 },
  mentor: { words: 20, youngWords: 12, sentences: 2 },
  body: { words: 12, sentences: 2 },
  // Bible 06 §4.4: "The sheet may hold up to 60 words, in short paragraphs."
  detail: { words: 60 },
};

/** Roles OD-13 names explicitly for the Forge gate. */
export const OD13_ROLES: readonly CopyRole[] = ['prompt', 'option', 'mentor'];

/** Bible 06 §3: "ES and PT get ×1.25, rounded up". */
export const LOCALE_FACTOR: Readonly<Record<ContentLocale, number>> = { 'en-US': 1, 'es-MX': 1.25, 'pt-BR': 1.25 };

export interface Audience {
  /** Ages 6–9 limits apply. */
  young: boolean;
  /** Human-readable reason, echoed into reports. */
  label: string;
}

export function wordLimit(role: Exclude<CopyRole, 'data'>, locale: ContentLocale, audience: Audience): number {
  const budget = COPY_BUDGETS[role];
  const base = audience.young && budget.youngWords !== undefined ? budget.youngWords : budget.words;
  return Math.ceil(base * LOCALE_FACTOR[locale]);
}

/**
 * The speech-plate caption limit (Frontend 08 §2 and §5): one Mentor turn.
 * A narrated block no longer than this may appear verbatim on screen — the
 * plate keeps a caption for accessibility and muted devices — so it is the
 * B.18 boundary between "a caption" and "long on-screen text duplicating
 * narration".
 */
export function captionLimit(locale: ContentLocale, audience: Audience): { words: number; sentences: number } {
  return { words: wordLimit('mentor', locale, audience), sentences: COPY_BUDGETS.mentor.sentences ?? 2 };
}

/** Lowest age of a tier's "ages" range ("6-7" → 6, "12-18" → 12). */
function lowestAge(ages: string): number | null {
  const match = /(\d+)/.exec(ages);
  return match ? Number(match[1]) : null;
}

/** Bible 06 "ages 6–9": a tier whose youngest age is at most this gets the young limits. */
export const YOUNG_AUDIENCE_MAX_AGE = 9;

/**
 * Resolves the budget audience for a catalog tier. Conservative on purpose: a
 * tier whose range reaches below 10 (tier2 is 8–10) serves 8- and 9-year-olds,
 * so it gets the 6–9 limits. The adult register never does.
 */
export function audienceForTier(taxonomy: TaxonomyFile | undefined, tier: string, register: 'kid' | 'adult' = 'kid'): Audience {
  if (register === 'adult') return { young: false, label: `${tier} adult register` };
  const ages = taxonomy?.age_tiers[tier]?.ages;
  if (!ages) return { young: true, label: `${tier} (ages unknown: 6–9 limits applied)` };
  const lowest = lowestAge(ages);
  const young = lowest === null || lowest <= YOUNG_AUDIENCE_MAX_AGE;
  return { young, label: `${tier} ages ${ages}${young ? ' (6–9 limits)' : ''}` };
}
