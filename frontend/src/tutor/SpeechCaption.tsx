import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { HudPlate } from './hud/HudPlate';
import { TutorFace, type TutorFaceProps } from './TutorFace';
import type { WordTiming } from './types';

/*
 * The tutor's words, ABOVE the character's head.
 *
 * This is an accessibility requirement, not decoration (/ORACLE.md §1 step 4).
 * A deaf or hard-of-hearing learner must get the whole lesson, and a caption
 * that lives in a side panel makes them choose between watching the character
 * and reading what it said. Above the head, they are the same glance.
 *
 * IT IS AN HTML OVERLAY, NOT SCENE GEOMETRY. Text inside WebGL is a font-atlas
 * problem — glyph coverage for three locales, hinting, subpixel rendering,
 * scaling with the camera — and none of it buys anything here, because the
 * caption is always facing the viewer anyway. An absolutely-positioned div
 * over the canvas gets real text rendering, real text selection, real screen
 * reader output and real i18n for free.
 *
 * IT NOW RIDES THE SPEAKER'S OWN CROWN rather than the top edge of the layer,
 * and the crown is a PUBLISHED PLACE rather than an offset from the head. That
 * distinction is the whole fix: `lead.head` is the mid-head, so at a close-up
 * the crown is roughly 290 CSS px further up on a 1280 viewport and roughly 40
 * px further up at the establishing shot. Nudging the caption off the head by
 * any fixed number of pixels therefore puts it across the speaker's forehead in
 * exactly the shot a conversation spends most of its time in. Riding a point
 * the scene computes from the character's own height in metres makes the same
 * small CSS gap correct at every distance.
 * The previous version was `absolute inset-x-0 top-0`: correct while the stage
 * was a box with one character centred in it, and wrong the moment the stage
 * became the page, because the camera moves. A caption pinned to the viewport
 * while the subject travels ends up over the sky, over the sea, over the
 * lesson plate, or over the other character's face, and it never once points at
 * whoever is talking. The anchor channel projects a NAMED place in the scene
 * onto the viewport every frame and writes this node's transform directly, so
 * the caption stays attached through a swoop without React re-rendering once.
 *
 * WHAT DID NOT CHANGE, and must not: every aria attribute below. The live
 * region, the atomic announcement, the full sentence in an `sr-only` span
 * beside the aria-hidden typewriter, the reduced-motion instant reveal, and the
 * `turnSeq` dependency that replays a repeated sentence. The projection touches
 * layout; it must never touch semantics.
 *
 * The typewriter reveal is capped and interruptible: a caption that is still
 * typing when the next line arrives would fall behind the audio and stay
 * behind for the rest of the session.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT CARRIES THE 2D FACE NOW, AND IT IS THE ONLY SURFACE THAT PRINTS THE LINE
 * (2026-08-22 — /DESIGN.md §Lumen → *One line, one printing, two channels*).
 *
 * The owner's accessibility requirement is TWO channels: a caption above the
 * head, and the 2D animated head, for a deaf or hard-of-hearing learner. It was
 * being satisfied as two SURFACES that each printed the whole sentence — the
 * caption here and the bubble on the lesson plate — which at 1280x800 measured
 * 21 spoken words printed twice, 252 px apart, inside 142 words on screen. Two
 * channels is the requirement; two printings was an implementation of it, and
 * the wrong one: whichever copy the learner reads, the other is noise, and the
 * one in the plate was pushing the exercise below the fold to be noise.
 *
 * Both channels survive intact, in one place. The words are here, at
 * `lf-speech`, over the speaker. The mouth is here too, beside them, so a
 * learner reading the lips and a learner reading the words are looking at the
 * same 300 px of screen instead of choosing — which is the argument this file
 * has made about the caption's POSITION since it was written, now applied to
 * the mouth as well. What went is the duplicate sentence, not a channel.
 */

