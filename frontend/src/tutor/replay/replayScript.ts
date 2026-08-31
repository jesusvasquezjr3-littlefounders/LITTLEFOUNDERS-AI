import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';
import type { SessionSummary, SessionTranscript, TranscriptSegment, TranscriptTurn } from '../types';

/*
 * A SAVED CONVERSATION, TURNED INTO A PERFORMANCE.
 *
 * This file is the script. It takes the transcript Core serves — turns with
 * their text, their emotion, their action and the Depot URL of the tutor's own
 * clip, plus the activities that were served alongside them — and orders it
 * into BEATS: the smallest unit the stage can perform, one at a time, in the
 * order it happened.
 *
 * IT IS PURE, AND THAT IS THE POINT. No React, no audio element, no camera, no
 * `three`. The whole question "what happens, in what order, for how long" is
 * arithmetic over two arrays, so it is checkable in a unit test that runs in
 * milliseconds — which matters here more than usual, because the alternative
 * way to find out that a replay skipped a line is to sit and watch a whole
 * conversation. `useReplayDirector` owns the clock and `ReplayInWorld` owns the
 * surfaces; neither of them decides what the session WAS.
 *
 * WHY THE LEARNER IS A BEAT TOO. /ORACLE.md §12 calls replay a reconstruction
 * of the SESSION, and a session is two people. A performance that plays only
 * the tutor's half is a lecture the learner happened to be near, and it is also
 * a lie about the record: the learner's own turns are stored, in order, with
 * their own text, and dropping them from the playback would edit the thing the
 * learner came back to see.
 *
 * WHAT IS NOT HERE, AND WILL NOT BE INVENTED. The learner's AUDIO is never
 * persisted — there is no column for it and there must not be (/ORACLE.md §4,
 * migration 0047) — so a learner beat is text, and it is silent by
 * construction rather than by accident. The option a learner PICKED in an
 * activity is not stored either: `tutor_segments` keeps the payload, the score,
 * the attempts and the XP, and `answer` is the server-only key that never
 * reaches a browser. So an activity beat replays the question that was asked
 * and what the learner SCORED on it, and it does not draw a tick beside a
 * choice nobody wrote down.
 */

// ── What a beat is ──────────────────────────────────────────────────────────

/**
 * Who or what a beat belongs to.
 *
 * `note` is the `system` speaker: a scripted intervention that is neither the
 * tutor performing nor the learner answering — a safety stop, a budget close.
 * It is kept rather than filtered, because a replay that quietly drops the one
 * line explaining why a conversation ended early is the least honest edit
 * available.
 */
export type ReplayBeatKind = 'tutor' | 'learner' | 'note' | 'activity';

/** An activity as it can honestly be replayed. */
export interface ReplayActivity {
  segmentId: string;
  /**
   * The question, as it was asked. Every segment type in the Lesson Engine
   * carries `prompt_md`; a type that somehow does not yields an empty string
   * and the beat renders its outcome alone rather than a blank surface with a
   * confident heading over it.
   */
  prompt: string;
  /** 0–100, or null when it was served and never answered. */
  score: number | null;
  xpAwarded: number;
  origin: TranscriptSegment['origin'];
}

