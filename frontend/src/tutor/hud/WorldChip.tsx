import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { useSafeArea, type SafeAreaSlot, type SafeAreaValue } from '@/tutor-scene/SafeAreaContext';
import type { HudRect } from '@/tutor-scene/composition';
import { HudPlate } from './HudPlate';
import type { HudPlateFloor, HudPlateShape } from './HudPlate';

/*
 * A HudPlate that lives at a named place in the world.
 *
 * The chip is the GUARANTEED path and the mesh beside it is the delightful one.
 * A pickable mesh is a lovely thing to tap and a terrible thing to reach with a
 * keyboard, a screen reader or a shaking hand; a DOM button is the reverse.
 * Both are always mounted and both dispatch the SAME handler, so there is one
 * code path with two ways in rather than an accessible fallback that quietly
 * diverges from the real feature.
 *
 * POSITION COMES FROM A REF CHANNEL, NOT FROM STATE. `useAnchorSlot` hands back
 * a ref callback; the scene writes this node's transform every frame without
 * React knowing. Re-rendering a chip sixty times a second to move it costs more
 * than drawing the island it is floating over.
 *
 * THE ANCHORED NODE CARRIES NO TRANSFORM OF ITS OWN, including a centering one.
 * The projector writes the whole `transform` string each frame and already ends
 * it with `translate(-50%, -50%)`, so a Tailwind `-translate-x-1/2` here would
 * either be erased or, on a wrapper, applied twice — a chip sitting half its own
 * width up and to the left of the thing it names.
 *
 * AND IT IS CULLED BY THE HUD AS WELL AS BY THE FRAME. See below: the two
 * z-bands mean an anchored chip can be perfectly on screen, perfectly focusable
 * and completely invisible, because an opaque plate is painted over it.
 */

/**
 * The measured surfaces that PAINT OVER world-anchored chrome.
 *
 * /DESIGN.md fixes exactly two z-bands on this route: world-anchored chrome
 * below, viewport-anchored chrome above. That is the right arrangement — the
 * alternative is a control rendered underneath the thing it controls — but it
 * has a consequence nobody wrote down, and the owner met it on a phone: a chip
 * whose anchor projects into the bottom band is not "slightly obscured", it is
 * gone, while remaining a tab stop, a pointer target and a thing a screen
 * reader will happily describe as being on screen.
 *
 * `caption` is deliberately NOT in this list. It is world-anchored itself, so
 * it lives in the same band and settles with a chip by DOM order rather than by
 * painting over it from the band above.
 */
const OCCLUDING_SLOTS: readonly SafeAreaSlot[] = ['lesson', 'sheet', 'mic'];

/**
 * How often a chip re-tests itself against the HUD, in milliseconds.
 *
 * Not every frame. The test costs a `getBoundingClientRect`, which is a forced
 * layout, and the projector already refuses to pay that per node per frame
 * (`ScreenAnchor.tsx` batches its own remeasure at 4 Hz for the same reason).
 * What moves here is a camera drifting at walking pace and a sheet a thumb is
 * dragging, so an eighth of a second of lag is invisible — and one shared
 * ticker for every mounted chip means the cost is N rects at 8 Hz rather than
 * N rects at 60.
 */
const OCCLUSION_INTERVAL_MS = 120;

/**
 * Overlap this small is a rounding artefact rather than an occlusion.
 *
 * Without it a chip resting exactly on the plate's edge flips hidden and
 * visible on alternate ticks, which is a worse experience than either state.
 */
const TOUCH_TOLERANCE_PX = 1;

/** A chip's own box, in viewport pixels, at the size it is drawn. */
export interface ChipBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * True when this box is meaningfully covered by any of the HUD's opaque plates.
 *
 * ANY intersection counts, not a majority. That is the same rule
 * `culling.ts` settled on for the frame edge and for the same reason: a control
 * a learner can only half read must not be under their thumb or in their tab
 * order, and "half of a glass pill peeking out from behind the lesson sheet" is
 * exactly that state.
 *
 * Exported because it is arithmetic, and arithmetic is the part of this file a
 * test can reach — the rest of the mechanism lives in an animation frame.
 */
