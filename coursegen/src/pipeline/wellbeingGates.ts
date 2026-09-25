// Forge gates 18 and 19 (S05.3f). Policy:
// docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md. Both read the one
// learner register policy Core owns (learnerRegisterPolicy.generated.ts, a
// byte-identical copy checked by `npm run spec:check`).
//
// GATE 18 — shame, family-finance framing and manipulation language
// (Appendix C Part 3, Stage 2, gate 4 "shame-language", extended by B.27 and
// by B.25's content half). Over every learner-visible string of the document:
//
//   BLOCKING
//     * self-global language: a verdict on who the learner is ("you're not a
//       saver", "no eres bueno para el dinero"), in any state (B.26);
//     * trait praise ("you're so smart"): praise names the step, not the child;
//     * moralizing a family's real money ("poor families are lazy", "tus
//       papás malgastan"), anywhere, story included (B.27);
//     * a loss mechanic: `scoring.hearts` set, or lives/hearts copy (OD-1);
//     * a purchase or advertising lure (B.25; OD-5: no paywall exists).
//   REVIEW (the Stage 3 reviewer decides: a story may say "hurry" to a
//   character, or teach how "last chance" sales pressure works)
//     * time-pressure, parasocial-pressure and social-pressure language;
//     * a timed drill (a segment declaring seconds): B.25 checklist MN-02.
//
// GATE 19 — the age register (B.23). The tier's ages map to one or more
// registers (a tier such as "8-10" spans two); the strictest applies:
//
//   BLOCKING
//     * a register's own forbidden lexicon (childish framing such as "kiddo",
//       "campeoncito" in a lesson any teen or adult will read);
//     * feedback that praises with nothing named ("Great job!") where any
//       register in range no longer takes praise at face value (10+).
//   REVIEW
//     * more exclamation marks in one string than the strictest register
//       allows (a teen register allows none in the product's own voice).

import {
  REGISTERS, findLexicons, forbiddenLexicons, isGenericPraise, exclamationCount,
  parseAgeRange, registersForAgeRange, type LexiconId, type LearnerRegister,
} from './learnerRegisterPolicy.generated.js';

export interface WellbeingFinding {
  path: string;
  segmentId?: string;
  message: string;
}

export interface WellbeingReport {
  blocking: WellbeingFinding[];
  review: WellbeingFinding[];
}

