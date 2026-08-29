import { describe, expect, it } from 'vitest';
import {
  createTurnDetector,
  DEFAULT_TURN_POLICY,
  type TurnDetectorPolicy,
  type TurnPhase,
} from '../turnDetector';

/*
 * The turn policy, tested as arithmetic rather than as audio.
 *
 * Every case here is a scenario a real child produces and push-to-talk got
 * wrong: pausing mid-number, mumbling an unsure answer, coughing, saying
 * nothing at all, or being in a room with a fan. None of them needs a
 * microphone to reproduce, which is the whole reason the detector is a pure
 * function over samples.
 */

const POLICY: TurnDetectorPolicy = {
  silenceMs: 2_000,
  speechLevel: 0.06,
  minSpeechMs: 300,
  leadInMs: 8_000,
};

const LOUD = 0.5;
const QUIET = 0.0;

/**
 * Feed a script of [level, durationMs] at 60fps-ish steps and return the phase
 * after each segment, so a test reads as the shape of a conversation.
 */
function play(
  script: [level: number, durationMs: number][],
  policy: TurnDetectorPolicy = POLICY,
): { phases: TurnPhase[]; final: TurnPhase } {
  const start = 1_000_000;
  const d = createTurnDetector(policy, start);
  let t = start;
  const phases: TurnPhase[] = [];
  for (const [level, durationMs] of script) {
    const end = t + durationMs;
    while (t < end) {
      t = Math.min(t + 16, end);
      d.observe(level, t);
    }
    phases.push(d.phase);
  }
  return { phases, final: d.phase };
}

describe('a turn ends when the learner stops talking', () => {
  it('ends after the silence budget once they have actually spoken', () => {
    const { final } = play([
      [LOUD, 1_000],
      [QUIET, 2_100],
    ]);
    expect(final).toBe('ended');
  });

  it('does NOT end while the silence is still shorter than the budget', () => {
    const { final } = play([
      [LOUD, 1_000],
      [QUIET, 1_500],
    ]);
    expect(final).toBe('speaking');
  });
});

describe('a child who pauses mid-sentence keeps their turn', () => {
  /*
   * "cuarenta y…" [thinks] "…dos". This is the exact behaviour push-to-talk
   * destroyed and the reason the whole feature exists: the pause is the child
   * doing the arithmetic, and cutting it sends half an answer.
   */
  it('resets the silence run when speech resumes', () => {
    const { final } = play([
      [LOUD, 700], // "cuarenta y"
      [QUIET, 1_800], // thinking — under budget, so still theirs
      [LOUD, 500], // "dos"
      [QUIET, 1_000], // not yet
    ]);
    expect(final).toBe('speaking');
  });

  it('ends only after the pause that follows the WHOLE utterance', () => {
    const { final } = play([
      [LOUD, 700],
      [QUIET, 1_800],
      [LOUD, 500],
      [QUIET, 2_100],
    ]);
    expect(final).toBe('ended');
  });
});

describe('noise is not an answer', () => {
  it('a cough followed by silence never ends a turn as speech', () => {
    // 100ms of noise is under `minSpeechMs`, so the silence budget must not
    // be allowed to close a turn that contains nothing transcribable.
    const { final } = play([
      [LOUD, 100],
      [QUIET, 2_500],
    ]);
    expect(final).not.toBe('ended');
  });

  it('a room with a fan in it still closes, rather than listening forever', () => {
    const { final } = play([
      [LOUD, 100],
      [QUIET, 8_500],
    ]);
    expect(final).toBe('no_speech');
  });
});

describe('a learner who says nothing', () => {
  it('gives up after the lead-in instead of shipping room tone', () => {
    const { final } = play([[QUIET, 8_100]]);
    expect(final).toBe('no_speech');
  });

  it('is still waiting before the lead-in expires', () => {
    const { final } = play([[QUIET, 5_000]]);
    expect(final).toBe('waiting');
  });
});

