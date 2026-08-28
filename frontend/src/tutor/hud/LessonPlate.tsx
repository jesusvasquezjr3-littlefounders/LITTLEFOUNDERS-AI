import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from './HudPlate';

/*
 * The surface a live lesson runs on, floating over the island.
 *
 * ON DESKTOP IT IS A DOCKED FULL-HEIGHT PANEL (owner sign-off 2026-08-28,
 * superseding two earlier positions in turn). The 2026-08-21 build put the
 * stage in one half of a `lg:grid-cols-[1fr_1fr]` split and was rejected for
 * its SILHOUETTE — a near-opaque slab down half the screen reads as a
 * dashboard. The correction floated a content-fitted 420 px plate in the
 * bottom-right corner, and the owner rejected THAT on use: the transcript
 * lived folded away, the conversation had no stable home, and the screen read
 * as disorganised. The docked panel keeps what the first rejection actually
 * taught — the material stays Lumen over a full-bleed canvas, never an opaque
 * slab, and the island keeps roughly two thirds of the width with the camera
 * composing the character into it — while giving the conversation, the
 * activity and the composer one permanent, ordered home on the breakpoint
 * that has room for all three.
 *
 * ON A PHONE IT IS A BOTTOM SHEET, because 420 px of floating plate on a 375 px
 * screen is the whole screen. Three detents from /DESIGN.md's `sheet-detents`:
 * PEEK where it rests, HALF for working, FULL for reading back a long
 * conversation. The learner drags it, and the camera composes around wherever
 * they left it.
 *
 * PEEK IS A SUMMARY ROW, NOT A CLIPPED PANEL, and that correction is what makes
 * resting there honest. An 88 px sheet used to be the top 88 px of the same
 * column — half a character's head and the first line of an exercise, sliced —
 * so the only way to find out what had arrived was to open it, and the sheet
 * therefore opened itself to 45% of the screen the moment anything did. Measured
 * on a 375x812 phone that left 227 px of island under a HUD on a route whose
 * entire premise is that the island IS the page. So at PEEK the body is not
 * shown at all: the sheet is one row that SAYS what is waiting and opens on a
 * tap, and the same phone keeps 560 px of island — everything above the sheet's
 * 88 px, its 16 px inset and the microphone dock riding over it. What the
 * learner loses at PEEK is the transcript log, which is a live region; the
 * caption over the speaker's crown is mounted in every phase and carries the
 * announcement, and the row itself announces an arrival politely, so nothing
 * that speaks goes silent.
 *
 * IT PUBLISHES ITS OWN RECTANGLE, and that is what keeps the tutor's head the
 * same size on screen whether or not an exercise is up. The camera reads the
 * published rect and aims into the FREE part of the frame instead of the
 * geometric centre, so an arriving lesson never appears to shove the character
 * out of the way to make room for itself. Publishing goes through
 * `SafeAreaContext`, which is a ref channel: a drag writes sixty rectangles a
 * second and not one of them re-renders anything.
 *
 * WHY THE HEIGHT IS WRITTEN IMPERATIVELY DURING A DRAG. The obvious version
 * holds the height in state and lets React apply it. A sheet is dragged, so
 * that is a `setState` per `pointermove`, which re-renders the whole
 * conversation (including the live exercise) on every frame of the gesture,
 * while the GPU is already drawing an island. The settled height IS state,
 * because it survives a re-render and it is what the content is laid out
 * against; only the in-between frames bypass React.
 */

/** The three heights a sheet may rest at (/DESIGN.md `layout.immersive.sheet-detents`). */
export const LESSON_PLATE_DETENTS = ['peek', 'half', 'full'] as const;
export type LessonPlateDetent = (typeof LESSON_PLATE_DETENTS)[number];

const PEEK_PX = 88;
const HALF_FRACTION = 0.45;
const FULL_FRACTION = 0.88;

/**
 * The gap under a sheet, matching `layout.immersive.hud-inset-mobile`.
 *
 * A sheet flush to the bottom edge is the platform convention and it is the
 * wrong one here: the point of this route is that the island is visible around
 * everything, and a slab welded to the bottom of the screen is the silhouette
 * that got the last version rejected, rotated ninety degrees.
 */
