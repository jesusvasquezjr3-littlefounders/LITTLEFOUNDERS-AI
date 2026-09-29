// B.17 — the concept-cap gate: age-based working-memory limits per lesson
// (Appendix C Stage 2, gate 1; Forge gate 14).
//
// "Forge must gain a deterministic gate that counts genuinely new
// (non-previously-introduced) concepts per lesson and blocks publication when
// that count exceeds an age-tier ceiling … Lessons exceeding the ceiling must
// be split, not shipped as authored." Appendix B §1.2 gives the ranges: 2–3
// new concepts for ages 6–9, 3–4 for 10–12, 4–6 for teens and adults. The owner
// log (§8) applies them as written, recalibrated through the Threshold
// Recalibration Log.
//
// Two layers, because density is decided when a lesson is PLANNED and can be
// broken when it is WRITTEN:
//
//   catalog  — every lesson blueprint declares `new_concepts` (Stage 0/1). In
//              course order, a concept is new only the first time it is
//              declared; a later declaration is refused as "not new". The count
//              is checked against the band ceiling (block) and the lower end of
//              the range (Stage 3 review). An undeclared lesson blocks: density
//              that is not tracked cannot be shown to fit.
//   document — with a concept registry (concepts.yaml, surface terms per
//              locale), a generated lesson that uses a LATER lesson's concept
//              has introduced an undeclared new concept. That blocks, and the
//              lesson's real count (declared + early) is checked again.
//
// Ranges → rule: the upper end of each range is the blocking ceiling; a count
// above the lower end is allowed but goes to the Stage 3 reviewer, who checks
// the concepts are chunked onto prior knowledge (Appendix B §1.2 "Nuance").

import type { TaxonomyFile, ConceptsFile } from '../catalog/schema.js';
import type { ContentLocale } from './budgets.js';

export type WorkingMemoryBand = '6-9' | '10-12' | '13+';

export const CONCEPT_CEILINGS: Readonly<Record<WorkingMemoryBand, { target: number; ceiling: number }>> = {
  '6-9': { target: 2, ceiling: 3 },
  '10-12': { target: 3, ceiling: 4 },
  '13+': { target: 4, ceiling: 6 },
};

/** The oldest youngest-age each younger band takes (Appendix B §1.2 ranges); older is 13+. */
export const WORKING_MEMORY_BAND_MAX_AGE = { '6-9': 9, '10-12': 12 } as const;

/**
 * The working-memory band a tier is authored for. Conservative like the Copy
 * Budget audience: the YOUNGEST age a tier serves decides (tier2 8–10 serves
 * 8- and 9-year-olds, so 6–9; tier4 12–18 serves 12-year-olds, so 10–12). The
 * adult register is 13+; unknown ages take the strictest band.
 */
export function workingMemoryBand(taxonomy: TaxonomyFile | undefined, tier: string, register: 'kid' | 'adult' = 'kid'): WorkingMemoryBand {
  if (register === 'adult') return '13+';
  const ages = taxonomy?.age_tiers[tier]?.ages;
  const lowest = ages ? Number(/(\d+)/.exec(ages)?.[1]) : NaN;
  if (!Number.isFinite(lowest) || lowest <= WORKING_MEMORY_BAND_MAX_AGE['6-9']) return '6-9';
  if (lowest <= WORKING_MEMORY_BAND_MAX_AGE['10-12']) return '10-12';
  return '13+';
}

/** A concept introduced LATER in course order, with the words that show a lesson using it. */
export interface FutureConcept {
  id: string;
  lesson: string;
  terms: Partial<Record<ContentLocale, string[]>>;
}

export interface ConceptPolicy {
  band: WorkingMemoryBand;
  target: number;
  ceiling: number;
  /** undefined = the blueprint does not declare its density. */
  declared?: string[];
  /** Labels of the declared concepts, authoring locale, for the write prompt. */
  declaredLabels: string[];
  /** Concepts introduced after this lesson that the registry gives terms for. */
  future: FutureConcept[];
}

export interface ConceptLessonInput {
  slug: string;
  path: string;
  tier: string;
  review: boolean;
  declared?: string[];
}

export interface ConceptCatalogFinding {
  lesson?: string;
  severity: 'block' | 'review';
  message: string;
}

