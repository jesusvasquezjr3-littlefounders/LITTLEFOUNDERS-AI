import { useCallback, useEffect, useRef, useState } from 'react';
import { TutorScene, type TutorFraming, type TutorSceneProps } from './TutorScene';
import { useLipSync } from './useLipSync';
import { VISEME_CLOSED } from './lipSync';
import { shotForLegacyFraming, type ShotId } from './shots';
import type { SceneBackdropId } from './backdrops';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';

/*
 * The Tutor's stage, as the PRODUCT uses it.
 *
 * `TutorScene` is the renderer and takes low-level props — a viseme index, a
 * shot. This is the surface the conversational layer talks to, and it exists so
 * that wiring RAG and TTS is passing props rather than reaching into the scene:
 * hand it a speech URL and it plays the audio, drives the mouth from that audio,
 * and lets the camera come in close for as long as the character is talking.
 *
 * It deliberately knows NOTHING about DeepSeek, Qwen, retrieval, transcripts or
 * turn-taking. It knows that speech is a URL that starts and stops. Everything
 * upstream of that belongs to /ORACLE.md.
 *
 * WHY THE AUDIO ELEMENT LIVES HERE: `useLipSync` needs an element, not a URL,
 * because an element can only ever be adopted by one AudioContext — a second
 * attempt throws and, since the analyser ROUTES the audio, a failed attach is
 * silence rather than merely a still mouth. Owning the element in one place
 * means that can only happen once, here, rather than at every call site.
 */

export interface TutorStageProps {
  className?: string;
  /**
   * Which island. Forwarded straight to `TutorScene`, which has always
   * accepted it — the prop was simply missing here, so the product could not
   * offer a diorama the scene lab had been switching between for weeks.
   */
  scene?: TutorSceneProps['scene'];
  character?: CharacterId;
  companion?: CharacterId | null;
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey?: number;
  /**
   * Audio for the character to speak, or null when silent.
   *
   * Changing it starts the new clip immediately: an interruption is a new URL,
   * not a separate cancel call, because a tutor that finishes its sentence
   * after the child has moved on is worse than one that stops mid-word.
   */
  speechUrl?: string | null;
  /**
   * Bump to replay the SAME url.
   *
   * The play effect was keyed on the URL alone, which meant the tutor saying the
   * same line twice in a row played once: the caption and the bubble both
   * updated while the audio element sat at the end of a clip it had already
   * finished, and the character mouthed nothing. `turn.seq` is the signal the
   * conversational layer already has for exactly this.
   */
  audioKey?: number;
  /** Fires when a clip finishes on its own. Not called on interruption. */
  onSpeechEnd?: () => void;
  /**
   * How the camera frames the scene, from the vocabulary in `shots.ts`.
   *
   * When given, it is used verbatim in silence AND while speaking: the caller
   * owns the shot, because the phase of the conversation is something only the
   * caller knows. When absent, the legacy idle/speaking pair below still
   * decides, so nothing that has not migrated changes behaviour.
   */
  shot?: ShotId;
  /**
   * Time of day for the lighting. Forwarded to `SceneLighting`. The axis was
   * offered, validated and persisted for weeks while reaching no renderer.
   */
  backdrop?: SceneBackdropId;
  /**
   * Framing while NOT speaking.
   *
   * @deprecated Pass `shot`. Retained because the conversational layer still
   * speaks the two-value vocabulary and a later increment owns that file.
   */
  idleFraming?: TutorFraming;
  /**
   * Framing WHILE speaking.
   *
   * @deprecated Pass `shot`. It existed because `liruf` and `dina` have no
   * mouth card (/TUTOR_3D.md §3.1) and closing the camera on a painted,
   * motionless mouth frames the one thing that is not working. The shot
   * vocabulary answers that properly with `closeup-wide` — off-axis and wider,
   * with the hands in frame — rather than by leaving them at the island shot
   * where nothing about them is legible either.
   */
  speakingFraming?: TutorFraming;
  /**
   * Fires ONCE, when the cast is actually on screen. Wait for it before the
   * first line: speech handed over while the assets are still resolving plays
   * to a blank canvas.
   */
  onReady?: () => void;
}

export function TutorStage({
  className,
  scene,
  character = 'rho',
  companion = 'liruf',
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
  speechUrl = null,
  audioKey = 0,
  onSpeechEnd,
  shot,
  backdrop = 'auto',
  idleFraming = 'vignette',
  speakingFraming = 'conversation',
  onReady,
}: TutorStageProps) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [element, setElement] = useState<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const viseme = useLipSync(speaking ? element : null);

  useEffect(() => {
    const node = audio.current;
    if (!node) return;

    if (!speechUrl) {
      node.pause();
      setSpeaking(false);
      return;
    }

    setElement(node);
    setSpeaking(true);
    /*
     * `play()` rejects when the browser has not seen a user gesture yet. That
     * is a NORMAL first-load state, not an error to throw on — but the mouth
     * must not be left open pretending to talk over silence, so the speaking
     * flag is cleared on rejection.
     */
    node.currentTime = 0;
    void node.play().catch(() => setSpeaking(false));
  }, [speechUrl, audioKey]);

  const handleEnded = useCallback(() => {
    setSpeaking(false);
    onSpeechEnd?.();
  }, [onSpeechEnd]);

  const activeShot: ShotId = shot ?? shotForLegacyFraming(speaking ? speakingFraming : idleFraming);

  return (
    <>
      <audio
        ref={(node) => {
          audio.current = node;
        }}
        src={speechUrl ?? undefined}
        preload="auto"
        onEnded={handleEnded}
      />
      <TutorScene
        className={className}
        scene={scene}
        character={character}
        companion={companion}
        emotion={emotion}
        action={action}
        actionKey={actionKey}
        viseme={speaking ? viseme : VISEME_CLOSED}
        shot={activeShot}
        backdrop={backdrop}
        onReady={onReady}
      />
    </>
  );
}
