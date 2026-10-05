/*
 * author-briefs — emit self-contained authoring briefs for an OUT-OF-PIPELINE
 * author (a Claude subagent) instead of DeepSeek.
 *
 * WHY THIS EXISTS. Forge's own `plan`/`write` stages assemble their prompts
 * from CONTENT_PLAYBOOK + MIX_RULES + BASE_HARD_RULES + the palette + per-type
 * shape examples, and hand them to a provider. When the author is a subagent
 * rather than an HTTP provider, the prompt has to become a FILE. Every block
 * below is IMPORTED from the module that owns it — never paraphrased — for the
 * same reason `src/contract/**` is byte-diffed against the frontend: a second,
 * hand-maintained copy of a rule does not fail loudly when it drifts, it just
 * quietly stops being the rule (coursegen/AGENTS.md, "Contract-copy parity").
 *
 * The author does plan AND write in one pass, so the brief carries BOTH the
 * MIX RULES (which govern the segment skeleton) and the HARD RULES (which
 * govern the document). Nothing here validates anything: `author-validate.ts`
 * re-runs the real contract + all 9 gates over whatever comes back, and is the
 * only authority on whether a document is usable.
 *
 * Usage:
 *   npx tsx src/scripts/author-briefs.ts --course <slug> --out <dir> [--slots <prefix> ...]
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { loadCourseCatalog } from '../catalog/loader.js';
import { buildCompetencyGraph } from '../catalog/competencyGraph.js';
import { enumerateSlots, filterSlots, buildPlanContext, type Slot } from '../pipeline/run.js';
import { resolveRegister } from '../pipeline/register.js';
import { resolveAllowedTypes, renderPalette } from '../pipeline/prompts/palette.js';
import { MIX_RULES, renderCompetencyBlockForPrompt, renderReviewSourcesBlock, type PlanContext } from '../pipeline/plan.js';
import { BASE_HARD_RULES, renderFactsBlock, buildLessonDirectives } from '../pipeline/write.js';
import { CONTENT_PLAYBOOK, FOLLOWABILITY_RULES, tierReasoningGuidance } from '../pipeline/contentPlaybook.js';
import { ICON_PALETTE } from '../pipeline/generationQuality.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';
import { shapeExample } from '../pipeline/shapeExample.js';
import { lessonMetaSchema, lessonScoringSchema } from '../contract/core/schemaBase.js';

interface Args {
  course: string;
  out: string;
  slots: string[];
  /**
   * Slot prefixes to drop AFTER `--slots` selects. Re-authoring a lesson that
   * is already written costs a full generation for no gain, so a resumed or
   * widened batch subtracts what is done rather than redoing it.
   */
  exclude: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> & { slots: string[]; exclude: string[] } = { slots: [], exclude: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    // §1.14: a value-taking flag must never swallow the NEXT flag as its value.
    const takeValue = (name: string): string => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`author-briefs: ${name} requires a value`);
      i++;
      return value;
    };
    if (flag === '--course') args.course = takeValue('--course');
    else if (flag === '--out') args.out = takeValue('--out');
    else if (flag === '--slots') args.slots.push(takeValue('--slots'));
    else if (flag === '--exclude') args.exclude.push(takeValue('--exclude'));
    else throw new Error(`author-briefs: unknown flag "${flag}"`);
  }
  if (!args.course) throw new Error('author-briefs: --course is required');
  if (!args.out) throw new Error('author-briefs: --out is required');
  return args as Args;
}

/**
 * TOKEN ECONOMY: split the per-TYPE material out of the shared contract.
 *
 * The contract used to carry the JSON shape of all 57 palette types (38.8KB)
 * plus every type-specific hard rule (17KB) — 56% of a 100KB file that every
 * authoring subagent read in full, to write lessons using 8-10 types. The rest
 * was pure context tax, and worse than free: it is 47KB of rules about
 * mechanics the agent is not using, competing for attention with the ones it is.
 *
 * So each type gets its own small file, read on demand. The contract keeps only
 * what applies to EVERY lesson. Measured effect is reported by the emitter.
 *
 * A rule counts as type-specific only when it OPENS by naming its type(s) —
 * "compare_table segments ONLY:", "coin_count / make_change segments ONLY:",
 * "pattern_complete VISUAL RULE:". A rule that merely mentions types further in
 * (the answer-leak rule cites match_pairs, debug_hunt and spot_error as
 * examples) stays GENERAL: dropping it from the shared contract would lose a
 * rule that governs every lesson.
 */
const TYPE_RULE_HEAD = /^([a-z_]+(?:\s*\/\s*[a-z_]+)*)\s+(?:segments\s+)?(?:ONLY|VISUAL RULE|OPTIONS RULE|CONTENT)\b/;

