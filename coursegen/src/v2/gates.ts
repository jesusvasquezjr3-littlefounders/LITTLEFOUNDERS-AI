// Forge content gates over a v2 lesson document (S05.4c).
//
// S05.4a/b built gates 11-16 over the v1 document Forge produces today and
// listed "no v2 adapter" as an open item. A v2 document that skipped them
// would be exactly the structurally exempt path Product G.2 forbids, so the
// same gates run here, through the same measurement code, on the v2 shape:
//
//   gate 11 (B.18 redundancy)   the v2 contract has no narration channel yet:
//                               nothing is voiced, so nothing can be redundant.
//                               Reported as not applicable, never as a pass by
//                               omission; when v2 gains narration this adapter
//                               gains the check.
//   gate 12 (B.14 tone)         every learner-visible string (title, prompts,
//                               labels, spoken text, worked-step text).
//   gate 13 (OD-13 Copy Budget) title = heading, prompt = prompt, diagram
//                               labels = option; spoken readouts, expressions
//                               and results are data (Bible 06 §3.3).
//   gate 14 (B.17 concept cap)  the plan's declared new concepts against the
//                               age band's ceiling (plan-level).
//   gate 15 (B.11 misjudgment)  a flagged episode needs a Mentor voice; v2 has
//                               none yet, so a flagged v2 plan blocks with that
//                               reason (plan-level).
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
import type { MarketScenario } from '../catalog/schema.js';
import { isNonCopyKey, type V2AgeBand } from './contract.js';
import type { V2LessonPlan } from './plan.js';

export interface V2DocumentLike {
  locale?: unknown;
  age_band?: unknown;
  title?: unknown;
  segments?: unknown;
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
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    if (typeof segment.prompt === 'string') blocks.push({ segmentId, path: 'prompt', role: 'prompt', text: segment.prompt });
    const strings: Array<{ path: string; key: string; text: string }> = [];
    payloadStrings(segment.payload, 'payload', '', strings);
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

  for (const finding of checkCopyBudget(blocks, locale, audience)) {
    problems.push({ gate: 13, ...(finding.segmentId.startsWith('(') ? {} : { segmentId: finding.segmentId }), message: finding.message });
  }

  const text = blocks.map((block) => block.text).join('\n');
  for (const finding of checkRegionalDocument(text, locale, regional, markets)) problems.push({ gate: 16, message: finding.message });

  return {
    problems,
    review,
    notApplicable: [{ gate: 11, reason: 'the v2 lesson contract has no narration channel yet, so no on-screen text is voiced' }],
  };
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

  // Gate 15 — B.11.
  if (plan.mentor_misjudgment) {
    findings.push({
      gate: 15,
      severity: 'block',
      message: `flags a mentor-misjudgment episode (${plan.mentor_misjudgment.character}), but the v2 lesson contract has no Mentor voice channel to stage the misjudgment and the recovery; stage it in a format with Mentor turns`,
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
