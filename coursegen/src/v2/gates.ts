// Forge content gates over a v2 lesson document (S05.4c).
//
// S05.4a/b built gates 11-16 over the v1 document Forge produces today and
// listed "no v2 adapter" as an open item. A v2 document that skipped them
// would be exactly the structurally exempt path Product G.2 forbids, so the
// same gates run here, through the same measurement code, on the v2 shape:
//
//   gate 11 (B.18 redundancy)   GAP-FIX-R1: v2 Mentor turns carry the
//                               narration channel (mode text_only or
//                               differentiated plus script). A differentiated
//                               script must add to its on-screen line, and a
//                               narrated line longer than a caption must not
//                               duplicate the script. A document with no
//                               narrated segment voices nothing and passes.
//   gate 12 (B.14 tone)         every learner-visible string (title, prompts,
//                               labels, spoken text, worked-step text).
//   gate 13 (OD-13 Copy Budget) title = heading, prompt = prompt, diagram
//                               labels = option; spoken readouts, expressions
//                               and results are data (Bible 06 §3.3).
//   gate 14 (B.17 concept cap)  the plan's declared new concepts against the
//                               age band's ceiling (plan-level).
//   gate 15 (B.11 misjudgment)  a flagged episode must be staged: the plan
//                               needs a `voice.mentor-episode.v2` segment (the
//                               Mentor voices the misjudgment and the
//                               recovery); without one it blocks (plan-level).
//                               GAP-FIX-R3 (B.8, OD-19): the document's stage
//                               scene (mentor_stage.scene, else the lesson's
//                               adventure_scene_id) must be an approved
//                               catalog scene, so every v2 lesson stages the
//                               learner's Mentor (document-level).
//   gate 16 (B.16 regional)     another market's anchors or currency always
//                               block; with the plan's scenarios, a missing
//                               market scenario or an unapplied one blocks.
//
// Release time (verify:course) has the documents but not the plans, so it
// runs the document-only half (11, 12, 13, 16 residue); the plan-level half
// runs when the emitter builds the documents.

import type { GateNumber, GateProblem } from '../pipeline/gates.js';
import type { Audience, ContentLocale, CopyRole } from '../contentGates/budgets.js';
import { checkCopyBudget } from '../contentGates/copyBudget.js';
import { CONCEPT_CEILINGS, type WorkingMemoryBand } from '../contentGates/conceptCap.js';
import { analyzeRegionalLesson, checkRegionalDocument, loadMarketInventory, type MarketInventory, type RegionalPolicy } from '../contentGates/regional.js';
import { scanTone, toneAdvice, type ToneFinding } from '../contentGates/tone.js';
import { scanGlossary } from '../contentGates/glossary.js';
import type { MarketScenario } from '../catalog/schema.js';
import { captionLimit } from '../contentGates/budgets.js';
import { SCRIPT_REPEAT_THRESHOLD, REDUNDANCY_THRESHOLD, verbatimCoverage } from '../contentGates/redundancy.js';
import { countWords, tokens } from '../contentGates/text.js';
import { isNonCopyKey, V2_MENTOR_VOICE_TYPES, type V2AgeBand } from './contract.js';
import type { V2LessonPlan } from './plan.js';
import { runV2CarriedGates } from './carriedGates.js';
import { horizontePieceGates } from './horizonte/index.js';

export interface V2DocumentLike {
  locale?: unknown;
  age_band?: unknown;
  title?: unknown;
  segments?: unknown;
  approaches?: unknown;
}

export interface V2TextBlock {
  segmentId: string;
  path: string;
  role: CopyRole;
  text: string;
}

export interface V2Finding {
  gate: GateNumber;
  severity: 'block' | 'review';
  segmentId?: string;
  message: string;
}

export interface V2GateReport {
  problems: GateProblem[];
  review: V2Finding[];
  /** Gates that do not apply to the v2 shape yet, with the reason. */
  notApplicable: Array<{ gate: GateNumber; reason: string }>;
}

const LOCALES: readonly ContentLocale[] = ['en-US', 'es-MX', 'pt-BR'];

export function v2Locale(document: V2DocumentLike): ContentLocale {
  return LOCALES.includes(document.locale as ContentLocale) ? (document.locale as ContentLocale) : 'es-MX';
}

