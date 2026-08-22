import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
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
 */

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

  return (
    <div
      ref={anchorRef}
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