export interface SpeechCaptionProps {
  text: string | null;
  /** Bump when a NEW line starts, so the same text can replay. */
  turnSeq: number;
  /**
   * The named place the caption rides above.
   *
   * Defaults to the top of the speaking character's head. It is a prop rather
   * than a constant because the companion speaks in the replay director, and a
   * caption over the wrong character is worse than no caption at all.
   */
  slot?: AnchorId;
  /**
   * V4: WHERE THE CAPTION LIVES WHEN A LESSON SURFACE OWNS THE SCREEN.
   *
   * The anchored caption escapes fixed chrome with a hard budget — 25% of
   * the viewport's shorter side — and that budget is unbeatable against a
   * full-height docked panel (desktop) or a full-width sheet at FULL
   * (mobile): the escape refuses, the caption stays put, and at z-20 under
   * the z-30 surface the tutor's words are PAINTED OVER. Confirmed as the
   * top overlap mechanism in the owner's "elementos que se sobreponen".
   *
   * The caller knows deterministically when those surfaces are up, so it
   * says so, and the caption DOCKS: `'panel'` centres it in the space left
   * of the desktop panel; `'sheet'` pins it as a strip above the mobile
   * sheet. No geometry listening, no z escalation — the caption moves to
   * space nothing else claims.
   */
  docked?: 'panel' | 'sheet' | null;
  className?: string;
  /** Skips the reveal animation. Respected from prefers-reduced-motion too. */
  instant?: boolean;
  /**
   * The speaker's 2D face, articulating, beside the words.
   *
   * Optional because two callers have no character to show: the greeting on the
   * audition phase is spoken by whoever the learner has not chosen yet. When it
   * is supplied it is the product's ONLY articulating mouth for `liruf` and
   * `dina` (/TUTOR_3D.md §3.1), so it is an accessibility channel and not an
   * avatar — see `TutorFace`.
   */
  face?: TutorFaceProps | null;
  /**
   * Word-level timing for THIS turn's clip, or `null`/absent — the common
   * case (ORACLE.md §19.5): absent whenever the voice provider did not
   * return timing for this exact clip, which is every turn in production
   * today. `null` is a fact, never estimated — see `oracle/src/voice/
   * provider.ts`'s own `WordTiming` comment.
   *
   * When present (and `audioElement` is too), the reveal below tracks the
   * REAL playback position instead of the fixed-rate typewriter: the boundary
   * of what is shown IS the highlight — the last word revealed is the word
   * being said right now. No separate highlight colour is drawn on top of
   * already-shown words, for the same reason the typewriter never draws one:
   * a synced reveal that is occasionally a beat off (a network stall, a
   * decode delay) reads as a caption catching up, exactly like every caption
   * track a learner has ever seen; a highlighted PAST word sitting one beat
   * behind the actual audio would read as broken.
   */
  wordTimings?: WordTiming[] | null;
  /**
   * The stage's own `<audio>` element — see `TutorStageProps
   * .onAudioElementReady`. Required (alongside `wordTimings`) for the synced
   * reveal; without it this component cannot read a playback position at
   * all, and falls back to the typewriter exactly as if `wordTimings` were
   * absent.
   */
  audioElement?: HTMLAudioElement | null;
  /**
   * True only while this turn's clip is ACTUALLY playing — not merely
   * requested. `false` covers three different reasons (the clip has not
   * started, the browser blocked autoplay, the clip already ended) and all
   * three get the SAME treatment here: show the complete sentence rather
   * than trust a `currentTime` that is not actually advancing. A caption
   * that went silent because playback was blocked is the §1 step 4
   * accessibility promise broken for the one learner who has no other way
   * to read what was said.
   */
  speaking?: boolean;
}

/** Fast enough to keep up with speech, slow enough to read as "being said". */
const CHARS_PER_TICK = 2;
const TICK_MS = 24;