function classifyHardRules(allowedTypes: readonly string[]): {
  general: string[];
  byType: Map<string, string[]>;
} {
  const allowed = new Set(allowedTypes);
  const general: string[] = [];
  const byType = new Map<string, string[]>();
  for (const rule of BASE_HARD_RULES) {
    const head = TYPE_RULE_HEAD.exec(rule.trim());
    const named = head
      ? head[1]!.split('/').map((t) => t.trim()).filter((t) => allowed.has(t))
      : [];
    if (named.length === 0) {
      general.push(rule);
      continue;
    }
    for (const type of named) {
      const list = byType.get(type) ?? [];
      list.push(rule);
      byType.set(type, list);
    }
  }
  return { general, byType };
}

/**
 * Hard-won guidance that is NOT in BASE_HARD_RULES because it came from this
 * harness's own measured failures, and belongs with the type it is about
 * rather than in the shared contract every agent reads.
 */
const TYPE_ADDENDA: Readonly<Record<string, string>> = {
  compare_table: [
    'SIZING — this type caused 7 of the 12 gate failures in the first adventure, always the same way.',
    'You must satisfy BOTH of these at once, and they pull against each other:',
    '  (a) every SOURCE cell needs its row label AND its value stated together in `prompt_md`, using the row\'s EXACT payload label — the table renders EMPTY cells and a token bank, with no data panel, so the prompt is the only source of truth. Writing "Tianguis:" when the row label is "Cambio en el tianguis" FAILS: the learner cannot bind them.',
    '  (b) `prompt_md` is capped at 160 characters and 3 sentences. This cap is NOT waived for this type.',
    'Together those fit only a SMALL table: 2 rows x 2 source columns, values of one to three words. If your table does not fit, SHRINK IT — drop a column, drop a row, shorten the token texts — do not cram the prompt.',
    'The one column exempt from (a) is the DERIVED decision column, and it is detected by a REGEX on the column id/label: /elig|eleg|escoj|escog|choos|pick|best|mejor|winner|ganad/i. A decision column named `conviene` does NOT match and will be treated as a source cell. Name it `mejor`.',
    'If none of that fits your content, use a different type. A cramped compare_table is worse than a clean sort_buckets.',
  ].join('\n'),
};

/** One file per palette type: its exact JSON shape plus the rules only it must obey. */
function renderTypeFile(type: string, rules: readonly string[]): string {
  const schema = TYPE_TO_SCHEMA.get(type);
  return [
    `# type="${type}"`,
    '',
    '## EXACT JSON SHAPE — field names, nesting and enum options are LAW',
    '',
    schema ? JSON.stringify(shapeExample(schema)) : '(no schema found — do not use this type)',
    '',
    ...(rules.length > 0
      ? ['## HARD RULES for this type (binding, in addition to the general rules)', '', ...rules.map((r) => `- ${r}`), '']
      : ['(no type-specific hard rules beyond the general ones)', '']),
    ...(TYPE_ADDENDA[type] ? ['## LEARNED FROM REAL FAILURES ON THIS TYPE', '', TYPE_ADDENDA[type], ''] : []),
  ].join('\n');
}

/**
 * The static half of the prompt: identical for every lesson of a tier, so it
 * is written ONCE and read once per subagent rather than repeated 544 times.
 * Same static-first ordering as write.ts, for the same reason (a stable head
 * is what a prompt cache can reuse).
 */