describe('the quietest answers still count', () => {
  it('hears a mumble just above the threshold', () => {
    // The unsure, half-mumbled answer is the one a tutor most needs; a
    // threshold tuned for a confident adult would drop it entirely.
    const { final } = play([
      [POLICY.speechLevel, 600],
      [QUIET, 2_100],
    ]);
    expect(final).toBe('ended');
  });

  it('ignores a level just below the threshold', () => {
    // Sub-threshold audio never becomes speech, so the turn cannot END — but
    // 2.7s is well inside the 8s lead-in, so it is still WAITING rather than
    // given up on. Both halves matter: the first says the threshold works, the
    // second says a quiet room is not instantly abandoned.
    expect(
      play([
        [POLICY.speechLevel - 0.001, 600],
        [QUIET, 2_100],
      ]).final,
    ).toBe('waiting');
    expect(
      play([
        [POLICY.speechLevel - 0.001, 600],
        [QUIET, 8_100],
      ]).final,
    ).toBe('no_speech');
  });
});

describe('the per-strategy budget is honoured', () => {
  it('a Socratic budget keeps the turn open where a fluency budget closes it', () => {
    const script: [number, number][] = [
      [LOUD, 800],
      [QUIET, 1_200],
    ];
    expect(play(script, { ...POLICY, silenceMs: 900 }).final).toBe('ended');
    expect(play(script, { ...POLICY, silenceMs: 3_500 }).final).toBe('speaking');
  });
});

describe('terminal phases are sticky', () => {
  it('a door closing after the turn ended does not re-open it', () => {
    const start = 1_000_000;
    const d = createTurnDetector(POLICY, start);
    let t = start;
    for (; t < start + 800; t += 16) d.observe(LOUD, t);
    for (; t < start + 3_200; t += 16) d.observe(QUIET, t);
    expect(d.phase).toBe('ended');
    // A caller that keeps feeding frames must not see the turn come back to
    // life — it has already been sent.
    expect(d.observe(LOUD, t + 16)).toBe('ended');
  });
});

describe('a gap in the samples is not evidence of silence', () => {
  /*
   * requestAnimationFrame stops in a background tab and stutters under load, so
   * two samples can be seconds apart. The recorder kept running through the
   * gap; we simply were not measuring. Guessing costs differently in each
   * direction — guess "silence" and a thinking child is cut off mid-sentence,
   * guess "keep waiting" and the turn stays open a beat too long — so a gap
   * contributes at most MAX_SAMPLE_SPAN_MS and the turn survives it.
   */
  it('does NOT end a turn on one lonely quiet sample after a long gap', () => {
    const start = 1_000_000;
    const d = createTurnDetector(POLICY, start);
    for (let t = start; t < start + 800; t += 16) d.observe(LOUD, t);
    expect(d.observe(QUIET, start + 2_900)).toBe('speaking');
  });

  it('still ends once real, densely-sampled silence follows', () => {
    const start = 1_000_000;
    const d = createTurnDetector(POLICY, start);
    let t = start;
    for (; t < start + 800; t += 16) d.observe(LOUD, t);
    d.observe(QUIET, start + 2_900); // the gap: worth 250ms, not 2.1s
    for (; t < start + 5_200; t += 16) d.observe(QUIET, t);
    expect(d.phase).toBe('ended');
  });
});

describe('the fallback policy', () => {
  it('is patient enough for a child when the v3 brain is dormant', () => {
    // A dormant brain sends no policy. The default must not collapse to a
    // voice-assistant timeout (~700ms) or to zero.
    expect(DEFAULT_TURN_POLICY.silenceMs).toBeGreaterThanOrEqual(1_500);
    expect(DEFAULT_TURN_POLICY.minSpeechMs).toBeGreaterThan(0);
    expect(DEFAULT_TURN_POLICY.leadInMs).toBeGreaterThan(DEFAULT_TURN_POLICY.silenceMs);
  });
});
