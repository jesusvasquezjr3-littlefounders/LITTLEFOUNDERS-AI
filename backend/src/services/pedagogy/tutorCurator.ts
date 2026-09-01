/*
 * THE SKILL/KC CURATOR — the V4 harness backlog's "skill distiller/curator
 * loop", built on the SAME propose-only shape `coursegen/src/pipeline/coach.ts`
 * already established for Forge: offline, free (zero LLM calls), deterministic,
 * and PROPOSE-ONLY. It reads real (or, for its tests, realistic synthetic)
 * session evidence — which misconceptions actually recur, which KCs actually
 * get attempted — and cross-references it against the two things a human
 * curates by hand: the misconception catalog (`database/seeds/kc_graph.v1.json`,
 * migration 0052) and the pedagogical skill catalogue
 * (`oracle/skills/moves/*.md`, §20.1 of /ORACLE.md).
 *
 * NEVER WRITES ANYTHING. This module produces a `CurationReport` and a
 * markdown rendering of it; nothing here calls a write endpoint, and nothing
 * calls a model. Applying a proposal means a human editing a `.md` skill file
 * or `kc_graph.v1.json` in an ordinary reviewed commit — the same PR-as-
 * approval-gate this codebase already uses for pedagogical skills (§20.1:
 * "today every skill is hand-written and enters through code review — the
 * pull request IS the approval gate... it never writes to the live
 * catalogue"), extended here to the misconception catalog and the graph.
 * This is the ROADMAP.md §15.1 governance rule applied to what the tutor is
 * taught to teach, not only to what it says live: nothing autonomous reaches
 * a child, and nothing autonomous reaches the CURRICULUM either.
 *
 * WHY FOUR SEPARATE CHECKS, NOT ONE SCORE. Each answers a different curation
 * question a human actually has, the same way coach.ts's `actions` are one
 * per DIMENSION rather than one blended number: "which skill file has a typo
 * that makes part of it dead code", "which real, common wrong idea has nobody
 * written a remediation for", "which knowledge component is the tutor
 * currently teaching entirely through expensive live generation", and "which
 * prerequisite edge does the real data not support". Blending these into one
 * score would hide exactly the evidence a curator needs to act.
 */

import type { KcMasteryAggregateRow, MisconceptionEvidenceAggregateRow } from './kcData.js';

export interface CurationKc {
  id: string;
  key: string;
  skillKey: string | null;
}

export interface CurationEdge {
  prerequisiteKcId: string;
  dependentKcId: string;
}

export interface CurationMisconception {
  id: string;
  kcId: string;
  code: string;
}

/**
 * Only what this analysis needs from a parsed `oracle/skills/moves/*.md`
 * file — deliberately decoupled from oracle's own richer `PedagogicalSkill`
 * type (strategies, tiers, mastery band, body, onceOnly): backend cannot
 * import oracle's TS source across the package boundary (§1.2 "11
 * independent npm packages — no workspaces"), and this analysis has no use
 * for those fields anyway.
 */
export interface CurationSkillRef {
  name: string;
  misconceptions: string[];
}

export interface CurationInput {
  kcs: CurationKc[];
  edges: CurationEdge[];
  misconceptions: CurationMisconception[];
  skills: CurationSkillRef[];
  masteryByKc: KcMasteryAggregateRow[];
  misconceptionEvidence: MisconceptionEvidenceAggregateRow[];
}

export interface CurationAction {
  tag: string;
  proposal: string;
  evidence: string;
}

export interface CurationReport {
  summary: {
    kcCount: number;
    skillCount: number;
    misconceptionCodeCount: number;
    coveredCodeCount: number;
  };
  actions: CurationAction[];
}

/** Below this, a misconception is real but too rarely seen yet to justify authoring time over something more common — re-run as volume grows. */
export const COVERAGE_GAP_MIN_LEARNERS = 3;
export const COVERAGE_GAP_MIN_EVIDENCE = 5;

