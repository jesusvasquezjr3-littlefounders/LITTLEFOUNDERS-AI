import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

/*
 * Push-to-talk, deliberately.
 *
 * NOT open-mic voice activity detection, and the reason is §1.9 rather than
 * engineering taste: an always-listening microphone in a child's room captures
 * everything said near it, including by people who never agreed to anything.
 * Hold-to-talk means the learner decides, every single time, exactly what
 * leaves the device — and the recording indicator is honest, because there is
 * nothing to indicate when they are not holding.
 *
 * The stream is acquired on FIRST USE rather than on mount. Asking a child for
 * their microphone the instant a page loads is the pattern that teaches people
 * to click "block", and a session that never uses voice never asks at all.
 */

/*
 * THE LEVEL IS A REF CHANNEL, NOT REACT STATE.
 *
 * The meter used to be `setLevel(peak)` inside a requestAnimationFrame loop,
 * which re-rendered every component under the tutor route sixty times a second
 * for the whole hold. Nothing read the value, so the cost was invisible; the
 * moment a meter actually consumed it, the entire route would have re-rendered
 * per frame while a 3D scene was already competing for the same budget.
 * `levelRef` plus `subscribe` gives a meter the same sixty updates a second
 * with zero renders: the subscriber writes an SVG attribute directly.
 *
 * THE HOLD CAP IS MEASURED IN BYTES, NOT SECONDS.
 *
 * `new MediaRecorder(stream)` takes no options on purpose — the browser picks
 * the codec, and we want whatever it is best at. That also means we cannot know
 * the bitrate, so "how many seconds fit under the wire cap" has no answer:
 * 1.5M base64 characters is roughly thirty-five seconds of PCM and several
 * minutes of Opus. Guessing a duration would either truncate a Chrome learner
 * mid-sentence or hand Oracle a frame its schema rejects. So the recorder runs
 * with a timeslice, we add up the chunk sizes it actually produces, and the
 * hold releases itself at 90% of the cap. The number is then exact on every
 * browser without knowing anything about any of them.
 */

export type MicPermission = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

/**
 * Oracle's inbound audio ceiling, mirrored from `oracle/src/ws/protocol.ts`.
 *
 * It is duplicated rather than imported because the frontend may only ever
 * reach Core, never an internal service (frontend/AGENTS.md). The two numbers
 * must agree: a larger value here produces a frame Zod rejects at the socket,
 * which surfaces to a child as a turn that silently never happened.
 */
export const MAX_AUDIO_B64_CHARS = 1_500_000;

/**
 * How much of the wire cap a single hold is allowed to spend.
 *
 * The remaining tenth absorbs the final chunk, which arrives after the decision
 * to stop has already been taken: `MediaRecorder` flushes whatever it buffered
 * when `stop()` is called, so the last chunk lands after the check that fired.
 */
export const WIRE_SAFETY_FRACTION = 0.9;

/** Recorded bytes that base64 to the safe fraction of the cap (4 chars per 3 bytes). */
export const HOLD_MAX_BYTES = Math.floor((MAX_AUDIO_B64_CHARS * WIRE_SAFETY_FRACTION * 3) / 4);

/**
 * A wall-clock ceiling on one hold, stated as a PRODUCT limit rather than a
 * technical one.
 *
 * The byte cap is what the wire can carry; this is what a turn should be. A
 * learner who leans on the button for two minutes has stopped talking to a
 * tutor and started recording a monologue, and the reply to it would arrive far
 * outside the latency budget that makes this feel like a conversation. On a
 * low-bitrate codec the byte cap would never fire first, so without this the
 * hold has no end at all.
 */
export const HOLD_MAX_MS = 60_000;

/**
 * How often the recorder hands us a chunk.
 *
 * Small enough that the byte total is never more than a quarter second stale
 * when the cap decision is made, large enough that we are not allocating a Blob
 * every frame for a sixty-second hold.
 */
const RECORDER_TIMESLICE_MS = 250;

/** Below this, a "recording" was a mis-tap rather than an utterance. */
const MIN_USEFUL_BYTES = 1_200;

/** Called once per animation frame while a hold is live. */
export type MicLevelListener = (level: number) => void;

export interface Microphone {
  permission: MicPermission;
  recording: boolean;
  /**
   * Peak level 0-1 for the current frame. Read it inside your own loop, or
   * subscribe; either way it never triggers a render.
   */
  levelRef: MutableRefObject<number>;
  /** Bytes recorded so far in this hold. Resets to 0 when the hold ends. */
  holdBytesRef: MutableRefObject<number>;
  /** Milliseconds elapsed in this hold. Resets to 0 when the hold ends. */
  holdMsRef: MutableRefObject<number>;
  /**
   * Fraction 0-1 of whichever ceiling is actually closest — bytes or seconds.
   * A meter driven by this fills at the rate the hold is really being spent.
   */
  holdFractionRef: MutableRefObject<number>;
  /** Register a per-frame level listener. Returns its unsubscribe. */
  subscribe: (listener: MicLevelListener) => () => void;
  start: () => Promise<void>;
  /** Resolves with the recorded audio, or null if nothing usable was captured. */
  stop: () => Promise<Blob | null>;
  release: () => void;
}