/** Copy Budget audience: Bible 06's 6-9 limits apply to the 6-9 pathway only. */
export function v2Audience(ageBand: unknown): Audience {
  return ageBand === '6-9' ? { young: true, label: 'v2 age band 6-9' } : { young: false, label: `v2 age band ${String(ageBand)}` };
}

/** Working-memory band of a v2 age pathway (B.17). Unknown bands take the strictest. */
export function v2WorkingMemoryBand(ageBand: V2AgeBand | unknown): WorkingMemoryBand {
  if (ageBand === '10-12') return '10-12';
  if (ageBand === '13-17' || ageBand === 'adult') return '13+';
  return '6-9';
}

function roleForPayloadKey(key: string): CopyRole {
  // GAP-FIX-R1: the new families' learner-visible fields keep their Bible 06 roles.
  if (key === 'line' || key === 'setup' || key === 'misjudgment' || key === 'recovery') return 'mentor';
  if (key === 'scene') return 'detail';
  if (key === 'rule' || key === 'prompt') return 'prompt';
  if (key === 'text') return 'body';
  if (key === 'label' || key === 'face') return 'option';
  return /Label$/.test(key) ? 'option' : 'data';
}

function payloadStrings(node: unknown, pathSoFar: string, key: string, out: Array<{ path: string; key: string; text: string }>): void {
  if (typeof node === 'string') {
    out.push({ path: pathSoFar, key, text: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => payloadStrings(item, `${pathSoFar}[${index}]`, key, out));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node as Record<string, unknown>)) {
      if (!isNonCopyKey(childKey)) payloadStrings(value, `${pathSoFar}.${childKey}`, childKey, out);
    }
  }
}

/** Every learner-visible string of a v2 document, with its Copy Budget role. */
export function v2TextBlocks(document: V2DocumentLike): V2TextBlock[] {
  const blocks: V2TextBlock[] = [];
  if (typeof document.title === 'string') blocks.push({ segmentId: '(title)', path: 'title', role: 'heading', text: document.title });
  // GAP-FIX-R5 (B.24): an approach's name is a choice the learner reads, an option under the Copy Budget.
  const approaches = (document.approaches as { options?: Array<{ label?: unknown }> } | undefined)?.options ?? [];
  approaches.forEach((option, index) => { if (typeof option.label === 'string') blocks.push({ segmentId: '(approaches)', path: `approaches.options[${index}].label`, role: 'option', text: option.label }); });
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    if (typeof segment.prompt === 'string') blocks.push({ segmentId, path: 'prompt', role: 'prompt', text: segment.prompt });
    // Help ladder steps are spoken by the Mentor in one speech-plate turn each.
    if (Array.isArray(segment.help)) segment.help.forEach((step, index) => { if (typeof step === 'string') blocks.push({ segmentId, path: `help[${index}]`, role: 'mentor', text: step }); });
    // GAP-FIX-R6 (B.20, Bible 02 §9.2): the feedback banner is one body string per verdict.
    const feedback = segment.feedback as Record<string, unknown> | undefined;
    if (feedback && typeof feedback === 'object') for (const key of ['met', 'not_yet']) {
      if (typeof feedback[key] === 'string') blocks.push({ segmentId, path: `feedback.${key}`, role: 'body', text: feedback[key] as string });
    }
    const strings: Array<{ path: string; key: string; text: string }> = [];
    // A narration script is heard, never shown: the redundancy gate reads it, the Copy Budget does not.
    const payload = segment.payload && typeof segment.payload === 'object' ? { ...(segment.payload as Record<string, unknown>) } : segment.payload;
    if (payload && typeof payload === 'object') delete (payload as Record<string, unknown>).narration;
    payloadStrings(payload, 'payload', '', strings);
    // Ids and enum values (currency: "coins", mode: "discount") are contract
    // vocabulary, not copy (isNonCopyKey): only fields the author writes count.
    for (const item of strings) {
      blocks.push({ segmentId, path: item.path, role: roleForPayloadKey(item.key), text: item.text });
    }
  }
  return blocks;
}

