import { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import type { Locale } from '@/i18n';
import { ROLEPLAY_SCENES, type RoleplayBeat, type RoleplaySceneId } from './scenes';
import ROLEPLAY_VOICES from './voices.generated.json';

/*
 * THE CLOCK OF A ROLEPLAY, the same job `useReplayDirector.ts` does for a
 * replay. Voice added 2026-09-04 (owner request, after `scenes.ts`'s own
 * header explained why it had been deliberately left uncabled): every beat
 * of every scene is pre-generated, once, by oracle's `speech:pregenerate`
 * (merged catalogue — see `oracle/src/tutor/roleplayScenes.ts`), so THIS
 * hook never calls a provider or spends anything; it only resolves a URL
 * that already exists in `voices.generated.json`, a file
 * `roleplay-voices:generate` derives from oracle's own manifest and
 * `roleplay-voices:check` verifies still says what the caption says.
 *
 * `perCharacter` resolves the scene's abstract `'lead' | 'companion'` roles
 * to whichever REAL `CharacterId`s this session actually has standing —
 * TutorScene.tsx's `perCharacter` prop (Class III / S17), so the same scene
 * plays correctly no matter which two characters the learner picked.
 *
 * LIP-SYNC IS DELIBERATELY NOT WIRED, the same honest-gap posture `point_at`
 * already has for a different reason: driving `Character3D`'s `viseme` per
 * SPEAKING CHARACTER (not the broadcast single-track it has today) is a
 * real extension of `perCharacter` this pass did not reach. The audio is
 * genuinely spoken; the mouth does not move to it yet.
 */

export interface RoleplayDirectorState {
  active: boolean;
  titleKey: string | null;
  /** Null once the scene has finished (or was never started). */
  beat: RoleplayBeat | null;
  perCharacter: Partial<Record<CharacterId, { emotion: CharacterEmotion; action: CharacterAction; actionKey: number }>>;
  /**
   * The current beat's pre-generated clip, or null when nothing resolves —
   * an unenrolled voice for this character/locale, or a deployment with
   * `VOICE_PROVIDER=none`. Null is silent, never a stock substitute
   * (`scripted.ts`'s own posture) — the caption still carries the line.
   */
  audioUrl: string | null;
  /**
   * Call this when the caller's own `<audio src={audioUrl}>` fires `ended`,
   * to advance the instant the clip actually finishes rather than waiting
   * for the fallback timer below. Safe to never call (a null `audioUrl`, or
   * a caller with no audio element at all) — the fallback covers it.
   */
  onAudioEnded: () => void;
}

const IDLE_STATE: RoleplayDirectorState = {
  active: false,
  titleKey: null,
  beat: null,
  perCharacter: {},
  audioUrl: null,
  onAudioEnded: () => {},
};

type VoicesManifest = Record<string, Record<string, Record<string, Record<string, string>>>>;

function resolveAudioUrl(
  sceneId: RoleplaySceneId,
  beatIndex: number,
  character: CharacterId | null,
  locale: Locale,
): string | null {
  if (!character) return null;
  const manifest = (ROLEPLAY_VOICES as { voices: VoicesManifest }).voices;
  return manifest[sceneId]?.[String(beatIndex)]?.[character]?.[locale] ?? null;
}

export function useRoleplayDirector(
  /**
   * The TRIGGER, read only at the instant it fires — `roleplayScene` lives
   * on exactly the one turn that starts a scene (see `scenes.ts`'s prompt
   * guidance: "this REPLACES your own telling of that moment", a one-turn
   * signal, not a held state). `turnSeq` is what makes a fresh trigger
   * distinguishable from an ORDINARY later turn that simply does not repeat
   * the field: without it, the conversation's very next turn — which has
   * `roleplayScene: null` because nothing asked it to start a SECOND scene —
   * would read as "cancel the one already playing" and cut a 4-beat, ~10s
   * performance off after one line. Keying on `turnSeq` instead means a
   * scene runs to ITS OWN natural completion (the beat timer below) once
   * started, and only a genuinely NEW turn requesting a scene can restart
   * one — including the SAME scene id twice, since two different turns
   * always carry two different `turnSeq`s.
   */
  sceneId: RoleplaySceneId | null,
  turnSeq: number,
  leadId: CharacterId,
  companionId: CharacterId | null,
  locale: Locale,
): RoleplayDirectorState {
  // `runningScene` is STATE, deliberately, not a ref: a ref mutated inside
  // an effect does not itself schedule the re-render that would let this
  // component's own render body see the new value on the very next paint —
  // it would only show up once SOME OTHER state update happened to trigger
  // one. `setIndex(0)`/`setFinished(false)` below often set a value IDENTICAL
  // to the initial one (index 0, not finished), which React bails out of
  // silently — so a ref here would have left the very first scene of a
  // session invisible until an unrelated re-render happened to reveal it.
  const [runningScene, setRunningScene] = useState<RoleplaySceneId | null>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const reactedToSeq = useRef<number | null>(null);
  const actionKeyRef = useRef(0);

  useEffect(() => {
    if (sceneId === null || turnSeq === reactedToSeq.current) return;
    reactedToSeq.current = turnSeq;
    setRunningScene(sceneId);
    setIndex(0);
    setFinished(false);
  }, [sceneId, turnSeq]);

  // Reads the RUNNING scene, not the raw `sceneId` prop — the whole point of
  // `runningScene`/`reactedToSeq` above is that the performance keeps going
  // once started even after the prop that triggered it reverts to null.
  const scene = runningScene ? ROLEPLAY_SCENES[runningScene] : undefined;
  const beat = scene && !finished ? scene.beats[index] : undefined;

  const advance = useCallback(() => {
    setIndex((current) => {
      if (!scene) return current;
      if (current + 1 < scene.beats.length) {
        actionKeyRef.current += 1;
        return current + 1;
      }
      setFinished(true);
      return current;
    });
    // Functional `setIndex` reads the LATEST index rather than the one this
    // closure captured, so a fallback timer firing a beat late (audio
    // already advanced it) cannot regress the scene back a step.
  }, [scene]);

  useEffect(() => {
    if (!scene || !beat) return undefined;
    /*
     * A CEILING, NOT THE CLOCK, once audio exists: real speech ends when it
     * ends, which is what `onAudioEnded` below reports. This timer still
     * fires — `beat.durationMs` PLUS headroom for the network fetch — so a
     * clip that never loads (offline, a 404, an unenrolled voice) cannot
     * strand the scene silently forever. `advance()` is idempotent against a
     * beat already moved on by the real `ended` event, per its own comment.
     */
    const timer = window.setTimeout(advance, beat.durationMs + 4000);
    return () => window.clearTimeout(timer);
    // `beat` itself is deliberately not a dependency: it is DERIVED from
    // `scene`/`index` on every render (the line above), not independent
    // state — listing it too would re-arm the same timer every render
    // instead of only when the beat actually changes.
  }, [scene, index, advance]);

  if (!runningScene || !scene || !beat) return IDLE_STATE;

  const speakerId = beat.speaker === 'lead' ? leadId : companionId;
  const perCharacter: RoleplayDirectorState['perCharacter'] = speakerId
    ? { [speakerId]: { emotion: beat.emotion, action: beat.action, actionKey: actionKeyRef.current } }
    : {};

  return {
    active: true,
    titleKey: scene.titleKey,
    beat,
    perCharacter,
    audioUrl: resolveAudioUrl(runningScene, index, speakerId, locale),
    onAudioEnded: advance,
  };
}
