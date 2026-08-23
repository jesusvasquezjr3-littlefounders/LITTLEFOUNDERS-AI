import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backstopMsFor, beatAt, progressOf, type ReplayBeat, type ReplayScript } from './replayScript';

/*
 * THE CLOCK OF THE PERFORMANCE.
 *
 * `replayScript.ts` says what happens and in what order. This says WHEN, and it
 * is the only thing in the replay that holds time. It owns four facts — which
 * beat is on, whether it is running, whether the performance has finished, and
 * a key that makes the same beat replayable — and it exposes the six controls a
 * transport needs. Everything else about a replay is derived from those.
 *
 * IT DOES NOT OWN AN AUDIO ELEMENT, and that is the whole reason a replay can
 * exist without a second one. The stage already has exactly one `<audio>`
 * (`TutorStage`), fed by `speechUrl`/`audioKey` and reporting back through
 * `onSpeechEnd`, and mounting another would give the route two mouths that can
 * talk over each other. So this hook hands out a URL and a key, and waits to be
 * told the clip ended. The same three props drive a live session; a replay is
 * simply a different thing choosing what goes into them.
 *
 * TWO CLOCKS, BECAUSE THERE ARE TWO WAYS A BEAT CAN END.
 *
 *   1. The clip finishes. `handleSpeechEnd` — which the stage now also calls on
 *      a media ERROR, so a URL that 404s after retention swept the bucket ends
 *      its beat immediately instead of hanging the show.
 *   2. The timer expires. This is the ONLY clock for a beat with no audio — a
 *      learner's own line, an activity, a tutor line whose clip aged out — and
 *      it is the BACKSTOP for one that has audio, because `play()` can be
 *      refused by the autoplay policy without firing any media event at all.
 *
 * SILENCE IS A STATE, NOT A FAILURE (/ORACLE.md §12, and the owner's brief).
 * Nothing in this file treats a missing clip as an error condition: a silent
 * beat is timed instead of listened to, and the performance runs at the same
 * pace either way. The one thing the learner is told is told once, by the
 * layer, when the WHOLE conversation is silent — because that is a fact about
 * the recording rather than about the line they are looking at.
 *
 * PAUSING STOPS THE LINE, AND PLAYING STARTS IT AGAIN FROM ITS BEGINNING. The
 * stage's audio contract is "a new url or key starts at zero", and rather than
 * fight it with a second source of truth over `currentTime`, the replay adopts
 * it: press pause, the line stops; press play, that line is said again. It is
 * the behaviour a seven-year-old predicts from a picture book — you go back to
 * the start of the sentence — and it means the caption, the clip and the pose
 * can never disagree about which beat is happening.
 */

export interface ReplayDirector {
  script: ReplayScript;
  /** Which beat is on. Always in range while the script has beats. */
  index: number;
  beat: ReplayBeat | null;
  playing: boolean;
  /** True once the last beat has ended. The camera pulls back on this. */
  finished: boolean;
  /** 0–1, counted in beats. See `progressOf` for why not in milliseconds. */
  progress: number;
  /**
   * What the stage should be sounding right now, or null.
   *
   * Null while paused, on every beat that is not the tutor talking, and on a
   * tutor beat whose clip is gone. All three are ordinary states; none of them
   * is an error.
   */
  speechUrl: string | null;
  /**
   * Bumped every time a beat BEGINS.
   *
   * It is what makes a replay a performance rather than a slideshow: the stage
   * keys both the one-shot action and the audio element off it, so pressing
   * "again" on the line you are already on really does play it again — the same
   * gesture, the same clip. An index alone cannot do that, because the index
   * did not change.
   */
  beatKey: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  restart: () => void;
  /** The stage's audio element finished, or failed. Ends the current beat. */
  handleSpeechEnd: () => void;
}

/**
 * The performance, driven.
 *
 * `script` is null before the transcript has been fetched, and the hook returns
 * null with it rather than inventing an empty script: "no conversation loaded"
 * and "a conversation with no lines in it" are different, and the layer says
 * different things about them.
 *
 * THERE IS DELIBERATELY NO `ready` GATE ON THE SOUND, unlike a live session.
 * The live gate exists so the tutor cannot deliver its first line at a blank
 * canvas while the `.glb` files resolve (/ORACLE.md §9.1) — a first-impression
 * rule for a conversation that is only just beginning. A replay begins from a
 * phase where the island has been on screen for a while, so the gate would buy
 * nothing there; and on a device with no usable WebGL the first frame NEVER
 * arrives, so the same gate would make every replay permanently silent on
 * exactly the machines where the audio is the entire product. The no-WebGL
 * arrangement is the flat transcript /ORACLE.md §12 requires, and it is a
 * transcript that TALKS.
 */