function renderContract(tier: string, allowedTypes: readonly string[], generalRules: readonly string[]): string {
  const metaShape = JSON.stringify({ meta: shapeExample(lessonMetaSchema), scoring: shapeExample(lessonScoringSchema) });

  return [
    `# LittleFounders — Lesson Authoring Contract (${tier})`,
    '',
    'You are Forge, the authoring stage of a financial-literacy lesson platform for teenagers (LittleFounders).',
    'You expand a lesson blueprint into a complete, gradeable lesson document.',
    'Your job is not just to satisfy the schema — it is to design exercises a learner genuinely WANTS to do, at',
    'Duolingo/Brilliant quality: concrete, relatable, decision-driven, never a dry recall drill.',
    '',
    'You do TWO things in one pass, in this order:',
    '  1. PLAN — choose the segment skeleton (types + a one-sentence brief each), obeying the MIX RULES.',
    '  2. WRITE — expand that skeleton into the full document, obeying the HARD RULES.',
    'Emit ONLY the finished document. The plan is your own working step; do not include it in the output.',
    '',
    '**AFTER PLANNING, READ `types/<type>.md` FOR EVERY TYPE YOU CHOSE — before writing that segment.**',
    'Each holds that type\'s EXACT JSON shape and the hard rules only it must obey. They are not optional reading:',
    'guessing a field name that is written down in there is the single most common way a lesson is rejected.',
    '',
    '## CONTENT PLAYBOOK (the quality bar)',
    '',
    CONTENT_PLAYBOOK,
    '',
    `## AGE-TIER REASONING CEILING — ${tierReasoningGuidance(tier)}`,
    '',
    '## PALETTE (the only segment types allowed at this age tier)',
    '',
    renderPalette(allowedTypes),
    '',
    '## MIX RULES (govern the skeleton you plan in step 1)',
    '',
    MIX_RULES.map((line, i) => `${i + 1}. ${line}`).join('\n'),
    '',
    /*
     * OWNER FEEDBACK, 2026-08-17, after reading the first published adventure:
     * "se podría ser más claro, puntual y preciso en los ejercicios y
     * descripciones, muchas veces es complicado seguir el contexto de la
     * lección". Diagnosed, not guessed: one 5-minute review lesson ran through
     * SEVEN unrelated situations (skatepark → papelería → bike lane → tutoring
     * → laundry app → skatepark → cafeteria). Every segment made the learner
     * re-orient from scratch. These four rules are the fix, and rules 1 and 3
     * are deliberately stated together because they pull in opposite
     * directions and the resolution is the whole point.
     */
    '## AUTHORING DISCIPLINE — followability (read this twice; it is what most lessons get wrong)',
    '',
    ...FOLLOWABILITY_RULES,
    '',
    '## HARD RULES (general — these govern EVERY lesson, whatever types you pick)',
    '',
    generalRules.map((line, i) => `${i + 1}. ${line}`).join('\n'),
    '',
    `## ALLOWED ICONS (the complete whitelist — every icon-valued field must use one of these)\n\n${[...ICON_PALETTE].join(', ')}`,
    '',
    '## EXACT top-level `meta`/`scoring` JSON SHAPE',
    '',
    'ALL fields shown are REQUIRED (title, estimated_minutes and objectives are easy to forget and the document is rejected without them):',
    '',
    metaShape,
    '',
    '## PER-TYPE SHAPES AND RULES — in `types/<type>.md`, one file per palette type',
    '',
    "Read the file for each type you planned, before you write that segment. Field names/nesting/enum options are LAW — never invent, rename, or move a field. `payload`/`answer` sit alongside `id`/`type`/`prompt_md`/`difficulty`/`xp`/`hints`/`narrator` at the segment's top level, never nested inside each other.",
    '',
  ].join('\n');
}

