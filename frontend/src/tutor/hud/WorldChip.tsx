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
  /** Marks the chip as the currently chosen option in its group. */
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
  selected = false,
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
        aria-pressed={onSelect && selected ? true : undefined}
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
