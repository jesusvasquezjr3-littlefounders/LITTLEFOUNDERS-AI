// Audience registers — COURSE_ENGINE.md §3.3. The catalog's CONCEPTS are
// audience-agnostic; the RENDERING is not. `--register adult` regenerates
// the SAME blueprints as a parallel course (content is always REGENERATED
// per register — never filtered down or dressed up from the kid version;
// a UI toggle that hides fields and calls itself "adaptation" is the
// documented anti-pattern this module exists to avoid).
//
// `kid` is the default and its vocabulary hard-gate is NEVER a catalog
// toggle — it's a §1.9 child-safety invariant, so `resolveRegister` ignores
// whatever `taxonomy.registers.kid` might say and always returns
// `vocabularyGates: true` for kid. `adult` reads `taxonomy.registers.adult`
// when the catalog declares it, and otherwise falls back to the built-in
// defaults below — so a taxonomy.yaml authored before this field existed
// (every catalog today) still produces a sane adult run out of the box.

import type { TaxonomyFile } from '../catalog/schema.js';

export const REGISTERS = ['kid', 'adult'] as const;
export type Register = (typeof REGISTERS)[number];

export function isRegister(value: string): value is Register {
  return (REGISTERS as readonly string[]).includes(value);
}

export interface ResolvedRegister {
  register: Register;
  /** Gate 2 (forbidden vocabulary) + tier vocabulary ceiling. Always true for kid. */
  vocabularyGates: boolean;
  /** Ignore the tier family_allowlist/type_exceptions palette subsetting — draw from the full 56-type palette. */
  fullPalette: boolean;
  /** Non-empty only for adult — injected into plan/write/localize prompts. */
  toneDirectiveEs?: string;
  /** Course slug/title suffix applied at publish time. Empty for kid. */
  slugSuffix: string;
  titleSuffix: string;
}

const DEFAULT_ADULT_TONE_ES =
  'Tono directo y respetuoso para adultos — nunca infantilizante. Ancla los ejemplos en la vida adulta real ' +
  '(nómina, súper, renta, comisiones, tarjetas), sin restricciones de vocabulario financiero.';

const ADULT_SLUG_SUFFIX = '-adultos';
const ADULT_TITLE_SUFFIX = ' (Adultos)';

export function resolveRegister(taxonomy: TaxonomyFile | undefined, register: Register): ResolvedRegister {
  if (register === 'kid') {
    return { register, vocabularyGates: true, fullPalette: false, slugSuffix: '', titleSuffix: '' };
  }

  const adultConfig = taxonomy?.registers?.adult;
  return {
    register,
    // COURSE_ENGINE.md §3.3: adult register has no vocabulary ceiling by
    // default; a catalog MAY opt back into gating via vocabulary_gates:true.
    vocabularyGates: adultConfig?.vocabulary_gates ?? false,
    fullPalette: true,
    toneDirectiveEs: adultConfig?.tone_es ?? DEFAULT_ADULT_TONE_ES,
    slugSuffix: ADULT_SLUG_SUFFIX,
    titleSuffix: ADULT_TITLE_SUFFIX,
  };
}
