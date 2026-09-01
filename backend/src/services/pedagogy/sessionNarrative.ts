/*
 * The guardian "what is happening" narrative (/ORACLE.md §12, 2026-09-01) —
 * closing the §19.5 v3-tail item of the same name.
 *
 * Pure and deterministic, on purpose: everything it needs already exists as
 * structured data Core computed for another reason —
 *   - `kc_attempt` (migration 0052): every graded attempt this session, with
 *     the Knowledge Component it evidences and whether it was correct.
 *   - `tutor_sessions.summary` (migration 0051): the cross-session memory
 *     digest, already computed once at close (topic, graded fraction,
 *     outcome) for the NEXT session's own model context.
 * No model call reads or writes anything here. That is a deliberate design
 * choice, not a placeholder for one: the evidence above is rich enough to
 * say something true and specific without inventing prose, and skipping a
 * call avoids new cost, new latency, and a new privacy-review surface for a
 * feature that does not need one (AGENTS.md §1.14 — prefer the boring,
 * verifiable path).
 *
 * No I/O in this file — the route resolves attempts/titles/locale and hands
 * this function already-resolved strings, so it stays unit-testable with
 * plain fixtures, the same shape as `checkAnswer.ts`/`bkt.ts`/`fsrs.ts`.
 */

/** One `kc_attempt` row, already joined to its KC's title in the viewer's own locale. */
export interface KcAttemptForNarrative {
  kcId: string;
  kcTitle: string;
  correct: boolean;
  /** ISO timestamp — used only to order attempts chronologically within the session. */
  createdAt: string;
}

export interface SessionNarrativeInput {
  /** This session's own kc_attempt evidence, any order. */
  attempts: KcAttemptForNarrative[];
  /** `session.summary?.topic ?? null` — the session's own memory digest, for a session the v3 brain never touched. */
  fallbackTopic: string | null;
  /** `session.summary?.gradedCorrect ?? null` — null only when the session has not closed yet. */
  gradedCorrect: number | null;
  /** `session.summary?.gradedTotal ?? null` — null only when the session has not closed yet. */
  gradedTotal: number | null;
}

export interface SessionNarrative {
  /** Localized KC titles, in the order first attempted, capped for a readable sentence. */
  topics: string[];
  /** A topic that was missed at least once this session. Null when nothing was ever missed. */
  struggledTopic: string | null;
  /** Whether the LAST attempt on `struggledTopic` this session was correct. Meaningless when `struggledTopic` is null. */
  struggleResolved: boolean;
  gradedCorrect: number | null;
  gradedTotal: number | null;
}

/** How many topics a single narrative sentence names — /ORACLE.md §12's own cap philosophy (`skillKeys.slice(0, 5)`), tightened here because this is prose a parent reads once, not a machine-readable list. */
const MAX_NARRATIVE_TOPICS = 2;

/**
 * Builds one session's narrative, or `null` when there is genuinely nothing
 * topic-specific or numeric to report (AGENTS.md §1.14: emit nothing rather
 * than a confident, content-free sentence).
 *
 * Tiering, richest first:
 *   1. `attempts` non-empty — real KC-level evidence for THIS session. Names
 *      up to two topics in the order first attempted, and separately (not
 *      necessarily among the two named) the first topic that was ever
 *      missed, with whether the learner's last try at it this session
 *      landed correct — "found X tricky, but worked through it" vs. "is
 *      still finding X tricky", the shape the backlog line asked for.
 *   2. `attempts` empty but `fallbackTopic` set — the v3 brain never
 *      touched this session (dormant, pre-migration, or a segment with no
 *      `kc_id`), but the session still closed with a topic. One topic, no
 *      struggle claim (that granularity does not exist at this tier).
 *   3. Neither, but a graded fraction exists (`gradedTotal > 0`) — a
 *      diagnostic or open session with no topic anchor. The fraction alone.
 *   4. None of the above — nothing to say.
 */
export function buildSessionNarrative(input: SessionNarrativeInput): SessionNarrative | null {
  const chronological = [...input.attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byKc = new Map<string, { title: string; everWrong: boolean; endedCorrect: boolean }>();
  for (const attempt of chronological) {
    const existing = byKc.get(attempt.kcId);
    if (existing) {
      existing.everWrong = existing.everWrong || !attempt.correct;
      existing.endedCorrect = attempt.correct; // last write wins — the list is chronological.
    } else {
      byKc.set(attempt.kcId, {
        title: attempt.kcTitle,
        everWrong: !attempt.correct,
        endedCorrect: attempt.correct,
      });
    }
  }

  const encountered = [...byKc.values()];
  const topics = encountered.slice(0, MAX_NARRATIVE_TOPICS).map((e) => e.title);
  // Chosen independently of the `topics` cap, by design: a genuinely
  // struggled-with topic is worth naming even when it was not one of the
  // first two attempted this session.
  const struggled = encountered.find((e) => e.everWrong);

  if (topics.length > 0) {
    return {
      topics,
      struggledTopic: struggled?.title ?? null,
      struggleResolved: struggled?.endedCorrect ?? false,
      gradedCorrect: input.gradedCorrect,
      gradedTotal: input.gradedTotal,
    };
  }

  if (input.fallbackTopic) {
    return {
      topics: [input.fallbackTopic],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: input.gradedCorrect,
      gradedTotal: input.gradedTotal,
    };
  }

  if (input.gradedTotal !== null && input.gradedTotal > 0) {
    return {
      topics: [],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: input.gradedCorrect,
      gradedTotal: input.gradedTotal,
    };
  }

  return null;
}