/*
 * The smallest the tutor's own voice may RENDER at, once the depth scale has
 * had its say, in CSS pixels.
 *
 * `lf-action` (/DESIGN.md §Lumen -> Type) — the size a CONTROL is set at on
 * this layer, and therefore the floor under anything a learner is meant to
 * read over a moving render. `ScreenAnchor`'s own default is 12, which is
 * right for a two-word chip and wrong here twice over: the same section calls
 * 12 px on this layer "not a size, an apology" and has the stylesheet
 * neutralise `lf-caption` to stop it, and it calls this node "the largest type
 * on the stage after the character".
 *
 * A chip never reaches 12 anyway, because the 44 px tap floor stops it first.
 * Nobody presses a caption, so nothing stopped this one: measured on
 * `/dev/tutor-lab` at 375x812 with an adaptation question up, the two-shot's
 * stand-off clamped it to exactly 12.0 px — below a world chip's 13.7 — while
 * the same tutor's question, one plate below it in the dock, was 19 px.
 */
const MIN_SPEECH_PX = 15;

export function SpeechCaption({
  text,
  turnSeq,
  slot = 'lead.crown',
  className,
  instant = false,
  face = null,
  docked = null,
  wordTimings = null,
  audioElement = null,
  speaking = false,
 }: SpeechCaptionProps) {
  const [shown, setShown] = useState('');
  const timerRef = useRef<number | null>(null);

  const reducedMotion =
    instant || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  /*
   * WHETHER THIS TURN HAS SOMETHING REAL TO SYNC TO.
   *
   * All three conditions are load-bearing: no timing (the common case today
   * — ORACLE.md §19.5), no element (the stage has not mounted one, or this
   * caller is one of the two with no stage at all), or reduced motion (the
   * boundary of a synced reveal moves exactly like the typewriter's does,
   * and a learner who asked for less motion gets the same instant full
   * sentence either way) all fall back to the UNTOUCHED typewriter effect
   * below — not a variant of the synced path, the literal same code that
   * already ran before this feature existed.
   */
  const hasWordSync = Boolean(wordTimings && wordTimings.length > 0 && audioElement) && !reducedMotion;
  /*
   * ABOVE the crown, and OUT OF THE WAY of the fixed chrome.
   *
   * `place: 'above'` replaces the `w-0 h-0` wrapper this used to hang the plate
   * out of. That trick positioned correctly and measured as a POINT, so the
   * caption — the largest anchored surface on the route — had zero half-extents:
   * it was culled on its centre rather than on its box, and it had no box to
   * compare against anything else at all.
   *
   * `avoid` is the caption's alone on this route, and it is the answer to a
   * measured collision: at 375 px in `introducing` the plate landed at
   * (54, 31, 266, 68) and the way-out chip at (16, 16, 155, 44), so "Hi Robi!
   * I'm Dr." sat underneath the word "Leave" on three of three fresh mounts. It
   * may not be solved the way every other anchored surface solves being covered
   * — hiding — because this is the whole lesson for a deaf or hard-of-hearing
   * learner (/ORACLE.md §1 step 4). So it moves, by the smallest amount that
   * clears.
   */
  /*
   * `keepInFrame` is the other half of the same sentence, and it was missing.
   * `avoid` gets the caption out from under the fixed chrome; nothing got it out
   * from under the frame EDGE, so the ordinary cull ran instead. Measured on
   * `/dev/tutor-lab` at 1280x800 during `conversing`: the closeup fills the frame
   * with the tutor's face, the crown is above the top of the screen, and the
   * caption node was `hidden` and `inert` — the tutor's words on a desktop
   * existed only inside the lesson plate, and the plate rests CLOSED on a phone.
   * It now slides down to the edge and stays.
   */
  const anchorRef = useAnchorSlot(slot, {
    place: 'above',
    avoid: true,
    keepInFrame: true,
    minTextPx: MIN_SPEECH_PX,
  });

  useEffect(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (!text) {
      setShown('');
      return;
    }
    // The synced effect below owns `shown` for this turn instead — see its
    // own comment. Every line under this point is UNCHANGED from before
    // word timing existed, for every turn that still has none.
    if (hasWordSync) return;

    if (reducedMotion) {
      setShown(text);
      return;
    }

    let index = 0;
    setShown('');
    timerRef.current = window.setInterval(() => {
      index += CHARS_PER_TICK;
      setShown(text.slice(0, index));
      if (index >= text.length && timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, TICK_MS);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // turnSeq is in the deps on purpose: the same sentence said twice must
    // replay, and text alone would not change.
  }, [text, turnSeq, instant, hasWordSync, reducedMotion]);

  /*
   * THE SYNCED REVEAL. Runs only while `hasWordSync` is true (see its own
   * comment) — inert, start to finish, on every turn that has no word
   * timing, which is every turn in production today.
   *
   * The reveal boundary IS the highlight: `shown` is always an exact prefix
   * of the joined tokens, so the last token in it is the word being said
   * right now. No word is ever coloured differently from another — see
   * `SpeechCaptionProps.wordTimings`'s own comment on why a synced reveal
   * beats a persistent highlight sitting on top of already-visible text.
   *
   * `!speaking` is the escape hatch, checked BEFORE reading `currentTime` at
   * all: it covers three different reasons audio might not be advancing
   * (not started yet, blocked by the browser's autoplay policy, already
   * ended) and every one of them gets the same answer — show the complete
   * sentence NOW. The alternative (trusting a `currentTime` stuck at 0
   * because `play()` was silently refused) is a caption that never reveals
   * a single word for the one learner who has no sound to fall back on.
   */
  useEffect(() => {
    if (!hasWordSync || !wordTimings || !audioElement) return;

    if (!speaking) {
      setShown(wordTimings.map((token) => token.word).join(''));
      return;
    }

    let frame = 0;
    // -2: distinct from every real index (-1 = nothing yet, 0..n-1 = a word),
    // so the FIRST tick always writes, including the "nothing yet" case.
    let lastIndex = -2;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const nowMs = audioElement.currentTime * 1000;

      // The last token whose own start has already passed. `for...of` over
      // `.entries()` rather than indexing by `i`, so `noUncheckedIndexedAccess`
      // cannot make this the same defensive-parsing bug `inworld.ts` guards
      // against on the way IN — here it would silently mis-highlight instead.
      let index = -1;
      for (const [i, token] of wordTimings.entries()) {
        if (token.startMs <= nowMs) index = i;
        else break;
      }

      if (index !== lastIndex) {
        lastIndex = index;
        setShown(
          index === -1 ? '' : wordTimings.slice(0, index + 1).map((token) => token.word).join(''),
        );
      }
    };
    tick();

    return () => cancelAnimationFrame(frame);
  }, [hasWordSync, wordTimings, audioElement, speaking]);

  if (!text) return null;

  return (
    <div
      /*
       * DOCKED MODE DETACHES FROM THE PROJECTOR. The anchor slot keeps its
       * registration alive elsewhere, but this node stops handing it a ref,
       * so no per-frame transform fights the fixed placement below.
       */
      ref={docked === null ? anchorRef : undefined}
      /*
       * THE ANCHORED NODE IS THE CAPTION, box and all. It used to be a 0x0
       * wrapper with this column absolutely positioned up out of it — which put
       * the plate in the right place and told the projector the caption was a
       * point, so it was culled on its centre and could not be compared with
       * anything. `place: 'above'` moves that arithmetic into the projector,
       * where the node's measured height is already known, and leaves a real
       * rectangle behind for the cull test and the HUD escape to work on.
       *
       * The eight-pixel gap over the crown is the projector's now
       * (`HUD_SURFACE_GAP_PX`) and reads correctly whether the character fills
       * the frame or is standing across the island. The width is capped so a
       * long sentence wraps to a second line inside the plate instead of running
       * off both edges at 375 px, which `w-max` alone allows.
       *
       * `lf-speech` sits on THIS element rather than on the text inside,
       * because the projector reads this node's computed font size once at
       * registration to work out how far it may shrink the node before the
       * caption stops being readable. Put the type class deeper and it measures
       * the wrapper's inherited size instead, and the readability floor is
       * computed against a font nobody is reading.
       *
       * IT IS `lf-speech` AND NOT `lf-body` (/DESIGN.md §Lumen → Type). This is
       * the tutor talking, and until the token existed the tutor's own voice
       * was being set in the same 16/400 the product uses for a paragraph in a
       * settings page — which is why the largest thing said on a cinematic
       * stage read as chat copy. 19 px at 500, 21 from `sm:`, and it is the
       * biggest type on the stage after the character, which is the order the
       * two should be in.
       */
      className={cn(
        'lf-speech pointer-events-none fixed z-20 flex flex-col items-center',
        docked === null &&
          'left-0 top-0 w-max max-w-[min(88vw,32rem)] will-change-transform',
        /*
         * Left of the docked desktop panel: the same width formula the panel
         * and the dock use, so all three agree on where the free space is.
         */
        docked === 'panel' &&
          'left-0 right-[min(27.5rem,34vw)] top-20 mx-auto w-max max-w-[min(60vw,32rem)]',
        // Above the mobile sheet: a strip under the exit chip, full care width.
        docked === 'sheet' && 'inset-x-0 top-16 mx-auto w-max max-w-[calc(100vw-2rem)]',
        className,
      )}
      style={docked === null ? undefined : { transform: 'none' }}
    >
      <HudPlate
        shape="plate"
        /*
         * aria-live="polite" and the FULL text, not the typewriter slice: a
         * screen reader must announce the sentence once, when it is complete,
         * not stutter through it two characters at a time.
         */
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none"
        // `gap-3` and not the plate's default `gap-2`: a face needs a little
        // more air beside a sentence than two words of a chip label do.
        floorClassName={face ? 'gap-3' : undefined}
      >
        {/* `self-start`: a face beside a four-line caption belongs at the top of
            the paragraph, the way a speaker's portrait does. Centred, it drifts
            to the middle of the block and reads as an illustration. */}
        {face && (
          <TutorFace
            {...face}
            /*
             * A TINTED RING, matching the design study's identity chip: an
             * indigo-tinted backplate and hairline around the speaker's
             * portrait, distinct from the plain photo it was. `bg-accent-soft`
             * only shows at the rounded corners the image itself doesn't
             * fill; the border is what reads as a chip rather than a crop.
             */
            className="h-11 w-11 self-start border border-accent/30 bg-accent-soft sm:h-14 sm:w-14"
          />
        )}
        {/*
          `text-start`, because a sentence beside a portrait is a line of prose
          and a centred paragraph with a ragged left edge against a face reads
          as a greetings card. Without a face the plate stays centred, which is
          what it has always been. The alignment is set here rather than through
          `floorClassName` on purpose: `HudPlate`'s core already carries
          `text-center`, and two text-align utilities on one element are settled
          by stylesheet order rather than by which one was written last.
        */}
        <span className={face ? 'min-w-0 flex-1 text-start' : undefined}>
          <span aria-hidden="true">{shown}</span>
          <span className="sr-only">{text}</span>
        </span>
      </HudPlate>

      {/*
        A short gradient tail down onto the crown. It is NOT a contrast scrim:
        the plate above is made of Lumen, whose alpha puts a FLOOR under the
        composite, so the ratio a moving render cannot give as a measurement it
        still gives as a bound (/DESIGN.md §Lumen). The tail's only job is
        attachment, so that at a two-shot the learner can see at a glance WHICH
        character the words belong to — and it is made of the scene's own shade
        rather than of `outline`, because it is the one part of the caption that
        actually touches the island.
      */}
      <span aria-hidden="true" className="lf-caption-tail h-6 w-0.5 rounded-full" />
    </div>
  );
}
