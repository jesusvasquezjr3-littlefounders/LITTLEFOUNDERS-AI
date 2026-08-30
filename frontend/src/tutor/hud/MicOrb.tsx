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
 *
 * IT IS ONE SURFACE, AND UNTIL 2026-08-22 IT WAS TWO (/DESIGN.md §Lumen → What
 * to delete). A 96 px orb with a separate plate underneath spelling out its own
 * name — "Start talking", "Hold to talk" — is two surfaces for one control, and
 * it was on screen in five of the seven phases. The name belongs to the orb: it
 * is the button's accessible name, and the glyph is what a learner reads.
 *
 * THE REASON, WHEN THERE IS ONE, STAYS — INSIDE THE ORB'S OWN SURFACE. A
 * microphone that cannot be used has to say why (/ORACLE.md §14), and that is a
 * sentence rather than a name, so it cannot live on the button. It is rendered
 * on ONE plate that CONTAINS the orb rather than on a second plate beside it,
 * which is the difference between a control that explains itself and a control
 * with a caption stuck to its shoe. In that form the ring is a plain element,
 * because /DESIGN.md forbids stacking glass on glass: the plate is the
 * material, the ring is drawn on it.
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
  /**
   * A line the orb must show even though it is usable.
   *
   * Exactly one thing needs this today: the browser itself refusing the
   * microphone after the learner was asked. It used to be a plate of its own in
   * the dock (`StageShell`), which is the same "two surfaces for one control"
   * the resting label plate was deleted for — and worse, because it appeared
   * BESIDE an orb that still looked perfectly usable. It is rendered here, in
   * the orb's own surface, by the same mechanism the blocked reason uses.
   */
  notice?: string | null;
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
  notice = null,
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
    /*
     * 'thinking' is not 'unavailable' — `available` stays true so the orb
     * keeps its own distinct spinner rather than looking broken — but a
     * hold started here is a dead end. Found by adversarial review,
     * 2026-08-30 (MEDIUM): unlike 'speaking' (deliberately interruptible,
     * via `onInterrupt` below), nothing sends an `interrupt` frame for a
     * hold begun while a reply is already in flight, so the server's own
     * one-turn-at-a-time claim correctly refuses the resulting submission —
     * but only AFTER the child has gone through the full "you are being
     * heard" ritual (sound, haptics, ducked ambience, a live meter) for a
     * turn that was always going to be discarded.
     */
    if (!available || recording || holdingRef.current || state === 'thinking') return;
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
   * THE ONE THING THE ORB PRINTS, AND USUALLY IT PRINTS NOTHING.
   *
   * A usable microphone does not need a caption: `label` above is its
   * accessible name, the glyph is what a learner reads, and the state is
   * carried by colour, by the breathing, by the meter ring and by
   * `aria-pressed`. Printing "Hold to talk" under it was a second surface
   * saying what the first surface already is (/DESIGN.md §Lumen).
   *
   * A microphone that CANNOT be used is the opposite case and always was: an
   * absent explanation teaches a child the feature does not exist. A
   * caller-supplied line wins, because it can say something narrower — "the
   * conversation has not started yet" is true and checkable, where any of
   * Core's three would be a confident wrong sentence. Failing that, the three
   * policy answers are genuinely different: the agreement protecting children's
   * voices is not signed, no guardian has said yes yet, or no provider is
   * configured. Policy is checked first upstream, and this mirrors that order
   * rather than re-deciding it.
   *
   * `notice` is the third case — usable, but the browser said no — and it is
   * news rather than a name, so it prints too.
   */
  const reason = !available
    ? (blockedCopy ??
      (blockedReason === 'POLICY_BLOCKED'
        ? t('tutor.offers.voicePolicyBlocked')
        : blockedReason === 'CONSENT_REQUIRED'
          ? t('tutor.offers.voiceNeedsConsent')
          : t('tutor.offers.voiceUnavailable')))
    : (notice ?? null);

  const orb = (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!available || undefined}
      aria-pressed={available ? recording : undefined}
      aria-describedby={reason ? `${statusId} ${hintId}` : hintId}
      onPointerDown={onPointerDown}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      // Losing focus mid-latch would leave the microphone open with no
      // visible owner, which is the exact thing push-to-talk exists to avoid.
      onBlur={endHold}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={cn(
        /*
         * IT IS THE MATERIAL ONLY WHEN IT STANDS ALONE. With a reason to print
         * the orb sits INSIDE a plate, and /DESIGN.md forbids stacking glass on
         * glass — two blurred layers over a moving island stop reading as one
         * material and start reading as a bug in the blur. There the ring is
         * simply drawn on the plate.
         */
        !reason && 'lf-settle lf-lumen',
        'pointer-events-auto relative grid h-24 w-24 place-items-center rounded-full lg:h-28 lg:w-28',
        'active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
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
         * ride the outer band, where their track is a known token in both
         * themes instead of whatever the orb is currently coloured.
         */
        className={cn(
          'absolute inset-4 grid place-items-center rounded-full transition-colors',
          // Unavailable has NO disc. The dashed track alone says "not now", and
          // a filled circle behind a struck-through microphone reads as a
          // button that is merely a different colour today.
          !available
            ? 'text-content'
            : recording
              ? 'bg-error text-on-error'
              : 'bg-accent text-on-accent',
          state === 'idle' && available && 'lf-mic-breathe',
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
    </button>
  );

  const hint = (
    <span id={hintId} className="sr-only">
      {t('tutor.mic.keyboardHint')}
    </span>
  );

  /*
   * Nothing to explain: one circle, and it is the whole control.
   *
   * The wrapper is a bare box rather than a surface, so the only thing painted
   * here is the orb itself — which is the state five of the seven phases are
   * in, and 36 px of the dock's height back on every one of them.
   */
  if (!reason) {
    /*
     * `shrink-0` is hard-coded HERE, not left to the caller, because it
     * protects something the caller cannot see from the outside: the 96 px
     * CIRCLE. A flex row that runs out of room shrinks WIDTH only, never
     * height, so a shrinkable orb sharing a tight row would flatten into an
     * oval before this component ever gets a say. The `reason` branch below
     * has no such constraint — a plate of TEXT is exactly what is supposed to
     * reflow when the row is tight — so it deliberately does NOT get this.
     */
    return (
      <div className={cn('flex shrink-0 flex-col items-center', className)}>
        <style>{ORB_KEYFRAMES}</style>
        {orb}
        {hint}
      </div>
    );
  }

  /*
   * There IS something to explain, so there is one plate and the orb is on it.
   *
   * `role="status"` on the line, always: losing the microphone mid-session — a
   * guardian revoking consent, a provider going down, the browser refusing —
   * is news, and it has to reach someone who is not looking at the orb. The
   * ordinary idle/listening/thinking cycle is deliberately NOT announced;
   * `aria-pressed` and the button's own name carry it, and repeating it every
   * turn talks over the tutor.
   */
  return (
    <HudPlate
      shape="plate"
      /*
       * `min-w-0`, NOT `shrink-0` — found live, at a phone width, sharing a
       * row with the composer (StageShell.tsx): this plate's own `max-w` is
       * `min(38ch,86vw)`, sized for standing ALONE, and a flex sibling that
       * refuses to shrink takes that full width regardless of what the
       * composer next to it needs — down to an unusable ~10 px input box.
       * `text-balance` on the reason line already expects to wrap; letting
       * this plate shrink is what lets it actually do that instead of
       * forcing one wide, un-wrapped row.
       */
      className={cn('pointer-events-none min-w-0 self-center', className)}
      // Tighter than the plate's own `py-4`: the ring is already 96 px of air
      // with a 28 px glyph in the middle of it, and the plate's job here is to
      // hold the two together, not to frame them.
      floorClassName="flex-col gap-2 py-3"
    >
      <style>{ORB_KEYFRAMES}</style>
      {orb}
      <span id={statusId} role="status" className="lf-action text-balance">
        {reason}
      </span>
      {hint}
    </HudPlate>
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
