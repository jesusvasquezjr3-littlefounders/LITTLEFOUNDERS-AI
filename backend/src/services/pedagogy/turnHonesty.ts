/*
 * C.18 — writes one Mentor turn's honesty facts to `tutor_turn_honesty`,
 * adding the one fact only Core can establish: whether the turn stated the
 * open activity's REAL answer key (`answerReveal.ts`).
 *
 * Called from `POST /tutor/internal/turns` after the transcript row itself
 * lands. Best-effort by the same rule as every backstage write on that
 * route: a failed honesty row costs one data point on the monitoring
 * dashboard, never the learner's turn, and is logged rather than thrown.
 *
 * The row carries NO user id and NO text — only the persona, the session
 * (nullable, SET NULL on the 90-day session purge) and closed-vocabulary
 * facts — so the metric outlives the transcript without keeping anything
 * about the child.
 */

import { serviceRest } from '../supabaseRest.js';
import { getTutorSegment, getTutorSession } from '../tutorData.js';
import { revealsAnswerKey } from './answerReveal.js';

/** Mirrors oracle/src/tutor/feedbackHonesty.ts `TurnHonesty` (checked by `npm run honesty:check`). */
export interface TurnHonestyInput {
  sequenceKind: 'hint_ladder' | 'repair' | 'open_activity' | 'none';
  hintLevel: 'reask' | 'indirect' | 'misconception' | 'fill_blank' | 'tell' | null;
  revealSanctioned: boolean;
  revealSelfAnswered: boolean;
  revealPhrase: boolean;
  openSegmentId: string | null;
  verdictContext: 'after_incorrect' | 'after_correct' | 'after_unsound_claim' | null;
  falseAffirmationCaught: boolean;
  falseAffirmationDelivered: boolean;
  praise: 'specific' | 'generic' | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordTurnHonesty(input: {
  sessionId: string;
  turnSeq: number;
  text: string;
  honesty: TurnHonestyInput;
}): Promise<boolean> {
  const session = await getTutorSession(input.sessionId);
  if (!session) return false;

  /*
   * The key-based check. Only for a segment of THIS session — an id naming
   * another session's activity is ignored (null), never scored against a key
   * the turn could not have been about.
   */
  let keyMatch: boolean | null = null;
  const segmentId = input.honesty.openSegmentId;
  if (segmentId !== null && UUID.test(segmentId)) {
    const segment = await getTutorSegment(segmentId);
    if (segment && segment.session_id === input.sessionId) {
      keyMatch = revealsAnswerKey({ segment: segment.payload, answer: segment.answer, text: input.text });
    }
  }

  const res = await serviceRest<unknown>('/tutor_turn_honesty?on_conflict=session_id,turn_seq', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      session_id: input.sessionId,
      character: session.character,
      turn_seq: input.turnSeq,
      sequence_kind: input.honesty.sequenceKind,
      hint_level: input.honesty.hintLevel,
      reveal_sanctioned: input.honesty.revealSanctioned,
      reveal_key_match: keyMatch,
      reveal_self_answered: input.honesty.revealSelfAnswered,
      reveal_phrase: input.honesty.revealPhrase,
      verdict_context: input.honesty.verdictContext,
      false_affirmation_caught: input.honesty.falseAffirmationCaught,
      false_affirmation_delivered: input.honesty.falseAffirmationDelivered,
      praise: input.honesty.praise,
    }),
  });
  return res !== null;
}