export function isBehindHud(box: ChipBox, plates: readonly HudRect[]): boolean {
  for (const plate of plates) {
    const overlapX =
      Math.min(box.right, plate.left + plate.width) - Math.max(box.left, plate.left);
    const overlapY =
      Math.min(box.bottom, plate.top + plate.height) - Math.max(box.top, plate.top);
    if (overlapX > TOUCH_TOLERANCE_PX && overlapY > TOUCH_TOLERANCE_PX) return true;
  }
  return false;
}

/* ── One ticker for every chip on the route ─────────────────────────────── */

type Watcher = () => void;

const watchers = new Set<Watcher>();
let pumpFrame = 0;
let lastPump = 0;

function pump(now: number): void {
  pumpFrame = requestAnimationFrame(pump);
  // `lastPump === 0` is a ticker that has just started rather than a timestamp,
  // and the clock is only monotonic WITHIN one document: a test's fake clock
  // rewinds between cases, and a naive elapsed check would then wait for the
  // old timestamp to come round again — which is a watcher that never fires and
  // a suite that passes because nothing ran.
  if (lastPump !== 0 && now >= lastPump && now - lastPump < OCCLUSION_INTERVAL_MS) return;
  lastPump = now;
  for (const watcher of watchers) watcher();
}

function watch(watcher: Watcher): () => void {
  watchers.add(watcher);
  // Once immediately: a chip mounted into a HUD that is already on screen must
  // not spend its first frames visible behind a plate, and the rect read costs
  // one layout at mount rather than one per frame.
  watcher();
  if (pumpFrame === 0 && typeof requestAnimationFrame === 'function') {
    pumpFrame = requestAnimationFrame(pump);
  }
  return () => {
    watchers.delete(watcher);
    if (watchers.size === 0 && pumpFrame !== 0) {
      cancelAnimationFrame(pumpFrame);
      pumpFrame = 0;
      lastPump = 0;
    }
  };
}

function occludingPlates(safeArea: SafeAreaValue): HudRect[] {
  const plates: HudRect[] = [];
  for (const slot of OCCLUDING_SLOTS) {
    const rect = safeArea.rectsRef.current.get(slot);
    if (rect && rect.width > 0 && rect.height > 0) plates.push(rect);
  }
  return plates;
}

/**
 * Hides a chip that has ended up behind the HUD, and un-hides it when it has
 * not.
 *
 * TWO NODES, TWO OWNERS, AND THAT IS THE WHOLE TRICK. The projector owns
 * `hidden`/`inert` on the anchored FRAME and writes them only on a cull
 * transition, so a second writer on the same node would leave a chip
 * permanently hidden the first time the two disagreed. This writes the same two
 * properties on the PLATE inside instead. The frame then measures as a
 * zero-size box at its own centre, which is why the last non-zero half-extents
 * are remembered: the test has to keep working on the frames when the answer is
 * "still hidden".
 */
function useHudOcclusion(): {
  frame: (node: HTMLElement | null) => void;
  plate: (node: HTMLElement | null) => void;
} {
  const safeArea = useSafeArea();
  const frameNode = useRef<HTMLElement | null>(null);
  const plateNode = useRef<HTMLElement | null>(null);
  const half = useRef({ width: 0, height: 0 });
  const hidden = useRef(false);

  useEffect(() => {
    // No safe area means no measured HUD, which is the scene lab and every unit
    // test. Nothing can be occluding a chip there, and a ticker that reads
    // rectangles nobody publishes is pure cost.
    if (!safeArea) return;

    const stop = watch(() => {
      const frame = frameNode.current;
      const plate = plateNode.current;
      if (!frame || !plate) return;
      // The projector has this chip off screen already. Measuring a
      // `display: none` node reads zero, and zero overlaps nothing.
      if (frame.hidden) return;

      const box = frame.getBoundingClientRect();
      if (box.width > 0) half.current.width = box.width / 2;
      if (box.height > 0) half.current.height = box.height / 2;
      const centreX = box.left + box.width / 2;
      const centreY = box.top + box.height / 2;

      const behind = isBehindHud(
        {
          left: centreX - half.current.width,
          top: centreY - half.current.height,
          right: centreX + half.current.width,
          bottom: centreY + half.current.height,
        },
        occludingPlates(safeArea),
      );

      if (behind === hidden.current) return;
      hidden.current = behind;
      plate.hidden = behind;
      plate.inert = behind;
    });

    return () => {
      stop();
      // Leave the plate usable if it outlives the watcher: an element released
      // while hidden would stay hidden and inert forever, which looks exactly
      // like a component that failed to render.
      const plate = plateNode.current;
      if (plate && hidden.current) {
        plate.hidden = false;
        plate.inert = false;
      }
      hidden.current = false;
    };
  }, [safeArea]);

  return useMemo(
    () => ({
      frame: (node: HTMLElement | null) => {
        frameNode.current = node;
      },
      plate: (node: HTMLElement | null) => {
        plateNode.current = node;
      },
    }),
    [],
  );
}

