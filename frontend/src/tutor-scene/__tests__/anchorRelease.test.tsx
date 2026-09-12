import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AnchorProvider, useAnchorSlot } from '../ScreenAnchor';

/*
 * WHAT THE PROJECTOR TAKES, IT HAS TO GIVE BACK.
 *
 * `useAnchorSlot` positions a node by writing inline styles onto it every frame
 * — `position`, `left`, `top`, `margin`, `transformOrigin`, `willChange` and
 * `transform`. An inline declaration outranks every class, so a node released
 * from the projector while STILL ON SCREEN keeps whatever the projector left
 * behind and can never be positioned by its own stylesheet again.
 *
 * That is not hypothetical. `SpeechCaption` has two positioning modes and
 * switches between them at the `lg` breakpoint: anchored over the speaking
 * character's crown below it, CSS-docked beside the desktop panel above it. A
 * rotation or a window drag across 1024 px runs this release path on a node that
 * stays mounted and visible. Measured in production on 2026-09-12 at 1604x677:
 * the caption moved from (326, 80) to (0, 0) and covered the way-out chip at
 * (24, 24, 152, 48) entirely — the only navigation on the route — because the
 * stale inline `top: 0; margin: 0` beat `.top-20` and `.mx-auto`, both of which
 * still matched and were both still present in the stylesheet.
 *
 * These two tests are the pair. The first says the takeover happens at all (so
 * the second cannot pass by the hook doing nothing); the second is the
 * regression.
 */

/** Every property `claimProjection` writes, which is what release must clear. */
const CLAIMED = ['position', 'left', 'top', 'margin', 'transformOrigin', 'willChange', 'transform'] as const;

function Anchored({ anchored }: { anchored: boolean }) {
  const anchorRef = useAnchorSlot('lead.crown');
  return (
    <div
      data-testid="node"
      ref={anchored ? anchorRef : undefined}
      /*
       * A real positioning class, because the point of releasing is that THIS
       * takes over again. jsdom applies no stylesheet, so the assertion below
       * reads the inline layer the class would otherwise be fighting.
       */
      className="fixed top-20 mx-auto"
    >
      hola
    </div>
  );
}

function Harness({ anchored }: { anchored: boolean }) {
  return (
    <AnchorProvider>
      <Anchored anchored={anchored} />
    </AnchorProvider>
  );
}

describe('a node released by the anchor projector', () => {
  it('is taken over by inline styles while it is anchored', () => {
    const { getByTestId } = render(<Harness anchored />);
    const node = getByTestId('node');

    expect(node.style.position).toBe('fixed');
    expect(node.style.top).toBe('0px');
    expect(node.style.margin).toBe('0px');
    expect(node.style.transformOrigin).toBe('center center');
  });

  /*
   * THE REGRESSION. The old release path cleared `transform` and nothing else,
   * so this failed on five of the seven properties — and `top` is the one that
   * put the tutor's own words on top of the way out.
   */
  it('gets every one of those properties back when it stops being anchored', () => {
    const { getByTestId, rerender } = render(<Harness anchored />);
    const node = getByTestId('node');
    expect(node.style.position).toBe('fixed');

    // The caption docking: same node, still mounted, no longer projected.
    rerender(<Harness anchored={false} />);

    for (const prop of CLAIMED) {
      expect(node.style[prop], `style.${prop} survived the release`).toBe('');
    }
    // And nothing else was touched on the way out.
    expect(node.className).toBe('fixed top-20 mx-auto');
    expect(node.hidden).toBe(false);
  });
});
