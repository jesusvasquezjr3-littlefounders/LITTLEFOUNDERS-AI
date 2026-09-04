import { describe, expect, it } from 'vitest';
import {
  backstopMsFor,
  beatAt,
  buildReplayScript,
  estimateBeatMs,
  progressOf,
  type ReplayBeat,
} from '../replayScript';
import { GROW_STEP_MS } from '../../TutorWhiteboard';
import type { SessionSummary, SessionTranscript, TranscriptSegment, TranscriptTurn } from '../../types';

/*
 * The running order of a replayed conversation, tested headless.
 *
 * These are the assertions that cannot be made by looking. A replay plays one
 * line at a time and a wrong ORDER is invisible in a screenshot: the caption
 * says something plausible, the character is posed, the transcript scrolls. The
 * only way it is caught is by somebody watching a whole conversation and
 * noticing the tutor answered a question the learner had not asked yet — which
 * is exactly the class of defect that reaches an owner.
 */

const SESSION: SessionSummary = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  locale: 'en-US',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'weak_skill',
  startedAt: '2026-08-14T16:20:00.000Z',
  endedAt: '2026-08-14T16:38:00.000Z',
  closeReason: 'completed',
  turnCount: 4,
  segmentCount: 1,
  xpAwarded: 20,
};

function turn(over: Partial<TranscriptTurn> & Pick<TranscriptTurn, 'id' | 'seq' | 'speaker' | 'text'>): TranscriptTurn {
  return {
    emotion: null,
    action: null,
    audio_path: null,
    source: 'model',
    created_at: '2026-08-14T16:20:00.000Z',
    whiteboard: null,
    demonstrate: null,
    roleplay_scene: null,
    ...over,
  };
}

function segment(over: Partial<TranscriptSegment> & Pick<TranscriptSegment, 'segmentId' | 'seq'>): TranscriptSegment {
  return {
    origin: 'live',
    segment: { prompt_md: 'How much after 4 weeks?' },
    score: 100,
    xpAwarded: 20,
    createdAt: '2026-08-14T16:20:00.000Z',
    ...over,
  };
}

function transcript(turns: TranscriptTurn[], segments: TranscriptSegment[] = []): SessionTranscript {
  return { session: SESSION, turns, segments };
}

