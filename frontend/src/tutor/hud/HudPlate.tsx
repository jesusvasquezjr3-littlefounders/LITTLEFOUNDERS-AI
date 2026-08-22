import { createElement, forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The one surface every in-scene control is made of: chip, plate, orb, sheet.
 * Having exactly one keeps the HUD reading as a single material rather than as
 * a pile of differently-frosted rectangles, and it is the only way the rules
 * below can be guaranteed rather than remembered fourteen times.
 *
 * IT IS MADE OF LUMEN (/DESIGN.md §Lumen). Not `.lf-glass`, which frosts a
 * panel sitting on a PAGE. This one sits on a WORLD: it lets a third of the
 * island through, blurred past legibility and stripped of hue, leans its fill
 * 6% toward the sky the island is standing under, wears the key light's colour
 * on its top edge, and drops a shadow made of the ground's own colour that
 * grows long as the sun sinks.
 *
 * ONE VISIBLE SURFACE, NOT TWO.
 *
 * The previous version was a glass FRAME around an OPAQUE core, because a
 * translucent plate over an orbiting camera was held to have no computable
 * contrast ratio. The premise was half right. There is no single background,
 * but alpha puts a FLOOR under the composite, so the ratio is computable as a
 * BOUND — 7.2:1 worst case in light at `--lf-lumen-alpha`, 5.4:1 in dark. The
 * text can therefore sit on the glass, and the 2 px lighter ring that used to
 * circle every control — the single loudest "sticker pasted on a photo" cue on
 * the route — is gone with it.
 *
 * The inner span survives as a LAYOUT box only. It carries padding and the
 * reading measure and nothing that paints, except when the plate is an action,
 * where it carries the solid fill.
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
 *
 * IT SETTLES, IT DOES NOT POP. The camera on this route is critically damped,
 * so chrome that appears instantly reads as a different product sharing the
 * screen. The entrance lives HERE rather than on the anchored wrapper, because
 * `ScreenAnchor` rewrites that wrapper's whole `transform` every frame and
 * would erase it.
 */

/** Frame density. The shape decides radius and padding, never colour. */
export type HudPlateShape = 'chip' | 'plate' | 'orb' | 'sheet';

/**
 * What the plate is made of.
 *
 * THREE VALUES, AND THAT IS THE WHOLE SET. `lumen` is the material. `accent` is
 * an ACTION — a solid object rather than one more window onto the island,
 * keeping only the seated shadow so it still belongs to the same light. `none`
 * is for a plate that composes its own interior (the lesson plate).
 *
 * `surface` and `sunken` used to be here as well: the names the opaque-floor
 * era used, kept as aliases of `lumen` so the material could land in one commit
 * instead of fourteen. They are gone with the applying pass. They rendered
 * identically, which is the problem — a call site that asks for `sunken` is a
 * call site that believes in a second, quieter tone of glass, and sooner or
 * later somebody makes that belief true. Hierarchy on this layer is the two
 * DENSITIES and nothing else.
 */
export type HudPlateFloor = 'lumen' | 'accent' | 'none';

/**
 * How much of the world the plate lets through, decided by how much text it
 * carries.
 *
 * `chrome` is the default and the one every label, chip and caption uses: 32%
 * transmission, ONE ink. `content-muted` does not survive that alpha over the
 * worst backdrop a render can produce, so it is prohibited there — which is the
 * rule doing its second job, because a label that needs a quieter second line
 * is a label with a second line to delete.
 *
 * `reading` is the ONE surface per phase carrying paragraphs — the lesson
 * plate, the transcript sheet. It closes to 14% transmission and earns
 * `content-muted` by doing so. The densest surface on screen being the one the
 * eye is meant to settle on is not a compromise; it is the hierarchy.
 */
export type HudPlateDensity = 'chrome' | 'reading';

export type HudPlateElement = 'div' | 'section' | 'aside' | 'button';

export interface HudPlateProps extends HTMLAttributes<HTMLElement> {
  as?: HudPlateElement;
  shape?: HudPlateShape;
  floor?: HudPlateFloor;
  /** Chrome by default; `reading` for the one surface per phase with paragraphs. */
  density?: HudPlateDensity;
  /**
   * Only meaningful when `as="button"`. Defaulted explicitly so an in-scene
   * control dropped inside the composer's form can never submit it.
   */
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** One of a group, and this is the chosen one. Draws the material's own ring. */
  selected?: boolean;
  /** Classes for the inner layout box, e.g. a bespoke padding or a fixed size. */
  floorClassName?: string;
  children?: ReactNode;
}

/**
 * THE SHAPE IS NOT A PILL, AND THAT IS THE POINT.
 *
 * /DESIGN.md makes `rounded-full` the shape of everything interactive and
 * small, and it is right everywhere the product is a page. Over a photographic
 * frame a capsule is the silhouette of a sticker: the eye reads a shape with no
 * corners as something applied to the picture, not something in it. A soft
 * rectangle at the `md` radius reads as a PANE, which is what this material is.
 * The orb keeps its circle because it is a physical object rather than a label,
 * and the sheet keeps `xl` because it is a piece of furniture.
 */
const FRAME: Record<HudPlateShape, string> = {
  chip: 'rounded-md',
  // `md` for the plate too, and that is a MEASUREMENT rather than a taste.
  // `lg` is 24 px, and a plate carrying one line is about 44 px tall — so a
  // 24 px radius on it IS a capsule, and half the HUD went on reading as pills
  // after the shape rule said it should not. 16 px cannot become a capsule
  // above 32 px of height, which is below the tap floor.
  plate: 'rounded-md',
  orb: 'rounded-full',
  // The two furniture shapes are large enough that a bigger radius stays a
  // radius. The sheet is the one surface that is a piece of furniture rather
  // than a label, and it is never short.
  sheet: 'rounded-lg',
};

/*
 * Padding lives entirely on the inner box now that the frame paints edge to
 * edge, and it is more generous than the pill era's. Space is most of what
 * separates an instrument from a toy, and the plates got fewer and larger in
 * the same pass that made them roomier.
 */
const CORE: Record<HudPlateShape, string> = {
  chip: 'rounded-[inherit] px-4 py-2.5',
  plate: 'rounded-[inherit] px-5 py-4',
  orb: 'rounded-[inherit]',
  sheet: 'rounded-[inherit] px-6 py-5',
};

const FILL: Record<HudPlateFloor, string> = {
  lumen: '',
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
    floor = 'lumen',
    // `sheet` is a reading surface by definition — it is the shape the
    // transcript and the lesson body use — so it defaults to the denser fill
    // rather than making every caller remember.
    density,
    type = 'button',
    disabled = false,
    selected,
    className,
    floorClassName,
    children,
    ...rest
  },
  ref,
) {
  const interactive = as === 'button';
  const action = floor === 'accent';
  const reading = (density ?? (shape === 'sheet' ? 'reading' : 'chrome')) === 'reading';

  const frame = cn(
    'lf-settle',
    'lf-lumen',
    reading && !action && 'lf-lumen-reading',
    action && 'lf-lumen-solid',
    selected && 'lf-lumen-selected',
    FRAME[shape],
    MEASURE[shape],
    /*
     * 48 px, not 44. The floor is 44 (/DESIGN.md §Layout, non-negotiable) and
     * an anchored control is ALSO scaled by its distance from the camera, so a
     * plate authored at exactly the floor renders under it the moment the
     * island is more than a close-up away. `ScreenAnchor` clamps that scale
     * against 44; authoring at 48 is what leaves the depth cue any room to
     * exist at all.
     *
     * Hover-only affordances are prohibited (§1.11): the press physics from
     * the closed motion set carry the whole interaction, and they work on a
     * thumb.
     */
    interactive && 'min-h-12 min-w-12 active:translate-y-px disabled:pointer-events-none',
    className,
  );

  const core = cn(
    'flex items-center justify-center gap-2 text-center',
    // Wrapping, never truncating. `break-words` is the backstop for a single
    // token longer than the measure — a URL, a compound noun — which would
    // otherwise widen the plate instead of breaking.
    'whitespace-normal break-words',
    CORE[shape],
    FILL[floor],
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