/** Below this, a content gap's traffic is too thin to prioritize authoring over a KC that is actually costing more in live-generation calls. */
export const CONTENT_GAP_MIN_ATTEMPTS = 5;

/** An edge review needs a real sample on BOTH ends — too small a group and "the data does not show the expected ordering" is just noise, not a finding. */
export const EDGE_REVIEW_MIN_LEARNERS = 5;
/** Accuracy noise this small does not clear the bar for "worth a graph review" on its own. */
export const EDGE_REVIEW_EPSILON = 0.05;

function round1(n: number): number {
  return Math.round(n * 1000) / 10; // one decimal place, as a percentage
}

/**
 * CHECK 1 — dead frontmatter references. A skill's `misconceptions:` list
 * names codes that must exist in the misconception catalog for
 * `selectSkill`'s dedicated-remediation path (`oracle/src/tutor/skills.ts`)
 * to ever match them; a code that exists nowhere in the catalog can NEVER be
 * selected for, silently. Verified against this repository's own real data
 * on 2026-09-01: `counterexample-confront.md` names three codes, and two of
 * them (`more-parts-means-more`, `longer-number-is-bigger`) do not appear
 * anywhere in `database/seeds/kc_graph.v1.json` — this is not a hypothetical
 * check, it caught a real, present defect on its first run.
 */