describe('buildReplayScript', () => {
  it('keeps both halves of the conversation, in the order they happened', () => {
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'What shall we work on?', created_at: '2026-08-14T16:20:00.000Z' }),
        turn({ id: 't2', seq: 1, speaker: 'learner', text: 'saving for a bike', created_at: '2026-08-14T16:21:00.000Z' }),
        turn({ id: 't3', seq: 2, speaker: 'tutor', text: 'How much does it cost?', created_at: '2026-08-14T16:22:00.000Z' }),
      ]),
    );

    expect(script.beats.map((beat) => [beat.kind, beat.text])).toEqual([
      ['tutor', 'What shall we work on?'],
      ['learner', 'saving for a bike'],
      ['tutor', 'How much does it cost?'],
    ]);
  });

  it('breaks a shared seq by the clock, so an answer never precedes its question', () => {
    /*
     * THE DEFECT THIS EXISTS FOR. Oracle writes the learner's turn at the
     * orchestrator's current turn count and the tutor's reply at the emission's,
     * so both halves of one exchange can land on the same `seq` — and Core
     * serves them `order=seq.asc` and nothing else. Sorting on `seq` alone
     * therefore leaves the order of an exchange to whatever PostgREST returned,
     * which is a coin flip that decides whether a replay shows the answer
     * before the question. The rows below are supplied in the WRONG order on
     * purpose.
     */
    const script = buildReplayScript(
      transcript([
        turn({ id: 'b', seq: 7, speaker: 'tutor', text: 'answer', created_at: '2026-08-14T16:31:00.000Z' }),
        turn({ id: 'a', seq: 7, speaker: 'learner', text: 'question', created_at: '2026-08-14T16:30:00.000Z' }),
      ]),
    );

    expect(script.beats.map((beat) => beat.text)).toEqual(['question', 'answer']);
  });

  it('puts an activity after the turn that handed it over, not before it', () => {
    const script = buildReplayScript(
      transcript(
        [
          turn({ id: 't1', seq: 4, speaker: 'tutor', text: "Let's try one.", created_at: '2026-08-14T16:25:00.000Z' }),
          turn({ id: 't2', seq: 5, speaker: 'tutor', text: 'Well done.', created_at: '2026-08-14T16:27:00.000Z' }),
        ],
        [segment({ segmentId: 's1', seq: 4, createdAt: '2026-08-14T16:26:00.000Z' })],
      ),
    );

    expect(script.beats.map((beat) => beat.kind)).toEqual(['tutor', 'activity', 'tutor']);
  });

  it('never sorts a segment by comparing its own ordinal against a turn seq', () => {
    /*
     * THE DEFECT THIS EXISTS FOR. Found live, testing as a real logged-in kid
     * account, 2026-08-30 (HIGH): `tutor_segments.seq` is this segment's own
     * per-session ordinal (`countSessionSegments` — the 1st, 2nd, 3rd...
     * activity served), not the seq of the turn that requested it. A
     * session's SECOND activity legitimately carries `seq: 1` (its own
     * ordinal) while the conversation's turns were already up to `seq: 5` or
     * beyond — comparing the two numbers directly sorted the activity into
     * the middle of turn 1, long before it actually happened. The guardian
     * transcript viewer (`KidTutorPage.tsx`) showed both of a session's
     * activities before any dialogue at all.
     */
    const script = buildReplayScript(
      transcript(
        [
          turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Good to see you.', created_at: '2026-08-14T16:20:00.000Z' }),
          turn({ id: 't2', seq: 2, speaker: 'learner', text: 'how do I save money', created_at: '2026-08-14T16:21:00.000Z' }),
          turn({
            id: 't3',
            seq: 3,
            speaker: 'tutor',
            text: "Let's try one on the screen.",
            created_at: '2026-08-14T16:22:00.000Z',
          }),
          turn({ id: 't4', seq: 4, speaker: 'tutor', text: 'Well done.', created_at: '2026-08-14T16:24:00.000Z' }),
        ],
        // This segment's own ordinal (1, its SECOND ever) numerically matches
        // no turn's seq here, but a naive cross-kind comparison of raw `seq`
        // values would still place it by that meaningless number rather than
        // by when it actually happened.
        [segment({ segmentId: 's1', seq: 1, createdAt: '2026-08-14T16:23:00.000Z' })],
      ),
    );

    expect(script.beats.map((beat) => [beat.kind, beat.text])).toEqual([
      ['tutor', 'Good to see you.'],
      ['learner', 'how do I save money'],
      ['tutor', "Let's try one on the screen."],
      ['activity', 'How much after 4 weeks?'],
      ['tutor', 'Well done.'],
    ]);
  });

  it('replays the stored performance, and invents one only where none exists', () => {
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Hi!', emotion: 'happy', action: 'wave' }),
        turn({ id: 't2', seq: 2, speaker: 'learner', text: 'hi', created_at: '2026-08-14T16:21:00.000Z' }),
      ]),
    );

    // The tutor's own emotion and action, straight off the row. This is the
    // sentence /ORACLE.md §12 has been promising since migration 0047.
    expect(script.beats[0]).toMatchObject({ emotion: 'happy', action: 'wave' });
    // A learner row has both columns NULL by schema, so the character listens.
    // A staging decision, and one the script states rather than smuggles.
    expect(script.beats[1]).toMatchObject({ emotion: 'thinking', action: 'idle' });
  });

  /*
   * Found by adversarial review, round 35 (2026-08-30, HIGH): a tutor turn
   * that drew a V4 whiteboard had no path into a replay beat at all — the
   * field did not exist on `ReplayBeat`, so the board was invisible on
   * replay even though the stored row now carries it (migration 0058).
   */
  it('carries the stored whiteboard through to the tutor beat that drew it', () => {
    const BOARD = {
      kind: 'sequence' as const,
      start: 10,
      steps: [{ op: 'add' as const, value: 2 }],
      unit: 'day' as const,
      values: [10, 12],
      label: 'Cada día te dan 2 más',
      currency: 'MXN' as const,
    };
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Imaginemos que guardas 10 pesos.', whiteboard: BOARD }),
      ]),
    );
    expect(script.beats[0]?.whiteboard).toEqual(BOARD);
  });

  /*
   * Found by adversarial review, 3/3 skeptics confirmed (MEDIUM): a replayed
   * beat's duration came ONLY from `row.text`'s word count, with zero
   * awareness of `row.whiteboard`'s value count. A short `say` paired with a
   * many-step board is the DESIGNED usage of the whiteboard, per /ORACLE.md's
   * own section on it ("say narrates and asks; the board carries the running
   * values") — not a rare edge case — so the 1500ms word-count floor routinely
   * won, `useReplayDirector` advanced on it, and `TutorWhiteboard` unmounted
   * mid-reveal, before its final bars — often the FINAL total — ever drew.
   */
  it('gives a whiteboard beat enough time to finish revealing, even with a one-word "say"', () => {
    // 8 steps is `turnSchema.ts`'s own `.max(8)` ceiling, which `whiteboard.ts`'s
    // `computeSequence` turns into 9 values (the start, plus one per step).
    const values = [0, 2, 4, 6, 8, 10, 12, 14, 16];
    const script = buildReplayScript(
      transcript([
        turn({
          id: 't1',
          seq: 1,
          speaker: 'tutor',
          text: 'Hi.',
          whiteboard: {
            kind: 'sequence',
            start: 0,
            steps: Array.from({ length: 8 }, () => ({ op: 'add' as const, value: 2 })),
            unit: 'day',
            values,
            label: 'Cada día te dan 2 más',
            currency: null,
          },
        }),
      ]),
    );

    const durationMs = script.beats[0]?.durationMs ?? 0;
    // Not the old word-count floor: `estimateBeatMs('Hi.', 'tutor')` is 1500,
    // and 8 * GROW_STEP_MS is comfortably longer than that.
    expect(durationMs).toBeGreaterThanOrEqual(8 * GROW_STEP_MS);
    expect(durationMs).toBe((values.length - 1) * GROW_STEP_MS);
  });

  it('leaves an ordinary tutor beat with no whiteboard on its word-count timing, unchanged', () => {
    // The whiteboard-driven minimum must be a no-op — `Math.max(x, 0)` — for
    // every beat that never carried a board, or every existing replay's
    // caption pacing would have moved.
    const script = buildReplayScript(
      transcript([turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one two three four five six' })]),
    );
    expect(script.beats[0]?.durationMs).toBe(estimateBeatMs('one two three four five six', 'tutor'));
  });

  it('never puts a whiteboard on a learner or note beat — nothing was ever recorded for those', () => {
    const script = buildReplayScript(
      transcript([turn({ id: 't1', seq: 1, speaker: 'learner', text: 'quiero un pizarrón' })]),
    );
    expect(script.beats[0]?.whiteboard).toBeNull();
  });

  /*
   * Found while investigating ORACLE.md §19.5's "replaying `demonstrate`
   * animations" backlog item, 2026-09-01 — the identical gap round 35 found
   * for the whiteboard above, on the tutor's OTHER v3 turn-schema visual
   * field: a tutor turn that demonstrated on the money tray had no path
   * into a replay beat at all, so a replay silently dropped the tutor's
   * hands moving a coin even though the stored row now carries it
   * (migration 0067).
   */
  it('carries the stored demonstration steps through to the tutor beat that drew them', () => {
    const STEPS = [
      { kind: 'add' as const, denomination: 10 },
      { kind: 'add' as const, denomination: 5 },
    ];
    const script = buildReplayScript(
      transcript([
        turn({
          id: 't1',
          seq: 1,
          speaker: 'tutor',
          text: 'Mira, si agrego esta moneda de 10 y esta de 5…',
          demonstrate: STEPS,
        }),
      ]),
    );
    expect(script.beats[0]?.demonstrate).toEqual(STEPS);
  });

  it('never puts a demonstration on an activity, learner or note beat — nothing was ever recorded for those', () => {
    const script = buildReplayScript(
      transcript(
        [
          turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Aquí tienes la actividad.' }),
          turn({ id: 't2', seq: 2, speaker: 'learner', text: 'no entendí' }),
        ],
        [segment({ segmentId: 's1', seq: 1 })],
      ),
    );
    expect(script.beats).toHaveLength(3);
    for (const beat of script.beats) {
      expect(beat.demonstrate).toBeNull();
    }
  });

  it('never attributes audio to the learner, because no such recording exists', () => {
    // The learner's voice transits for STT and is never persisted (/ORACLE.md
    // §4, migration 0047 — there is no column for it). A learner beat is silent
    // by construction and not by accident.
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'learner', text: 'hi', audio_path: 'https://depot.invalid/nope.mp3' }),
      ]),
    );
    expect(script.beats[0]?.audioUrl).toBeNull();
  });

  it('distinguishes a silent recording from an empty one', () => {
    const silent = buildReplayScript(
      transcript([turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Hello.' })]),
    );
    expect(silent).toMatchObject({ hasAudio: false, silent: true });

    // No tutor lines at all is not "a conversation that lost its sound" — it is
    // a conversation with nothing in it, and the layer says something else.
    const empty = buildReplayScript(transcript([]));
    expect(empty).toMatchObject({ hasAudio: false, silent: false, beats: [] });

    const heard = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'Hello.', audio_path: 'https://depot.invalid/a.mp3' }),
        turn({ id: 't2', seq: 2, speaker: 'tutor', text: 'And this one lost its clip.', created_at: '2026-08-14T16:22:00.000Z' }),
      ]),
    );
    expect(heard).toMatchObject({ hasAudio: true, silent: false });
  });

  it('carries the activity through with its outcome and without its key', () => {
    const script = buildReplayScript(transcript([], [segment({ segmentId: 's1', seq: 1 })]));
    const beat = script.beats[0];
    expect(beat?.kind).toBe('activity');
    expect(beat?.activity).toEqual({
      segmentId: 's1',
      prompt: 'How much after 4 weeks?',
      score: 100,
      xpAwarded: 20,
      origin: 'live',
    });
    // Nothing anywhere stores which option the learner picked, and the answer
    // key is service-role-only. A replay may show the question and the score.
    expect(Object.keys(beat?.activity ?? {})).not.toContain('answer');
  });

  it('survives a segment whose payload has no prompt, and says nothing rather than something', () => {
    const script = buildReplayScript(
      transcript([], [segment({ segmentId: 's1', seq: 1, segment: { type: 'quiz_mcq' } })]),
    );
    expect(script.beats[0]?.text).toBe('');
  });

  it('does not let an unparseable timestamp shuffle the conversation', () => {
    // `Date.parse` of a bad string is NaN, and NaN compares false against
    // everything — a comparator that let one through turns a sort into a
    // shuffle rather than into one misplaced row.
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one', created_at: 'not a date' }),
        turn({ id: 't2', seq: 2, speaker: 'tutor', text: 'two', created_at: 'also not a date' }),
        turn({ id: 't3', seq: 3, speaker: 'tutor', text: 'three', created_at: 'still not' }),
      ]),
    );
    expect(script.beats.map((beat) => beat.text)).toEqual(['one', 'two', 'three']);
  });

  it('gives every beat an index that matches its position', () => {
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one' }),
        turn({ id: 't2', seq: 2, speaker: 'tutor', text: 'two' }),
      ]),
    );
    expect(script.beats.map((beat) => beat.index)).toEqual([0, 1]);
    expect(beatAt(script, 1)?.text).toBe('two');
    expect(beatAt(script, 2)).toBeNull();
    expect(beatAt(script, -1)).toBeNull();
  });

  it('keeps a system note rather than editing it out of the record', () => {
    // A `system` turn is how a safety stop or a budget close is written down.
    // Dropping it from a replay is the least honest edit available.
    const script = buildReplayScript(
      transcript([turn({ id: 't1', seq: 1, speaker: 'system', text: 'We are nearly out of time.' })]),
    );
    expect(script.beats[0]?.kind).toBe('note');
  });
});

