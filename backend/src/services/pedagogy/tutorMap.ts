/*
 * The learning map (Tutor v3) — the KC graph as the learner sees it.
 *
 * This is deliberately the SAME graph the session planner traverses
 * (sessionPlan.ts), not a parallel one built from course topics: the map's
 * whole promise is "this is where you are and why", and a map drawn over a
 * different structure than the brain plans against would be a beautiful lie.
 * Node states are derived server-side, deterministically, and unit-tested.
 */

import { MASTERY_CORROBORATION_MIN, MASTERY_DISPLAY_THRESHOLD, MASTERY_PREREQ_THRESHOLD } from './bkt.js';
import { rankPlanKcs } from './sessionPlan.js';
import {
  getActiveKcs,
  getCorrectStreaks,
  getKcEdges,
  getLearnerMastery,
  getMemoryCards,
  type KcStrand,
  type Localized,
} from './kcData.js';

export type MapNodeState = 'locked' | 'available' | 'in_progress' | 'mastered' | 'needs_review';

export interface TutorMapNode {
  kcId: string;
  kcKey: string;
  strand: KcStrand;
  title: string;
  state: MapNodeState;
  /** Rounded posterior for display, null before any evidence. */
  mastery: number | null;
  attempts: number;
  /**
   * C.10: the consecutive correct answers the learner's latest attempts on
   * this KC end in — the EVIDENCE behind "mastered", exposed so a parent-
   * facing explanation can say "2 correct in a row" rather than "the AI
   * decided" (Appendix D §2.6).
   */
  consecutiveCorrect: number;
  skillKey: string | null;
}

export interface TutorMapResponse {
  nodes: TutorMapNode[];
  edges: Array<{ from: string; to: string }>;
  /** What CONTINUE opens — the planner's own first pick. Null on an empty graph. */
  continueTarget: { kcKey: string; title: string; reason: 'review_due' | 'frontier'; skillKey: string | null } | null;
  review: { count: number };
}

const pickLocale = (text: Localized, locale: string): string =>
  text[locale as keyof Localized] ?? text['es-MX'] ?? Object.values(text)[0] ?? '';

export function deriveNodeState(input: {
  pKnown: number;
  attempts: number;
  reviewDue: boolean;
  prereqsMet: boolean;
  /** C.10: trailing consecutive correct answers on this KC. */
  consecutiveCorrect: number;
}): MapNodeState {
  if (input.reviewDue) return 'needs_review';
  /*
   * C.10: "mastered" needs the posterior, enough evidence overall AND the
   * latest evidence corroborating it — a KC whose last answer was wrong, or
   * that crossed the bar on one lucky answer, is still in progress. Derived
   * on every read, so it is provisional by construction: a later miss
   * demotes it at once (the Appendix D §2.3 demotion rule).
   */
  if (
    input.pKnown >= MASTERY_DISPLAY_THRESHOLD &&
    input.attempts >= 3 &&
    input.consecutiveCorrect >= MASTERY_CORROBORATION_MIN
  ) {
    return 'mastered';
  }
  if (!input.prereqsMet) return 'locked';
  if (input.attempts > 0) return 'in_progress';
  return 'available';
}

/**
 * Null ONLY on an upstream read failure; an empty catalog yields an empty
 * map, which the client renders as "the map is still being drawn".
 */
export async function buildTutorMap(
  userId: string,
  tier: number,
  locale: string,
  now = new Date(),
): Promise<TutorMapResponse | null> {
  const [kcs, edges, mastery, cards, streaks] = await Promise.all([
    getActiveKcs(),
    getKcEdges(),
    getLearnerMastery(userId),
    getMemoryCards(userId),
    getCorrectStreaks(userId),
  ]);
  if (kcs === null || edges === null || mastery === null || cards === null || streaks === null) return null;

  const eligible = kcs.filter((k) => k.tier_min <= tier);
  const eligibleIds = new Set(eligible.map((k) => k.id));
  const keyById = new Map(eligible.map((k) => [k.id, k.key]));

  const masteryByKc = new Map(mastery.map((m) => [m.kc_id, m]));
  const dueByKc = new Set(
    cards.filter((c) => new Date(c.due_at).getTime() <= now.getTime() && c.reps > 0).map((c) => c.kc_id),
  );

  const prereqsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!eligibleIds.has(e.prerequisite_kc_id) || !eligibleIds.has(e.dependent_kc_id)) continue;
    prereqsOf.set(e.dependent_kc_id, [...(prereqsOf.get(e.dependent_kc_id) ?? []), e.prerequisite_kc_id]);
  }

  const pOf = (kcId: string): number => {
    const row = masteryByKc.get(kcId);
    if (row) return row.p_known;
    return eligible.find((k) => k.id === kcId)?.p_l0 ?? 0;
  };

  const nodes: TutorMapNode[] = eligible.map((kc) => {
    const row = masteryByKc.get(kc.id);
    const attempts = row?.attempts ?? 0;
    const prereqsMet = (prereqsOf.get(kc.id) ?? []).every((p) => pOf(p) >= MASTERY_PREREQ_THRESHOLD);
    return {
      kcId: kc.id,
      kcKey: kc.key,
      strand: kc.strand,
      title: pickLocale(kc.title, locale),
      state: deriveNodeState({
        pKnown: row?.p_known ?? 0,
        attempts,
        reviewDue: dueByKc.has(kc.id),
        prereqsMet,
        consecutiveCorrect: streaks.get(kc.id) ?? 0,
      }),
      mastery: attempts > 0 ? Math.round((row?.p_known ?? 0) * 100) / 100 : null,
      attempts,
      consecutiveCorrect: streaks.get(kc.id) ?? 0,
      skillKey: kc.skill_key,
    };
  });

  const mapEdges = edges
    .filter((e) => eligibleIds.has(e.prerequisite_kc_id) && eligibleIds.has(e.dependent_kc_id))
    .map((e) => ({ from: keyById.get(e.prerequisite_kc_id)!, to: keyById.get(e.dependent_kc_id)! }));

  /*
   * CONTINUE opens exactly what the planner would teach first — the map and
   * the session can never disagree about "where were we". This calls the
   * planner's PURE ranking directly, over the rows already fetched above,
   * rather than `buildSessionPlan` (found by adversarial review, round 37,
   * 2026-08-30, MEDIUM — see `rankPlanKcs`'s own doc comment for the full
   * defect: a redundant second fetch of these same four tables, and a
   * silent collapse of "nothing to continue" with "that redundant fetch
   * itself failed"). Cannot fail here — the four reads it needs already
   * succeeded, or this function would have returned null above.
   */
  const first = rankPlanKcs(kcs, edges, mastery, cards, tier, streaks)[0] ?? null;
  const firstNode = first ? nodes.find((n) => n.kcId === first.kc.id) : null;

  return {
    nodes,
    edges: mapEdges,
    continueTarget: first
      ? {
          kcKey: first.kc.key,
          title: firstNode?.title ?? pickLocale(first.kc.objective, locale),
          reason: first.reason,
          skillKey: first.kc.skill_key,
        }
      : null,
    review: { count: nodes.filter((n) => n.state === 'needs_review').length },
  };
}
