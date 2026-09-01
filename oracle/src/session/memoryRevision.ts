/*
 * THE MEMORY-WRITE REVISION GUARD — a "dialectic" check on the Preceptor's
 * own synthesis, sibling to the compare-and-swap discipline in migrations
 * 0059/0061 (V4 harness backlog: "Honcho-style dialectic memory").
 *
 * WHAT "DIALECTIC" MEANS HERE, AND WHY THIS IS THE SCOPED PIECE OF IT.
 * Plastic Labs' Honcho names its user-memory endpoint "dialectic" because it
 * answers a question about a person by reasoning ACROSS potentially
 * conflicting evidence at query time, rather than trusting one flat,
 * pre-baked summary. This codebase's `learnerBrief` is architecturally the
 * opposite of that by design (§20.4 of /ORACLE.md): a small, curated,
 * SESSION-START-FROZEN prose note, precisely so the model's prompt prefix
 * stays cacheable and the live voice turn never waits on an extra reasoning
 * pass. Reimplementing Honcho's actual query-time agentic loop inside the
 * fast chamber would break that cache and add a live model call to the one
 * turn where latency IS the product (§19.1's "three clocks rule") — exactly
 * the "large, speculative architecture" this backlog item is not asking for.
 *
 * What genuinely IS missing, and fits this codebase's own grain: `review.ts`
 * ALREADY asks the model for a dialectical synthesis in prose ("carry forward
 * what still holds... drop what it contradicted"), but nothing CHECKS that
 * synthesis before it is trusted forever — the exact "a rule the model is
 * only TOLD does not hold; a rule it is CHECKED on does" lesson oracle/
 * AGENTS.md keeps re-learning for other surfaces. This module is that check:
 * a free, deterministic, unit-testable comparison of the OLD note against the
 * PROPOSED replacement, run in `review.ts` immediately before the same
 * `updateLearnerMemory` call the 0059/0061 compare-and-swap protects — same
 * moment, same "verify before you let a write stand" instinct, different
 * axis (semantic revision, not concurrent-writer detection).
 *
 * DELIBERATELY ADVISORY, NOT A GATE. Blocking on this heuristic would risk
 * exactly the failure mode §1.14 warns about elsewhere in this codebase: a
 * bag-of-words overlap score cannot reliably tell "the model hallucinated a
 * reversal" apart from "the child genuinely changed, and this session found
 * out" — a shy learner who warms up, or a first substantial session after a
 * near-empty one, SHOULD replace most of a thin prior note. A false block
 * here would silently starve the one thing this whole memory system exists
 * to do (accumulate genuine learning), which is a worse failure than a
 * missed flag. So this never withholds a write; it only makes a drastic
 * revision LOUD (§1.0) for a human auditing the ledger or server logs,
 * exactly the way every other soft-signal in review.ts already is
 * (`console.warn`, never a thrown error). See `runPostSessionReview`'s own
 * doc comment for where the natural, costed escalation to a real judge call
 * would go if this ever needs to become a harder guarantee — deliberately
 * NOT built here (see this repo's own report for why: it would require a
 * second billed model call per flagged session, threaded through the same
 * cost-accounting `reportReviewCost` already had to be fixed once for
 * exactly this call, and a moderation-taxonomy change to a heavily-hardened
 * child-safety module for a concern that is not about child safety).
 *
 * PRIVACY: this module never sends anything to a model or over the network.
 * It runs entirely in-process on content that has ALREADY passed this same
 * file's moderation and §1.9 identifier checks, and its own log line never
 * prints the note text itself — only counts and ratios (§1.9's "no free-text
 * history" instinct applied to our OWN server logs, which carry weaker access
 * control than the RLS-guarded `learner_memory` table itself).
 */

/** One PROSE line from the OLD note that no line in the NEW note resembles closely enough to count as "kept". */
export type DroppedClaim = string;

export interface MemoryRevisionReport {
  /** Old observations (one per newline, per the Preceptor's own prompt) with no close counterpart in the new note. */
  droppedClaims: DroppedClaim[];
  /** How many observations the old note had. 0 when there was no prior note (a first-ever write). */
  priorObservationCount: number;
  /** Fraction of prior observations that survived, 0..1. Always 1 when there was nothing prior to lose. */
  survivalRatio: number;
  /**
   * True only when the note had ENOUGH prior substance to judge (see
   * `MIN_PRIOR_OBSERVATIONS_TO_JUDGE`) AND most of it did not survive. A
   * first-ever note, or a one-line note being elaborated into several, is
   * never "drastic" by construction — replacing thin or absent prior belief
   * is exactly what this memory system is supposed to do every session.
   */
  isDrasticRevision: boolean;
}

