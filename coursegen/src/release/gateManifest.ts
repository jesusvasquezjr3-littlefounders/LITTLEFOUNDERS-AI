// The Forge release-gate manifest (S05.4c; Product G.2, Appendix C Part 3 Stage 2).
//
// One list of every check `verify:course` records in a course's release
// attestation. Vault's `release_course` preflight (shared by Core's staff
// publish route and the local `db:publish-course` command) refuses a release
// unless the attestation carries a passing entry for every id seeded into
// `public.forge_release_gates` by the release-gate-manifest migration.
// `agent/tools/check-forge-release-gate-parity.mjs` fails when this list and
// the migrations disagree, so a new Forge gate cannot ship without being part
// of the release preflight, and a DB requirement cannot name a check Forge
// never records.
//
// Keep ids stable: they are the contract with the database. Add a new id with
// a new migration row; never rename one.

import type { GateNumber } from '../pipeline/gates.js';

export type ReleaseCheckScope = 'catalog' | 'document' | 'course';

export interface ReleaseCheckDefinition {
  /** Stable id recorded in `course_release_verifications.checks[].gate`. */
  id: string;
  /** Forge gate number when the check is one of runAllGates' document gates. */
  gate?: GateNumber;
  /**
   * SPEC ids the check enforces. 'AppC-S2.8' marks the gates Appendix C Stage 2
   * item 8 carries over from the legacy pipeline; 'G.2' marks release-integrity
   * checks with no narrower Block B owner.
   */
  spec: readonly string[];
  scope: ReleaseCheckScope;
  /** Short description (also seeded into the database row). */
  description: string;
  /**
   * Whether a blueprint's `known_exception` may excuse a document failing this
   * check. Only the legacy gates 1-9 may be excused: Appendix C Stage 1 gives
   * no gate exemption to any draft, and B.17 says an over-ceiling lesson is
   * "split, not shipped as authored". The content and lesson-policy gates
   * (11-16) are never exemptable.
   */
  exemptable: boolean;
}

/** Forge document gates that verify:course cannot evaluate, with the reason. */
export const GENERATION_ONLY_GATES: Readonly<Partial<Record<GateNumber, string>>> = {
  10: 'plan fidelity compares a written document with the approved plan skeleton; the plan is not persisted with the document, so it is enforced in the write stage only',
};

