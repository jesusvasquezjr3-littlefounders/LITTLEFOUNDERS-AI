import { useEffect, useRef, useState } from 'react';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { ROLEPLAY_SCENES, type RoleplayBeat, type RoleplaySceneId } from './scenes';

/*
 * THE CLOCK OF A ROLEPLAY, the same job `useReplayDirector.ts` does for a
 * replay — this file is deliberately much smaller because a roleplay beat
 * carries no audio (see `scenes.ts`'s own header for why voice is not wired
 * yet), so there is only ONE way a beat ends: its `durationMs` timer, no
 * media-event backstop needed.
 *
 * `perCharacter` resolves the scene's abstract `'lead' | 'companion'` roles
 * to whichever REAL `CharacterId`s this session actually has standing —
 * TutorScene.tsx's `perCharacter` prop (Class III / S17), so the same scene
 * plays correctly no matter which two characters the learner picked.
 */

export interface RoleplayDirectorState {
  active: boolean;
  titleKey: string | null;
  /** Null once the scene has finished (or was never started). */
  beat: RoleplayBeat | null;
  perCharacter: Partial<Record<CharacterId, { emotion: CharacterEmotion; action: CharacterAction; actionKey: number }>>;
}

const IDLE_STATE: RoleplayDirectorState = { active: false, titleKey: null, beat: null, perCharacter: {} };

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

  useEffect(() => {
    if (!scene || !beat) return undefined;
    const timer = window.setTimeout(() => {
      if (index + 1 < scene.beats.length) {
        actionKeyRef.current += 1;
        setIndex(index + 1);
      } else {
        setFinished(true);
      }
    }, beat.durationMs);
    return () => window.clearTimeout(timer);
    // `beat` itself is deliberately not a dependency: it is DERIVED from
    // `scene`/`index` on every render (the line above), not independent
    // state — listing it too would re-arm the same timer every render
    // instead of only when the beat actually changes.
  }, [scene, index]);

  if (!scene || !beat) return IDLE_STATE;

  const speakerId = beat.speaker === 'lead' ? leadId : companionId;
  const perCharacter: RoleplayDirectorState['perCharacter'] = speakerId
    ? { [speakerId]: { emotion: beat.emotion, action: beat.action, actionKey: actionKeyRef.current } }
    : {};

  return { active: true, titleKey: scene.titleKey, beat, perCharacter };
}