/** The per-lesson half: everything that varies slot to slot. */
function renderSlotBrief(slot: Slot, ctx: PlanContext, subject: string, factsBlock: string, outFile: string): string {
  const competency = renderCompetencyBlockForPrompt(ctx.competency, ctx.review);
  const directives = buildLessonDirectives(ctx);
  const reviewBlock = ctx.review
    ? [
        '',
        `## SOURCE TOPICS (this is a ${ctx.review.kind} review lesson — ground every segment in these, introduce nothing new)`,
        '',
        renderReviewSourcesBlock(ctx.review.sources),
      ].join('\n')
    : '';

  return [
    `# LESSON SLOT — ${slot.slotId}`,
    '',
    `WRITE THE DOCUMENT TO: \`${outFile}\``,
    'Read `_CONTRACT.md` in this same directory FIRST (once per session) — it holds the playbook, the palette, the mix rules, the hard rules, the icon whitelist and the exact JSON shape of every type.',
    'Output is a single JSON file: the complete LessonDocument, nothing else in the file — no markdown fences, no prose.',
    directives,
    '',
    '## LESSON CONTEXT',
    '',
    `Course: ${ctx.courseTitle}`,
    `Adventure arc: ${ctx.adventureNarrativeArc}`,
    `Age tier: ${ctx.tier}`,
    `Topic concept: ${ctx.topic.concept}`,
    `Learning objective: ${ctx.topic.learningObjective}`,
    `Key vocabulary: ${ctx.topic.keyVocabulary.join(', ')}`,
    `Prior knowledge: ${ctx.topic.priorKnowledge}`,
    `Micro-objective: ${ctx.lesson.microObjective}`,
    `Narrative beat: ${ctx.lesson.narrativeBeat}`,
    `Target difficulty: ${ctx.lesson.difficulty}/5`,
    `Suggested families: ${ctx.lesson.suggestedFamilies.join(', ') || '(none specified)'}`,
    `Lesson slug (meta.slug): ${slot.lesson.slug}`,
    `Subject (meta.subject): ${subject}`,
    competency ? `\n## COMPETENCY GRAPH CONTEXT\n\n${competency}` : '',
    reviewBlock,
    '',
    '## FACTS (the ONLY source of numbers, besides pure arithmetic)',
    '',
    factsBlock,
    '',
  ].join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const courseDir = join('curriculum', args.course);
  const load = loadCourseCatalog(courseDir);
  const errors = load.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    for (const e of errors) console.error(`  ERROR  ${e.file}: ${e.message}`);
    throw new Error(`author-briefs: catalog has ${errors.length} error(s) — refusing to emit briefs`);
  }
  const { taxonomy, catalog, facts } = load.course;
  if (!taxonomy || !catalog || !facts) throw new Error('author-briefs: course taxonomy/catalog/facts failed to load');

  const all = enumerateSlots(load.course.adventures);
  const selected = filterSlots(all, args.slots.length > 0 ? args.slots : undefined);
  // §1.14 / mass-generation #9: a pattern that matches nothing is a typo, not
  // a successful run of zero lessons.
  if (selected.length === 0) throw new Error(`author-briefs: --slots matched 0 of ${all.length} slots`);

  const excluded = new Set(
    filterSlots(selected, args.exclude.length > 0 ? args.exclude : undefined).map((s) => s.slotId),
  );
  const slots = args.exclude.length > 0 ? selected.filter((s) => !excluded.has(s.slotId)) : selected;
  if (args.exclude.length > 0) {
    // Silent truncation reads as "covered everything" when it did not.
    if (excluded.size === 0) throw new Error(`author-briefs: --exclude matched 0 of the ${selected.length} selected slots`);
    console.log(`author-briefs: excluded ${excluded.size} already-authored slot(s) from ${selected.length} selected`);
  }
  if (slots.length === 0) throw new Error('author-briefs: --exclude removed every selected slot — nothing to author');

  // 'kid' is the production register for this catalog (COURSE_ENGINE.md §3.3):
  // vocabulary gates on, tier-restricted palette. Never widen it here silently.
  const register = resolveRegister(taxonomy, 'kid');
  const graph = buildCompetencyGraph(load.course);

  rmSync(args.out, { recursive: true, force: true });
  mkdirSync(args.out, { recursive: true });
  mkdirSync(join(args.out, 'out'), { recursive: true });

  // One contract per tier present in the selection — the palette and the
  // reasoning ceiling are both tier-scoped.
  const tiers = [...new Set(slots.map((s) => s.tier))];
  const contractFor = new Map<string, string>();
  mkdirSync(join(args.out, 'types'), { recursive: true });
  for (const tier of tiers) {
    const { allowed } = resolveAllowedTypes(taxonomy, tier, { fullPalette: register.fullPalette });
    const { general, byType } = classifyHardRules(allowed);

    let typeChars = 0;
    for (const type of allowed) {
      const body = renderTypeFile(type, byType.get(type) ?? []);
      writeFileSync(join(args.out, 'types', `${type}.md`), body, 'utf8');
      typeChars += body.length;
    }

    const contract = renderContract(tier, allowed, general);
    const name = tiers.length === 1 ? '_CONTRACT.md' : `_CONTRACT.${tier}.md`;
    writeFileSync(join(args.out, name), contract, 'utf8');
    contractFor.set(tier, name);

    // Surface the economy rather than assuming it (mass-generation #11).
    const perLesson = Math.round(typeChars / allowed.length) * 9;
    console.log(
      `author-briefs: ${tier} contract ${Math.round(contract.length / 1024)}KB shared + ${allowed.length} type files ` +
        `(${Math.round(typeChars / 1024)}KB total, ~${Math.round(perLesson / 1024)}KB read per lesson at 9 types) — ` +
        `an agent now reads ~${Math.round((contract.length + perLesson) / 1024)}KB instead of ${Math.round((contract.length + typeChars) / 1024)}KB`,
    );
  }

  const manifest: Array<{ slotId: string; brief: string; out: string; tier: string; contract: string }> = [];
  slots.forEach((slot, index) => {
    const ctx = buildPlanContext(slot, load.course, catalog, taxonomy, register, graph);
    const factsBlock = renderFactsBlock(facts, slot.topic.fact_refs);
    const stem = `${String(index + 1).padStart(4, '0')}-${slot.lesson.slug}`;
    const outFile = `out/${stem}.es-MX.json`;
    writeFileSync(
      join(args.out, `${stem}.md`),
      renderSlotBrief(slot, ctx, catalog.course.subject, factsBlock, outFile),
      'utf8',
    );
    manifest.push({
      slotId: slot.slotId,
      brief: `${stem}.md`,
      out: outFile,
      tier: slot.tier,
      contract: contractFor.get(slot.tier)!,
    });
  });

  writeFileSync(join(args.out, 'manifest.json'), `${JSON.stringify({ course: args.course, slots: manifest }, null, 2)}\n`, 'utf8');
  console.log(`author-briefs: wrote ${manifest.length} brief(s) + ${tiers.length} contract(s) to ${args.out}`);
}

main();
