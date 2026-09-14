import { useEffect, useRef, useState } from 'react';
import { follow, rms, SILENCE_FLOOR, VISEME_CLOSED, visemeForAmplitude } from './lipSync';

/*
 * Drives a mouth from a playing <audio> element.
 *
 * This is the integration point for TTS: `audiogen` produces a URL, the product
 * plays it, and this turns that playback into the `viseme` prop the stage
 * already accepts. It deliberately takes an HTMLAudioElement rather than a URL
 * — whoever owns the conversation owns playback, pausing, interruption and the
 * user gesture that unlocks audio, and none of that belongs to a 3D scene.
 */

export interface LipSyncOptions {
  /** Analysis resolution. 1024 is ~21 ms at 48 kHz — a syllable, not a phoneme. */
  fftSize?: number;
  /** Scales raw RMS into the 0..1 the viseme bands expect. */
  gain?: number;
}

/**
 * Returns the viseme index for the current instant of playback.
 *
 * Returns `closed` whenever there is nothing to say: no element, playback
 * paused, audio silent, or Web Audio unavailable. A mouth that keeps moving
 * after the sound stops is worse than one that never moved.
 */

/*
 * ONE CONTEXT, ONE SOURCE NODE PER ELEMENT, AND NEITHER IS EVER THROWN AWAY.
 *
 * THE BUG THIS CLOSES — the reason the Tutor was silent in production for
 * every learner, while the entire server side was provably healthy (all twelve
 * enrolled voices synthesizing, Depot storing and serving, CORS open, and an
 * `audio_path` on every tutor row in the owner's own sessions):
 *
 * `createMediaElementSource(el)` does not tap an element, it CAPTURES it. From
 * that call onward the element's output goes into the audio graph and nowhere
 * else, permanently — the binding survives the node, the context, and every
 * remount. There is no API to undo it.
 *
 * The previous version built a NEW AudioContext on every run of the effect and
 * called `context.close()` in its cleanup. So the first run captured the
 * element, the first cleanup closed the context its capture lived in, and from
 * then on the element's audio drained into a dead node. Every later run threw
 *
 *   InvalidStateError: HTMLMediaElement already connected previously to a
 *   different MediaElementSourceNode
 *
 * which was caught and logged as "lip-sync could not attach" — a message about
 * a MOUTH, for a defect that had already silenced the whole product. The
 * comment beside it even said a failed connection is silence rather than a dead
 * mouth. It was right, and the handler still just returned.
 *
 * So: one context for the page, one source per element, cached, and the
 * capture is performed at most once. The context is never closed, because
 * closing it is what silenced the element.
 */
let sharedContext: AudioContext | null = null;
const capturedElements = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/*
 * THE LEARNER'S VOICE-VOLUME PREFERENCE, AND WHY IT IS A GAIN NODE RATHER
 * THAN `audioElement.volume`.
 *
 * Once `createMediaElementSource` has captured an element (above), the spec
 * requires the browser to ignore that element's OWN `.volume`/`.muted` from
 * then on — the sound the learner hears is whatever this graph does with it,
 * nothing the element itself reports. A volume slider that wrote
 * `audioElement.volume` would move a number nobody was reading.
 *
 * So the preference lives here, as the one persistent node this file's own
 * doctrine already requires ("the element must always have a path to the
 * speakers"): one shared `GainNode`, created once per context and reused for
 * every element and every re-wire, sitting where `context.destination` used
 * to sit directly. `.gain.value` is safe to change at any time — no
 * reconnect needed — so a slider drag is a single property write per frame.
 */
const VOICE_VOLUME_KEY = 'lf.tutor.voiceVolume';
const DEFAULT_VOICE_VOLUME = 1;

function readVoiceVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOICE_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOICE_VOLUME_KEY);
    if (raw === null) return DEFAULT_VOICE_VOLUME;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOICE_VOLUME;
  } catch {
    return DEFAULT_VOICE_VOLUME;
  }
}

let voiceVolume = readVoiceVolume();
let sharedGain: GainNode | null = null;

function ensureGain(context: AudioContext): GainNode {
  if (!sharedGain) {
    sharedGain = context.createGain();
    sharedGain.gain.value = voiceVolume;
    sharedGain.connect(context.destination);
  }
  return sharedGain;
}

