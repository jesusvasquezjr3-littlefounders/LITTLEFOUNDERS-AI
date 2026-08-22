import { useCallback, useEffect, useId, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { duckTutorAmbient, playPlatformSound } from '@/lib/sound';
import { HudPlate } from './HudPlate';
import type { Microphone } from '../useMicrophone';

/*
 * The hero control, and the answer to the sentence that got the last version
 * rejected: "en ningun momento se ve el acceso a microfono".
 *
 * IT IS IN THE DOM IN ALL FIVE STATES, INCLUDING THE ONES WHERE IT CANNOT BE
 * USED. The previous build rendered it behind `{socket.microphone && (...)}`,
 * so the single most important affordance in the product disappeared entirely
 * whenever the server said no — which, with no voice provider configured, is
 * every session anyone has actually seen. An absent control teaches a learner
 * that the feature does not exist. A dashed, aria-disabled orb with one honest
 * line under it teaches them that it exists and why today is not the day, and
 * the three reasons are already computed by Core and already translated.
 *
 * IT IS THE LARGEST THING ON SCREEN: 96px at 375px, 112px at 1280px. That is
 * not emphasis for its own sake. It is a target a child hits without aiming,
 * on a phone, one-handed, while looking at the character rather than at their
 * thumb.
 *
 * THE RINGS ARE WRITTEN, NOT RENDERED. Both are driven from the microphone's
 * ref channel by one subscriber that sets SVG attributes directly. React never
 * hears about a level change, so the meter costs nothing while a 3D scene is
 * drawing behind it. The outer ring fills on the BYTE fraction rather than on a
 * guessed duration, so the thing the learner watches fill is the thing that
 * actually ends the hold.
 */

export type MicOrbState = 'unavailable' | 'idle' | 'listening' | 'thinking' | 'speaking';

/** Core's answers, verbatim (backend/src/routes/tutor.ts `microphoneBlockedBy`). */
export type MicBlockedReason = 'POLICY_BLOCKED' | 'CONSENT_REQUIRED' | 'VOICE_UNAVAILABLE';

export interface MicOrbProps {
  state: MicOrbState;
  /**
   * The hook's return value. The PARENT owns the `useMicrophone` call and
   * should pass `{ onAutoRelease: onClip }` there, so a hold that ends by
   * hitting the wire cap lands in exactly the same place as one the learner
   * released.
   */
  microphone: Microphone;
  /** Why the microphone is off, when the answer came from Core. */
  blockedReason?: MicBlockedReason | null;
  /**
   * Why the microphone is off, when the answer is a PHASE of the product rather
   * than one of Core's three policy answers.
   *
   * The orb is now mounted by the stage and is therefore on screen during
   * arrival, personalization and the goodbye — phases where there is no socket,
   * so nothing could be recorded even with every permission granted. Reusing
   * `VOICE_UNAVAILABLE` there would say "no voice provider is configured",
   * which is not what happened and is the kind of confident wrong sentence a
   * child cannot check. One of `blockedReason` and this must be supplied
   * whenever `state` is `unavailable`; this one wins, because a phase is a
   * narrower and more useful truth than a policy.
   */
  blockedCopy?: string | null;
  /** Receives the recording when a hold ends. Null means it was a mis-tap. */
  onClip: (clip: Blob | null) => void;
  /**
   * Pressing while the tutor speaks stops playback LOCALLY and starts a hold.
   * Nothing is sent and no protocol message exists for it: the turn was already
   * complete, already moderated and already in the transcript, because speech
   * arrives as a stored URL and never as a stream.
   */
  onInterrupt?: () => void;
  /**
   * What the orb says at rest, when "Hold to talk" would be a lie.
   *
   * There is exactly one screen where it is: the introduction, where no socket
   * exists yet, so the press cannot record anything and instead OPENS the
   * conversation in which recording becomes possible. Describing that as "hold
   * to talk" tells a learner to hold a button that has nothing to hold onto.
   *
   * Deliberately one string covering both the accessible name and the status
   * line, because those two are already the same sentence in every state the
   * orb has. Two props would let them drift, and a control whose spoken name
   * disagrees with its printed label is worse than either wording alone.
   */
  idleCopy?: string;
  className?: string;
}

/* Ring geometry in the 100x100 viewBox. Radii differ so the two never overlap. */
const CAP_RADIUS = 47;
const LEVEL_RADIUS = 41;
const CAP_CIRCUMFERENCE = 2 * Math.PI * CAP_RADIUS;
const LEVEL_CIRCUMFERENCE = 2 * Math.PI * LEVEL_RADIUS;

/**
 * Longer than this and a key press was a HOLD, so releasing the key ends the
 * turn. Shorter and it was a TAP, so the hold latches and the next press ends
 * it. One key does both because neither alone is enough: hold-to-talk is
 * unusable with switch access or sticky keys, and a pure toggle strands anyone
 * who copies the mouse gesture they just watched work.
 */
const KEY_HOLD_MS = 350;

const TALK_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);

