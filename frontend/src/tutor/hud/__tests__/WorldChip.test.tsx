import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { WorldChip } from '../WorldChip';

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
    // A ring, not a fill: over live scenery a colour swap reads as the light
    // changing rather than as a choice being made.
    expect(chip.className).toContain('ring-primary');
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
