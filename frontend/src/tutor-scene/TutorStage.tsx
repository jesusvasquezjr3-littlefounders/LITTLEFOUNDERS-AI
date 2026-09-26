import { useCallback, useEffect, useRef, useState } from 'react';
import { TutorScene, type TutorFraming, type TutorSceneProps } from './TutorScene';
import { armAudioUnlock } from './audioUnlock';
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
  /** See `TutorSceneProps.perCharacter`'s own comment (Class III / S17 `roleplay`). */
  perCharacter?: TutorSceneProps['perCharacter'];
  /** See `TutorSceneProps.presenceAvatarUri`'s own comment (Class III / S17 `presence`). */
  presenceAvatarUri?: TutorSceneProps['presenceAvatarUri'];
  /** See `TutorSceneProps.props`'s own comment (Class III / S18 `props`, generalized). */
  props?: TutorSceneProps['props'];
  /** @deprecated Use `props: ['stall']` — see `TutorSceneProps.showStall`. */
  showStall?: TutorSceneProps['showStall'];
  /** See `TutorSceneProps.pointBearing`'s own comment (Class III `point_at`). */
  pointBearing?: TutorSceneProps['pointBearing'];
  /**
   * Drives the syllabic articulation heuristic (`Character3D`'s `speaking`),
   * INDEPENDENT of this stage's own audio-driven viseme.
   *
   * A live `story` family segment (`story_dialogue`, `story_scene`,
   * `eavesdrop`) narrates through Echo's pre-rendered, disposable pipeline
   * (`useNarration`) rather than through `speechUrl`/`useLipSync` — so while
   * one is speaking there is no waveform here to drive a viseme from, and
   * without this the on-stage character would stand inertly posed while its
   * own line plays elsewhere on screen. Forwarded verbatim to every standing
   * character, the same way `emotion`/`action` already are: this stage has
   * one shared pose per frame, not one per character.
   */
  characterSpeaking?: boolean;
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
   * Everyone who should be standing on the island, for the personalization
   * audition. Absent means the tutor and their companion. Forwarded verbatim to
   * `TutorScene`, which owns what it costs and what it turns off to afford it.
   */
  audition?: readonly CharacterId[] | null;
  /**
   * Fires ONCE, when the cast is actually on screen. Wait for it before the
   * first line: speech handed over while the assets are still resolving plays
   * to a blank canvas.
   */
  onReady?: () => void;
  /**
   * The resolved quality tier, whenever the adaptive governor moves it.
   *
   * Forwarded verbatim to `TutorScene`. It reaches this surface at all because
   * the ONE quality decision the renderer cannot apply itself is the HUD
   * material's `backdrop-filter`, and the HUD is DOM outside the canvas — see
   * `TutorSceneProps.onQuality` and /DESIGN.md §Lumen → The blur, profiled.
   */
  onQuality?: TutorSceneProps['onQuality'];
  /**
   * The renderer's live counters (frame rate, tier, draw calls), about once a
   * second. Forwarded verbatim to `TutorScene`. The rebuilt Mentor stage reads
   * the frame rate to keep its 30 fps floor (Frontend Bible 08 §7): a device
   * that cannot hold it at the lowest tier gets the still fallback.
   */
  onStats?: TutorSceneProps['onStats'];
  /**
   * Fires when the browser REFUSES to play a line, and again when it stops
   * refusing.
   *
   * The Tutor speaks before the learner has touched anything, which is exactly
   * what every autoplay policy blocks. That rejection used to be swallowed:
   * the mouth closed and the product was silently silent, which reads as
   * broken and teaches nobody to fix it. The shell uses this to offer a "turn
   * sound on" affordance — a tutor that says why it is quiet is a product; one
   * that is just quiet is a bug report.
   */
  onSpeechBlocked?: (blocked: boolean) => void;
  /**
   * Fires once, when the `<audio>` element this stage owns is attached (and
   * again with `null` if it is ever detached).
   *
   * A raw element, not a URL or a playback position: this stage stays
   * deliberately ignorant of what is IN the audio (§ above, "knows NOTHING
   * about DeepSeek, Qwen, retrieval, transcripts or turn-taking") — reading
   * `.currentTime` against word-level timing is a conversational-layer
   * concern, not a rendering one. The element is handed out rather than
   * duplicated because `useLipSync` (via `captureOnce`) already permanently
   * routes this SAME element through one shared Web Audio graph — a second
   * `<audio>` for a second consumer would need its own such capture, or
   * silence.
   */
  onAudioElementReady?: (element: HTMLAudioElement | null) => void;
}