const GATE18_BLOCKING: readonly LexiconId[] = ['self-global', 'person-praise', 'family-finance-moralizing', 'loss-mechanic', 'purchase-lure'];
const GATE18_REVIEW: readonly LexiconId[] = ['time-pressure', 'parasocial-pressure', 'social-pressure'];
const FEEDBACK_KEY = /^(rationale_md|explanation_md|hint_md|hints|reactions?|feedback[a-z_]*|correct_md|success[a-z_]*)$/;
const TIMED_KEY = /^(seconds|seconds_per_question|time_limit[a-z_]*|timer[a-z_]*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface VisibleString { text: string; path: string; segmentId?: string; feedback: boolean }

/** Every learner-visible string, with its path, segment and whether it sits in a feedback field. */
export function visibleStrings(rawDocument: unknown, skipKeys: ReadonlySet<string>): VisibleString[] {
  const out: VisibleString[] = [];
  const walk = (node: unknown, path: string, segmentId: string | undefined, feedback: boolean): void => {
    if (typeof node === 'string') { out.push({ text: node, path, segmentId, feedback }); return; }
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${path}[${index}]`, segmentId, feedback)); return; }
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (skipKeys.has(key) || key === 'schema_version' || key === 'scoring') continue;
      walk(value, path ? `${path}.${key}` : key, segmentId, feedback || FEEDBACK_KEY.test(key));
    }
  };
  if (!isRecord(rawDocument)) return out;
  for (const [key, value] of Object.entries(rawDocument)) {
    if (key === 'segments' && Array.isArray(value)) {
      value.forEach((segment, index) => {
        const id = isRecord(segment) && typeof segment.id === 'string' ? segment.id : undefined;
        walk(segment, `segments[${index}]`, id, false);
      });
    } else if (!skipKeys.has(key) && key !== 'scoring' && key !== 'schema_version') {
      walk(value, key, undefined, false);
    }
  }
  return out;
}

function timedSegments(rawDocument: unknown): WellbeingFinding[] {
  if (!isRecord(rawDocument) || !Array.isArray(rawDocument.segments)) return [];
  const found: WellbeingFinding[] = [];
  rawDocument.segments.forEach((segment, index) => {
    if (!isRecord(segment) || !isRecord(segment.payload)) return;
    const id = typeof segment.id === 'string' ? segment.id : undefined;
    for (const [key, value] of Object.entries(segment.payload)) {
      if (TIMED_KEY.test(key) && typeof value === 'number' && value > 0) {
        found.push({ path: `segments[${index}].payload.${key}`, segmentId: id, message: `a timed drill (${value}s): the reviewer confirms running out of time costs nothing the learner cannot retry (B.25, MN-02)` });
      }
    }
  });
  return found;
}

export function runWellbeingLanguageGate(rawDocument: unknown, skipKeys: ReadonlySet<string>): WellbeingReport {
  const report: WellbeingReport = { blocking: [], review: [] };
  if (!isRecord(rawDocument)) return report;
  const scoring = rawDocument.scoring;
  if (isRecord(scoring) && scoring.hearts !== undefined && scoring.hearts !== null) {
    report.blocking.push({ path: 'scoring.hearts', message: 'a lives counter is a loss mechanic: a wrong answer must cost nothing (OD-1, B.26); set it to null' });
  }
  for (const item of visibleStrings(rawDocument, skipKeys)) {
    for (const hit of findLexicons(item.text, GATE18_BLOCKING)) {
      report.blocking.push({ path: item.path, segmentId: item.segmentId, message: `${hit.lexicon} "${hit.match}": ${explain(hit.lexicon)}` });
    }
    for (const hit of findLexicons(item.text, GATE18_REVIEW)) {
      report.review.push({ path: item.path, segmentId: item.segmentId, message: `${hit.lexicon} "${hit.match}": the reviewer confirms the text teaches it and never applies it to the learner (B.25)` });
    }
  }
  report.review.push(...timedSegments(rawDocument));
  return report;
}

function explain(lexicon: LexiconId): string {
  switch (lexicon) {
    case 'self-global': return 'name the step that went wrong, never who the learner is (B.26)';
    case 'person-praise': return 'praise the step or strategy, never a trait (Appendix B §1.8)';
    case 'family-finance-moralizing': return 'no family\'s real money is a personal or moral failing (B.27)';
    case 'loss-mechanic': return 'nothing is spent by a wrong answer (OD-1)';
    case 'purchase-lure': return 'no purchase or advertising lure (B.25, OD-5)';
    default: return 'forbidden by the learner register policy';
  }
}

/** The registers a Forge tier's ages span; unknown ages read as every register (strictest). */
export function registersForTier(ages: string | undefined): LearnerRegister[] {
  const range = ages ? parseAgeRange(ages) : null;
  return range ? registersForAgeRange(range.min, range.max) : ['young', 'transition', 'teen', 'adult'];
}

export function runAgeRegisterGate(rawDocument: unknown, skipKeys: ReadonlySet<string>, tierAges: string | undefined): WellbeingReport {
  const report: WellbeingReport = { blocking: [], review: [] };
  const registers = registersForTier(tierAges);
  const own = [...new Set(registers.flatMap((register) => REGISTERS[register].tone.forbids))];
  const noGenericPraise = registers.some((register) => !REGISTERS[register].tone.genericPraise);
  const exclamations = Math.min(...registers.map((register) => REGISTERS[register].tone.exclamations));
  const label = registers.join(', ');
  for (const item of visibleStrings(rawDocument, skipKeys)) {
    for (const hit of findLexicons(item.text, own)) {
      report.blocking.push({ path: item.path, segmentId: item.segmentId, message: `${hit.lexicon} "${hit.match}" in a lesson read in the ${label} register (B.23)` });
    }
    if (noGenericPraise && item.feedback && isGenericPraise(item.text)) {
      report.blocking.push({ path: item.path, segmentId: item.segmentId, message: `"${item.text.trim()}" praises with nothing named; from age 10 praise names the step or skill (B.20, B.23)` });
    }
    if (exclamationCount(item.text) > exclamations && !item.path.includes('dialogue') && !item.path.includes('lines')) {
      report.review.push({ path: item.path, segmentId: item.segmentId, message: `${exclamationCount(item.text)} exclamation(s) where the ${label} register allows ${exclamations} (B.23)` });
    }
  }
  return report;
}

/** For reports and tests: the lexicons a register forbids, from the shared policy. */
export function registerLexicons(register: LearnerRegister): LexiconId[] {
  return forbiddenLexicons(register);
}