/** The tutor's own voice volume, 0..1 — read once for a slider's initial position. */
export function getTutorVoiceVolume(): number {
  return voiceVolume;
}

/**
 * Sets the tutor's voice volume, 0..1, and remembers it for the next visit.
 *
 * Safe to call before any audio has ever played: the value is applied to the
 * shared gain node the next time one exists, and stamped onto it immediately
 * if a conversation is already live.
 */
export function setTutorVoiceVolume(next: number): void {
  voiceVolume = Math.min(1, Math.max(0, next));
  if (sharedGain) sharedGain.gain.value = voiceVolume;
  try {
    window.localStorage.setItem(VOICE_VOLUME_KEY, String(voiceVolume));
  } catch {
    // Private browsing, a blocked origin, a full quota — the session still honours it.
  }
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/**
 * The one source node for this element, creating it only the first time.
 *
 * Returns null when Web Audio is unavailable, or when the element was already
 * captured by something else — a page loaded before this fix, say. Null means
 * "do not lip-sync"; it must never mean "and also break the sound".
 */
function captureOnce(audio: HTMLMediaElement): {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
} | null {
  const Ctor = audioContextCtor();
  if (!Ctor) {
    console.info('[tutor-scene] Web Audio unavailable — lip-sync disabled.');
    return null;
  }
  sharedContext ??= new Ctor();
  const context = sharedContext;

  const existing = capturedElements.get(audio);
  if (existing) return { context, source: existing };

  try {
    const source = context.createMediaElementSource(audio);
    capturedElements.set(audio, source);
    return { context, source };
  } catch (error) {
    /*
     * The element belongs to a capture we do not own, so its audio is already
     * routed somewhere we cannot reach. Nothing here can rescue it — but this
     * code will not make it worse, and it must not pretend to work.
     */
    console.warn('[tutor-scene] this audio element was already captured by another audio graph', error);
    return null;
  }
}

export function useLipSync(audio: HTMLAudioElement | null, options: LipSyncOptions = {}): number {
  const { fftSize = 1024, gain = 2.4 } = options;
  const [viseme, setViseme] = useState(VISEME_CLOSED);

  const level = useRef(0);
  const step = useRef(0);
  const lastShape = useRef(VISEME_CLOSED);

  useEffect(() => {
    if (!audio) {
      setViseme(VISEME_CLOSED);
      return;
    }

    const captured = captureOnce(audio);
    if (!captured) return;
    const { context, source } = captured;

    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    const samples = new Float32Array(analyser.fftSize);

    // Re-wire from scratch each run: the source may still be connected from a
    // previous run, and a duplicated edge would double the signal.
    source.disconnect();
    source.connect(analyser);
    // Keep the element audible: the analyser is a tap, not a sink. Routed
    // through the shared gain node, not `context.destination` directly — see
    // its own comment above for why that is where volume has to live.
    analyser.connect(ensureGain(context));

    let frame = 0;
    let previous = performance.now();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;

      if (audio.paused || audio.ended) {
        level.current = follow(level.current, 0, delta);
      } else {
        analyser.getFloatTimeDomainData(samples);
        level.current = follow(level.current, Math.min(rms(samples) * gain, 1), delta);
      }

      const next =
        level.current < SILENCE_FLOOR
          ? VISEME_CLOSED
          : visemeForAmplitude(level.current, step.current);

      if (next !== lastShape.current) {
        // Advance the within-band rotation only when the mouth actually
        // changes, so a held vowel stays on one frame instead of flickering.
        step.current += 1;
        lastShape.current = next;
        setViseme(next);
      }
    };

    const resume = () => {
      if (context.state === 'suspended') void context.resume();
    };
    audio.addEventListener('play', resume);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener('play', resume);
      analyser.disconnect();
      /*
       * THE ELEMENT MUST ALWAYS HAVE A PATH TO THE SPEAKERS.
       *
       * Its output is captured by `source` for the rest of this page's life, so
       * leaving that node dangling is not "no lip-sync" — it is a permanently
       * mute player. Tearing down the analyser therefore hands the audio
       * straight to the destination instead. And the context is NOT closed:
       * closing it is precisely what silenced the tutor in production.
       */
      source.disconnect();
      source.connect(ensureGain(context));
      setViseme(VISEME_CLOSED);
    };
  }, [audio, fftSize, gain]);

  return viseme;
}