const SHEET_INSET_PX = 16;

/** Below this the plate is a sheet. `lg`, the same breakpoint Tailwind uses. */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** A pointer has to travel this far before the gesture stops being a tap. */
const DRAG_SLOP_PX = 4;

/**
 * What the sheet must always leave above itself, in CSS pixels.
 *
 * FOUND BY MEASURING, not by reasoning. The microphone cluster rides above the
 * sheet. At the FULL detent on a 375x812 phone the raw fractions put the sheet
 * at 715 px, which pushed the cluster to y = -155: the microphone, its status
 * line and the only way to type were all off the top of the screen at once.
 * Every gate was green through it.
 *
 * So the fractions are a target and this is the ceiling. FULL becomes about
 * 63vh on that phone rather than 88vh, which is still most of the screen for
 * reading a transcript, and the hero control is still on it.
 *
 * The number is deliberately NOT re-tightened now that the composer shares the
 * orb's row and the cluster measures 136 px rather than 192 px (measured on
 * `/dev/tutor-lab` at 375x812). The reserve has to hold for the WORST dock, not
 * the resting one: an adaptation question wrapping to three lines in pt-BR
 * stacks a plate and two answers on top of that row, and the FULL detent is
 * where a learner is least able to see what they pushed off the screen. What
 * the shorter cluster buys is spent on the scene at PEEK and HALF, where the
 * learner actually sits, rather than on 56 px more transcript.
 */
const STAGE_RESERVE_PX = 300;

type DetentHeights = Record<LessonPlateDetent, number>;

function detentHeights(): DetentHeights {
  // 812 is a phone, and it is only ever used where there is no window at all
  // (a server render, a test). Every real caller measures.
  const viewport = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 812;
  const ceiling = Math.max(PEEK_PX, viewport - STAGE_RESERVE_PX);
  const detent = (fraction: number) =>
    Math.min(ceiling, Math.max(PEEK_PX, Math.round(viewport * fraction)));

  return {
    peek: PEEK_PX,
    half: detent(HALF_FRACTION),
    full: detent(FULL_FRACTION),
  };
}

function sameHeights(a: DetentHeights, b: DetentHeights): boolean {
  return a.peek === b.peek && a.half === b.half && a.full === b.full;
}

/** The detent a released drag should settle into. */
export function nearestDetent(heightPx: number, heights: DetentHeights): LessonPlateDetent {
  let best: LessonPlateDetent = 'peek';
  let bestDistance = Infinity;
  for (const detent of LESSON_PLATE_DETENTS) {
    const distance = Math.abs(heights[detent] - heightPx);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = detent;
    }
  }
  return best;
}

function step(detent: LessonPlateDetent, direction: 1 | -1): LessonPlateDetent {
  const index = LESSON_PLATE_DETENTS.indexOf(detent);
  const next = Math.min(LESSON_PLATE_DETENTS.length - 1, Math.max(0, index + direction));
  return LESSON_PLATE_DETENTS[next] ?? detent;
}

/**
 * Whether the plate is in its desktop form.
 *
 * A media query rather than a Tailwind breakpoint, because the two forms differ
 * in BEHAVIOUR and not only in styling: one is dragged and reports a footprint,
 * the other is fitted to its content and reports none. Styling both and hiding
 * one would mount two plates, publish two rectangles, and leave the camera
 * composing around a sheet nobody can see.
 *
 * Exported because the personalization plate takes the same corner at the same
 * breakpoint and has the same two behaviours: in the corner it stands beside
 * the microphone, and below `lg:` the microphone has to ride above it. A second
 * media-query hook a hundred lines away is how two surfaces come to change form
 * at different widths.
 */
export function useDesktopPlate(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.(DESKTOP_QUERY).matches ?? false),
  );

  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.matchMedia?.(DESKTOP_QUERY) : undefined;
    if (!query) return;
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}

