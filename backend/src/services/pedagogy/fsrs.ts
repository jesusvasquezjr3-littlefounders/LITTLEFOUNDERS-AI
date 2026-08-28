/*
 * FSRS-style spaced-review scheduler — stability / difficulty / due date.
 *
 * Deliberately NOT the full 17-weight FSRS-6: those weights are trained
 * against millions of reviews we do not have yet. This is the same three-state
 * model (stability grows multiplicatively on success, collapses on a lapse,
 * difficulty drifts with performance) with hand-set constants, which already
 * beats the fixed thresholds Data Intel writes into review_due_at — and it is
 * swappable for trained weights later without touching any caller, because
 * the whole contract is `reviewCard(card, rating, now) -> card`.
 *
 * One card per (learner, KC), not per item: the Tutor reviews CONCEPTS with
 * fresh items each time (migration 0052, memory_card).
 */

export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface MemoryCard {
  state: CardState;
  /** Days the memory is expected to hold at ~90% recall. */
  stability: number;
  /** 1 (easy) .. 10 (hard) — drifts with observed performance. */
  difficulty: number;
  reps: number;
  lapses: number;
  dueAt: Date;
  lastReviewAt: Date | null;
}

export function newCard(now: Date): MemoryCard {
  return { state: 'new', stability: 0, difficulty: 5, reps: 0, lapses: 0, dueAt: now, lastReviewAt: null };
}

/** Map a graded score to a review rating. Deterministic and shared. */
export function ratingFromScore(score: number, attempts: number): ReviewRating {
  if (score < 70) return 'again';
  if (attempts > 1 || score < 85) return 'hard';
  if (score < 100) return 'good';
  return 'easy';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** First-success stability by rating, in days. */
const INITIAL_STABILITY: Record<ReviewRating, number> = { again: 0.5, hard: 1, good: 3, easy: 7 };

/** Multiplicative stability growth on a successful review, scaled by difficulty. */
function grownStability(card: MemoryCard, rating: ReviewRating): number {
  const ease = { hard: 1.2, good: 2.2, easy: 3.2 }[rating as 'hard' | 'good' | 'easy'];
  // Harder cards grow slower: difficulty 1 → full ease, difficulty 10 → ~40%.
  const difficultyDrag = 1 - ((card.difficulty - 1) / 9) * 0.6;
  return clamp(card.stability * ease * difficultyDrag, 0.5, 365);
}

function driftedDifficulty(difficulty: number, rating: ReviewRating): number {
  const delta = { again: 1.2, hard: 0.4, good: -0.2, easy: -0.6 }[rating];
  return clamp(difficulty + delta, 1, 10);
}

/**
 * Apply one review. Success spaces the card out; a lapse collapses stability
 * to a fraction (memory is damaged, not erased) and re-enters 'relearning'
 * with a next-day due date.
 */
export function reviewCard(card: MemoryCard, rating: ReviewRating, now: Date): MemoryCard {
  const difficulty = driftedDifficulty(card.difficulty, rating);
  const reps = card.reps + 1;

  if (rating === 'again') {
    const stability = card.state === 'new' ? INITIAL_STABILITY.again : clamp(card.stability * 0.3, 0.5, 365);
    return {
      state: card.state === 'new' ? 'learning' : 'relearning',
      stability,
      difficulty,
      reps,
      lapses: card.lapses + (card.state === 'review' ? 1 : 0),
      dueAt: new Date(now.getTime() + stability * DAY_MS),
      lastReviewAt: now,
    };
  }

  const stability =
    card.state === 'new' || card.stability <= 0 ? INITIAL_STABILITY[rating] : grownStability(card, rating);
  return {
    state: 'review',
    stability,
    difficulty,
    reps,
    lapses: card.lapses,
    dueAt: new Date(now.getTime() + stability * DAY_MS),
    lastReviewAt: now,
  };
}
