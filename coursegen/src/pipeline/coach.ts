// forge:coach — the between-runs half of the improvement loop (Level 2 of the
// self-improvement design, 2026-07-26). It reads what a run left behind — the
// checkpoint, the usage ledger, the rubric log, optionally a track report —
// and produces a DIAGNOSIS with PROPOSED actions, each tied to evidence.
//
// Deliberately: offline, free (zero LLM calls), deterministic, and
// PROPOSE-ONLY. The apply step is a human editing the playbook/prompts/gates
// in a normal commit — the system never grades its own homework into
// kid-facing content (§1.9), and judge scores are treated as defect POINTERS,
// never as an optimization target (their run-over-run noise floor is ±0.4
// with binary flips on identical content — coursegen/AGENTS.md #15; a loop
// that chases score deltas is Goodhart bait).

import type { RunCheckpoint } from './checkpoint.js';
import { RubricLog, type RubricLogEntry } from './rubricLog.js';
import type { TrackReport } from './track.js';

export interface LedgerLine {
  operation?: string;
  provider?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_prompt_tokens?: number;
  images?: number;
  est_usd?: number;
}

export interface CoachInput {
  label: string; // run-id or track-id
  checkpoints: RunCheckpoint[];
  ledger: LedgerLine[];
  rubrics: RubricLogEntry[];
  trackReport?: TrackReport;
}

export interface CoachAction {
  /** Machine-ish tag for grouping (e.g. 'playbook:distractor_quality'). */
  tag: string;
  proposal: string;
  evidence: string;
}

export interface CoachDiagnosis {
  outcomes: { published: number; failed: number; dryRun: number; other: number };
  failureHeatmap: Record<string, number>;
  topErrors: { sample: string; count: number }[];
  judge: {
    judged: number;
    dimensionMeans: Record<string, number>;
    dimensionMins: Record<string, number>;
    cyclesHistogram: Record<string, number>;
    earlyStops: number;
    failedVerdicts: number;
    worstLessons: { slotId: string; dims: string; notes: string }[];
  };
  cost: {
    totalUsd: number;
    totalTokens: number;
    cacheHitPctOverall: number;
    perOperation: Record<string, { calls: number; usd: number; cacheHitPct: number }>;
    usdPerPublishedLesson: number | null;
    imagesBilled: number;
  };
  actions: CoachAction[];
}

/** The 9 judge dimensions (base floors used for coach approximations — real floors are document-aware). */
const DIMENSIONS = [
  'kid_safety',
  'age_fit',
  'concreteness',
  'pedagogy',
  'cognitive_engagement',
  'feedback_quality',
  'distractor_quality',
  'narrative_quality',
  'naturalness',
] as const;

/** Where each dragging dimension points in the CONTENT PLAYBOOK — the apply-side map. */
const DIMENSION_PLAYBOOK_MAP: Record<string, string> = {
  concreteness: 'playbook #1/#5 (concrete micro-situation, concrete-before-abstract)',
  cognitive_engagement: 'playbook #2/#6 (real decision with a stake, one genuine reasoning step)',
  pedagogy: 'playbook #3/#4 (application-not-recall, guided discovery)',
  distractor_quality: 'playbook #7 (misconception-encoding distractors)',
  feedback_quality: 'playbook #8 (elaborated, outcome-neutral feedback)',
  naturalness: 'playbook #9 (voice; check colloquialism dosage reads organic)',
  narrative_quality: 'playbook #9 (voice/stakes) + narrative beats in the blueprints',
  age_fit: 'tierReasoningGuidance (Piaget ceiling for the tier)',
  kid_safety: 'ESCALATE — inspect the flagged lessons immediately (§1.9)',
};

function round(n: number, places = 2): number {
  return Number(n.toFixed(places));
}

