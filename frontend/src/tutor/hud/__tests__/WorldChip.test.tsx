import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { SafeAreaProvider, useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { isBehindHud, WorldChip } from '../WorldChip';

/*
 * The chip is the guaranteed half of a pair: a mesh in the scene is the lovely
 * way to choose something and a DOM button is the only way that survives a
 * keyboard, a screen reader or a shaking hand. Both dispatch the same handler,
 * so what is tested here is that the guaranteed half is a real control.
 *
 * The rest is about the seam with the projector, which writes this node's whole
 * `transform` every frame. Anything the chip contributes to that property is
 * either erased or applied twice, and "applied twice" is a chip sitting half its
 * own width away from the thing it names — visible only once the scene is
 * running, which is the worst time to find it.
 */

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** jsdom lays nothing out, so a node that has to have a box states its own. */
function stubRect(node: HTMLElement, rect: Rect): void {
  node.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Stands in for the lesson sheet: one measured, opaque, bottom-edge plate. */
function SheetProbe({ rect }: { rect: Rect }) {
  const safeArea = useSafeArea();
  const measure = safeArea?.measure('sheet');
  return (
    <div
      ref={(node) => {
        if (node) stubRect(node, rect);
        measure?.(node);
      }}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WorldChip as a control', () => {
  it('is a real button that dispatches the same handler as its mesh', () => {
    const onSelect = vi.fn();
    render(
      <WorldChip slot="lead.head" onSelect={onSelect}>
        Just us
      </WorldChip>,
    );

    screen.getByRole('button', { name: 'Just us' }).click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('is not focusable when it only reports something', () => {
    render(<WorldChip slot="island.centre">12 min left</WorldChip>);
    // A recap figure is not a control. Putting it in the tab order gives a
    // keyboard user a stop that does nothing.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('12 min left')).toBeInTheDocument();
  });

  it('marks the chosen option without recolouring it', () => {
    render(
      <WorldChip slot="island.rim.left" onSelect={vi.fn()} selected>
        Oasis
      </WorldChip>,
    );

    const chip = screen.getByRole('button', { name: 'Oasis' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    /*
     * A ring, not a fill: over live scenery a colour swap reads as the light
     * changing rather than as a choice being made.
     *
     * The ring is part of the MATERIAL rather than Tailwind's `ring-*`
     * utility, and that is a bug fix. `ring-2` writes `box-shadow`, utilities
     * outrank components, and the material's shadow IS its edge, its specular
     * lip and the shadow that seats it in the scene — so a chosen chip used to
     * lose all three at the exact moment it was meant to look more present.
     */
    expect(chip.className).toContain('lf-lumen-selected');
    expect(chip.className).not.toContain('ring-primary');
  });

  /*
   * A GROUP OF OPTIONS HAS TO SOUND LIKE ONE.
   *
   * `aria-pressed` used to be emitted only when a chip was chosen, so the four
   * sun-arc light chips reached a screen reader as three ordinary buttons and
   * one pressed button. The chosen light was announced; that the other three
   * were the alternatives was not, and the plate fallback for the same choice
   * got it right, so the two paths disagreed about what the control even was.
   */
  it('announces an UNCHOSEN option as an unpressed toggle, not as a plain button', () => {
    render(
      <>
        <WorldChip slot="sky.mark.0" onSelect={vi.fn()} selected={false}>
          Morning
        </WorldChip>
        <WorldChip slot="sky.mark.1" onSelect={vi.fn()} selected={true}>
          Sunset
        </WorldChip>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Morning' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves aria-pressed OFF a chip that is an action rather than an option', () => {
    // The way out of the route, an offer, a rim pad: pressing one does
    // something rather than turning something on. Announcing it as an unpressed
    // toggle asks the learner to work out what it would switch.
    render(
      <WorldChip slot="stage.mark.0" onSelect={vi.fn()}>
        Practise together
      </WorldChip>,
    );

    expect(screen.getByRole('button', { name: 'Practise together' })).not.toHaveAttribute('aria-pressed');
  });
});

describe('WorldChip and the projector', () => {
  it('adds no transform of its own to the anchored node', () => {
    const { container } = render(
      <WorldChip slot="lead.head" onSelect={vi.fn()}>
        Practise together
      </WorldChip>,
    );

    const anchored = container.firstElementChild;
    expect(anchored?.className).not.toMatch(/-?translate-[xy]-/);
    expect(anchored?.className).not.toMatch(/(^|\s)(scale|rotate)-/);
  });

  it('lets taps through to the island everywhere except on the plate itself', () => {
    const { container } = render(
      <WorldChip slot="stage.mark.0" onSelect={vi.fn()}>
        Ask me anything
      </WorldChip>,
    );

    // The positioned layer is full-size and sits over the canvas; if it caught
    // pointer events, every chip would punch an invisible hole in the scene.
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
    expect(screen.getByRole('button').className).toContain('pointer-events-auto');
  });

  /*
   * THE OTHER WAY A CHIP DISAPPEARS, AND IT IS THE ONE THE OWNER FOUND.
   *
   * /DESIGN.md fixes two z-bands on this route: world-anchored chrome below,
   * viewport-anchored chrome above. The projector culls a chip that leaves the
   * FRAME, and nothing culled a chip that was still perfectly inside the frame
   * and simply painted over by the lesson sheet or the microphone dock. On a
   * phone, where those two own the bottom third of the screen, that is a
   * control which is invisible, focusable, tappable and reported to a screen
   * reader as being on screen — the worst of both, and impossible to tell from
   * a projection bug by looking at it.
   */
  it('hides AND inerts a chip that the HUD is painted over, then brings it back', () => {
    // `requestAnimationFrame` explicitly: the shared ticker runs on frames, not
    // on timeouts, and vitest does not fake it by default.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'performance'] });
    const { container } = render(
      <SafeAreaProvider>
        <SheetProbe rect={{ left: 0, top: 600, width: 375, height: 212 }} />
        <WorldChip slot="stage.mark.0" onSelect={vi.fn()}>
          Practise together
        </WorldChip>
      </SafeAreaProvider>,
    );

    const frame = container.querySelector<HTMLElement>('.will-change-transform');
    const plate = screen.getByRole('button', { name: 'Practise together' });
    expect(frame).not.toBeNull();

    // Squarely behind the sheet. The projector would place it here quite
    // happily: it is inside the frame, and the frame is all the projector knows.
    stubRect(frame as HTMLElement, { left: 100, top: 660, width: 160, height: 44 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(plate.hasAttribute('hidden')).toBe(true);
    // `inert` as a PROPERTY: jsdom does not reflect it to an attribute, so the
    // attribute check would read false on a node that is correctly inert.
    expect(plate.inert).toBe(true);

    // The camera moves it back into open sky. A chip released while hidden
    // would stay hidden forever, which looks exactly like a render that failed.
    stubRect(frame as HTMLElement, { left: 100, top: 200, width: 160, height: 44 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(plate.hasAttribute('hidden')).toBe(false);
    expect(plate.inert).toBe(false);
  });

  it('leaves a chip alone when there is no HUD measured at all', () => {
    // The scene lab mounts the stage with no HUD, and every unit test in this
    // file renders without a provider. A guard that hid chips there would be
    // hiding them against rectangles nobody published.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'performance'] });
    const { container } = render(
      <WorldChip slot="stage.mark.0" onSelect={vi.fn()}>
        Practise together
      </WorldChip>,
    );
    stubRect(container.querySelector('.will-change-transform') as HTMLElement, {
      left: 100,
      top: 660,
      width: 160,
      height: 44,
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('button', { name: 'Practise together' }).hasAttribute('hidden')).toBe(false);
  });

  /*
   * AND HIDING IT HAS TO SURVIVE THE NODE'S OWN STYLING, which is the way this
   * guard failed silently for one caller.
   *
   * `hidden` hides through a base-layer `[hidden] { display: none }` rule, and
   * that is a 0-1-0 attribute selector. Any `display` utility on the same node
   * is a class — also 0-1-0, and later in the cascade — so it wins, and the
   * node reports `hidden === true` to every script that asks while painting
   * perfectly normally. The audition's candidate cluster is a `flex` row, so
   * measured on `/dev/tutor-lab` at 375x812 with the personalization list open
   * it satisfied the harness and left Dr. Rho's name plate clipped behind the
   * microphone dock ON SCREEN.
   */
  it('hides a plate that carries a display utility of its own', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'performance'] });
    const { container } = render(
      <SafeAreaProvider>
        <SheetProbe rect={{ left: 0, top: 600, width: 375, height: 212 }} />
        <WorldChip slot="stage.mark.0" onSelect={vi.fn()} className="flex">
          Practise together
        </WorldChip>
      </SafeAreaProvider>,
    );

    const frame = container.querySelector<HTMLElement>('.will-change-transform');
    const plate = screen.getByRole('button', { name: 'Practise together' });
    stubRect(frame as HTMLElement, { left: 100, top: 660, width: 160, height: 44 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // The attribute is the semantic half and is not enough on its own.
    expect(plate.hasAttribute('hidden')).toBe(true);
    // This is the half that actually removes the pixels.
    expect(plate.style.display).toBe('none');

    stubRect(frame as HTMLElement, { left: 100, top: 200, width: 160, height: 44 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Cleared back to '' rather than to a guessed value, so the node returns to
    // whatever its classes say — `flex`, here.
    expect(plate.style.display).toBe('');
  });

  it('registers with the projector and starts hidden AND inert', () => {
    const { container } = render(
      <AnchorProvider>
        <WorldChip slot="companion.head" onSelect={vi.fn()}>
          Zara Vex
        </WorldChip>
      </AnchorProvider>,
    );

    const anchored = container.querySelector<HTMLElement>('[style*="position: fixed"]');
    expect(anchored).not.toBeNull();
    // Before the first projection the node has no place to be. Showing it would
    // flash a control in the corner of the stage on mount, and leaving it
    // focusable would let a keyboard reach it there.
    expect(anchored?.hidden).toBe(true);
    expect(anchored?.inert).toBe(true);
  });
});

/*
 * The arithmetic behind the guard above, tested where a test can actually reach
 * it: the mechanism itself lives in an animation frame, and the rule it applies
 * is the same one `culling.ts` settled on for the frame edge — a control the
 * learner can only HALF read must not be under their thumb or in their tab
 * order.
 */
describe('isBehindHud', () => {
  const SHEET = { left: 0, top: 600, width: 375, height: 212 };
  const DOCK = { left: 15, top: 500, width: 345, height: 136 };

  it('says no when the chip is in open sky', () => {
    expect(isBehindHud({ left: 100, top: 200, right: 260, bottom: 244 }, [SHEET, DOCK])).toBe(false);
  });

  it('says yes when the chip is squarely behind a plate', () => {
    expect(isBehindHud({ left: 100, top: 660, right: 260, bottom: 704 }, [SHEET])).toBe(true);
  });

  it('says yes for a chip only PARTLY behind one', () => {
    // Half a glass pill peeking out from under the lesson sheet is exactly the
    // half-read control this rule exists to remove.
    expect(isBehindHud({ left: 100, top: 580, right: 260, bottom: 624 }, [SHEET])).toBe(true);
  });

  it('ignores a chip that merely touches an edge', () => {
    // Rounding, not occlusion. Without the tolerance a chip resting on the
    // boundary flips hidden and visible on alternate ticks.
    expect(isBehindHud({ left: 100, top: 556, right: 260, bottom: 600.5 }, [SHEET])).toBe(false);
  });

  it('tests every plate, not only the first', () => {
    expect(isBehindHud({ left: 100, top: 540, right: 260, bottom: 584 }, [SHEET, DOCK])).toBe(true);
  });

  it('says no when nothing has been measured', () => {
    expect(isBehindHud({ left: 100, top: 660, right: 260, bottom: 704 }, [])).toBe(false);
  });
});