export interface ReplayBeat {
  /**
   * The row's own id, so a beat's identity survives a refetch.
   *
   * Used as a React key and as the anchor for "jump to this line": an index
   * would silently retarget if the transcript ever grew a row.
   */
  id: string;
  kind: ReplayBeatKind;
  /** Where this beat sits in the performance, 0-based. */
  index: number;
  /**
   * The schema `seq` this beat was ordered by — `TranscriptTurn.seq` for a
   * turn, `TranscriptSegment.seq` for an activity (that segment's OWN
   * per-session ordinal, not the seq of the turn that served it — see
   * `compare`'s own comment above). NOT the same number as `index`: `index`
   * is this beat's position in the sorted performance, `seq` is the row's own
   * identity, and the two only coincide by accident.
   * Found by adversarial review, round 67 (2026-08-30, HIGH): the guardian
   * transcript viewer (`KidTutorPage.tsx`) needs the real row `seq` to match
   * a safety flag's `turn_seq` against the correct beat — the review's own
   * fix for that finding is what this field exists for.
   */
  seq: number;
  /** The words. Empty only for an activity whose payload carried no prompt. */
  text: string;
  /**
   * The pose the character holds while this beat plays.
   *
   * For a tutor beat these are the STORED values — the same emotion and the
   * same action the character performed live — and that is the whole reason
   * this feature is possible without a contract change (/ORACLE.md §12).
   *
   * For the other three kinds nothing was stored, because nothing was
   * performed: the columns are NULL on a learner row by schema. A character
   * still has to be doing something, so the choices below are PERFORMANCE and
   * are named as such rather than dressed up as data — see `POSE`.
   */
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** The tutor's stored clip, or null when there never was one, or it aged out. */
  audioUrl: string | null;
  /**
   * How long this beat lasts when nothing else ends it, in milliseconds.
   *
   * A beat WITH audio ends when the clip does; this is the backstop for the
   * clip that 404s after retention swept it. A beat WITHOUT audio has only
   * this, and it is the whole reason a silent replay still plays at a human
   * pace instead of flickering through twenty lines in a second.
   */
  durationMs: number;
  /** Present on, and only on, an `activity` beat. */
  activity: ReplayActivity | null;
  /**
   * V4's live sequence board, when this tutor beat drew one — the SAME
   * server-computed values shown live, never recomputed. Present only on a
   * `tutor` beat; every other kind carries `null`, the same way `activity`
   * is null outside an `activity` beat. Found by adversarial review, round
   * 35 (2026-08-30, HIGH): this did not exist at all, so a session that
   * used the whiteboard lost it silently on replay.
   */
  whiteboard: TranscriptTurn['whiteboard'];
}

export interface ReplayScript {
  session: SessionSummary;
  beats: readonly ReplayBeat[];
  /** True when at least one tutor beat kept its voice. */
  hasAudio: boolean;
  /**
   * True when the conversation has tutor lines and NOT ONE of them has audio.
   *
   * Distinct from `!hasAudio`, which is also true of an empty transcript. This
   * is the state that earns a sentence on screen: the performance is going to
   * be silent from beginning to end, the learner should be told once, and they
   * should be told it is fine.
   */
  silent: boolean;
  /** The sum of every beat's duration — an estimate, and honest about it. */
  durationMs: number;
}

// ── Timing ──────────────────────────────────────────────────────────────────

/**
 * How long a line takes to say, when there is no clip to time it by.
 *
 * 380 ms a word is roughly 158 words a minute, which is unhurried adult speech
 * and about right for a tutor addressing a seven-year-old. It is deliberately
 * NOT reading speed: a replay is a performance of somebody talking, and running
 * the captions at silent-reading pace would make a saved conversation feel like
 * a slideshow of somebody else's.
 */
const MS_PER_WORD = 380;

/** Nobody says anything, however short, in under a second and a half. */
const MIN_LINE_MS = 1500;

/**
 * And nothing holds the screen for more than nine seconds without the transport
 * looking broken. A line long enough to hit this ceiling is one the learner can
 * still read — the caption stays up for the whole beat and the transcript keeps
 * it afterwards — and the alternative is a replay that appears to have frozen.
 */
const MAX_LINE_MS = 9000;

/** An activity is read, not heard, so it gets a longer floor and the same ceiling. */
const MIN_ACTIVITY_MS = 3200;

/**
 * How long a beat's audio may overrun its own estimate before the director
 * gives up on it.
 *
 * The stage's `<audio>` fires `ended`, and it now fires the same callback on
 * `error`, so a clip that 404s ends the beat immediately. What neither event
 * covers is a `play()` the browser REFUSES — the autoplay policy rejects the
 * promise and no media event follows at all — so the beat would sit forever on
 * a line nobody can hear. Doubling the estimate and adding six seconds is
 * comfortably longer than any real clip of a line this length and short enough
 * that a learner reads the refusal as a pause rather than as a dead product.
 */
export function backstopMsFor(beat: ReplayBeat): number {
  return beat.durationMs * 2 + 6000;
}

/** How long a beat of this text should last. */
export function estimateBeatMs(text: string, kind: ReplayBeatKind): number {
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const floor = kind === 'activity' ? MIN_ACTIVITY_MS : MIN_LINE_MS;
  return Math.min(MAX_LINE_MS, Math.max(floor, words * MS_PER_WORD));
}

// ── The poses nothing recorded ──────────────────────────────────────────────

