import { getConfig } from '../env.js';
import { updateLearnerMemory } from '../core/client.js';
import type { SessionContext } from '../core/client.js';

/*
 * THE POST-SESSION REVIEW — the first organ of the slow chamber (V4).
 *
 * A human tutor's real edge accrues BETWEEN sessions: they walk away thinking
 * "she needs to see it before she hears it", and next week's session starts
 * from that. This is that walk. After a session closes, one cheap model call
 * reads the conversation that just happened plus what we already believed,
 * and rewrites the two curated stores — LEARNER (who this child is) and
 * PEDAGOGY (what teaching works with them).
 *
 * DESIGN RULES, each load-bearing:
 *
 * - RUNS AFTER finish(), BEST-EFFORT. The close must never wait on this and
 *   a failure costs continuity, not the session — the same seam Core's
 *   summary digest uses. The review runs again after the next session anyway.
 *
 * - THE HARD LIMIT DOES THE CURATING. The model receives the current store
 *   contents and the caps, and must return complete replacements that fit.
 *   Consolidation is forced at write time (the Hermes pattern): to add a new
 *   observation it must compress or drop an old one. `null` means "nothing
 *   new worth writing", and short sessions should usually say null.
 *
 * - §1.9 IS IN THE PROMPT AND RE-CHECKED HERE. No surnames, no locations,
 *   no school names, no identifying details. The nickname is the only name
 *   that may appear. A response that smells of identifiers is dropped whole.
 *
 * - NOTHING HERE BLOCKS, THROWS UPWARD, OR RETRIES IN A LOOP. One call, one
 *   validation, one PUT to Core. Core owns the schema caps and the ledger.
 */

const REVIEW_SYSTEM = [
  'You are the reflection pass of a tutoring system for children. You read one',
  "finished tutoring conversation and maintain two small notes about the learner.",
  '',
  'Reply with ONLY a JSON object: {"learner": string|null, "pedagogy": string|null}',
  '',
  '"learner" (max 1300 chars): who this child is AS A LEARNER — interests that',
  'engage them, what motivates them, what to avoid. Durable facts only.',
  '"pedagogy" (max 2100 chars): what TEACHING works with this child — which',
  'maneuvers landed, pacing, scaffolding needs, representations that clicked.',
  '',
  'Each value REPLACES the whole stored note. Carry forward what still holds,',
  'fold in what this session showed, drop what it contradicted. Dense, plain',
  'sentences; separate observations with a newline. If this session taught',
  'nothing durable about a note, return null for it — most short sessions do.',
  '',
  'HARD RULES: never include a surname, a location, a school, or any',
  'identifying detail. The nickname is the only name allowed. Never quote the',
  "child's words about people or places. Write about learning, nothing else.",
].join('\n');

/** Leave headroom under the DB caps (1400/2200) so a validator disagreement over length never loses a write. */
const LEARNER_MAX = 1_300;
const PEDAGOGY_MAX = 2_100;

interface ReviewProposal {
  learner: string | null;
  pedagogy: string | null;
}

function parseProposal(raw: string): ReviewProposal | null {
  try {
    const value = JSON.parse(raw) as { learner?: unknown; pedagogy?: unknown };
    const norm = (v: unknown, max: number): string | null | undefined => {
      if (v === null) return null;
      if (typeof v !== 'string') return undefined;
      const trimmed = v.trim();
      if (trimmed === '') return null;
      return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
    };
    const learner = norm(value.learner, LEARNER_MAX);
    const pedagogy = norm(value.pedagogy, PEDAGOGY_MAX);
    if (learner === undefined || pedagogy === undefined) return null;
    return { learner, pedagogy };
  } catch {
    return null;
  }
}

/**
 * Run the review for a finished session and persist what it learned.
 *
 * Fire-and-forget from the socket's finish path: `void runPostSessionReview(…)`.
 * Returns what it wrote, for the tests and for nothing else.
 */
export async function runPostSessionReview(input: {
  session: SessionContext;
  history: readonly { speaker: 'learner' | 'tutor'; text: string }[];
}): Promise<ReviewProposal | null> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) return null;
  // A session with no real exchange teaches nothing — do not spend a call.
  const learnerTurns = input.history.filter((h) => h.speaker === 'learner').length;
  if (learnerTurns < 2) return null;

  const brief = input.session.learnerBrief ?? { learner: null, pedagogy: null };
  const transcript = input.history
    .slice(-40)
    .map((h) => `${h.speaker === 'tutor' ? 'TUTOR' : 'LEARNER'}: ${h.text}`)
    .join('\n');

  const userContent = [
    `Stored note "learner" (${LEARNER_MAX} chars max):`,
    brief.learner ?? '(empty)',
    '',
    `Stored note "pedagogy" (${PEDAGOGY_MAX} chars max):`,
    brief.pedagogy ?? '(empty)',
    '',
    "The session that just ended (the learner's nickname is the only name):",
    transcript,
  ].join('\n');

  let raw: string;
  try {
    const response = await fetch(`${config.MODEL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.MODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.MODEL_NAME,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      console.warn(`[oracle] post-session review call failed: ${response.status}`);
      return null;
    }
    const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    raw = typeof body.choices?.[0]?.message?.content === 'string' ? body.choices[0].message.content : '';
  } catch (error) {
    console.warn('[oracle] post-session review transport failed:', error instanceof Error ? error.message : error);
    return null;
  }

  const proposal = parseProposal(raw);
  if (proposal === null) {
    console.warn('[oracle] post-session review returned an unusable shape — dropped');
    return null;
  }
  if (proposal.learner === null && proposal.pedagogy === null) return proposal;

  /*
   * The §1.9 re-check. The prompt forbids identifiers; this catches a drift.
   * Coarse on purpose: an at-sign, a URL, or a phone-shaped run of digits has
   * no business in a note about pedagogy, so the whole proposal is dropped
   * rather than trimmed — a partially sanitized belief is not a belief we
   * hold about a child.
   */
  const suspicious = /@|https?:\/\/|\b\d{7,}\b/;
  for (const text of [proposal.learner, proposal.pedagogy]) {
    if (text !== null && suspicious.test(text)) {
      console.warn('[oracle] post-session review proposal carried an identifier-shaped token — dropped whole');
      return null;
    }
  }

  const written = await updateLearnerMemory({
    userId: input.session.userId,
    sessionId: input.session.sessionId,
    stores: proposal,
  });
  if (!written) console.warn('[oracle] learner memory write did not land — the next review will try again');
  return proposal;
}
