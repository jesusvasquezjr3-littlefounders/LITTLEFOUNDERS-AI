/**
 * THE LAB FIXTURES ARE WRITTEN PER LOCALE, AND THIS IS THE REASON.
 *
 * `/dev/lesson-lab` renders chrome through i18n and fixtures from these files.
 * While the fixtures were pinned to Spanish, every screenshot of the lab showed
 * ENGLISH CHROME AROUND SPANISH CONTENT — and was read, reasonably, as evidence
 * that the lesson engine has hardcoded strings. It does not: a lesson DOCUMENT
 * is single-locale by design (LESSON_ENGINE.md §3) and production documents
 * arrive from Forge already written in the learner's language. The lab was
 * simply lying about the one thing it exists to show. `/dev/tutor-lab` had the
 * identical defect and fixed it the identical way (`labFixtures.ts`), and the
 * tutor lab's lesson-sheet switch draws from THESE fixtures — so this change
 * makes both instruments honest at once.
 *
 * ── THE PARITY RULE, ENFORCED BY THE COMPILER ────────────────────────────────
 *
 * A family writes its copy as three flat objects and passes them here. The
 * en-US object is the key source of truth (/AGENTS.md §1.8) and the other two
 * are typed `typeof EN`, so a missing key is a compile error and an invented
 * one is too. Nothing walks the objects at runtime to check: there is nothing
 * to check, because the shape cannot differ.
 *
 * Structure — ids, payload shape, ANSWER KEYS, xp, difficulty — is written once
 * per family, outside the copy, and is therefore identical in every locale by
 * construction. That matters more than it looks: a grader test that passes in
 * one locale and fails in another would be a fixture bug wearing a grader's
 * clothes, and this layout makes it unrepresentable.
 *
 * These are DEV FIXTURES, not UI strings, so they deliberately do NOT live in
 * `src/i18n/**`: `npm run i18n:check` guards the product's key set, and 400
 * demo sentences about lemonade in it would be 400 keys nobody ships.
 */

import { LOCALES, type Locale } from '@/i18n'

/** The locale a lab renders when nothing has been chosen (matches the tutor lab). */
export const DEFAULT_FIXTURE_LOCALE: Locale = 'en-US'

/**
 * A family's copy object, keyed by the en-US one.
 *
 * `{ [K in keyof T]: string }` and not `T`: the en-US object is written
 * `as const`, so `T`'s values are LITERAL types and a translation would have to
 * equal the English word to type-check. Mapping the values back to `string`
 * keeps the KEYS closed — which is the parity guarantee — while leaving the
 * values free, which is the whole point of a translation.
 */
export type Copy<T> = { [K in keyof T]: string }

/**
 * Bundle one family's three copy objects into a locale-indexed pack.
 *
 * Typing `es`/`pt` as `T` (the en-US object's own type) is the whole guarantee:
 * TypeScript requires every key, and `as const` on the en-US literal keeps the
 * key set closed without freezing the VALUES into literal types the other two
 * could never satisfy.
 */
export function copyPack<T extends Record<string, string>>(
  en: T,
  es: { [K in keyof T]: string },
  pt: { [K in keyof T]: string },
): Record<Locale, { [K in keyof T]: string }> {
  return { 'en-US': en, 'es-MX': es, 'pt-BR': pt }
}

/** Narrows whatever i18next reports to a locale the fixtures are written in. */
export function fixtureLocaleOf(raw: string | undefined): Locale {
  if (!raw) return DEFAULT_FIXTURE_LOCALE
  const exact = LOCALES.find((id) => id === raw)
  if (exact) return exact
  const base = raw.slice(0, 2).toLowerCase()
  return LOCALES.find((id) => id.slice(0, 2) === base) ?? DEFAULT_FIXTURE_LOCALE
}

/**
 * The currency a locale's money fixtures are denominated in.
 *
 * A money exercise carries a real `currency` in its payload and the renderers
 * format with `Intl` from it, so the code has to move with the copy or a
 * Brazilian fixture would say "R$5" in its prose and print "$5.00" in its till.
 */
export const FIXTURE_CURRENCY: Record<Locale, string> = {
  'en-US': 'USD',
  'es-MX': 'MXN',
  'pt-BR': 'BRL',
}