/** Document-only gates (11, 12, 13, 16 residue), plus 16's scenario checks when a regional policy is known. */
export function runV2DocumentGates(
  document: V2DocumentLike,
  regional?: RegionalPolicy,
  markets: MarketInventory = loadMarketInventory(),
  answerKeys?: Record<string, unknown>,
): V2GateReport {
  const locale = v2Locale(document);
  const audience = v2Audience(document.age_band);
  const blocks = v2TextBlocks(document);
  const problems: GateProblem[] = [];
  const review: V2Finding[] = [];

  const tone: Array<ToneFinding & { segmentId: string; path: string }> = [];
  for (const block of blocks) for (const finding of scanTone(block.text, locale, 'lesson')) tone.push({ ...finding, segmentId: block.segmentId, path: block.path });
  for (const finding of tone) {
    const where = finding.segmentId.startsWith('(') ? {} : { segmentId: finding.segmentId };
    const message = `${finding.path}: "${finding.phrase}" (${finding.category}) — ${toneAdvice(finding.category)}. Text: "${finding.excerpt}"`;
    if (finding.severity === 'block') problems.push({ gate: 12, ...where, message });
    else review.push({ gate: 12, severity: 'review', ...where, message });
  }

  // OD-11 (GAP-FIX-R1): the controlled glossary over every learner-visible v2 string.
  for (const block of blocks) {
    for (const finding of scanGlossary(block.text, locale)) {
      const where = block.segmentId.startsWith('(') ? {} : { segmentId: block.segmentId };
      const message = `${block.path}: "${finding.phrase}" is a never-use glossary term (${finding.misuse}, OD-11). Text: "${finding.excerpt}"`;
      if (finding.severity === 'block') problems.push({ gate: 12, ...where, message });
      else review.push({ gate: 12, severity: 'review', ...where, message });
    }
  }

  for (const finding of checkCopyBudget(blocks, locale, audience)) {
    problems.push({ gate: 13, ...(finding.segmentId.startsWith('(') ? {} : { segmentId: finding.segmentId }), message: finding.message });
  }

  const text = blocks.map((block) => block.text).join('\n');
  for (const finding of checkRegionalDocument(text, locale, regional, markets)) problems.push({ gate: 16, message: finding.message });

  for (const finding of checkV2Narration(document, locale, audience)) problems.push({ gate: 11, segmentId: finding.segmentId, message: finding.message });

  for (const message of checkV2StageScene(document)) problems.push({ gate: 15, message });

  // GAP-FIX-R2 (Appendix C Stage 2; B.22, B.26, B.27; G.2): the carried-over gates 2, 3, 4, 17 and 18.
  const carried = runV2CarriedGates(document as Record<string, unknown>, answerKeys);
  problems.push(...carried.problems);
  review.push(...carried.review);

  problems.push(...horizontePieceGates(document, answerKeys));

  return { problems, review, notApplicable: [] };
}

/** The approved Mentor stage scenes (Core's `MENTOR_STAGE_SCENES`; frontend `lessonDocument.ts`). */
export const V2_STAGE_SCENES = ['diorama-a', 'diorama-b'] as const;

/**
 * B.8 / OD-19 (GAP-FIX-R3): every v2 lesson stages the learner's Mentor on a
 * scene the lesson declares. The stage scene is `mentor_stage.scene`, else
 * the lesson's `adventure_scene_id`; a document whose stage scene is not an
 * approved catalog scene blocks, so Core never has to fall back.
 */
export function checkV2StageScene(document: V2DocumentLike): string[] {
  const stage = (document as { mentor_stage?: { scene?: unknown } }).mentor_stage;
  const scene = stage ? stage.scene : (document as { adventure_scene_id?: unknown }).adventure_scene_id;
  if (typeof scene === 'string' && (V2_STAGE_SCENES as readonly string[]).includes(scene)) return [];
  return [`the Mentor stage has no approved scene: ${stage ? 'mentor_stage.scene' : 'adventure_scene_id'} is ${JSON.stringify(scene ?? null)}, not one of ${V2_STAGE_SCENES.join(', ')} (B.8, OD-19)`];
}

/**
 * Gate 11 (B.18) on v2: every Mentor-voiced segment's narration channel. A
 * differentiated script must say more than the plate (it may not repeat the
 * on-screen line), and a plate longer than a caption may not substantially
 * duplicate what is read aloud.
 */