export const FORGE_RELEASE_CHECKS: readonly ReleaseCheckDefinition[] = [
  // ---- catalog ----------------------------------------------------------------
  { id: 'forge.catalog.loads', spec: ['G.2'], scope: 'catalog', exemptable: false, description: 'Catalog loads with no errors' },
  { id: 'forge.catalog.progression', spec: ['G.2'], scope: 'catalog', exemptable: false, description: 'Pedagogical progression has no errors' },
  { id: 'forge.catalog.concept-cap', spec: ['B.17'], scope: 'catalog', exemptable: false, description: 'Every lesson declares its new concepts within the age ceiling' },
  { id: 'forge.catalog.mentor-misjudgment', spec: ['B.11'], scope: 'catalog', exemptable: false, description: 'The course meets the mentor-misjudgment episode minimum' },
  { id: 'forge.catalog.regional-adaptation', spec: ['B.16'], scope: 'catalog', exemptable: false, description: 'Every lesson with market context declares its market scenarios' },
  { id: 'forge.catalog.tone', spec: ['B.14'], scope: 'catalog', exemptable: false, description: 'Catalog titles, descriptions and tips pass the Law 2 tone gate' },
  { id: 'forge.catalog.copy-budget', spec: ['OD-13'], scope: 'catalog', exemptable: false, description: 'Catalog titles, descriptions and tips meet the Copy Budget' },
  // ---- documents: one check per Forge gate (Appendix C Part 1.3 pass rate per gate)
  { id: 'forge.gate.01.contract', gate: 1, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 1: lesson contract' },
  { id: 'forge.gate.02.age-vocabulary', gate: 2, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 2: age-tier vocabulary' },
  { id: 'forge.gate.03.currency-facts', gate: 3, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 3: currency facts' },
  { id: 'forge.gate.04.arithmetic', gate: 4, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 4: arithmetic re-execution' },
  { id: 'forge.gate.05.rationale-canon', gate: 5, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 5: rationale and character canon' },
  { id: 'forge.gate.06.anti-genericity', gate: 6, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 6: anti-genericity' },
  { id: 'forge.gate.07.generation-quality', gate: 7, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 7: generation quality' },
  { id: 'forge.gate.08.clarity', gate: 8, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 8: clarity and visual-first' },
  { id: 'forge.gate.09.readability', gate: 9, spec: ['AppC-S2.8'], scope: 'document', exemptable: true, description: 'Gate 9: readability band' },
  { id: 'forge.gate.11.redundancy', gate: 11, spec: ['B.18'], scope: 'document', exemptable: false, description: 'Gate 11: on-screen text versus narration' },
  { id: 'forge.gate.12.tone', gate: 12, spec: ['B.14'], scope: 'document', exemptable: false, description: 'Gate 12: Law 2 tone' },
  { id: 'forge.gate.13.copy-budget', gate: 13, spec: ['OD-13'], scope: 'document', exemptable: false, description: 'Gate 13: Copy Budget' },
  { id: 'forge.gate.14.concept-cap', gate: 14, spec: ['B.17'], scope: 'document', exemptable: false, description: 'Gate 14: concept cap' },
  { id: 'forge.gate.15.mentor-misjudgment', gate: 15, spec: ['B.11'], scope: 'document', exemptable: false, description: 'Gate 15: mentor misjudgment episode' },
  { id: 'forge.gate.16.regional-adaptation', gate: 16, spec: ['B.16'], scope: 'document', exemptable: false, description: 'Gate 16: regional adaptation' },
  // ---- course release ---------------------------------------------------------
  { id: 'forge.release.lessons-complete', spec: ['G.2'], scope: 'course', exemptable: false, description: 'Every blueprint produced a release-ready lesson' },
  { id: 'forge.release.locales-complete', spec: ['G.2'], scope: 'course', exemptable: false, description: 'Every release-ready lesson has all three locales' },
  { id: 'forge.release.illustration-style', spec: ['G.2'], scope: 'course', exemptable: false, description: 'Every document uses the current illustration style' },
  { id: 'forge.release.visual-coverage', spec: ['G.2'], scope: 'course', exemptable: false, description: 'Every planned visual target has an approved illustration' },
  { id: 'forge.release.distinct-scenes', spec: ['G.2'], scope: 'course', exemptable: false, description: 'No scene illustration is reused across lessons' },
  { id: 'forge.release.orphan-progress', spec: ['G.2'], scope: 'course', exemptable: false, description: 'No orphaned lesson carries learner progress' },
  { id: 'forge.release.currency-locale', spec: ['B.16'], scope: 'course', exemptable: false, description: 'No foreign currency word leaked across locales' },
  { id: 'forge.release.topic-titles', spec: ['B.16'], scope: 'course', exemptable: false, description: 'Topic titles are present and localized in all three locales' },
  // A v2 activation changes what a learner is served, so every activated v2
  // document passes the document half of the v2 Forge gates (src/v2/gates.ts).
  { id: 'forge.release.v2-content', spec: ['B.14', 'B.16', 'B.17', 'OD-13'], scope: 'course', exemptable: false, description: 'Every activated v2 document passes the Forge content gates' },
];

export const RELEASE_CHECK_IDS: readonly string[] = FORGE_RELEASE_CHECKS.map((check) => check.id);

export function releaseCheck(id: string): ReleaseCheckDefinition {
  const found = FORGE_RELEASE_CHECKS.find((check) => check.id === id);
  if (!found) throw new Error(`unknown release check "${id}"`);
  return found;
}

/** The release check for a Forge document gate, or undefined for a generation-only gate. */
export function checkForGate(gate: GateNumber): ReleaseCheckDefinition | undefined {
  return FORGE_RELEASE_CHECKS.find((check) => check.gate === gate);
}

/** Gates a known_exception may excuse. */
export const EXEMPTABLE_GATES: ReadonlySet<number> = new Set(
  FORGE_RELEASE_CHECKS.filter((check) => check.gate !== undefined && check.exemptable).map((check) => check.gate as number),
);
