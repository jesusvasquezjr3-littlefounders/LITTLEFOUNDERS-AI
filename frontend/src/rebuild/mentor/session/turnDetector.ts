/*
 * WHEN HAS THE CHILD FINISHED SPEAKING?
 *
 * Until now the answer was "when they let go of the button". Push-to-talk is
 * honest and cheap, and it is also the reason the Tutor felt like a walkie
 * talkie rather than a conversation: a learner who pauses to think — which is
 * the entire behaviour the product exists to cause — releases the button and
 * loses the rest of their sentence.
 *
 * This is the blueprint's §6.2 turn policy and differentiator #1 of its
 * fourteen. The rule it encodes is the opposite of the one a voice assistant
 * uses: in customer service you close a turn fast, and in tutoring the silence
 * is the valuable part. So the budget is not a constant — it arrives per turn
 * from the pedagogical strategy in force (`LISTEN_SILENCE_MS` in
 * oracle/src/tutor/controller.ts), because only the strategy knows whether
 * three seconds of quiet is a child working through a Socratic question or a
 * child who has lost the thread in a fluency drill.
 *
 * WHY THIS IS A PURE FUNCTION OVER SAMPLES. It takes a level and a timestamp
 * and returns a verdict; it owns no timers, no audio graph and no React state.
 * That is what lets the whole policy — including the failure modes that only
 * appear after four seconds of silence — be tested in microseconds with no
 * microphone, no permission prompt and no fake clock. The half of this feature
 * that is easy to get wrong is the arithmetic, not the plumbing.
 */

export interface TurnDetectorPolicy {
  /**
   * How much silence AFTER speech ends the turn. Per strategy, from the
   * server's turn policy; the caller supplies a default when the v3 brain is
   * dormant and sends none.
   */
  silenceMs: number;
  /**
   * Peak level (0-1) at or above which a frame counts as speech.
   *
   * Deliberately low. A six-year-old two feet from a laptop microphone,
   * half-mumbling an answer they are unsure of, is much quieter than an adult
   * dictating — and the cost of a threshold set too high is that the quietest
   * and least confident answers, which are exactly the ones a tutor most needs
   * to hear, never register as speech at all.
   */
  speechLevel: number;
  /**
   * Speech must last this long, in total, before the turn can end.
   *
   * A cough, a chair, a sibling in the next room: without this, one loud frame
   * followed by quiet is indistinguishable from an answer, and the tutor
   * confidently replies to a noise.
   */
  minSpeechMs: number;
  /**
   * If no speech has begun within this, stop listening and send nothing.
   *
   * A child who says nothing must not have sixty seconds of room tone shipped
   * to a paid transcriber on their behalf — and the tutor should notice the
   * silence and say something, which is what `no_speech` lets the caller do.
   */
  leadInMs: number;
}

/** Sensible floor used when the server sends no policy (the v3 brain is off). */
export const DEFAULT_TURN_POLICY: TurnDetectorPolicy = {
  // Between the shortest strategy budget and the longest, so a dormant brain
  // still behaves like a patient tutor rather than like a phone assistant.
  silenceMs: 2_000,
  speechLevel: 0.06,
  minSpeechMs: 300,
  leadInMs: 8_000,
};

export type TurnPhase =
  /** Open, and nobody has said anything yet. */
  | 'waiting'
  /** Speech is happening right now. */
  | 'speaking'
  /** They spoke, then stopped long enough. Send the clip. */
  | 'ended'
  /** The lead-in expired in silence. Close the microphone, send nothing. */
  | 'no_speech';

export interface TurnDetector {
  /** Feed one frame. Returns the phase AFTER this sample. */
  observe: (level: number, nowMs: number) => TurnPhase;
  /** The phase as of the last sample, without advancing anything. */
  readonly phase: TurnPhase;
  /** Total milliseconds of speech seen so far — for meters and for tests. */
  readonly speechMs: number;
}

/**
 * The most time a single sample may be taken to represent.
 *
 * Samples arrive per animation frame (~16 ms), but requestAnimationFrame stops
 * entirely in a background tab and stutters under load, so two samples can be
 * seconds apart. Attributing that whole gap to whatever the LATER sample
 * happened to say is a guess in both directions, and the two directions are
 * not equally cheap: over-counting silence cuts a thinking child off
 * mid-sentence, which is the exact defect this file exists to fix, while
 * under-counting merely leaves the turn open a beat too long. So a gap
 * contributes at most this much to either accumulator — beyond it we were not
 * listening, and the honest answer is to keep waiting.
 */
const MAX_SAMPLE_SPAN_MS = 250;

export function createTurnDetector(
  policy: TurnDetectorPolicy,
  startedAtMs: number,
): TurnDetector {
  let phase: TurnPhase = 'waiting';
  let speechMs = 0;
  let silenceMs = 0;
  let lastSampleMs = startedAtMs;

  return {
    get phase() {
      return phase;
    },
    get speechMs() {
      return speechMs;
    },
    observe(level: number, nowMs: number): TurnPhase {
      // Terminal phases are sticky: a caller that keeps feeding frames after
      // the turn ended must not see it flip back to 'speaking' because a door
      // closed, which would re-open a turn it has already sent.
      if (phase === 'ended' || phase === 'no_speech') return phase;

      // Both accumulators move in milliseconds rather than in frames, and both
      // clamp the same way, so speech and silence are measured by one rule.
      const deltaMs = Math.min(MAX_SAMPLE_SPAN_MS, Math.max(0, nowMs - lastSampleMs));
      lastSampleMs = nowMs;

      if (level >= policy.speechLevel) {
        speechMs += deltaMs;
        /*
         * ANY speech resets the silence run. This is what lets a child say
         * "cuarenta y…", think, and then "…dos" without the first half being
         * sent as a finished answer. It is the cheap half of what a semantic
         * VAD does, and it is most of the benefit.
         */
        silenceMs = 0;
        phase = 'speaking';
        return phase;
      }

      silenceMs += deltaMs;

      if (phase === 'waiting') {
        // Nothing has been said yet, so the only question is whether to give up.
        return nowMs - startedAtMs >= policy.leadInMs ? (phase = 'no_speech') : phase;
      }

      /*
       * `minSpeechMs` is checked at the END rather than at the start, so a
       * cough does not merely fail to open a turn — it cannot CLOSE one
       * either. Without it, a short noise followed by real silence satisfies
       * the silence budget and sends a clip with nothing transcribable in it.
       */
      if (speechMs >= policy.minSpeechMs && silenceMs >= policy.silenceMs) {
        phase = 'ended';
        return phase;
      }

      /*
       * A noise that never became speech still has to end the turn eventually,
       * or the microphone stays open forever in a room with a fan in it.
       */
      if (speechMs < policy.minSpeechMs && nowMs - startedAtMs >= policy.leadInMs) {
        phase = 'no_speech';
        return phase;
      }

      return phase;
    },
  };
}