export interface MicrophoneOptions {
  /**
   * Called when the hold ended itself because it hit a ceiling.
   *
   * A caller that does not pass this still gets the auto-release — the frame
   * would otherwise be rejected by the server — but the audio is dropped
   * locally rather than sent, so anything that can hold the button for a long
   * turn should pass it.
   */
  onAutoRelease?: (clip: Blob | null) => void;
}

export function useMicrophone(enabled: boolean, options: MicrophoneOptions = {}): Microphone {
  const [permission, setPermission] = useState<MicPermission>('idle');
  const [recording, setRecording] = useState(false);

  const levelRef = useRef(0);
  const holdBytesRef = useRef(0);
  const holdMsRef = useRef(0);
  const holdFractionRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const listenersRef = useRef(new Set<MicLevelListener>());

  // The stop function reaches the frame loop through a ref because the loop is
  // created inside `start` and the loop is what decides to stop. Closing over
  // the callback directly would make the two depend on each other's identity
  // and re-create the loop every time either one changed.
  const stopRef = useRef<() => Promise<Blob | null>>(async () => null);
  const onAutoReleaseRef = useRef(options.onAutoRelease);
  onAutoReleaseRef.current = options.onAutoRelease;

  const subscribe = useCallback((listener: MicLevelListener) => {
    const listeners = listenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /** Zero every meter and tell the subscribers, so a ring never freezes mid-fill. */
  const resetMeters = useCallback(() => {
    levelRef.current = 0;
    holdBytesRef.current = 0;
    holdMsRef.current = 0;
    holdFractionRef.current = 0;
    for (const listener of listenersRef.current) listener(0);
  }, []);

  const release = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setRecording(false);
    resetMeters();
  }, [resetMeters]);

  // Releasing on unmount is not tidiness: a live MediaStream keeps the
  // browser's recording indicator lit after the learner has left the page,
  // which reads as "this site is still listening" and is a promise we break.
  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return;
    }

    try {
      if (!streamRef.current) {
        setPermission('requesting');
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        setPermission('granted');
      }
    } catch {
      setPermission('denied');
      return;
    }

    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    resetMeters();
    startedAtRef.current = Date.now();

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        holdBytesRef.current += event.data.size;
      }
    };
    // The timeslice is the whole point: without it `ondataavailable` fires once,
    // at stop, and the running total this cap is derived from would not exist
    // until the moment it was too late to act on it.
    recorder.start(RECORDER_TIMESLICE_MS);
    recorderRef.current = recorder;
    setRecording(true);

    // A level meter, so the learner can see they are being heard. Silence with
    // no feedback is indistinguishable from a broken microphone, and a child
    // will conclude the tutor is ignoring them.
    let analyser: AnalyserNode | null = null;
    let data = new Uint8Array(0);
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // No meter. Recording still works, and a missing meter must never stop a
      // learner from speaking.
    }

    /*
     * One loop, and it runs whether or not the analyser exists.
     *
     * It is the hold's clock as well as its meter: the auto-release lives here.
     * Nesting it inside the analyser's try block would mean a browser that
     * refused an AudioContext also lost the only thing enforcing the wire cap,
     * and that failure would show up as a rejected frame rather than as a
     * missing meter.
     */
    const tick = () => {
      if (analyser) {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const sample of data) peak = Math.max(peak, Math.abs(sample - 128) / 128);
        levelRef.current = peak;
      }

      holdMsRef.current = Date.now() - startedAtRef.current;
      holdFractionRef.current = Math.min(
        1,
        Math.max(holdBytesRef.current / HOLD_MAX_BYTES, holdMsRef.current / HOLD_MAX_MS),
      );
      for (const listener of listenersRef.current) listener(levelRef.current);

      if (holdBytesRef.current >= HOLD_MAX_BYTES || holdMsRef.current >= HOLD_MAX_MS) {
        void stopRef.current().then((clip) => onAutoReleaseRef.current?.(clip));
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [enabled, resetMeters]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      resetMeters();
      return null;
    }

    const finished = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length === 0) return resolve(null);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve(blob.size >= MIN_USEFUL_BYTES ? blob : null);
      };
    });

    recorder.stop();
    recorderRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRecording(false);
    resetMeters();
    return finished;
  }, [resetMeters]);

  stopRef.current = stop;

  return {
    permission,
    recording,
    levelRef,
    holdBytesRef,
    holdMsRef,
    holdFractionRef,
    subscribe,
    start,
    stop,
    release,
  };
}