/** Groups error strings by a normalized prefix so recurring causes surface (digits and quoted names vary per lesson — normalize them away). */
export function groupErrors(errors: readonly string[]): { sample: string; count: number }[] {
  const groups = new Map<string, { sample: string; count: number }>();
  for (const error of errors) {
    const key = error.toLowerCase().replace(/["'`].*?["'`]/g, '"…"').replace(/\d+/g, '#').slice(0, 70);
    const existing = groups.get(key);
    if (existing) existing.count++;
    else groups.set(key, { sample: error.slice(0, 160), count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

export function diagnose(input: CoachInput): CoachDiagnosis {
  // ---- outcomes + failure heatmap (from the checkpoints' final states) ----
  const outcomes = { published: 0, failed: 0, dryRun: 0, other: 0 };
  const failureHeatmap: Record<string, number> = {};
  const errors: string[] = [];
  const salvagedSlots: string[] = [];
  for (const checkpoint of input.checkpoints) {
    for (const slot of Object.values(checkpoint.slots)) {
      if (slot.state === 'published') outcomes.published++;
      else if (slot.state === 'failed') {
        outcomes.failed++;
        const stage = slot.failedFrom ?? 'unknown';
        failureHeatmap[stage] = (failureHeatmap[stage] ?? 0) + 1;
        if (slot.error) errors.push(slot.error);
      } else if (slot.state === 'dry-run') outcomes.dryRun++;
      else outcomes.other++;
      if ((slot.data as { salvaged?: boolean } | undefined)?.salvaged) salvagedSlots.push(slot.slotId);
    }
  }

  // ---- judge analysis (rubric log — final verdict per slot) ----
  const latest = [...RubricLog.latestBySlot(input.rubrics).values()];
  const dimensionMeans: Record<string, number> = {};
  const dimensionMins: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    const values = latest.map((e) => e.rubric[dim]).filter((v): v is number => typeof v === 'number');
    dimensionMeans[dim] = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    dimensionMins[dim] = values.length ? Math.min(...values) : 0;
  }
  const cyclesHistogram: Record<string, number> = {};
  for (const e of latest) cyclesHistogram[String(e.cycles)] = (cyclesHistogram[String(e.cycles)] ?? 0) + 1;
  const failedVerdicts = latest.filter((e) => e.outcome === 'failed');
  const worstLessons = [...latest]
    .sort((a, b) => {
      const min = (e: RubricLogEntry) => Math.min(...DIMENSIONS.map((d) => e.rubric[d] ?? 5));
      return min(a) - min(b);
    })
    .slice(0, 5)
    .map((e) => ({
      slotId: e.slotId,
      dims: DIMENSIONS.filter((d) => (e.rubric[d] ?? 5) <= 3)
        .map((d) => `${d}=${e.rubric[d]}`)
        .join(', '),
      notes: e.rubric.notes.slice(0, 220),
    }));

  // ---- cost (ledger) ----
  const perOperation: Record<string, { calls: number; usd: number; prompt: number; cached: number }> = {};
  let totalUsd = 0;
  let totalTokens = 0;
  let totalPrompt = 0;
  let totalCached = 0;
  let imagesBilled = 0;
  for (const line of input.ledger) {
    const op = line.operation ?? 'unknown';
    const entry = (perOperation[op] ??= { calls: 0, usd: 0, prompt: 0, cached: 0 });
    entry.calls++;
    entry.usd += line.est_usd ?? 0;
    entry.prompt += line.prompt_tokens ?? 0;
    entry.cached += line.cached_prompt_tokens ?? 0;
    totalUsd += line.est_usd ?? 0;
    totalTokens += (line.prompt_tokens ?? 0) + (line.completion_tokens ?? 0);
    totalPrompt += line.prompt_tokens ?? 0;
    totalCached += line.cached_prompt_tokens ?? 0;
    imagesBilled += line.images ?? 0;
  }
  const cost = {
    totalUsd: round(totalUsd, 4),
    totalTokens,
    cacheHitPctOverall: totalPrompt > 0 ? round((totalCached / totalPrompt) * 100, 1) : 0,
    perOperation: Object.fromEntries(
      Object.entries(perOperation).map(([op, e]) => [
        op,
        { calls: e.calls, usd: round(e.usd, 4), cacheHitPct: e.prompt > 0 ? round((e.cached / e.prompt) * 100, 1) : 0 },
      ]),
    ),
    usdPerPublishedLesson: outcomes.published > 0 ? round(totalUsd / outcomes.published, 4) : null,
    imagesBilled,
  };

  // ---- proposed actions (heuristics; every one carries its evidence) ----
  const actions: CoachAction[] = [];
  const judgedEnough = latest.length >= 10;
  for (const dim of DIMENSIONS) {
    const mean = dimensionMeans[dim] ?? 0;
    if (dim === 'kid_safety') {
      const flagged = latest.filter((e) => (e.rubric.kid_safety ?? 5) < 5);
      if (flagged.length > 0) {
        actions.push({
          tag: 'safety:kid_safety',
          proposal: DIMENSION_PLAYBOOK_MAP.kid_safety!,
          evidence: `${flagged.length} verdict(s) scored kid_safety < 5: ${flagged.map((e) => e.slotId).slice(0, 5).join(', ')}`,
        });
      }
      continue;
    }
    if (judgedEnough && mean > 0 && mean < 3.8) {
      actions.push({
        tag: `playbook:${dim}`,
        proposal: `Dimension "${dim}" is dragging — strengthen ${DIMENSION_PLAYBOOK_MAP[dim] ?? 'the playbook'} and re-measure on the next slice.`,
        evidence: `mean ${mean} over ${latest.length} judged lessons (min ${dimensionMins[dim]}). Noise floor is ±0.4 — act on the worst lessons' notes below, not on the mean alone.`,
      });
    }
  }
  const localizeFailures = failureHeatmap['reviewed'] ?? 0;
  if (localizeFailures > 0) {
    actions.push({
      tag: 'pipeline:localize',
      proposal: 'Failures from the reviewed stage are localize-stage deaths (vocabulary re-gate, empty title, contract break) — inspect the error samples and the per-locale forbidden lists before regenerating.',
      evidence: `${localizeFailures} slot(s) failed from state "reviewed".`,
    });
  }
  const earlyStops = latest.filter((e) => e.earlyStopped).length;
  if (failedVerdicts.length >= 3 && earlyStops / Math.max(1, failedVerdicts.length) > 0.5) {
    actions.push({
      tag: 'pipeline:early-stop-ratio',
      proposal: 'Most judge failures early-stopped (revisions not improving) — the draft quality, not the reviser, is the bottleneck: strengthen the WRITE-side playbook sections the failing notes name.',
      evidence: `${earlyStops}/${failedVerdicts.length} failed verdicts early-stopped.`,
    });
  }
  const writeOp = cost.perOperation['write'];
  if (writeOp && writeOp.calls >= 20 && writeOp.cacheHitPct < 30) {
    actions.push({
      tag: 'cost:prefix-cache',
      proposal: 'Write-stage prefix-cache hits are low — audit prompt assembly for per-lesson content that crept into the static prefix (AGENTS.md "An identical prompt prefix is a 10x discount").',
      evidence: `write cache-hit ${writeOp.cacheHitPct}% over ${writeOp.calls} calls.`,
    });
  }
  if (salvagedSlots.length > 0) {
    actions.push({
      tag: 'content:salvaged',
      proposal: 'Salvaged lessons published SHORTER than their blueprint — review whether the blueprint segment counts are realistic for these types, or re-run the slots.',
      evidence: `${salvagedSlots.length} salvaged: ${salvagedSlots.slice(0, 5).join(', ')}`,
    });
  }
  if (cost.usdPerPublishedLesson !== null && cost.usdPerPublishedLesson > 0.25) {
    actions.push({
      tag: 'cost:per-lesson',
      proposal: 'Cost per published lesson exceeds the budget-per-slot assumption ($0.25) — check the retry/revise histograms above before scaling to a bigger course.',
      evidence: `$${cost.usdPerPublishedLesson}/published lesson (${outcomes.published} published, $${cost.totalUsd} total).`,
    });
  }

  return {
    outcomes,
    failureHeatmap,
    topErrors: groupErrors(errors),
    judge: {
      judged: latest.length,
      dimensionMeans,
      dimensionMins,
      cyclesHistogram,
      earlyStops,
      failedVerdicts: failedVerdicts.length,
      worstLessons,
    },
    cost,
    actions,
  };
}

export function renderMarkdown(label: string, d: CoachDiagnosis, trackReport?: TrackReport): string {
  const lines: string[] = [
    `# forge:coach — ${label}`,
    '',
    '> PROPOSE-ONLY diagnosis. Apply = a human editing playbook/prompts/gates in a',
    '> normal commit. Judge scores carry a ±0.4 run-over-run noise floor',
    '> (coursegen/AGENTS.md #15): treat them as defect POINTERS, never as a target.',
    '',
    '## Outcomes',
    `- published: ${d.outcomes.published} · failed: ${d.outcomes.failed} · dry-run: ${d.outcomes.dryRun} · other: ${d.outcomes.other}`,
    `- failure heatmap by stage: ${Object.entries(d.failureHeatmap).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`,
  ];
  if (trackReport) {
    lines.push(`- track: ${trackReport.shards.length} shard(s), halted: ${trackReport.halted ?? 'no'}, mop-up: ${trackReport.mopUp.length}`);
  }
  if (d.topErrors.length > 0) {
    lines.push('', '## Recurring errors');
    for (const e of d.topErrors) lines.push(`- ×${e.count} — ${e.sample}`);
  }
  lines.push(
    '',
    '## Judge',
    `- judged lessons (final verdicts): ${d.judge.judged} · failed: ${d.judge.failedVerdicts} · early-stops: ${d.judge.earlyStops}`,
    `- revise-cycle histogram: ${Object.entries(d.judge.cyclesHistogram).map(([c, n]) => `${c}cy=${n}`).join(', ') || '(none)'}`,
    `- dimension means (min): ${Object.entries(d.judge.dimensionMeans).map(([k, v]) => `${k} ${v} (${d.judge.dimensionMins[k]})`).join(' · ')}`,
  );
  if (d.judge.worstLessons.length > 0) {
    lines.push('', '### Worst lessons (evidence — read the notes, fix the class)');
    for (const w of d.judge.worstLessons) {
      lines.push(`- **${w.slotId}**${w.dims ? ` [${w.dims}]` : ''}: ${w.notes}`);
    }
  }
  lines.push(
    '',
    '## Cost',
    `- total: $${d.cost.totalUsd} · ${d.cost.totalTokens.toLocaleString()} tokens · cache-hit ${d.cost.cacheHitPctOverall}% · images billed: ${d.cost.imagesBilled}`,
    `- per published lesson: ${d.cost.usdPerPublishedLesson === null ? 'n/a' : `$${d.cost.usdPerPublishedLesson}`}`,
    `- by operation: ${Object.entries(d.cost.perOperation).map(([op, e]) => `${op}(${e.calls} calls, $${e.usd}, cache ${e.cacheHitPct}%)`).join(' · ')}`,
  );
  lines.push('', '## Proposed actions (human-applied)');
  if (d.actions.length === 0) lines.push('- Nothing actionable surfaced — keep the current playbook/gates and re-measure on the next run.');
  for (const a of d.actions) {
    lines.push(`- **[${a.tag}]** ${a.proposal}`, `  - evidence: ${a.evidence}`);
  }
  lines.push('');
  return lines.join('\n');
}