export interface LessonPlateProps {
  /** Accessible name for the whole surface. It is a landmark on this route. */
  label: string;
  /** Accessible name for the drag handle. */
  resizeLabel: string;
  /** Where the sheet rests. Ignored on desktop, where the plate fits content. */
  detent: LessonPlateDetent;
  onDetentChange: (next: LessonPlateDetent) => void;
  /**
   * How much of the bottom of the viewport this surface occupies right now,
   * including its own inset, in CSS pixels. Zero on desktop, where it sits in
   * the corner and nothing needs to ride above it.
   *
   * Called on EVERY frame of a drag, so the receiver must write a style or a
   * ref and must never call `setState`. It is how the microphone cluster stays
   * above the sheet while the sheet is moving under the learner's thumb.
   */
  onFootprint?: (px: number) => void;
  /**
   * Whether this plate is holding the bottom-RIGHT corner at this instant.
   *
   * The sibling of `onFootprint`, for the other axis: that one says how much of
   * the bottom EDGE is taken and is called on every frame of a drag; this one
   * says whether the corner is occupied at all and changes at most once per
   * phase or breakpoint, so it is allowed to be state on the other side.
   *
   * It exists because the shell used to derive the same fact from the PHASE,
   * and a phase cannot see either of the two things that actually decide it:
   * whether this plate is in its desktop form, and whether it has stood down.
   * An adaptation question is still the `conversing` phase with the plate
   * `display: none`, and the dock went on clearing 480 px of empty island for
   * it (`StageDockValue.setCornerPlate`).
   */
  onCornerHeld?: (held: boolean) => void;
  /**
   * Get out of the way completely, without forgetting anything.
   *
   * For the one moment on this route that is not a lesson: the tutor has asked
   * a yes-or-no and is waiting (`ConversationView`). The sheet is the last
   * surface between the question and the island, and at 375 px its resting row
   * is 88 px plus a 16 px inset of a screen the whole point of which is that
   * the island is the page.
   *
   * HIDDEN, NOT UNMOUNTED, and the difference is the learner's half-finished
   * exercise. React keeps the state of a hidden subtree and throws away the
   * state of an unmounted one, so standing down has to be a style and an
   * `inert`, never a `&&` at the call site. It publishes a footprint of ZERO
   * while it is down, so the microphone dock drops to its own resting inset
   * instead of floating above a sheet that is not there — the same failure the
   * ref-callback release below exists to prevent, arriving from the other
   * direction.
   */
  standDown?: boolean;
  /** Sits in the non-scrolling row beside the handle, so it survives any detent. */
  header?: ReactNode;
  /**
   * The NEWS the resting sheet carries, when there is any.
   *
   * Optional, and usually absent, which is the correction of 2026-08-22. It
   * used to be supplied unconditionally and said "Conversation" when nothing
   * had happened — naming the screen the learner is standing on. Without it the
   * row is a grab bar and a chevron, which is a complete statement: this opens.
   * With it the row says the one thing the learner cannot read anywhere else,
   * which today is that an activity has arrived.
   */
  peekLabel?: string;
  /**
   * The same news, announced politely, while the sheet is at PEEK.
   *
   * Separate from `peekLabel` because the two have different jobs: the label is
   * a control's name and stays imperative, this is a sentence about what
   * changed. It exists because the body — and with it the transcript's live
   * region — is not mounted at PEEK, so an activity arriving would otherwise be
   * a purely visual event for a learner who is not looking at the sheet.
   */
  peekStatus?: string;
  /**
   * Where ONE TAP on the resting row lands, when the row is carrying news.
   *
   * The row's default is to step up one detent, which is right when the learner
   * is simply opening the sheet to look. It is wrong when the row says an
   * ACTIVITY IS WAITING: HALF is 45% of a phone, and after the plate's own
   * header and the pinned check control that left about 90 px for the exercise
   * itself (measured at 375x812) — so the one tap the row invites lands the
   * learner somewhere they still cannot work, and they have to discover a
   * second gesture. A control that announces something should open far enough
   * to act on it.
   *
   * Only consulted while the sheet is RESTING and `peekLabel` is set, so the
   * ordinary "open the sheet" tap is untouched.
   */
  peekOpensTo?: LessonPlateDetent;
  /**
   * How the body is laid out — and it decides WHAT SCROLLS.
   *
   * `scroll` (the default, and every caller that has not asked otherwise) makes
   * the body one scroller with the children stacked inside it. Simple, and
   * correct for a plate whose content is prose.
   *
   * `column` makes the body a non-scrolling flex column and hands the scrolling
   * to ONE child. That is what a plate carrying an EXERCISE needs, and the
   * difference is measurable rather than stylistic. In `scroll` the prompt, the
   * answers, the check control and the conversation log are one tall strip: a
   * learner reaching the last option scrolls the question they are answering off
   * the top, and on the 14 of 55 exercise types that do not fit a 420 px plate
   * they scroll the `Check` control out of the frame as well. Measured at
   * 1280x800: `read_chart` needs 817 px of prompt-plus-answers against 540 px of
   * plate. In `column` the question is pinned above and the action is pinned
   * below, so what scrolls is the answers, between two things that never move.
   *
   * The caller owns the arithmetic: exactly ONE child may be `flex-auto
   * min-h-0` with its own scroller, and the rest must be `shrink-0`.
   */
  bodyLayout?: 'scroll' | 'column';
  children: ReactNode;
  className?: string;
}