export function MicOrb({
  state,
  microphone,
  blockedReason = null,
  blockedCopy = null,
  onClip,
  onInterrupt,
  idleCopy,
  className,
}: MicOrbProps) {
  const { t } = useTranslation();
  const statusId = useId();
  const hintId = useId();

  const levelCircleRef = useRef<SVGCircleElement | null>(null);
  const capCircleRef = useRef<SVGCircleElement | null>(null);
  const keyDownAtRef = useRef(0);

  const { subscribe, levelRef, holdFractionRef, recording, start, stop } = microphone;
  const available = state !== 'unavailable';

  /*
   * One subscriber, two attributes, zero renders.
   *
   * The dependency list is the hook's STABLE members — `subscribe` is a
   * useCallback and the two refs are ref objects — never the microphone object
   * itself, which is a fresh literal on every render of whoever owns the hook
   * and would resubscribe the meter constantly.
   */
  useEffect(() => {
    return subscribe(() => {
      const level = levelCircleRef.current;
      const cap = capCircleRef.current;
      if (level) {
        const peak = Math.min(1, Math.max(0, levelRef.current));
        level.setAttribute('stroke-dashoffset', String(LEVEL_CIRCUMFERENCE * (1 - peak)));
      }
      if (cap) {
        const spent = Math.min(1, Math.max(0, holdFractionRef.current));
        cap.setAttribute('stroke-dashoffset', String(CAP_CIRCUMFERENCE * (1 - spent)));
      }
    });
  }, [subscribe, levelRef, holdFractionRef]);

  /*
   * THE FINGER IS THE SOURCE OF TRUTH, NOT REACT STATE.
   *
   * `recording` only becomes true after `start()` has awaited
   * getUserMedia — which on the FIRST hold of a session is a permission
   * prompt, and can sit there for as long as it takes a child to read it and
   * decide. A release arriving in that window used to hit `if (!recording)
   * return` and be swallowed whole: the recorder started moments later and
   * never stopped, the browser's recording indicator stayed lit, and nothing
   * was ever sent. On the one feature whose entire promise is "it listens only
   * while you hold it", that is the worst bug available.
   *
   * So intent is tracked synchronously in a ref, and the async path checks it
   * when it lands. Let go before the microphone opens and it closes itself the
   * instant it opens.
   */
  const holdingRef = useRef(false);

  // Deliberately free of `recording`: this is called from paths where React
  // has not caught up yet, and asking it to would reintroduce the race.
  const finishHold = useCallback(() => {
    playPlatformSound('tutor_mic_close');
    duckTutorAmbient(false);
    void stop().then(onClip);
  }, [stop, onClip]);

  const beginHold = useCallback(() => {
    if (!available || recording || holdingRef.current) return;
    holdingRef.current = true;
    if (state === 'speaking') onInterrupt?.();
    playPlatformSound('tutor_mic_open');
    // The bed drops for the whole hold so the learner's own voice is the
    // loudest thing in the mix while they are the one talking.
    duckTutorAmbient(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
    void start().then(
      () => {
        // They let go while the browser was still asking. Close it now.
        if (!holdingRef.current) finishHold();
      },
      () => {
        // Permission refused, or no device. `useMicrophone` already reports
        // this through `permission`; all this has to do is not leave the UI
        // believing a hold is in progress.
        holdingRef.current = false;
        duckTutorAmbient(false);
      },
    );
  }, [available, recording, state, onInterrupt, start, finishHold]);

  /*
   * EITHER condition ends a hold, and it has to be either.
   *
   * `holdingRef` alone misses the case the pointercancel and blur tests exist
   * for: the recorder IS running and no hold is registered — the OS took the
   * pointer, focus left the orb, something interrupted. A live microphone with
   * nobody holding it is precisely the state this feature promises cannot
   * happen, so it is closed on sight.
   *
   * `recording` alone misses the opposite case: the learner let go while
   * getUserMedia was still awaiting, so nothing is recording YET and the
   * continuation in `beginHold` is what will close it.
   */
  const endHold = useCallback(() => {
    if (!holdingRef.current && !recording) return;
    holdingRef.current = false;
    if (recording) finishHold();
  }, [recording, finishHold]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!available) return;
    /*
     * Capture the pointer, so a thumb that slides off the orb mid-sentence
     * still delivers its `pointerup` here. Without it the hold never ends, the
     * recording indicator stays lit, and the learner's turn is never sent.
     */
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    beginHold();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!available || !TALK_KEYS.has(event.code)) return;
    // Space scrolls the page and Enter re-fires the button's click; both are
    // suppressed here so the key means one thing only while the orb has focus.
    event.preventDefault();
    if (event.repeat) return;
    if (holdingRef.current || recording) {
      endHold();
      return;
    }
    keyDownAtRef.current = Date.now();
    beginHold();
  };

  const onKeyUp = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!available || !TALK_KEYS.has(event.code)) return;
    event.preventDefault();
    // Either, for the reason `endHold` explains: the permission prompt can
    // outlast the keypress, and a latched hold survives a re-render.
    if (!holdingRef.current && !recording) return;
    if (Date.now() - keyDownAtRef.current >= KEY_HOLD_MS) endHold();
    // Otherwise it was a tap: the hold LATCHES and the next press ends it.
  };

  /** What "at rest" says here. Every other state means the same everywhere. */
  const idle = idleCopy ?? t('tutor.conversation.holdToTalk');

  const label = available
    ? state === 'listening'
      ? t('tutor.mic.listening')
      : state === 'thinking'
        ? t('tutor.mic.thinking')
        : state === 'speaking'
          ? t('tutor.mic.speaking')
          : idle
    : t('tutor.mic.unavailableLabel');

  /*
   * One line, always. When the orb is blocked this is the honest reason.
   *
   * A caller-supplied line wins, because it can say something narrower: "the
   * conversation has not started yet" is true and checkable, where any of
   * Core's three would be a confident wrong sentence. Failing that, the three
   * policy answers are genuinely different — the agreement protecting
   * children's voices is not signed, no guardian has said yes yet, or no
   * provider is configured. Policy is checked first upstream, and this mirrors
   * that order rather than re-deciding it.
   */
  const status = !available
    ? (blockedCopy ??
      (blockedReason === 'POLICY_BLOCKED'
        ? t('tutor.offers.voicePolicyBlocked')
        : blockedReason === 'CONSENT_REQUIRED'
          ? t('tutor.offers.voiceNeedsConsent')
          : t('tutor.offers.voiceUnavailable')))
    : state === 'listening'
      ? t('tutor.mic.releaseToSend')
      : state === 'thinking'
        ? t('tutor.mic.thinking')
        : state === 'speaking'
          ? t('tutor.mic.speaking')
          : idle;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <style>{ORB_KEYFRAMES}</style>

      <HudPlate
        as="button"
        shape="orb"
        /*
         * `none` is legal here because the orb carries no text — the icon is
         * aria-hidden and the words live in the plate below. The opaque floor
         * the contrast rule demands is composed explicitly below instead, so
         * the rings can sit outside it.
         */
        floor="none"
        aria-label={label}
        aria-disabled={!available || undefined}
        aria-pressed={available ? recording : undefined}
        aria-describedby={`${statusId} ${hintId}`}
        onPointerDown={onPointerDown}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        // Losing focus mid-latch would leave the microphone open with no
        // visible owner, which is the exact thing push-to-talk exists to avoid.
        onBlur={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        className={cn(
          'relative grid h-24 w-24 place-items-center lg:h-28 lg:w-28',
          !available && 'cursor-not-allowed',
          state === 'speaking' && 'opacity-60',
        )}
      >
        <span
          /*
           * The face is inset far enough to clear both rings.
           *
           * At `inset-1.5` the level meter fell INSIDE the fill, and the fill
           * turns the same red as the meter the moment recording starts — a
           * meter that disappears exactly when it becomes useful. The rings now
           * ride the glass band, where their track is a known token in both
           * themes instead of whatever the orb is currently coloured.
           */
          className={cn(
            'absolute inset-4 grid place-items-center rounded-full transition-colors',
            // The dashed ring is the SVG track, not a second border here: two
            // concentric dashed circles read as a rendering glitch rather than
            // as one clear "not right now".
            !available
              ? 'bg-surface text-content-muted'
              : recording
                ? 'bg-error text-on-error'
                : 'bg-accent text-on-accent',
            state === 'idle' && 'lf-mic-breathe',
          )}
        >
          {state === 'thinking' ? (
            <span className="lf-mic-dot h-3 w-3 rounded-full bg-on-accent" />
          ) : (
            <Icon
              name={!available ? 'mic_off' : recording ? 'graphic_eq' : 'mic'}
              className="!text-[28px] lg:!text-[32px]"
            />
          )}
        </span>

        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full',
            state === 'thinking' && 'lf-mic-spin',
          )}
        >
          <g transform="rotate(-90 50 50)">
            {/* The track. Dashed when the orb is unavailable: a broken ring
                reads as "not now" at a glance, before any word is read. */}
            <circle
              cx="50"
              cy="50"
              r={CAP_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeDasharray={available ? undefined : '4 6'}
              className="stroke-outline"
            />
            {/* Outer, thin: how much of the wire cap this hold has spent. */}
            <circle
              ref={capCircleRef}
              cx="50"
              cy="50"
              r={CAP_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={CAP_CIRCUMFERENCE}
              strokeDashoffset={CAP_CIRCUMFERENCE}
              className="stroke-warning"
            />
            {/* Inner, thick: the live level, so silence is visibly different
                from a microphone that is not working. */}
            <circle
              ref={levelCircleRef}
              cx="50"
              cy="50"
              r={LEVEL_RADIUS}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={LEVEL_CIRCUMFERENCE}
              strokeDashoffset={LEVEL_CIRCUMFERENCE}
              className="stroke-error"
            />
          </g>
        </svg>
      </HudPlate>

      {/*
        The status line is also the visual twin of every sound this control
        makes. Sound is an accent here and never load-bearing: a muted device,
        a blocked autoplay policy or a deaf learner must lose nothing.

        It is a LIVE REGION ONLY WHEN THE ORB IS BLOCKED. Losing the microphone
        mid-session — a guardian revoking consent, a provider going down — is
        news, and it has to reach someone who is not looking at the orb. The
        ordinary idle/listening/thinking cycle is not: `aria-pressed` and the
        button's own name already carry it, and announcing it again on every
        turn talks over the tutor.

        A blocked reason is a sentence, not a label, so it gets the plate's
        wider measure. Wrapping one at a chip's 22ch on a 375px screen builds a
        seven-line tower under the largest control on the page.
      */}
      <HudPlate
        id={statusId}
        shape={available ? 'chip' : 'plate'}
        role={available ? undefined : 'status'}
        className="pointer-events-none"
      >
        <span className="lf-caption">{status}</span>
      </HudPlate>

      <span id={hintId} className="sr-only">
        {t('tutor.mic.keyboardHint')}
      </span>
    </div>
  );
}

/*
 * Scoped keyframes rather than new entries in index.css, because index.css is
 * shared and this motion belongs to one control. The reduced-motion block is
 * inside the same sheet so the two can never drift apart: the breathing, the
 * thinking spin and the pulsing dot all stop together, and every one of them
 * has a non-moving twin (colour, icon, and the status line) carrying the same
 * information.
 */
const ORB_KEYFRAMES = `
@keyframes lf-mic-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes lf-mic-spin { to { transform: rotate(360deg); } }
@keyframes lf-mic-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.7); } }
.lf-mic-breathe { animation: lf-mic-breathe 4s var(--lf-ease) infinite; }
.lf-mic-spin { animation: lf-mic-spin 1.2s linear infinite; transform-origin: 50% 50%; }
.lf-mic-dot { animation: lf-mic-dot 1.2s var(--lf-ease) infinite; }
@media (prefers-reduced-motion: reduce) {
  .lf-mic-breathe, .lf-mic-spin, .lf-mic-dot { animation: none; }
}
`;