export function checkV2Narration(document: V2DocumentLike, locale: ContentLocale, audience: Audience): Array<{ segmentId: string; message: string }> {
  const caption = captionLimit(locale, audience);
  const findings: Array<{ segmentId: string; message: string }> = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    if (!(V2_MENTOR_VOICE_TYPES as readonly string[]).includes(String(segment.type))) continue;
    const payload = (segment.payload ?? {}) as Record<string, unknown>;
    const narration = payload.narration as { mode?: unknown; script?: unknown } | undefined;
    if (!narration || narration.mode !== 'differentiated' || typeof narration.script !== 'string') continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const shown = ['line', 'setup', 'misjudgment', 'recovery'].map((key) => payload[key]).filter((value): value is string => typeof value === 'string').join(' ');
    const script = tokens(narration.script);
    const screen = tokens(shown);
    if (verbatimCoverage(script, screen) >= SCRIPT_REPEAT_THRESHOLD) {
      findings.push({ segmentId, message: `narration.script repeats the on-screen line: a differentiated script must explain, the plate only cues (B.18)` });
    }
    if (countWords(shown) > caption.words && verbatimCoverage(screen, script) >= REDUNDANCY_THRESHOLD) {
      findings.push({ segmentId, message: `a narrated plate of ${countWords(shown)} words duplicates its narration; shorten it to a caption (<= ${caption.words} words) or differentiate it (B.18)` });
    }
  }
  return findings;
}

export interface V2PlanPolicy {
  regional: RegionalPolicy;
  findings: V2Finding[];
}

/** Plan-level lesson-policy gates 14-16, decided before any document is built. */
export function analyzeV2Plan(plan: V2LessonPlan, markets: MarketInventory = loadMarketInventory()): V2PlanPolicy {
  const findings: V2Finding[] = [];

  // Gate 14 — B.17.
  const band = v2WorkingMemoryBand(plan.age_band);
  const { target, ceiling } = CONCEPT_CEILINGS[band];
  const count = new Set(plan.new_concepts).size;
  if (count !== plan.new_concepts.length) findings.push({ gate: 14, severity: 'block', message: 'new_concepts lists a concept twice' });
  if (count > ceiling) {
    findings.push({ gate: 14, severity: 'block', message: `introduces ${count} new concepts, over the ${band} ceiling of ${ceiling}: split the lesson, never ship it as authored (B.17)` });
  } else if (count > target) {
    findings.push({ gate: 14, severity: 'review', message: `introduces ${count} new concepts, above the ${band} target of ${target}: Stage 3 checks they are chunked onto prior knowledge` });
  }

  // Gate 15 — B.11: a flagged episode is staged by a Mentor-voiced episode segment.
  if (plan.mentor_misjudgment && !plan.segments.some((segment) => segment.type === 'voice.mentor-episode.v2')) {
    findings.push({
      gate: 15,
      severity: 'block',
      message: `flags a mentor-misjudgment episode (${plan.mentor_misjudgment.character}) but stages it nowhere: add a voice.mentor-episode.v2 segment that voices the misjudgment and the recovery`,
    });
  }

  // Gate 16 — B.16.
  const scenarios = 'scenarios' in plan.regional ? (plan.regional.scenarios as Record<ContentLocale, MarketScenario>) : undefined;
  const analysis = analyzeRegionalLesson(
    {
      slug: plan.lesson_id,
      path: `${plan.course_id}/${plan.pathway_id}/${plan.chapter_id}/${plan.lesson_id}`,
      factRefs: [],
      briefs: [plan.brief],
      scenarios: scenarios ?? { universal: (plan.regional as { universal: string }).universal },
    },
    undefined,
    markets,
  );
  const regional = analysis.policy;
  const localCurrency = plan.segments.some((segment) => segment.payload.currency === 'local');
  if (localCurrency && !regional.required) {
    regional.required = true;
    regional.reasons = [...regional.reasons, 'a segment shows amounts in the local currency'];
    if (!scenarios) {
      findings.push({ gate: 16, severity: 'block', message: `shows amounts in the local currency but is declared market-neutral: write a scenario per market (B.16)` });
    }
  }
  for (const finding of analysis.findings) findings.push({ gate: 16, severity: finding.severity, message: finding.message });

  return { regional, findings };
}