describe('estimateBeatMs', () => {
  it('paces a line at speaking speed, between a floor and a ceiling', () => {
    expect(estimateBeatMs('', 'tutor')).toBe(1500);
    expect(estimateBeatMs('Hi.', 'tutor')).toBe(1500);
    // Six words at 380 ms is 2280, comfortably inside both bounds.
    expect(estimateBeatMs('one two three four five six', 'tutor')).toBe(2280);
    // A very long line is capped: a beat that holds the screen for half a
    // minute reads as a replay that has frozen.
    expect(estimateBeatMs('word '.repeat(200), 'tutor')).toBe(9000);
  });

  it('gives an activity a longer floor, because it is read rather than heard', () => {
    expect(estimateBeatMs('2 + 2?', 'activity')).toBe(3200);
    expect(estimateBeatMs('2 + 2?', 'learner')).toBe(1500);
  });
});

describe('backstopMsFor', () => {
  it('outlasts any real clip of the same line', () => {
    /*
     * The stage's `<audio>` fires `ended`, and now also fires the same callback
     * on `error`, so a clip swept by retention ends its beat at once. What
     * neither event covers is a `play()` the autoplay policy REFUSES: no media
     * event follows at all, and without this the performance would sit on one
     * line forever.
     */
    const beat = { durationMs: 3000 } as ReplayBeat;
    expect(backstopMsFor(beat)).toBe(12000);
    expect(backstopMsFor(beat)).toBeGreaterThan(beat.durationMs);
  });
});

describe('progressOf', () => {
  it('counts beats, not milliseconds', () => {
    const script = buildReplayScript(
      transcript([
        turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one' }),
        turn({ id: 't2', seq: 2, speaker: 'tutor', text: 'two' }),
        turn({ id: 't3', seq: 3, speaker: 'tutor', text: 'three' }),
        turn({ id: 't4', seq: 4, speaker: 'tutor', text: 'four' }),
      ]),
    );
    expect(progressOf(script, 0)).toBe(0.25);
    expect(progressOf(script, 3)).toBe(1);
    // Out of range for exactly one render after a jump; the bar may not exceed
    // its own track while that is true.
    expect(progressOf(script, 99)).toBe(1);
    expect(progressOf(script, -5)).toBe(0);
    expect(progressOf(buildReplayScript(transcript([])), 0)).toBe(0);
  });
});
