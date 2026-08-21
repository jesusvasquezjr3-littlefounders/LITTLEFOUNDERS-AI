import { useCallback, useEffect, useRef, useState } from 'react';

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

export type MicPermission = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface Microphone {
  permission: MicPermission;
  recording: boolean;
  /** Peak level 0-1 while recording, for the level meter. */
  level: number;
  start: () => Promise<void>;
  /** Resolves with the recorded audio, or null if nothing usable was captured. */
  stop: () => Promise<Blob | null>;
  release: () => void;
}

/** Below this, a "recording" was a mis-tap rather than an utterance. */
const MIN_USEFUL_BYTES = 1_200;

export function useMicrophone(enabled: boolean): Microphone {
  const [permission, setPermission] = useState<MicPermission>('idle');
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const release = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setRecording(false);
    setLevel(0);
  }, []);

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
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);

    // A level meter, so the learner can see they are being heard. Silence with
    // no feedback is indistinguishable from a broken microphone, and a child
    // will conclude the tutor is ignoring them.
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const sample of data) peak = Math.max(peak, Math.abs(sample - 128) / 128);
        setLevel(peak);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // No meter. Recording still works, and a missing meter must never stop a
      // learner from speaking.
    }
  }, [enabled]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
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
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRecording(false);
    setLevel(0);
    return finished;
  }, []);

  return { permission, recording, level, start, stop, release };
}
