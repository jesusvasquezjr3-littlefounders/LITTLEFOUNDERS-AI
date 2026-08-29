/*
 * The daily session plan — what the Tutor should teach THIS session.
 *
 * Two motors compete for session time (blueprint §8.4): review debt (memory
 * cards due) and the learning frontier (KCs whose hard prerequisites are met
 * and whose predicted P(correct) sits in the zone of proximal development,
 * target ≈ 0.75). Review first, capped, then frontier — a learner drowning in
 * overdue review still gets something new, and a learner with nothing due
 * gets a full session of frontier work.
 *
 * Pure planning over rows the caller fetched; the one entry point with I/O is
 * `buildSessionPlan`. Runs ONCE at session-context assembly (the decision
 * clock), never inside a voice turn.
 */

import { predictCorrect, MASTERY_PREREQ_THRESHOLD, MASTERY_DISPLAY_THRESHOLD } from './bkt.js';
import {
  getActiveKcs,
  getKcEdges,
  getLearnerMastery,
  getMemoryCards,
  getMisconceptionsForKcs,
  paramsOf,
  type KcRow,
  type Localized,
} from './kcData.js';

export interface PlanMisconception {
  code: string;
  /** OUR catalogued remediation wording in the session locale. */
  hint: string;
}

export interface SessionPlanEntry {
  kcId: string;
  kcKey: string;
  /** Bridge to the content ladder; null falls back to the session's own skillKey. */
  skillKey: string | null;
  reason: 'review_due' | 'frontier';
  pKnown: number;
  targetDifficulty: 1 | 2 | 3 | 4 | 5;
  /** One localized objective sentence — catalog text, may reach the model. */
  objective: string;
  /** Direct prerequisites, weakest first — the PROBE path on unexpected failure. */
  prereqKcIds: string[];
  misconceptions: PlanMisconception[];
}

export interface KcStateEntry {
  kcId: string;
  kcKey: string;
  pKnown: number;
  attempts: number;
}

export interface SessionPlanResult {
  plan: SessionPlanEntry[];
  kcStates: KcStateEntry[];
}

const MAX_REVIEW = 2;
const MAX_FRONTIER = 4;
const ZPD_TARGET = 0.75;

function pickLocale(text: Localized, locale: string): string {
  return text[locale as keyof Localized] ?? text['es-MX'] ?? Object.values(text)[0] ?? '';
}

/** Difficulty band from predicted success: harder for confident, gentler for shaky. */
export function difficultyFor(pCorrect: number): 1 | 2 | 3 | 4 | 5 {
  if (pCorrect >= 0.9) return 4;
  if (pCorrect >= 0.75) return 3;
  if (pCorrect >= 0.55) return 2;
  return 1;
}

interface Graph {
  kcs: KcRow[];
  byId: Map<string, KcRow>;
  prereqsOf: Map<string, string[]>;
  pKnown: Map<string, number>;
  attempts: Map<string, number>;
  params: Map<string, ReturnType<typeof paramsOf>>;
}

function assemble(
  kcs: KcRow[],
  edges: Array<{ prerequisite_kc_id: string; dependent_kc_id: string }>,
  mastery: Array<{ kc_id: string; p_known: number; attempts: number; params_override: unknown }>,
): Graph {
  const byId = new Map(kcs.map((k) => [k.id, k]));
  const prereqsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.prerequisite_kc_id) || !byId.has(e.dependent_kc_id)) continue;
    prereqsOf.set(e.dependent_kc_id, [...(prereqsOf.get(e.dependent_kc_id) ?? []), e.prerequisite_kc_id]);
  }
  const pKnown = new Map<string, number>();
  const attempts = new Map<string, number>();
  const params = new Map<string, ReturnType<typeof paramsOf>>();
  for (const kc of kcs) params.set(kc.id, paramsOf(kc));
  for (const row of mastery) {
    pKnown.set(row.kc_id, row.p_known);
    attempts.set(row.kc_id, row.attempts);
    const kc = byId.get(row.kc_id);
    if (kc) params.set(row.kc_id, paramsOf(kc, row.params_override as never));
  }
  for (const kc of kcs) if (!pKnown.has(kc.id)) pKnown.set(kc.id, kc.p_l0);
  return { kcs, byId, prereqsOf, pKnown, attempts, params };
}

/** Hard prerequisites all at or above the bar. */
function prereqsMet(graph: Graph, kcId: string): boolean {
  return (graph.prereqsOf.get(kcId) ?? []).every(
    (p) => (graph.pKnown.get(p) ?? 0) >= MASTERY_PREREQ_THRESHOLD,
  );
}

/**
 * The frontier ranking (blueprint §8.5): distance to the ZPD target first,
 * then how many KCs this one unlocks. Deterministic, no randomness.
 */
