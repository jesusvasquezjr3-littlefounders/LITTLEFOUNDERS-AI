import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';

/*
 * The tutor's 2D FACE — the articulating mouth, cropped to the head.
 *
 * WHY IT EXISTS AS ITS OWN COMPONENT. `liruf` and `dina` have no mouth in 3D
 * (/TUTOR_3D.md §3.1, six techniques exhausted), and all four characters are
 * selectable as the speaking tutor (/ORACLE.md §0 decision 4). So for half the
 * cast the ONLY articulating mouth in the product is the 2D one, and
 * /ORACLE.md §2.2 names it as one of the three things that make shipping them
 * acceptable. That makes this an accessibility surface, not decoration.
 *
 * WHAT WAS WRONG WITH THE VERSION IT REPLACES, measured rather than argued.
 * The mouth was mounted as a whole-body `CharacterActor` in a 56 px box inside
 * the lesson plate. Measured on `/dev/tutor-lab` at 1280x800 in `conversing`:
 * the actor's box was 64x64 CSS px and Dr Rho's head group — `getBBox()` on
 * `#dr-rho-head-group-*` — is 196x183 of a 750x750 viewBox, so the head landed
 * at about 17 px and the mouth inside it at about 5 px. Five pixels of mouth is
 * not an articulation channel; it is a thumbnail of a character standing up.
 * The requirement was being honoured in the component tree and nowhere on the
 * screen.
 *
 * SO THE CROP IS MEASURED FROM THE ARTWORK, NEVER TABULATED. The four
 * characters are four independent SVGs with four different viewBoxes
 * (`0 0 550 550`, `-50 -50 500 500`, `-175 -125 750 750`, `-180 -100 500 500`)
 * and four different head transforms, so a table of magic numbers here would be
 * four chances to be wrong and would rot the first time an SVG is retouched.
 * Every one of them does have a head group whose id contains `head-group` —
 * they need it for their own look-at rigs — so this reads the head's rendered
 * rectangle and the artwork's rendered rectangle and solves for the transform
 * that puts one inside the other. It is /AGENTS.md §1.14's "derive the subject
 * from CONTENT" applied to geometry.
 *
 * IF IT CANNOT MEASURE, IT DOES NOT GUESS. No head group, a zero-sized box, or
 * a DOM with no layout (jsdom) leaves the figure untransformed — the previous
 * behaviour exactly, which is a smaller picture and never a wrong one.
 */

export interface TutorFaceProps {
  character: CharacterId;
  emotion: CharacterEmotion;
  /** Passed through so a nod or a wave still reads at this size. */
  action: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey: number;
  /** Drives the SVG mouth. This is the whole point of the component. */
  speaking: boolean;
  /** Sizing lives at the call site; this box is always square. */
  className?: string;
}

/**
 * How much of the box the head fills.
 *
 * Short of 1 on purpose. Zara's hair sway sits OUTSIDE her head group (it is
 * its own animated group in `ZaraVexCharacter`), so a crop that fits the head
 * group exactly would shave the top of her hair on every frame of the sway.
 * A tenth of the box in reserve costs nothing at this size and is the
 * difference between a portrait and a haircut.
 */
const HEAD_COVER = 0.82;

/**
 * How far up the box the eyes sit, as a fraction of its height.
 *
 * Centring the head's BOUNDING BOX centres the middle of the skull, which puts
 * the mouth — the part that is actually doing the work here — low in the frame
 * and often against the bottom edge. Sitting the head slightly high is the
 * ordinary portrait crop and it is what leaves the mouth in the middle third.
 */
const HEAD_CENTRE_Y = 0.46;

export function TutorFace({
  character,
  emotion,
  action,
  actionKey,
  speaking,
  className,
}: TutorFaceProps) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;

    /*
     * MEASURE UNTRANSFORMED, ALWAYS. `getBoundingClientRect` reports the
     * post-transform rectangle, so measuring while the previous crop is applied
     * feeds the last answer back into the next one and the head walks out of
     * the box over a few re-fits.
     */
    inner.style.transform = '';

    const head = inner.querySelector<SVGGraphicsElement>('[id*="head-group"]');
    if (!head) return;

    const boxRect = box.getBoundingClientRect();
    const headRect = head.getBoundingClientRect();
    if (boxRect.width < 1 || headRect.width < 1 || headRect.height < 1) return;

    /*
     * THE ANCESTOR'S OWN SCALE HAS TO BE DIVIDED BACK OUT, and leaving it in is
     * a bug that only shows on some of the cast, which is the worst kind.
     *
     * This component's usual home is the caption, and the caption is an ANCHORED
     * node: `ScreenAnchor` multiplies its whole transform by the speaker's
     * distance from the camera, every frame. So `getBoundingClientRect` reports
     * SCREEN pixels — already multiplied — while a `translate()` written here is
     * applied in the element's OWN space and then multiplied again. The scale
     * factor is a ratio of two screen measurements and survives that untouched;
     * the two offsets do not.
     *
     * Measured on `/dev/tutor-lab` at 1280x800 in `conversing`: the caption over
     * Dr Rho renders at an anchor scale of 1.00 and his crop was perfect, while
     * Dina's shot stands further off at 0.71 and her head sat hard against the
     * right edge of the box with her jaw cut off — the same arithmetic, 1.4x too
     * far. `offsetWidth` is the untransformed layout width, so their ratio is
     * exactly the multiplier to undo.
     */
    const layoutWidth = box.offsetWidth || boxRect.width;
    const anchorScale = boxRect.width / layoutWidth;
    if (!(anchorScale > 0)) return;

    const scale = (boxRect.width * HEAD_COVER) / Math.max(headRect.width, headRect.height);
    const headX = headRect.left + headRect.width / 2 - boxRect.left;
    const headY = headRect.top + headRect.height / 2 - boxRect.top;

    const x = (boxRect.width / 2 - headX * scale) / anchorScale;
    const y = (boxRect.height * HEAD_CENTRE_Y - headY * scale) / anchorScale;
    inner.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  }, []);

  /*
   * RE-FIT ON THE CHARACTER AND ON THE BOX, AND ON NOTHING ELSE.
   *
   * Deliberately NOT on `action`: `CharacterActor` runs its one-shot actions as
   * CSS keyframes on the element this wrapper contains, so a measurement taken
   * mid-bounce would bake that frame's offset into the crop and leave it there
   * after the animation ended. Emotions only move features inside the head, and
   * the reserve above absorbs them.
   */
  useLayoutEffect(() => {
    fit();
    // The SVG is inline, so there is nothing to load — but the first layout can
    // land after this effect on a cold mount, and a second pass is one frame.
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [fit, character]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <span
      ref={boxRef}
      /*
       * ARIA-HIDDEN, and that is the correct call rather than a shortcut. The
       * plate this sits in is the live region carrying the sentence; naming the
       * face as well would make a screen reader announce the character on every
       * turn, in front of the words. It is a channel for a learner who is
       * LOOKING, and the learner who is not looking already has a better one.
       */
      aria-hidden="true"
      className={cn('relative block shrink-0 overflow-hidden rounded-md', className)}
    >
      <span ref={innerRef} className="absolute left-0 top-0 block h-full w-full origin-top-left">
        <CharacterActor
          character={character}
          emotion={emotion}
          action={action}
          actionKey={actionKey}
          speaking={speaking}
          size="fill"
          // The per-frame mouse-follow rig is charm on a marketing page. Here it
          // would also move the head out from under a crop measured once.
          enableMouseTracking={false}
        />
      </span>
    </span>
  );
}