/**
 * What the character does during a beat that stored no performance.
 *
 * THESE ARE STAGING DECISIONS AND THEY ARE WRITTEN DOWN HERE so that nobody
 * later reads them out of a screenshot as recorded data. A learner turn and a
 * system note have `emotion` and `action` NULL by schema; the character is
 * nevertheless standing on an island and must be doing something.
 *
 * - `learner`: the tutor LISTENS. `thinking` with no one-shot action is the
 *   nearest thing the closed vocabulary has to attention, and it is what the
 *   character actually did while the learner was talking.
 * - `note`: `neutral` and still. A safety stop or a budget close is not a
 *   moment for the character to emote about.
 * - `activity`: the tutor HANDS IT OVER. `encouraging` and `point`, which is
 *   the gesture the vocabulary has for "look at this", and the one a live
 *   session most often carried on the turn whose `next` was `segment`.
 */
const POSE: Record<Exclude<ReplayBeatKind, 'tutor'>, { emotion: CharacterEmotion; action: CharacterAction }> = {
  learner: { emotion: 'thinking', action: 'idle' },
  note: { emotion: 'neutral', action: 'idle' },
  activity: { emotion: 'encouraging', action: 'point' },
};

// ── Ordering ────────────────────────────────────────────────────────────────

/**
 * A row of either table, reduced to the three fields the running order needs.
 *
 * Core serves turns `order=seq.asc` and nothing else, and `seq` is NOT unique
 * across speakers: Oracle writes the learner's turn at the orchestrator's
 * current turn count and the tutor's reply at the emission's, so the two halves
 * of one exchange can share a number. Sorting by `seq` alone therefore leaves
 * the order of an exchange up to whatever PostgREST happened to return, which
 * is a coin flip that decides whether a replay shows the answer before the
 * question.
 *
 * `seq` is only comparable WITHIN one kind's own numbering space — a segment's
 * `seq` is its own per-session ordinal (`countSessionSegments`, the 1st, 2nd,
 * 3rd... activity served), a completely different counter from a turn's `seq`,
 * and the two coincide only by accident. Found live, testing as a real logged-
 * in kid account, 2026-08-30 (HIGH): a session's SECOND activity carried
 * `seq: 1` (its own ordinal), which sorted it ahead of turn `seq: 1` (the
 * session's opening greeting) — the guardian transcript viewer showed both
 * activities before any dialogue at all, in an order no parent could follow.
 * `TURN_RANK`/`SEGMENT_RANK` exist for exactly this: `seq` is compared ONLY
 * between two rows of the same rank; a turn against a segment skips straight
 * to `at`, the real wall clock, which both kinds now carry for real.
 */
interface Ordered {
  seq: number;
  at: number;
  rank: number;
}

const TURN_RANK = 0;
const SEGMENT_RANK = 1;

function compare(a: Ordered, b: Ordered): number {
  if (a.rank === b.rank && a.seq !== b.seq) return a.seq - b.seq;
  if (a.at !== b.at) return a.at - b.at;
  return a.rank - b.rank;
}

/**
 * `created_at` as a number, and never NaN.
 *
 * A row whose timestamp will not parse sorts as if it arrived at the epoch,
 * which keeps it in `seq` order with its neighbours instead of poisoning every
 * comparison it takes part in — `NaN` compares false against everything and
 * turns a sort into a shuffle.
 */
function millis(iso: string | undefined): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

/** The `prompt_md` of a stripped segment payload, when it has one. */
function promptOf(segment: Record<string, unknown>): string {
  const prompt = segment.prompt_md;
  return typeof prompt === 'string' ? prompt : '';
}

// ── The script ──────────────────────────────────────────────────────────────

/**
 * Everything the performance needs, in the order it happened.
 *
 * Empty transcripts are a real state and not an error: a session that opened
 * and closed before the tutor said anything leaves a row in `tutor_sessions`
 * and nothing in `tutor_turns`. The script comes back with no beats and the
 * layer says so in one line, rather than mounting a transport for a
 * performance that does not exist.
 */