export function useReplayDirector(script: ReplayScript | null): ReplayDirector | null {
  const [rawIndex, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [beatKey, setBeatKey] = useState(1);

  /*
   * A NEW CONVERSATION RESTARTS THE PERFORMANCE, DURING RENDER.
   *
   * In an effect this would land one commit late, so the first frame of the
   * second replay a learner opens would show the last beat of the first one —
   * the wrong character pose, the wrong caption, and a progress bar reading
   * "18 of 18" over a conversation that has not started. The same
   * reset-while-rendering pattern the lab's socket stub uses, and for the same
   * reason: one wrong frame on a stage is one wrong frame too many.
   *
   * IDENTITY IS THE SESSION ID, NOT THE OBJECT, and that is a robustness
   * decision rather than a micro-optimisation. Comparing references makes the
   * hook silently depend on every caller memoising its script — and a caller
   * that forgets does not get a subtle bug, it gets `setState` on every render
   * and React's "too many re-renders". A different CONVERSATION is what should
   * restart a performance; the same conversation arriving as a fresh object
   * (a refetch, a caller that rebuilds on each render) should not, because
   * restarting a replay somebody is halfway through is the worse failure of the
   * two.
   */
  const identity = script?.session.id ?? null;
  const [shown, setShown] = useState<string | null>(identity);
  if (shown !== identity) {
    setShown(identity);
    setIndex(0);
    setPlaying(true);
    setFinished(false);
    setBeatKey((key) => key + 1);
  }

  /*
   * AND THE INDEX IS CLAMPED RATHER THAN TRUSTED.
   *
   * It is state, and the script it indexes can be replaced under it by a caller
   * whose transcript came back shorter. Clamping at the read is one line and no
   * extra render; the alternative — a `setIndex` during render to repair it —
   * is a second convergence argument for a value that is only ever read.
   */
  const total = script?.beats.length ?? 0;
  const index = total === 0 ? 0 : Math.min(Math.max(rawIndex, 0), total - 1);

  /*
   * Read by the timer's callback, which is armed once per beat and must not be
   * torn down and rebuilt because a caller re-rendered. Mirrored during render,
   * the pattern `ConversationView` uses for the plate's detent.
   */
  const indexRef = useRef(index);
  indexRef.current = index;
  const scriptRef = useRef(script);
  scriptRef.current = script;

  const beginAt = useCallback((next: number) => {
    setIndex(next);
    setFinished(false);
    setBeatKey((key) => key + 1);
  }, []);

  /** The one place a beat ends. Every clock and every control lands here. */
  const advance = useCallback(() => {
    const current = scriptRef.current;
    if (!current) return;
    const next = indexRef.current + 1;
    if (next >= current.beats.length) {
      /*
       * THE END IS A STATE, NOT A JUMP BACK. The index stays on the last beat,
       * so the final line is still on screen and still in the caption while the
       * camera pulls back — which is exactly what the live goodbye does
       * (/ORACLE.md §9.5). Snapping to beat zero would make the performance end
       * by forgetting itself.
       */
      setPlaying(false);
      setFinished(true);
      return;
    }
    beginAt(next);
  }, [beginAt]);

  const beat = script ? beatAt(script, index) : null;

  /*
   * THE TIMER. One per beat, armed on the beat KEY so that replaying the same
   * line re-arms it, and cleared by the cleanup on every change — including a
   * pause, which is what makes pausing actually stop the clock rather than
   * merely stop the sound.
   */
  useEffect(() => {
    if (!script || !playing) return;
    const current = beatAt(script, index);
    if (!current) return;

    const ms = current.audioUrl !== null ? backstopMsFor(current) : current.durationMs;
    const timer = window.setTimeout(advance, ms);
    return () => window.clearTimeout(timer);
    // `beatKey` is a dependency on purpose: pressing "again" on the current
    // line does not change the index, and the timer has to start over with it.
  }, [script, playing, index, beatKey, advance]);

  const handleSpeechEnd = useCallback(() => {
    // A clip that ends while the learner has paused is a clip whose beat they
    // already stopped; advancing here would step the performance forward
    // underneath them.
    if (!playing) return;
    advance();
  }, [playing, advance]);

  const play = useCallback(() => {
    const current = scriptRef.current;
    if (!current || current.beats.length === 0) return;
    setPlaying(true);
    /*
     * Pressing play on a finished performance starts it again from the top,
     * because the alternative is a control that visibly does nothing. The
     * transport says so: the button's label and its icon both change to
     * "play again" once the performance has ended.
     */
    if (indexRef.current >= current.beats.length - 1 && finished) beginAt(0);
    else setBeatKey((key) => key + 1);
  }, [beginAt, finished]);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const jumpTo = useCallback(
    (target: number) => {
      const current = scriptRef.current;
      if (!current || current.beats.length === 0) return;
      const clamped = Math.min(Math.max(target, 0), current.beats.length - 1);
      beginAt(clamped);
    },
    [beginAt],
  );

  const next = useCallback(() => {
    const current = scriptRef.current;
    if (!current) return;
    if (indexRef.current >= current.beats.length - 1) {
      // Already on the last line. Pressing forward there ENDS the performance
      // rather than doing nothing, which is what the control looks like it
      // should do and what the end-of-replay chips are waiting for.
      setPlaying(false);
      setFinished(true);
      return;
    }
    jumpTo(indexRef.current + 1);
  }, [jumpTo]);

  const previous = useCallback(() => jumpTo(indexRef.current - 1), [jumpTo]);

  const restart = useCallback(() => {
    beginAt(0);
    setPlaying(true);
  }, [beginAt]);

  const speechUrl = playing && beat?.kind === 'tutor' ? (beat.audioUrl ?? null) : null;

  return useMemo(
    () =>
      script
        ? {
            script,
            index,
            beat,
            playing,
            finished,
            progress: progressOf(script, index),
            speechUrl,
            beatKey,
            play,
            pause,
            toggle,
            next,
            previous,
            jumpTo,
            restart,
            handleSpeechEnd,
          }
        : null,
    [
      script,
      index,
      beat,
      playing,
      finished,
      speechUrl,
      beatKey,
      play,
      pause,
      toggle,
      next,
      previous,
      jumpTo,
      restart,
      handleSpeechEnd,
    ],
  );
}
