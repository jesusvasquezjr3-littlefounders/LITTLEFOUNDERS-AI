import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import castFile from './cast.json';
import manifestFile from './manifest.json';
import type { CharacterId } from '@/components/characters/control/types';

/*
 * The characters' own voices, during onboarding and placement.
 *
 * WHAT THIS IS. A fixed script — every line a character speaks while guiding
 * someone into the product — synthesised ONCE with the four canonical enrolled
 * voices and stored in Depot (oracle/scripts/pregenerate-guided-voice.ts). The
 * page looks a line up by key and plays a URL. There is no runtime synthesis
 * here and no per-learner cost: the set does not grow with usage, so it is paid
 * for once and free for the life of the product, the same economics the Tutor's
 * scripted lines already run on (/ORACLE.md §15).
 *
 * THE SUBTITLE AND THE VOICE ARE THE SAME SENTENCE. Both come from the i18n
 * bundle. The manifest records the exact text each clip was generated from, and
 * `speak()` REFUSES to play a clip whose recorded text no longer matches what
 * the page is about to show. That is the whole safety property: editing the
 * copy silently orphans its audio instead of leaving a character saying last
 * month's sentence over this month's subtitle. A missing clip is silent and
 * subtitled; a MISMATCHED clip would be a character lying to a child's face.
 *
 * SUBTITLES ARE NOT OPTIONAL AND NOT A FALLBACK. They are always rendered, for
 * the learner who cannot hear, will not turn sound on, or is on a device that
 * refused autoplay — which is most first visits. Audio is the enhancement here;
 * the text is the product.
 */

interface ManifestEntry {
  url: string;
  character: string;
  /** The exact string this clip was synthesised from — the drift guard. */
  text: string;
}

interface Manifest {
  generated: string | null;
  lines: Record<string, ManifestEntry>;
}

const manifest = manifestFile as unknown as Manifest;
const cast = (castFile as { cast: Record<string, string> }).cast;

const MUTE_STORAGE_KEY = 'lf.guidedVoice.muted';

/** Who speaks this line. Unknown keys fall back to Dina rather than rendering nothing. */
export function characterFor(key: string): CharacterId {
  return (cast[key] as CharacterId | undefined) ?? 'dina';
}

export interface GuidedVoice {
  /** Play the clip for this narration key, if one exists and still matches its subtitle. */
  speak: (key: string, text: string) => void;
  stop: () => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** True while a clip is actually playing — drives the character's speaking rig. */
  speaking: boolean;
  /** Whether any audio exists at all for this locale. False on a build that never ran the generator. */
  available: boolean;
}

function readStoredMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    // Private mode, blocked storage: default to sound ON, which is the product.
    return false;
  }
}

export function useGuidedVoice(): GuidedVoice {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMutedState] = useState(readStoredMute);
  const [speaking, setSpeaking] = useState(false);

  // One element for the page's whole life. Reusing it is what lets the browser's
  // autoplay permission, once granted by any gesture, carry to every later line.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    const onEnded = () => setSpeaking(false);
    const onError = () => setSpeaking(false);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const available = useMemo(
    () => Object.keys(manifest.lines ?? {}).some((k) => k.endsWith(`|${locale}`)),
    [locale],
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setSpeaking(false);
  }, []);

  const setMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Nothing to do — the preference just does not survive the session.
      }
      if (next) stop();
    },
    [stop],
  );

  const speak = useCallback(
    (key: string, text: string) => {
      const audio = audioRef.current;
      if (!audio || muted) return;

      const entry = manifest.lines?.[`${key}|${locale}`];
      if (!entry) return; // Never generated for this locale: silent, still subtitled.

      /*
       * The drift guard. If the copy has been edited since the clip was made,
       * the recorded text no longer matches the subtitle about to be shown, and
       * playing it would put a different sentence in the character's mouth than
       * the one on screen. Staying silent is the correct failure.
       */
      if (entry.text !== text) return;

      audio.pause();
      audio.src = entry.url;
      audio.currentTime = 0;
      setSpeaking(true);

      /*
       * `play()` is only SPECIFIED to return a promise — it is not guaranteed
       * to in every environment, and jsdom's stub returns undefined. Calling
       * `.catch()` on that throws a TypeError from inside a render effect,
       * which takes the whole page down. The failure was invisible until the
       * manifest had entries in it, because before that `speak()` returned at
       * the lookup and never reached this line: a latent crash on the exact
       * screen that forms a learner's first impression.
       */
      const started: unknown = audio.play();
      if (started && typeof (started as Promise<void>).catch === 'function') {
        void (started as Promise<void>).catch(() => {
          /*
           * Autoplay refused, or the file is unreachable. Both are normal — the
           * first visit has not produced a gesture yet — and both are already
           * handled by the subtitle that is on screen regardless.
           */
          setSpeaking(false);
        });
      }
    },
    [locale, muted],
  );

  /*
   * `speak` and `stop` are stable across a `speaking` change ON PURPOSE, and a
   * caller narrating on step change MUST depend on those two rather than on
   * this object. The object's identity necessarily changes when `speaking`
   * flips — that is what re-renders the character's mouth — so an effect keyed
   * on the whole object would loop: speak sets speaking, speaking changes the
   * object, the changed object re-runs the effect, which speaks again.
   */
  return { speak, stop, muted, setMuted, speaking, available };
}