export function buildReplayScript(transcript: SessionTranscript): ReplayScript {
  type Entry =
    | ({ kind: 'turn'; row: TranscriptTurn } & Ordered)
    | ({ kind: 'segment'; row: TranscriptSegment } & Ordered);

  const entries: Entry[] = [
    ...transcript.turns.map(
      (row): Entry => ({
        kind: 'turn',
        row,
        seq: row.seq,
        at: millis(row.created_at),
        rank: TURN_RANK,
      }),
    ),
    ...transcript.segments.map(
      (row): Entry => ({
        kind: 'segment',
        row,
        seq: row.seq,
        // `seq` here is this segment's own ordinal, not the requesting turn's
        // — see the comparator's own comment. `at` is what actually places it
        // among the turns; two activities served against one turn keep the
        // order Core listed them in via their own distinct `createdAt`.
        at: millis(row.createdAt),
        rank: SEGMENT_RANK,
      }),
    ),
  ].sort(compare);

  const beats: ReplayBeat[] = entries.map((entry, index) => {
    if (entry.kind === 'segment') {
      const prompt = promptOf(entry.row.segment);
      return {
        id: `segment:${entry.row.segmentId}`,
        kind: 'activity',
        index,
        seq: entry.seq,
        text: prompt,
        ...POSE.activity,
        audioUrl: null,
        durationMs: estimateBeatMs(prompt, 'activity'),
        activity: {
          segmentId: entry.row.segmentId,
          prompt,
          score: entry.row.score,
          xpAwarded: entry.row.xpAwarded,
          origin: entry.row.origin,
        },
        // Mutually exclusive with an activity by construction on the tutor's
        // own turn (never both `whiteboard` and `segmentRequest`), and this
        // beat itself IS the activity — nothing to draw here.
        whiteboard: null,
      };
    }

    const row = entry.row;
    const kind: ReplayBeatKind =
      row.speaker === 'tutor' ? 'tutor' : row.speaker === 'learner' ? 'learner' : 'note';

    if (kind === 'tutor') {
      return {
        id: `turn:${row.id}`,
        kind,
        index,
        seq: entry.seq,
        text: row.text,
        // The stored performance, exactly. `neutral`/`idle` only where the
        // column really is null — which is what a turn written before the
        // vocabulary was recorded looks like, not a default anybody chose.
        emotion: row.emotion ?? 'neutral',
        action: row.action ?? 'idle',
        audioUrl: row.audio_path,
        durationMs: estimateBeatMs(row.text, kind),
        activity: null,
        whiteboard: row.whiteboard,
      };
    }

    return {
      id: `turn:${row.id}`,
      kind,
      index,
      seq: entry.seq,
      text: row.text,
      ...POSE[kind],
      // Never the learner's. There is no such recording anywhere in this
      // product, and `audio_path` is documented as the tutor's alone.
      audioUrl: null,
      durationMs: estimateBeatMs(row.text, kind),
      activity: null,
      // A learner/note row's column is NULL by schema — the board is a
      // performance the tutor alone gives.
      whiteboard: null,
    };
  });

  const tutorBeats = beats.filter((beat) => beat.kind === 'tutor');
  const hasAudio = tutorBeats.some((beat) => beat.audioUrl !== null);

  return {
    session: transcript.session,
    beats,
    hasAudio,
    silent: tutorBeats.length > 0 && !hasAudio,
    durationMs: beats.reduce((total, beat) => total + beat.durationMs, 0),
  };
}

/**
 * The beat at an index, or null.
 *
 * A helper rather than `beats[i]` at four call sites, because the index is
 * driven by a transport a child is pressing and it is allowed to be out of
 * range for exactly one render after a jump. `noUncheckedIndexedAccess` makes
 * that a type error at each site; making it one function makes it one decision.
 */
export function beatAt(script: ReplayScript, index: number): ReplayBeat | null {
  return script.beats[index] ?? null;
}

/**
 * How far through the performance a beat is, 0–1.
 *
 * By BEAT rather than by elapsed milliseconds, and that is deliberate. The
 * durations are estimates for every line that lost its audio, so a bar driven
 * by them would advance at a rate the learner cannot feel and would disagree
 * with the "line 4 of 18" beside it. Counting beats is a number the learner can
 * check against the thing on screen, which is the only kind of progress worth
 * drawing.
 */
export function progressOf(script: ReplayScript, index: number): number {
  if (script.beats.length === 0) return 0;
  const clamped = Math.min(Math.max(index + 1, 0), script.beats.length);
  return clamped / script.beats.length;
}
