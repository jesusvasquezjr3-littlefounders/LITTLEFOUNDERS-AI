/*
 * WHAT THE MENTOR DECIDED, AND ON WHAT EVIDENCE (GAP-FIX-R2).
 *
 * Product Block C's Real-Time Interaction Standard: the Extended Mastery
 * Engine's "outputs remain interpretable and auditable to a parent, per
 * Appendix D §2.6", and §2.6 itself: "for the parent-facing explanation layer,
 * expose the evidence, not just the conclusion". C.10 already records that
 * evidence (the controller's consequential decisions in
 * `tutor_trajectory_step`, the answer ledger in `kc_attempt`, the review
 * schedule in `memory_card`); this is the one projection of it that a
 * verified guardian (GET /tutor/kids/:kidUserId/mastery) and the learner
 * themself (GET /tutor/mastery) read.
 *
 * NUMBERS AND CLOSED LABELS ONLY. No transcript text, no model output, no
 * free text of any kind: the only strings are the knowledge component's
 * authored title and key. The page phrases them as templated sentences.
 *
 * The displayed state follows the learning map's own rule (`deriveNodeState`
 * in tutorMap.ts), so the map and this view never disagree:
 *   not_yet               still being learned
 *   provisional_mastered  the posterior, enough evidence AND the latest answers
 *                         corroborating it (provisional: a later miss demotes it)
 *   recheck_due           the spaced review for it is due now
 */

import { serviceRest } from '../supabaseRest.js';
import { deriveNodeState } from './tutorMap.js';
import { getActiveKcs, getCorrectStreaks, getKcTitlesByIds, getLearnerMastery, getMemoryCards, type Localized } from './kcData.js';

const eu = (v: string): string => encodeURIComponent(v);

export type MasteryDisplayState = 'not_yet' | 'provisional_mastered' | 'recheck_due';
export type MasteryDecisionKind = 'mastered' | 'remediation' | 'rescue' | 'mastery_withdrawn';
export type DiscountedEvidence = 'none' | 'too_fast' | 'hint_assisted' | 'too_fast_and_hint_assisted';

export interface MasteryDecision {
  kind: MasteryDecisionKind;
  /** Consecutive qualifying observations the decision rested on (null for a withdrawal with no new evidence). */
  observations: number | null;
  /** The requirement in force (2 by default, C.10). */
  required: number | null;
  /** Correct answers the chain set aside on the way; null when not recorded (an older step). */
  discounted: DiscountedEvidence | null;
  decidedAt: string;
}

export interface MasteryEvidenceItem {
  kcKey: string;
  title: string;
  state: MasteryDisplayState;
  /** Correct answers in a row at the end of the answer ledger (the corroboration the map uses). */
  correctInARow: number;
  attempts: number;
  /** The latest consequential decision the controller logged for this skill, or null. */
  decision: MasteryDecision | null;
  /** When the spaced review looks at it again; null when no review is scheduled. */
  nextCheckAt: string | null;
}

export interface MasteryEvidenceResponse {
  items: MasteryEvidenceItem[];
}

interface DecisionRow {
  kc_id: string | null;
  evidence_rule: 'mastery' | 'remediation' | 'rescue' | null;
  evidence_observations: number | null;
  evidence_required: number | null;
  evidence_discounted: DiscountedEvidence | null;
  mastery_revoked: boolean;
  created_at: string;
}

const pickLocale = (text: Localized, locale: string): string =>
  text[locale as keyof Localized] ?? text['es-MX'] ?? Object.values(text)[0] ?? '';

/** Pure: a logged step to the decision a parent reads. Null for a step with nothing consequential. */
export function decisionOf(row: DecisionRow): MasteryDecision | null {
  if (row.evidence_rule === null && !row.mastery_revoked) return null;
  const kind: MasteryDecisionKind = row.evidence_rule === 'mastery'
    ? 'mastered'
    : row.evidence_rule === 'remediation'
      ? 'remediation'
      : row.evidence_rule === 'rescue'
        ? 'rescue'
        : 'mastery_withdrawn';
  return {
    kind,
    observations: row.evidence_observations,
    required: row.evidence_required,
    discounted: row.evidence_discounted ?? null,
    decidedAt: row.created_at,
  };
}

