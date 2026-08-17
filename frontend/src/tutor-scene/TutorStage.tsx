import { useCallback, useEffect, useRef, useState } from 'react';
import { TutorScene, type TutorFraming } from './TutorScene';
import { useLipSync } from './useLipSync';
import { VISEME_CLOSED } from './lipSync';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';

/*
 * The Tutor's stage, as the PRODUCT uses it.
 *
 * `TutorScene` is the renderer and takes low-level props — a viseme index, a
 * framing mode. This is the surface the conversational layer talks to, and it
 * exists so that wiring RAG and TTS is passing props rather than reaching into
 * the scene: hand it a speech URL and it plays the audio, drives the mouth from
 * that audio, and moves the camera in close for as long as the character is
 * talking.
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
  /** Fires when a clip finishes on its own. Not called on interruption. */
  onSpeechEnd?: () => void;
  /**
   * Framing while NOT speaking. Speaking always closes in, because the mouth is
   * 2.4 px tall at the island framing and no viseme is distinguishable there.
   */
  idleFraming?: TutorFraming;
  /**
   * Fires ONCE, when the cast is actually on screen. Wait for it before the
   * first line: speech handed over while the assets are still resolving plays
   * to a blank canvas.
   */
  onReady?: () => void;
}

export function TutorStage({
  className,
  character = 'rho',
  companion = 'liruf',
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
  speechUrl = null,
  onSpeechEnd,
  idleFraming = 'vignette',
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
  }, [speechUrl]);

  const handleEnded = useCallback(() => {
    setSpeaking(false);
    onSpeechEnd?.();
  }, [onSpeechEnd]);

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
        character={character}
        companion={companion}
        emotion={emotion}
        action={action}
        actionKey={actionKey}
        viseme={speaking ? viseme : VISEME_CLOSED}
        framing={speaking ? 'conversation' : idleFraming}
        onReady={onReady}
      />
    </>
  );
}