export function LessonPlate({
  label,
  resizeLabel,
  detent,
  onDetentChange,
  onFootprint,
  onCornerHeld,
  standDown = false,
  header,
  peekLabel,
  peekStatus,
  peekOpensTo,
  bodyLayout = 'scroll',
  children,
  className,
}: LessonPlateProps) {
  const desktop = useDesktopPlate();
  const safeArea = useSafeArea();

  const nodeRef = useRef<HTMLElement | null>(null);
  const [heights, setHeights] = useState<DetentHeights>(detentHeights);

  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(
    null,
  );
  // A drag that ends over the handle also fires a click. Without this, letting
  // go always cycled the detent on top of the snap the drag had just chosen.
  const suppressClickRef = useRef(false);

  // Held in a ref so the publisher below does not have to depend on the
  // caller's callback identity, which changes on every render of the layer.
  const onFootprintRef = useRef(onFootprint);
  onFootprintRef.current = onFootprint;

  const publishFootprint = useCallback(
    (heightPx: number) => {
      // A sheet that is standing down occupies nothing, so the dock drops back
      // to its own resting inset rather than riding above a surface nobody can
      // see. Same channel, same ref, no re-render.
      onFootprintRef.current?.(desktop || standDown ? 0 : heightPx + SHEET_INSET_PX);
    },
    [desktop, standDown],
  );

  /*
   * The measured node belongs to two owners: this component needs it to write
   * heights, and `SafeAreaContext` needs it to publish rectangles. The safe
   * area's callback is stable per SLOT, so this merge only changes identity
   * when the plate changes form, which is exactly when the old slot should be
   * cleared and the new one filled.
   */
  const measure = safeArea?.measure(desktop ? 'lesson' : 'sheet');
  const attach = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      // A sheet standing down publishes no rectangle either: the camera must
      // compose into the room it has just given back, not around a box that is
      // `display: none`. And it leaves the tab order with it — React 18.3 has
      // no `inert` prop, so it is a DOM assignment, as in `ScreenAnchor`.
      if (node) node.inert = standDown;
      measure?.(standDown ? null : node);

      /*
       * AND THE DOCK'S EDGE IS RELEASED HERE, IN THE REF, NOT IN AN UNMOUNT
       * EFFECT — which is where it was written first, and which measured wrong
       * on `/dev/tutor-lab` at 375x812.
       *
       * The bug it fixes is real: leaving a conversation left the dock's inline
       * `bottom` at the sheet's last footprint with no sheet under it, so the
       * microphone floated a third of the way up the screen over empty island
       * on the introduce and goodbye phases. Nothing published zero, because
       * the only publisher had just unmounted.
       *
       * The reason it cannot be an unmount effect is the phase order. React
       * detaches a removed tree's refs during the MUTATION phase and runs its
       * passive cleanups AFTER the next tree's refs have already attached — and
       * the personalization plate claims the same edge from a ref callback. A
       * release in a cleanup therefore ran last and wiped a claim that was
       * already correct: measured on the lab, moving from a conversation to the
       * picker put the microphone back on top of the picker's own plate. Here
       * the release lands in the same phase as the claim, and deletions are
       * processed before insertions, so whoever arrives next has the last word.
       */
      if (!node) onFootprintRef.current?.(0);
    },
    [measure, standDown],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const next = detentHeights();
      setHeights((previous) => (sameHeights(previous, next) ? previous : next));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The camera has to know where this is from the first frame it exists, not
  // from the first frame somebody drags it.
  useEffect(() => {
    publishFootprint(heights[detent]);
  }, [publishFootprint, heights, detent]);

  /*
   * The corner claim, and it is a PASSIVE EFFECT rather than the ref callback
   * the footprint uses — deliberately, and for the reason the ref callback
   * documents in reverse.
   *
   * The footprint has to be released in the mutation phase because two
   * surfaces hand the same bottom EDGE to each other across a phase change, and
   * a passive cleanup would land after the newcomer's ref had already claimed
   * it. Passive effects have the opposite ordering guarantee: React runs every
   * unmount cleanup in a commit before any mount effect in the same commit, so
   * a plate leaving cannot wipe the claim of the plate arriving. And unlike the
   * edge, the corner is not written during a drag, so it costs one render per
   * change rather than sixty per second.
   */
  const onCornerHeldRef = useRef(onCornerHeld);
  onCornerHeldRef.current = onCornerHeld;
  const holdingCorner = desktop && !standDown;
  useEffect(() => {
    const publish = onCornerHeldRef.current;
    publish?.(holdingCorner);
    return () => publish?.(false);
  }, [holdingCorner]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = nodeRef.current;
    if (desktop || !node) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: node.getBoundingClientRect().height || heights[detent],
      moved: false,
    };
    // The settled height animates; a dragged one must not, or the sheet lags
    // the thumb by the length of the transition.
    node.style.transition = 'none';
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const node = nodeRef.current;
    if (!drag || !node || drag.pointerId !== event.pointerId) return;

    const delta = drag.startY - event.clientY;
    if (Math.abs(delta) > DRAG_SLOP_PX) drag.moved = true;
    const next = Math.min(heights.full, Math.max(heights.peek, drag.startHeight + delta));
    node.style.height = `${next}px`;
    publishFootprint(next);
  };

  const onHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const node = nodeRef.current;
    if (!drag || !node || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    suppressClickRef.current = drag.moved;
    node.style.transition = '';

    const settled = nearestDetent(node.getBoundingClientRect().height || heights[detent], heights);
    // Written here as well as through the style prop below: when the drag ends
    // on the detent it started from there is no re-render, and the imperative
    // height from the last pointermove would otherwise stay where the thumb
    // left it.
    node.style.height = `${heights[settled]}px`;
    publishFootprint(heights[settled]);
    if (settled !== detent) onDetentChange(settled);
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (desktop) return;
    const next =
      event.key === 'ArrowUp'
        ? step(detent, 1)
        : event.key === 'ArrowDown'
          ? step(detent, -1)
          : event.key === 'Home'
            ? 'peek'
            : event.key === 'End'
              ? 'full'
              : null;
    if (!next) return;
    // A sheet that can only be resized by dragging is a sheet a keyboard user
    // cannot resize at all, and at PEEK that hides the activity from them.
    event.preventDefault();
    if (next !== detent) onDetentChange(next);
  };

  /**
   * The sheet is a summary row rather than a panel right now.
   *
   * Only ever true on a phone: the desktop plate has no detents at all, and a
   * corner plate that collapsed itself to one line would be hiding the lesson
   * on the breakpoint where there is room for everything.
   */
  const resting = !desktop && detent === 'peek';

  const onHandleClick = () => {
    if (desktop) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // A resting row that is ANNOUNCING something opens far enough to act on it.
    if (resting && peekLabel && peekOpensTo) {
      onDetentChange(peekOpensTo);
      return;
    }
    onDetentChange(detent === 'full' ? 'peek' : step(detent, 1));
  };

  return (
    <HudPlate
      as="aside"
      shape="sheet"
      /*
       * `none` because the plate is a COLUMN with a pinned header and a
       * scrolling body, and HudPlate's own content slot is a centred flex row
       * sized for a label. It is NOT a way out of the material: the frame is
       * `.lf-lumen .lf-lumen-reading` (a `sheet` defaults to the reading
       * density), which is where the contrast comes from.
       *
       * THE OPAQUE `bg-surface` CORE THAT USED TO BE IN HERE IS GONE, and it is
       * the last one on the route. It was written under the opaque-floor rule
       * of 2026-08-21 and outlived it by a day: with the material underneath it
       * doing the work, all the core did was paint over the island — so the one
       * surface a learner spends a whole conversation looking at was the one
       * surface the island could not be seen through. At the reading alpha the
       * ratio is 4.96:1 in light and 7.2:1 in dark for muted body text, which is
       * the bound §Lumen states and `HudPlate.test.tsx` re-derives.
       */
      floor="none"
      aria-label={label}
      ref={attach}
      /*
       * THE WIDTH IS PINNED IN PIXELS, not left to `HudPlate`'s `44ch` reading
       * measure, and that is a correction made from a measurement rather than a
       * preference. `ch` is the width of a zero in whatever font has actually
       * loaded: with Inter it lands near the 420 px token, and against the
       * fallback face the same class measured 444 px in a live browser. A
       * design token that drifts by 24 px depending on whether a webfont has
       * arrived is not a token, and 420 px is a number /DESIGN.md states
       * outright.
       */
      /*
       * `display: none` INLINE while standing down, not a `hidden` class.
       * `[hidden] { display: none }` is a user-agent rule and the frame carries
       * `flex` from an author stylesheet, so the attribute alone paints the
       * sheet anyway — the same trap `ScreenAnchor` documents for anchored
       * nodes, arrived at independently by two different surfaces on this
       * route. An inline style wins outright.
       */
      style={{
        maxWidth: desktop ? 'min(27.5rem, 34vw)' : 'calc(100vw - 2rem)',
        height: desktop ? undefined : heights[detent],
        // Docked panels do not float: square off the edge that meets the
        // viewport, keep the radius on the side that meets the island.
        ...(desktop ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}),
        ...(standDown ? { display: 'none' } : {}),
      }}
      // Out of the accessibility tree, and out of the tab order with it (the
      // `inert` half is set on the node itself in `attach` — React 18.3 has no
      // `inert` prop, exactly as `ScreenAnchor` records).
      aria-hidden={standDown ? true : undefined}
      className={cn(
        'pointer-events-auto fixed z-30 flex w-full flex-col overflow-hidden',
        desktop
          ? /*
             * A DOCKED FULL-HEIGHT PANEL (owner sign-off 2026-08-28), replacing
             * the floating bottom-right corner plate. The owner's feedback was
             * that the floating plate — content-fitted, transcript folded, the
             * conversation living in a corner — read as disorganised: on the
             * one breakpoint with room for everything, the conversation, the
             * activity and the composer should simply BE there, side by side
             * with the stage. The island keeps ~66-70% of the width, the camera
             * composes the character into it (this panel publishes its rect on
             * the `lesson` safe-area slot exactly as the corner plate did), and
             * the microphone dock already steps left of the corner claim
             * (`StageShell` → `besidePlate`). What is deliberately KEPT from
             * the rejected two-panel split's post-mortem: the panel is Lumen
             * material over the island, never an opaque slab, and the stage is
             * never squeezed into a half-width cell — the canvas stays
             * full-bleed underneath.
             */
            'inset-y-0 right-0'
          : 'inset-x-0 bottom-4 mx-auto motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-[var(--lf-ease)]',
        className,
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit] text-content">
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 px-2 pt-2 lg:px-3 lg:pt-3',
            // At PEEK the row IS the sheet, so it takes the whole height and
            // centres itself in it rather than sitting at the top of 88 px of
            // empty surface.
            resting && 'h-full pb-2',
          )}
        >
          {!desktop && (
            <button
              type="button"
              /*
               * The visible words come FIRST and the resize sentence after
               * them. A control whose spoken name omits its printed label
               * breaks voice control, and a control announced only as "make
               * this panel bigger" never mentions that an activity is waiting
               * inside it.
               */
              aria-label={resting && peekLabel ? peekLabel + ' ' + resizeLabel : resizeLabel}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onKeyDown={onHandleKeyDown}
              onClick={onHandleClick}
              // `touch-none` or the browser scrolls the page instead of giving
              // us the pointermove stream, and the sheet simply will not move.
              className={cn(
                'flex min-h-11 flex-1 cursor-grab touch-none items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                resting ? 'gap-2 px-2 text-left' : 'justify-center',
              )}
            >
              {/*
                THE CHEVRON IS ALWAYS THERE WHILE THE SHEET RESTS, AND THE WORDS
                ARE NOT.

                It used to be the other way round: the row printed
                "Conversation" whenever nothing was waiting — the name of the
                screen the learner is already standing on, which is the one
                thing a label may never be (/DESIGN.md §Lumen → What to delete).
                What the row actually has to do is say that it OPENS, and a
                chevron over a grab bar says that without a word in any locale.
                When there IS something to say — an activity has arrived — the
                row says that instead, which is the only news it ever carries.
              */}
              {resting ? (
                <>
                  <span aria-hidden="true" className="flex shrink-0 flex-col items-center gap-1">
                    <span className="h-1 w-8 rounded-full bg-content/25" />
                    <Icon name="keyboard_arrow_up" className="!text-[20px]" />
                  </span>
                  {/* Wraps to a second line rather than truncating: this label
                      swings by more than 1.8x across our three locales. */}
                  {peekLabel && <span className="lf-action min-w-0 text-content">{peekLabel}</span>}
                </>
              ) : (
                <span aria-hidden="true" className="h-1 w-12 rounded-full bg-content/25" />
              )}
            </button>
          )}
          <div className={cn('flex items-center gap-2', desktop ? 'ml-auto' : 'shrink-0')}>{header}</div>
        </div>

        {/*
          Announced, not merely drawn. The body below is not mounted at PEEK, so
          its transcript log cannot carry this, and an activity arriving on a
          sheet nobody is looking at has to reach a learner who is listening.
        */}
        {resting && peekStatus && (
          <span role="status" className="sr-only">
            {peekStatus}
          </span>
        )}

        {/*
          `hidden` at PEEK, not merely clipped, and the two are different
          promises. Clipped content is still focusable and still announced from
          behind an 88 px window — a keyboard user tabs into an exercise nobody
          can see. Hidden content is neither, and React keeps its state, so a
          half-answered activity is exactly where the learner left it when they
          open the sheet again.
        */}
        <div
          hidden={resting}
          // The body is the thing a measurement script and a test both have to
          // find, and both used to find it by an accessible name that happened
          // to be inside it. A named seam beats a lucky landmark.
          data-plate-body=""
          /*
           * `display: none` INLINE, not the `hidden` attribute alone, and this
           * is the third surface on this route to learn it the same way.
           * `[hidden] { display: none }` is a 0-1-0 USER-AGENT rule, and in
           * `column` mode this element carries `flex` from an author
           * stylesheet, which beats it outright. Measured on `/dev/tutor-lab` at
           * 375x812 with the sheet resting at PEEK: the whole exercise was laid
           * out below the fold — three option buttons at y = 925, 986 and 1047 —
           * reporting `hidden === true` to every script that asked, focusable,
           * announced, and 200 px past the bottom of the phone. Exactly the trap
           * `ScreenAnchor` and `WorldChip` already record.
           */
          style={resting ? { display: 'none' } : undefined}
          className={cn(
            'min-h-0 flex-1 px-4 pb-4 pt-2 lg:px-5 lg:pb-5',
            bodyLayout === 'column'
              ? // The body does not scroll; one child does. See `bodyLayout`.
                'flex flex-col gap-3 overflow-hidden'
              : 'space-y-3 overflow-y-auto overscroll-contain',
          )}
        >
          {children}
        </div>
      </div>
    </HudPlate>
  );
}
