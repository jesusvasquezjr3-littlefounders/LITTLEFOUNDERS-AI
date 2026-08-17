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

    const AudioContextCtor =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      // No Web Audio: the character simply does not lip-sync. Everything else
      // about the stage still works, which is the correct degradation.
      console.info('[tutor-scene] Web Audio unavailable — lip-sync disabled.');
      return;
    }

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    const samples = new Float32Array(analyser.fftSize);

    let source: MediaElementAudioSourceNode;
    try {
      source = context.createMediaElementSource(audio);
    } catch (error) {
      /*
       * An element can only be adopted by one AudioContext, ever. A second
       * attempt throws, and swallowing it would leave the caller with a muted
       * player and no idea why — createMediaElementSource ROUTES the audio
       * through the graph, so a failed connection is silence, not just a dead
       * mouth.
       */
      console.warn('[tutor-scene] lip-sync could not attach to this audio element', error);
      void context.close();
      return;
    }
    source.connect(analyser);
    // Keep the element audible: the analyser is a tap, not a sink.
    analyser.connect(context.destination);

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
      source.disconnect();
      analyser.disconnect();
      void context.close();
      setViseme(VISEME_CLOSED);
    };
  }, [audio, fftSize, gain]);

  return viseme;
}