/** Pure: the map's node state folded to the three labels a parent reads. */
export function displayStateOf(input: {
  pKnown: number;
  attempts: number;
  reviewDue: boolean;
  consecutiveCorrect: number;
}): MasteryDisplayState {
  const node = deriveNodeState({ ...input, prereqsMet: true });
  return node === 'needs_review' ? 'recheck_due' : node === 'mastered' ? 'provisional_mastered' : 'not_yet';
}

/**
 * Null ONLY on an upstream read failure (§1.14: "could not look" is never
 * "nothing to show"). A learner with no evidence yet gets an empty list.
 */
export async function buildMasteryEvidence(userId: string, locale: string, now = new Date()): Promise<MasteryEvidenceResponse | null> {
  const [kcs, mastery, cards, streaks, steps] = await Promise.all([
    getActiveKcs(),
    getLearnerMastery(userId),
    getMemoryCards(userId),
    getCorrectStreaks(userId),
    serviceRest<DecisionRow[]>(
      `/tutor_trajectory_step?user_id=eq.${eu(userId)}&or=(evidence_rule.not.is.null,mastery_revoked.is.true)` +
        '&select=kc_id,evidence_rule,evidence_observations,evidence_required,evidence_discounted,mastery_revoked,created_at' +
        '&order=created_at.desc&limit=500',
    ),
  ]);
  if (kcs === null || mastery === null || cards === null || streaks === null || steps === null) return null;

  // Newest first: the first row seen per KC is its latest consequential decision.
  const latest = new Map<string, MasteryDecision>();
  for (const row of steps) {
    if (row.kc_id === null || latest.has(row.kc_id)) continue;
    const decision = decisionOf(row);
    if (decision) latest.set(row.kc_id, decision);
  }

  const masteryByKc = new Map(mastery.map((m) => [m.kc_id, m]));
  const cardByKc = new Map(cards.filter((c) => c.reps > 0).map((c) => [c.kc_id, c]));
  const kcById = new Map(kcs.map((k) => [k.id, k]));
  const ids = [...new Set([...mastery.filter((m) => m.attempts > 0).map((m) => m.kc_id), ...latest.keys()])];

  // A retired skill still has a real history; its title comes from the unfiltered read.
  const missing = ids.filter((id) => !kcById.has(id));
  const retiredTitles = missing.length > 0 ? await getKcTitlesByIds(missing) : [];
  if (retiredTitles === null) return null;
  const retired = new Map(retiredTitles.map((row) => [row.id, row.title]));

  const items: MasteryEvidenceItem[] = [];
  for (const id of ids) {
    const kc = kcById.get(id);
    const title = kc ? pickLocale(kc.title, locale) : pickLocale(retired.get(id) ?? {}, locale);
    if (!title) continue;
    const row = masteryByKc.get(id);
    const card = cardByKc.get(id);
    const attempts = row?.attempts ?? 0;
    const correctInARow = streaks.get(id) ?? 0;
    items.push({
      kcKey: kc?.key ?? id,
      title,
      state: displayStateOf({
        pKnown: row?.p_known ?? 0,
        attempts,
        reviewDue: card ? new Date(card.due_at).getTime() <= now.getTime() : false,
        consecutiveCorrect: correctInARow,
      }),
      correctInARow,
      attempts,
      decision: latest.get(id) ?? null,
      nextCheckAt: card ? card.due_at : null,
    });
  }

  // Most recent decisions first, then the skills still without one, by title.
  items.sort((a, b) => (b.decision?.decidedAt ?? '').localeCompare(a.decision?.decidedAt ?? '') || a.title.localeCompare(b.title));
  return { items };
}