export interface ConceptCatalogResult {
  policies: Map<string, ConceptPolicy>;
  findings: ConceptCatalogFinding[];
  declaredLessons: number;
  totalLessons: number;
}

/** Course-order analysis of every lesson's declared density. `lessons` must be in course order. */
export function analyzeConceptCatalog(
  lessons: readonly ConceptLessonInput[],
  taxonomy: TaxonomyFile | undefined,
  registry: ConceptsFile | undefined,
  register: 'kid' | 'adult' = 'kid',
): ConceptCatalogResult {
  const findings: ConceptCatalogFinding[] = [];
  const introducedAt = new Map<string, string>();
  const entries = registry?.concepts ?? {};
  for (const [id, entry] of Object.entries(entries)) if (entry.from_course) introducedAt.set(id, `the prerequisite course ${entry.from_course}`);

  // Where each concept is first declared, so a lesson knows which concepts are still ahead of it.
  const firstLessonIndex = new Map<string, number>();
  lessons.forEach((lesson, index) => {
    for (const id of lesson.declared ?? []) if (!firstLessonIndex.has(id)) firstLessonIndex.set(id, index);
  });

  const policies = new Map<string, ConceptPolicy>();
  let declaredLessons = 0;
  lessons.forEach((lesson, index) => {
    const band = workingMemoryBand(taxonomy, lesson.tier, register);
    const { target, ceiling } = CONCEPT_CEILINGS[band];
    const declared = lesson.declared;
    if (declared === undefined) {
      findings.push({
        lesson: lesson.slug,
        severity: 'block',
        message: `${lesson.path}: new_concepts is not declared, so the lesson's density cannot be shown to fit the ${band} ceiling of ${ceiling} (declare the genuinely new concepts, or [] for practice)`,
      });
    } else {
      declaredLessons += 1;
      const seen = new Set<string>();
      for (const id of declared) {
        if (seen.has(id)) findings.push({ lesson: lesson.slug, severity: 'block', message: `${lesson.path}: new_concepts lists "${id}" twice` });
        seen.add(id);
        const earlier = introducedAt.get(id);
        if (earlier) {
          findings.push({
            lesson: lesson.slug,
            severity: 'block',
            message: `${lesson.path}: "${id}" was already introduced in ${earlier}; it is reinforcement here, not a new concept — remove it from new_concepts`,
          });
        }
      }
      if (lesson.review && declared.length > 0) {
        findings.push({ lesson: lesson.slug, severity: 'block', message: `${lesson.path}: a review lesson consolidates and introduces nothing new, but declares ${declared.length} new concept(s)` });
      }
      const fresh = [...seen].filter((id) => !introducedAt.has(id)).length;
      if (fresh > ceiling) {
        findings.push({
          lesson: lesson.slug,
          severity: 'block',
          message: `${lesson.path}: ${fresh} new concepts exceed the ${band} working-memory ceiling of ${ceiling} — split the lesson so each part introduces at most ${ceiling} (B.17: split, never ship as authored)`,
        });
      } else if (fresh > target) {
        findings.push({
          lesson: lesson.slug,
          severity: 'review',
          message: `${lesson.path}: ${fresh} new concepts is above the ${band} target of ${target} (ceiling ${ceiling}) — Stage 3 checks they are chunked onto prior knowledge`,
        });
      }
      for (const id of seen) if (!introducedAt.has(id)) introducedAt.set(id, lesson.path);
    }

    const future: FutureConcept[] = [];
    for (const [id, first] of firstLessonIndex) {
      if (first <= index || introducedAt.has(id)) continue;
      const terms = entries[id]?.terms;
      if (terms && Object.values(terms).some((list) => (list ?? []).length > 0)) future.push({ id, lesson: lessons[first]!.path, terms });
    }
    policies.set(lesson.slug, {
      band,
      target,
      ceiling,
      ...(declared ? { declared: [...new Set(declared)] } : {}),
      declaredLabels: (declared ?? []).map((id) => entries[id]?.label['es-MX'] ?? id),
      future,
    });
  });

  for (const [id, entry] of Object.entries(entries)) {
    if (!entry.from_course && !firstLessonIndex.has(id)) {
      findings.push({ severity: 'review', message: `concepts.yaml: "${id}" is registered but no lesson introduces it` });
    }
  }

  return { policies, findings, declaredLessons, totalLessons: lessons.length };
}
