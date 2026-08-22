import { createElement, forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The one glass primitive every in-scene control is built from: chip, plate,
 * orb, sheet. Having exactly one keeps the HUD reading as a single material
 * rather than as a pile of differently-frosted rectangles, and it is the only
 * way the contrast rule below can be guaranteed rather than remembered.
 *
 * THE GLASS IS THE FRAME. THE TEXT SITS ON AN OPAQUE FLOOR.
 *
 * `.lf-glass` is `surface/78%` plus a blur — a translucent fill whose effective
 * colour is 22% whatever is behind it. Behind a HUD control is a moving,
 * rotating, relit 3D island, so the same caption is over pale sand in one frame
 * and a dark rock in the next. There is no contrast ratio to compute, because
 * there is no second colour: it changes at 60fps. So the plate renders TWO
 * layers. The outer one is the glass frame, carrying the blur, the rim light
 * and the hairline edge, and it carries no text. The inner one is an OPAQUE
 * design token, and every word sits on that. Contrast is then a fixed number
 * against a known token, which is what /DESIGN.md §Colors already requires of
 * every other surface in the product.
 *
 * IT WRAPS. IT NEVER TRUNCATES.
 *
 * `personalize.lightTitle` is 9 characters in en-US ("The light"), 6 in es-MX
 * and 5 in pt-BR: a 1.8x swing on one of the shortest labels in the whole
 * product, and it runs the other way just as often. Any plate sized to fit one
 * locale's string clips another's, and an ellipsis in the middle of a two-word
 * control is not a smaller label, it is a control with no name. Widths are
 * therefore expressed in `ch` against a viewport clamp, and the content wraps
 * to a second line rather than losing a word.
 */

/** Frame density. The shape decides radius and padding, never colour. */
export type HudPlateShape = 'chip' | 'plate' | 'orb' | 'sheet';

/**
 * The OPAQUE token behind the content.
 *
 * `none` is for pure chrome only — a plate carrying no text, such as a ring or
 * a drag handle. Anything with a word in it takes a real floor.
 */
export type HudPlateFloor = 'surface' | 'sunken' | 'accent' | 'none';

export type HudPlateElement = 'div' | 'section' | 'aside' | 'button';

export interface HudPlateProps extends HTMLAttributes<HTMLElement> {
  as?: HudPlateElement;
  shape?: HudPlateShape;
  floor?: HudPlateFloor;
  /**
   * Only meaningful when `as="button"`. Defaulted explicitly so an in-scene
   * control dropped inside the composer's form can never submit it.
   */
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Classes for the opaque floor, e.g. a bespoke padding or a fixed size. */
  floorClassName?: string;
  children?: ReactNode;
}

/** Outer glass ring: radius plus the sliver of padding that makes it read as a frame. */
const FRAME: Record<HudPlateShape, string> = {
  chip: 'rounded-full p-0.5',
  plate: 'rounded-lg p-1',
  orb: 'rounded-full p-0.5',
  sheet: 'rounded-xl p-1',
};

/*
 * Inner floor radius is one token DOWN from the frame's, which is what keeps
 * the two curves concentric across the 4px of padding. Radii are a closed set
 * (/DESIGN.md front matter), so the inner curve is the nearest legal token
 * rather than an arithmetically perfect arbitrary value.
 */
const CORE: Record<HudPlateShape, string> = {
  chip: 'rounded-full px-3 py-1.5',
  plate: 'rounded-md px-4 py-3',
  orb: 'rounded-full',
  sheet: 'rounded-lg px-5 py-4',
};

const FLOOR: Record<HudPlateFloor, string> = {
  surface: 'bg-surface text-content',
  sunken: 'bg-surface-sunken text-content',
  accent: 'bg-accent text-on-accent',
  none: '',
};

/**
 * Reading width, in characters, so the measure holds in every locale rather
 * than in the one it was designed against. The viewport clamp is what stops a
 * long Portuguese label from pushing the document wider than the screen at
 * 375px, which §1.11 forbids outright.
 */
const MEASURE: Record<HudPlateShape, string> = {
  chip: 'max-w-[min(22ch,72vw)]',
  plate: 'max-w-[min(38ch,86vw)]',
  orb: '',
  sheet: 'max-w-[min(44ch,92vw)]',
};

export const HudPlate = forwardRef<HTMLElement, HudPlateProps>(function HudPlate(
  {
    as = 'div',
    shape = 'plate',
    floor = 'surface',
    type = 'button',
    disabled = false,
    className,
    floorClassName,
    children,
    ...rest
  },
  ref,
) {
  const interactive = as === 'button';

  const frame = cn(
    'lf-glass shadow-glass-sm',
    FRAME[shape],
    MEASURE[shape],
    // Hover-only affordances are prohibited (§1.11): the press physics from the
    // closed motion set carry the whole interaction, and they work on a thumb.
    interactive && 'min-h-11 min-w-11 active:translate-y-px disabled:pointer-events-none',
    className,
  );

  const core = cn(
    'flex items-center justify-center gap-2 text-center',
    // Wrapping, never truncating. `break-words` is the backstop for a single
    // token longer than the measure — a URL, a compound noun — which would
    // otherwise widen the plate instead of breaking.
    'whitespace-normal break-words',
    CORE[shape],
    FLOOR[floor],
    floorClassName,
  );

  return createElement(
    as,
    {
      ref,
      className: frame,
      // `type` and `disabled` belong to form controls. Spreading them onto a
      // div would put React's unknown-attribute warning in the console of every
      // session, which is how a real warning stops being read.
      ...(interactive ? { type, disabled } : {}),
      ...rest,
    },
    floor === 'none' ? children : <span className={core}>{children}</span>,
  );
});
