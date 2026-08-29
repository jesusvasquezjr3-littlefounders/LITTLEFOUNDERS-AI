import { useEffect, useRef } from 'react';
import type { Microphone } from './useMicrophone';
import {
  createTurnDetector,
  DEFAULT_TURN_POLICY,
  type TurnDetectorPolicy,
} from './turnDetector';

/*
 * LISTENING WITHOUT A BUTTON.
 *
 * The tutor finishes asking; the microphone opens by itself; the child answers
 * in their own time; the turn closes when they stop. That is a conversation.
 * Holding a button while you think is not, and it is the reason a session that
 * should have been a dialogue read as a walkie-talkie.
 *
 * WHAT THIS IS NOT, and the distinction is the whole privacy argument: it is
 * not an always-on microphone. It opens only in the gap the tutor just created
 * by asking something, it closes on its own if nobody speaks (`leadInMs`), and
 * it never opens while the tutor is talking or while a turn is already in
 * flight. The consent gate, the provider and the retention rules are exactly
 * the ones push-to-talk already passed through — this changes WHEN capture
 * starts, not what happens to the audio, and push-to-talk remains available
 * for anyone who would rather hold the orb.
 *
 * THE BUDGET IS PEDAGOGICAL, NOT TECHNICAL. `listenSilenceMs` arrives per turn
 * from the strategy in force, so the same silence is read as a child thinking
 * through a Socratic question or a child who has lost the thread in a fluency
 * drill (blueprint §6.2, differentiator #1). A dormant v3 brain sends nothing
 * and the fallback is deliberately patient rather than zero.
 */

export interface HandsFreeTurnInput {
  /**
   * True only when a live socket could actually carry audio — the same gate
   * push-to-talk uses. Consent and browser permission are upstream of this.
   */
  enabled: boolean;
  /** The tutor's clip is playing. Never listen over our own voice. */
  speaking: boolean;
  /** A turn is already in flight; a second one would race it. */
  awaitingReply: boolean;
  /** The server's per-strategy turn policy, or null while the brain is dormant. */
  policy: { listenSilenceMs: number } | null;
  /** Rises on every new tutor turn, so each answer gets a fresh listen. */
  turnSeq: number;
  microphone: Microphone;
  /** Called with the captured clip, or null when nobody spoke. */
  onTurn: (clip: Blob | null) => void;
}

export function useHandsFreeTurn(input: HandsFreeTurnInput): void {
  const { enabled, speaking, awaitingReply, policy, turnSeq, microphone, onTurn } = input;

  /*
   * The callbacks and the live objects are held in refs so the effect below
   * depends ONLY on the four booleans that decide whether to listen. Without
   * this the effect re-runs whenever the parent re-renders — which is every
   * animation frame during a conversation — and each re-run would stop and
   * restart the recorder mid-sentence.
   */
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  const micRef = useRef(microphone);
  micRef.current = microphone;
  const policyRef = useRef(policy);
  policyRef.current = policy;

  useEffect(() => {
    if (!enabled || speaking || awaitingReply) return;

    const mic = micRef.current;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const detectorPolicy: TurnDetectorPolicy = {
      ...DEFAULT_TURN_POLICY,
      ...(policyRef.current ? { silenceMs: policyRef.current.listenSilenceMs } : {}),
    };

    void mic
      .start()
      .then(() => {
        // The gate can close while `start()` is in flight — the tutor begins a
        // new turn, the session ends, the component unmounts. Opening a stream
        // after that would leave a recording indicator nobody owns.
        if (cancelled) {
          void mic.stop();
          return;
        }

        const detector = createTurnDetector(detectorPolicy, performance.now());
        let finishing = false;

        const finish = (send: boolean) => {
          // `stop()` is async and the level callback keeps firing until it
          // settles, so without this latch a turn ending exactly as another
          // frame lands is sent twice.
          if (finishing) return;
          finishing = true;
          unsubscribe?.();
          /*
           * The learner can also end their own turn by pressing the orb, which
           * stops the recorder and sends the clip through the same handler. If
           * that already happened, the detector reaching its verdict a frame
           * later must stay silent: sending again would hand the socket a null
           * clip and abandon an upload that was already committed.
           */
          if (!micRef.current.recording) return;
          void mic.stop().then((clip) => {
            if (cancelled) return;
            onTurnRef.current(send ? clip : null);
          });
        };

        unsubscribe = mic.subscribe((level) => {
          const phase = detector.observe(level, performance.now());
          if (phase === 'ended') finish(true);
          else if (phase === 'no_speech') finish(false);
        });
      })
      .catch(() => {
        /*
         * A refused or unavailable microphone is not an error to shout about
         * here — the orb already says why, in the five states `micForPhase`
         * enumerates. Swallowing it keeps a permission prompt the learner
         * dismissed from becoming an unhandled rejection every turn.
         */
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      void micRef.current.stop();
    };
    // `turnSeq` is in the list on purpose: a new tutor turn must restart the
    // listen even when the three booleans happen to look unchanged between
    // renders.
  }, [enabled, speaking, awaitingReply, turnSeq]);
}