export interface WorldChipProps {
  /** The named world point this chip rides on. */
  slot: AnchorId;
  children: ReactNode;
  /**
   * Fired by the chip AND by the mesh it mirrors. Omit for a chip that only
   * reports something, such as a recap figure.
   */
  onSelect?: () => void;
  /** Accessible name, when the visible children are not enough on their own. */
  label?: string;
  shape?: HudPlateShape;
  floor?: HudPlateFloor;
  /**
   * Toggle state, for a chip that is one option inside a group.
   *
   * THREE-VALUED, AND DELIBERATELY SO. `undefined` means "this is not a
   * toggle", `false` means "it is a toggle and this is not the chosen one", and
   * those two announce differently. Collapsing them — which is what defaulting
   * to `false` and then only emitting `aria-pressed` when true did — made the
   * four sun-arc light chips reach a screen reader as three ordinary buttons
   * and one pressed button. The chosen light was announced; that the other
   * three were choices at all was not, so the group had no group.
   *
   * It matters just as much in the other direction, which is why this is not
   * simply defaulted to `false`: the way out of the route is a button, not a
   * switch, and announcing it as an unpressed toggle invites the learner to
   * work out what pressing it would turn on.
   */
  selected?: boolean;
  className?: string;
}

export function WorldChip({
  slot,
  children,
  onSelect,
  label,
  shape = 'chip',
  floor = 'surface',
  selected,
  className,
}: WorldChipProps) {
  const anchorRef = useAnchorSlot(slot);
  const occlusion = useHudOcclusion();

  /*
   * Both owners get the frame node, in one callback so React attaches it once.
   * Its identity changes only when the anchor itself does, which is exactly
   * when the old registration should be torn down.
   */
  const attachFrame = useCallback(
    (node: HTMLElement | null) => {
      anchorRef(node);
      occlusion.frame(node);
    },
    [anchorRef, occlusion],
  );

  return (
    <div
      ref={attachFrame}
      /*
       * `fixed` at the origin, because the scene publishes viewport pixels: the
       * canvas is full-bleed, so viewport coordinates and canvas coordinates
       * are the same coordinates and no offset parent can drift between them.
       * `pointer-events-none` on the positioned layer keeps a chip's bounding
       * box from swallowing taps meant for the island; the plate inside turns
       * them back on for itself alone.
       */
      className="pointer-events-none fixed left-0 top-0 z-20 will-change-transform"
    >
      <HudPlate
        ref={occlusion.plate}
        as={onSelect ? 'button' : 'div'}
        shape={shape}
        floor={floor}
        aria-label={label}
        // Emitted for every chip in a toggle group, pressed or not, and for no
        // other chip. `undefined` is the only value that removes the attribute;
        // `false` renders as `aria-pressed="false"`, which is the announcement
        // an unchosen option needs.
        aria-pressed={onSelect && selected !== undefined ? selected : undefined}
        onClick={onSelect}
        className={cn(
          onSelect && 'pointer-events-auto',
          // Selection is a ring rather than a fill: the chip is over live
          // scenery, and a colour swap reads as a lighting change there.
          selected && 'ring-2 ring-primary',
          className,
        )}
      >
        {children}
      </HudPlate>
    </div>
  );
}