export function TutorStage({
  className,
  scene,
  character = 'rho',
  companion = 'liruf',
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
  pointBearing = null,
  perCharacter,
  presenceAvatarUri = null,
  props,
  showStall = false,
  characterSpeaking = false,
  speechUrl = null,
  audioKey = 0,
  onSpeechEnd,
  shot,
  backdrop = 'auto',
  idleFraming = 'vignette',
  speakingFraming = 'conversation',
  audition = null,
  onReady,
  onQuality,
  onStats,
  onSpeechBlocked,
  onAudioElementReady,
}: TutorStageProps) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [element, setElement] = useState<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const viseme = useLipSync(speaking ? element : null);

  /*
   * ARMED ON MOUNT, not on the first line. Permission is granted at the moment
   * of a gesture and only to an element that actually attempts a play then —
   * so waiting until the tutor has something to say is already too late. By
   * the time the greeting arrives, any tap the learner has made on the way in
   * has already bought the right to be heard.
   */
  useEffect(() => armAudioUnlock(audio.current), []);

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
    node.currentTime = 0;
    void node
      .play()
      .then(() => onSpeechBlocked?.(false))
      .catch(() => {
        /*
         * Refused. The mouth must not be left open pretending to talk over
         * silence — and, unlike before, the shell is TOLD, so the learner gets
         * an honest "tap to turn sound on" instead of a tutor that mouths
         * nothing. §1.14: a failure has to be distinguishable from working.
         */
        setSpeaking(false);
        onSpeechBlocked?.(true);
      });
  }, [speechUrl, audioKey, onSpeechBlocked]);

  const handleEnded = useCallback(() => {
    setSpeaking(false);
    onSpeechEnd?.();
  }, [onSpeechEnd]);

  const activeShot: ShotId = shot ?? shotForLegacyFraming(speaking ? speakingFraming : idleFraming);

  return (
    <>
      <audio
        ref={(node) => {
          /*
           * `crossOrigin` IS SET HERE, IN THE REF, AND NOT AS A JSX PROP.
           *
           * THE BUG THIS CLOSES — the reason the Tutor had no voice at all in
           * production, on every browser, for every learner:
           *
           * `useLipSync` routes this element through Web Audio
           * (`createMediaElementSource`) so the mouth can follow the waveform.
           * Per the spec, a MediaElementAudioSourceNode whose media is
           * cross-origin and NOT CORS-approved outputs DIGITAL SILENCE — the
           * element is "tainted". Depot serves the clips from a different
           * origin and does send `Access-Control-Allow-Origin: *`, but that
           * header is irrelevant while the element never ASKS for CORS.
           *
           * So the clip fetched, decoded, "played" for its full duration and
           * fired `ended` — with no error anywhere — and produced no sound.
           * The mouth stayed shut too, because the analyser read zeros. Every
           * server-side check passed: Oracle synthesized it, Depot stored it,
           * `curl` and `verify-speaks` fetched it back. None of them is a
           * browser routing audio through an analyser, which is the only
           * client that can see this.
           *
           * Order matters, which is why this is not a prop: assigning `src`
           * first starts a load that stays tainted for that resource. React
           * sets attributes in JSX order and that order is not a contract, so
           * the flag goes on before anything can trigger a fetch.
           */
          if (node && node.crossOrigin !== 'anonymous') node.crossOrigin = 'anonymous';
          audio.current = node;
          onAudioElementReady?.(node);
        }}
        src={speechUrl ?? undefined}
        preload="auto"
        onEnded={handleEnded}
        /*
         * A CLIP THAT CANNOT LOAD HAS ALSO FINISHED, and saying so is the whole
         * fix. `ended` never fires for a 404, a decode failure or an aborted
         * fetch, so the one callback the stage publishes about its audio simply
         * never arrived — the mouth was already handled (the `play()` rejection
         * clears `speaking`), but anything WAITING on the clip waited forever.
         *
         * Live that was invisible, because nothing waits: the tutor's next line
         * is driven by the socket. A REPLAY waits, because the clip ending IS
         * what ends the beat, and a session whose audio has been swept by the
         * 90-day retention (/ORACLE.md §12) is every session eventually. Rather
         * than teach the replay to distrust this callback, the callback is made
         * true: the clip is over, for whichever of the two reasons.
         */
        onError={handleEnded}
      />
      <TutorScene
        className={className}
        scene={scene}
        character={character}
        companion={companion}
        emotion={emotion}
        action={action}
        actionKey={actionKey}
        pointBearing={pointBearing}
        perCharacter={perCharacter}
        presenceAvatarUri={presenceAvatarUri}
        props={props}
        showStall={showStall}
        characterSpeaking={characterSpeaking}
        viseme={speaking ? viseme : VISEME_CLOSED}
        shot={activeShot}
        backdrop={backdrop}
        audition={audition}
        onReady={onReady}
        onQuality={onQuality}
        onStats={onStats}
      />
    </>
  );
}