function findDeadSkillReferences(input: CurationInput, catalogCodes: ReadonlySet<string>): CurationAction[] {
  const actions: CurationAction[] = [];
  for (const skill of input.skills) {
    const dead = skill.misconceptions.filter((code) => !catalogCodes.has(code));
    if (dead.length === 0) continue;
    actions.push({
      tag: `dead-reference:${skill.name}`,
      proposal:
        `Skill "${skill.name}" lists misconception code(s) that do not exist in the catalog — ` +
        `selectSkill's dedicated-remediation path can never match them, so this part of the skill is unreachable. ` +
        `Fix the code(s) to a real catalog value or remove them from the frontmatter.`,
      evidence: `unreachable code(s): ${dead.join(', ')} (not among ${catalogCodes.size} cataloged code(s)).`,
    });
  }
  return actions.sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * CHECK 2 — coverage gaps. A misconception CODE (not a per-KC row — the same
 * code can be cataloged under several KCs, and `selectSkill` matches by code
 * string) with real evidence and no skill anywhere covering it is a human
 * authoring task, ranked by how often real learners actually show it.
 */
function findCoverageGaps(input: CurationInput): CurationAction[] {
  const coveredCodes = new Set(input.skills.flatMap((s) => s.misconceptions));
  const evidenceById = new Map(input.misconceptionEvidence.map((e) => [e.misconceptionId, e]));

  const byCode = new Map<string, { kcKeys: Set<string>; learnerCount: number; totalEvidence: number }>();
  const kcKeyById = new Map(input.kcs.map((k) => [k.id, k.key]));
  for (const m of input.misconceptions) {
    const agg = byCode.get(m.code) ?? { kcKeys: new Set<string>(), learnerCount: 0, totalEvidence: 0 };
    agg.kcKeys.add(kcKeyById.get(m.kcId) ?? m.kcId);
    const evidence = evidenceById.get(m.id);
    if (evidence) {
      agg.learnerCount += evidence.learnerCount;
      agg.totalEvidence += evidence.totalEvidenceCount;
    }
    byCode.set(m.code, agg);
  }

  const actions: { action: CurationAction; rank: number }[] = [];
  for (const [code, agg] of byCode) {
    if (coveredCodes.has(code)) continue;
    if (agg.learnerCount < COVERAGE_GAP_MIN_LEARNERS && agg.totalEvidence < COVERAGE_GAP_MIN_EVIDENCE) continue;
    actions.push({
      rank: agg.totalEvidence,
      action: {
        tag: `coverage-gap:${code}`,
        proposal:
          `Misconception "${code}" has no dedicated pedagogical skill (oracle/skills/moves/*.md) — ` +
          `a human author should write a REMEDIATE maneuver targeting it.`,
        evidence: `${agg.learnerCount} learner(s), ${agg.totalEvidence} total occurrence(s), across KC(s): ${[...agg.kcKeys].sort().join(', ')}.`,
      },
    });
  }
  return actions.sort((a, b) => b.rank - a.rank).map((a) => a.action);
}

/**
 * CHECK 3 — content gaps. A KC with no `skill_key` falls through to tier-3
 * live generation on EVERY request (§7.3's own cost class, and exactly the
 * gap `contentBridgeAudit.ts` names but does not rank). Ranking by real
 * attempt volume tells a human which unmapped KC to author for FIRST.
 */
function findContentGaps(input: CurationInput): CurationAction[] {
  const masteryByKc = new Map(input.masteryByKc.map((m) => [m.kcId, m]));
  const actions: { action: CurationAction; rank: number }[] = [];
  for (const kc of input.kcs) {
    if (kc.skillKey !== null) continue;
    const agg = masteryByKc.get(kc.id);
    if (!agg || agg.totalAttempts < CONTENT_GAP_MIN_ATTEMPTS) continue;
    actions.push({
      rank: agg.totalAttempts,
      action: {
        tag: `content-gap:${kc.key}`,
        proposal:
          `KC "${kc.key}" has no mapped skill_key but is receiving real attempts — every one of these currently ` +
          `falls through to live generation (tier 3, the most expensive and most fragile rung of the ladder). ` +
          `Prioritize authoring or mapping a published topic for it.`,
        evidence: `${agg.totalAttempts} attempt(s) across ${agg.learnerCount} learner(s), avg mastery ${round1(agg.avgPKnown)}%.`,
      },
    });
  }
  return actions.sort((a, b) => b.rank - a.rank).map((a) => a.action);
}

/**
 * CHECK 4 — graph edges the real data does not support. A prerequisite
 * should ordinarily show HIGHER accuracy than what depends on it (it is
 * mastered first, reviewed more, and is by definition the easier half of the
 * pair); when real attempts on both ends show the dependent doing AT LEAST
 * AS WELL as its prerequisite, that is worth a human's look at the graph —
 * never an automatic edit (§15.1). Gated on a minimum sample on BOTH ends so
 * this stays silent rather than noisy while real usage is still thin, which,
 * as of this tool's first run against this repository, it is everywhere.
 */
function findQuestionableEdges(input: CurationInput): CurationAction[] {
  const masteryByKc = new Map(input.masteryByKc.map((m) => [m.kcId, m]));
  const kcKeyById = new Map(input.kcs.map((k) => [k.id, k.key]));
  const actions: { action: CurationAction; rank: number }[] = [];

  for (const edge of input.edges) {
    const pre = masteryByKc.get(edge.prerequisiteKcId);
    const dep = masteryByKc.get(edge.dependentKcId);
    if (!pre || !dep) continue;
    if (pre.learnerCount < EDGE_REVIEW_MIN_LEARNERS || dep.learnerCount < EDGE_REVIEW_MIN_LEARNERS) continue;
    if (pre.totalAttempts === 0 || dep.totalAttempts === 0) continue;

    const preAccuracy = pre.totalCorrect / pre.totalAttempts;
    const depAccuracy = dep.totalCorrect / dep.totalAttempts;
    if (depAccuracy < preAccuracy - EDGE_REVIEW_EPSILON) continue; // the expected ordering DID hold

    const preKey = kcKeyById.get(edge.prerequisiteKcId) ?? edge.prerequisiteKcId;
    const depKey = kcKeyById.get(edge.dependentKcId) ?? edge.dependentKcId;
    actions.push({
      rank: depAccuracy - preAccuracy,
      action: {
        tag: `edge-review:${preKey}->${depKey}`,
        proposal:
          `The prerequisite edge "${preKey}" -> "${depKey}" is not showing the expected difficulty ordering in ` +
          `real attempts — worth a human graph review, not an automatic change.`,
        evidence:
          `prerequisite accuracy ${round1(preAccuracy)}% (n=${pre.learnerCount} learners, ${pre.totalAttempts} attempts) vs ` +
          `dependent accuracy ${round1(depAccuracy)}% (n=${dep.learnerCount} learners, ${dep.totalAttempts} attempts).`,
      },
    });
  }
  return actions.sort((a, b) => b.rank - a.rank).map((a) => a.action);
}

export function diagnoseCuration(input: CurationInput): CurationReport {
  const catalogCodes = new Set(input.misconceptions.map((m) => m.code));
  const coveredCodes = new Set(input.skills.flatMap((s) => s.misconceptions));

  const actions = [
    ...findDeadSkillReferences(input, catalogCodes),
    ...findCoverageGaps(input),
    ...findContentGaps(input),
    ...findQuestionableEdges(input),
  ];

  return {
    summary: {
      kcCount: input.kcs.length,
      skillCount: input.skills.length,
      misconceptionCodeCount: catalogCodes.size,
      coveredCodeCount: [...catalogCodes].filter((c) => coveredCodes.has(c)).length,
    },
    actions,
  };
}

export function renderCurationMarkdown(label: string, report: CurationReport): string {
  const lines: string[] = [
    `# Tutor skill/KC curation — ${label}`,
    '',
    '> PROPOSE-ONLY. Nothing here writes to the KC graph, the misconception',
    '> catalog, or the skill files — every action below is for a human to',
    '> review and apply as an ordinary reviewed change (ROADMAP.md §15.1:',
    '> nothing autonomous reaches a child, applied here to what the tutor is',
    '> taught to teach, not only to what it says live).',
    '',
    '## Summary',
    `- ${report.summary.kcCount} active KC(s), ${report.summary.skillCount} pedagogical skill(s).`,
    `- ${report.summary.misconceptionCodeCount} distinct misconception code(s) in the catalog, ` +
      `${report.summary.coveredCodeCount} covered by at least one skill.`,
    '',
    '## Proposed actions (human-applied)',
  ];
  if (report.actions.length === 0) {
    lines.push('- Nothing actionable surfaced from the data available — re-run as real session volume grows.');
  }
  for (const a of report.actions) {
    lines.push(`- **[${a.tag}]** ${a.proposal}`, `  - evidence: ${a.evidence}`);
  }
  lines.push('');
  return lines.join('\n');
}

/*
 * A DELIBERATELY MINIMAL FRONTMATTER READER for `oracle/skills/moves/*.md` —
 * independent of oracle's own `oracle/src/tutor/skills.ts` loader (which
 * cannot be imported across the package boundary), and deliberately NARROWER
 * than it: this tool only ever cross-references misconception coverage, so
 * it reads exactly `name:` and `misconceptions:` and validates nothing else
 * (strategies, tiers, mastery band, body length, once_per_session are all
 * oracle's own concern, checked by oracle's own loader at oracle's own boot).
 * Mirrors the "forty lines we fully understand beat four thousand we do not"
 * reasoning oracle/src/tutor/skills.ts's own comment gives for the same
 * choice, scoped down further because this reader is read-only introspection
 * for an operator report, never a value that reaches a child.
 */
export function parseSkillMisconceptionRef(raw: string, file: string): CurationSkillRef {
  const nameMatch = raw.match(/^name:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim();
  if (!name) throw new Error(`${file}: could not find a "name:" frontmatter line`);

  const miscMatch = raw.match(/^misconceptions:\s*\[(.*)\]\s*$/m);
  const misconceptions = miscMatch?.[1]
    ? miscMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
    : [];

  return { name, misconceptions };
}