/**
 * A note this short (1 observation) legitimately flips in full on ordinary
 * sessions — e.g. the very first real note the Preceptor ever writes for a
 * learner. Below this floor, "drastic" would just mean "the note existed",
 * which is not a finding.
 */
export const MIN_PRIOR_OBSERVATIONS_TO_JUDGE = 2;

/** Fewer than a third of the prior note's observations recognizable in the replacement is the bar for "worth a human's attention", not "wrong" — see the module header for why this stays a log, never a refusal. */
export const DRASTIC_SURVIVAL_THRESHOLD = 1 / 3;

/**
 * An old observation counts as "kept" when some new line shares at least this
 * much of ITS OWN vocabulary (see `similarity`'s containment, not Jaccard,
 * choice below). Deliberately loose: this only ever needs to rule OUT a
 * wholesale, unexplained disappearance, not to track a precise paraphrase.
 */
const KEPT_SIMILARITY_FLOOR = 0.5;

/** Drop accents so the same es-MX word in two different observations tokenizes identically (the Preceptor writes primarily in Spanish; see 0053/0056's own locale-aware-FTS history for the same normalization need one layer over). */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '');
}

/**
 * Splits one observation into a comparable bag of words. Deliberately naive —
 * no stemming, no per-locale stopword list, just lowercasing, accent
 * stripping, and a length floor to drop the shortest connector words. This is
 * an advisory heuristic (see module header), not a claim of linguistic rigor;
 * MIN_WORD_LEN of 4 clears the bulk of es-MX/en-US/pt-BR function words short
 * enough to appear in almost any sentence regardless of topic ("que", "con",
 * "las", "los", "una", "the", "and", "com", "seu") without requiring a real
 * per-locale stopword list this heuristic does not warrant.
 */
const MIN_WORD_LEN = 4;

function tokenize(line: string): Set<string> {
  const words = stripAccents(line.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN);
  return new Set(words);
}

/**
 * CONTAINMENT, not Jaccard: shared words over the SMALLER bag's size (the
 * overlap coefficient), not the larger one. The question this answers is
 * directional — does old's idea appear somewhere in new — and new is usually
 * a longer sentence covering more ground than the old one-liner it replaces,
 * which a same-denominator (Jaccard/max) measure would unfairly punish for
 * length rather than for actually dropping the idea. 1 for two identical
 * non-empty bags; 0 when either is empty and they are not both.
 */
function similarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function observations(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Compares a stored memory note against the Preceptor's proposed FULL
 * REPLACEMENT for it (both stores work this way — see 0053's own "Each value
 * REPLACES the whole stored note" in `review.ts`'s system prompt). Pure,
 * synchronous, and free: no model call, no I/O.
 *
 * `oldContent` is `null` for a first-ever write to this store — trivially
 * never drastic, since there is nothing yet to lose.
 */
export function evaluateMemoryRevision(oldContent: string | null, newContent: string): MemoryRevisionReport {
  const oldLines = observations(oldContent ?? '');
  if (oldLines.length === 0) {
    return { droppedClaims: [], priorObservationCount: 0, survivalRatio: 1, isDrasticRevision: false };
  }

  const newTokenSets = observations(newContent).map(tokenize);
  const droppedClaims: DroppedClaim[] = [];
  let survived = 0;
  for (const oldLine of oldLines) {
    const oldTokens = tokenize(oldLine);
    const bestMatch = newTokenSets.reduce((best, newTokens) => Math.max(best, similarity(oldTokens, newTokens)), 0);
    if (bestMatch >= KEPT_SIMILARITY_FLOOR) survived += 1;
    else droppedClaims.push(oldLine);
  }

  const survivalRatio = survived / oldLines.length;
  const isDrasticRevision =
    oldLines.length >= MIN_PRIOR_OBSERVATIONS_TO_JUDGE && survivalRatio < DRASTIC_SURVIVAL_THRESHOLD;

  return { droppedClaims, priorObservationCount: oldLines.length, survivalRatio, isDrasticRevision };
}

/**
 * The ONLY thing this module ever logs — counts and a ratio, never the note
 * text (see module header's privacy note). Exported so `review.ts` and its
 * tests share one exact wording rather than two copies drifting apart.
 */
export function describeDrasticRevision(store: 'learner' | 'pedagogy', report: MemoryRevisionReport): string {
  const keptPct = Math.round(report.survivalRatio * 100);
  return (
    `post-session review drastically revised the "${store}" memory ` +
    `(kept ${keptPct}% of ${report.priorObservationCount} prior observation(s), ` +
    `dropped ${report.droppedClaims.length}) — worth a human glance at this learner's ledger`
  );
}