function frontierScore(graph: Graph, kc: KcRow, unlocks: Map<string, number>): number {
  const p = graph.pKnown.get(kc.id) ?? kc.p_l0;
  const pCorrect = predictCorrect(p, graph.params.get(kc.id) ?? paramsOf(kc));
  const zpd = -Math.abs(pCorrect - ZPD_TARGET);
  const unlock = (unlocks.get(kc.id) ?? 0) / Math.max(1, graph.kcs.length);
  return 2 * zpd + 1.5 * unlock;
}

/**
 * Build the plan. Returns null ONLY on an upstream read failure — an empty
 * KC catalog (migration applied, nothing seeded) yields an empty plan, which
 * callers treat as "v3 brain has nothing to say", the graceful v2 fallback.
 */
export async function buildSessionPlan(
  userId: string,
  tier: number,
  locale: string,
): Promise<SessionPlanResult | null> {
  const [kcs, edges, mastery, cards] = await Promise.all([
    getActiveKcs(),
    getKcEdges(),
    getLearnerMastery(userId),
    getMemoryCards(userId),
  ]);
  if (kcs === null || edges === null || mastery === null || cards === null) return null;
  if (kcs.length === 0) return { plan: [], kcStates: [] };

  const eligible = kcs.filter((k) => k.tier_min <= tier);
  const graph = assemble(eligible, edges, mastery);

  // How many dependents each KC unlocks (direct), for the ranking.
  const unlocks = new Map<string, number>();
  for (const [dep, prereqs] of graph.prereqsOf) {
    void dep;
    for (const p of prereqs) unlocks.set(p, (unlocks.get(p) ?? 0) + 1);
  }

  const now = Date.now();
  const dueCardsAll = cards
    .filter((c) => graph.byId.has(c.kc_id) && new Date(c.due_at).getTime() <= now)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const dueCards = dueCardsAll.slice(0, MAX_REVIEW);

  // Every KC that is due for review is excluded from the frontier, not only
  // the ones that fit inside MAX_REVIEW — otherwise a review overflowing the
  // cap silently reappears one line down relabeled 'frontier', taking a slot
  // that should have gone to genuinely new material, and reporting a reason
  // to the learner ("this is new ground") that is not why it was chosen.
  const reviewIds = new Set(dueCardsAll.map((c) => c.kc_id));

  const frontier = graph.kcs
    .filter((kc) => !reviewIds.has(kc.id))
    .filter((kc) => (graph.pKnown.get(kc.id) ?? 0) < MASTERY_DISPLAY_THRESHOLD)
    .filter((kc) => prereqsMet(graph, kc.id))
    .sort((a, b) => frontierScore(graph, b, unlocks) - frontierScore(graph, a, unlocks))
    .slice(0, MAX_FRONTIER);

  const planKcs: Array<{ kc: KcRow; reason: 'review_due' | 'frontier' }> = [
    ...dueCards
      .map((c) => graph.byId.get(c.kc_id))
      .filter((kc): kc is KcRow => kc !== undefined)
      .map((kc) => ({ kc, reason: 'review_due' as const })),
    ...frontier.map((kc) => ({ kc, reason: 'frontier' as const })),
  ];

  const misconceptions = await getMisconceptionsForKcs(planKcs.map((p) => p.kc.id));
  if (misconceptions === null) return null;
  const misByKc = new Map<string, PlanMisconception[]>();
  for (const m of misconceptions) {
    misByKc.set(m.kc_id, [
      ...(misByKc.get(m.kc_id) ?? []),
      { code: m.code, hint: pickLocale(m.remediation_hint, locale) },
    ]);
  }

  const plan: SessionPlanEntry[] = planKcs.map(({ kc, reason }) => {
    const p = graph.pKnown.get(kc.id) ?? kc.p_l0;
    const pCorrect = predictCorrect(p, graph.params.get(kc.id) ?? paramsOf(kc));
    const prereqs = [...(graph.prereqsOf.get(kc.id) ?? [])].sort(
      (a, b) => (graph.pKnown.get(a) ?? 0) - (graph.pKnown.get(b) ?? 0),
    );
    return {
      kcId: kc.id,
      kcKey: kc.key,
      skillKey: kc.skill_key,
      reason,
      pKnown: round4(p),
      targetDifficulty: difficultyFor(pCorrect),
      objective: pickLocale(kc.objective, locale),
      prereqKcIds: prereqs,
      misconceptions: (misByKc.get(kc.id) ?? []).slice(0, 5),
    };
  });

  const kcStates: KcStateEntry[] = graph.kcs
    .filter((kc) => (graph.attempts.get(kc.id) ?? 0) > 0)
    .map((kc) => ({
      kcId: kc.id,
      kcKey: kc.key,
      pKnown: round4(graph.pKnown.get(kc.id) ?? kc.p_l0),
      attempts: graph.attempts.get(kc.id) ?? 0,
    }))
    .slice(0, 40);

  return { plan, kcStates };
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}
