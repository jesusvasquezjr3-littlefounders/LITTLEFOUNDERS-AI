import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  StageLayer,
  StageShell,
  STAGE_PHASES,
  type StageMicProps,
  type StagePhase,
} from '../StageShell';
import type { Microphone } from '@/tutor/useMicrophone';

beforeAll(() => {
  // jsdom ships no media pipeline, and the stage's audio element pauses itself
  // on mount. Left alone it prints a not-implemented stack on every render in
  // this file, which is how a real error stops being read.
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

/*
 * The two properties the whole rebuild rests on, asserted where a browser is
 * not available.
 *
 * 1. THE STAGE IS THE PAGE. The shell is its own `fixed inset-0` layer with no
 *    reading column and no page heading. The rejected version was a dashboard
 *    with the scene shrunk into a box in one corner, and the mechanism was
 *    exactly the wrapper this asserts the absence of.
 * 2. ONE MOUNT. A phase change must not replace the node the canvas lives in.
 *    A remount refetches the island through a Suspense fallback, so the learner
 *    watches their own world blink on the way into a conversation — which is
 *    invisible to every other test we have, because the rendered output is
 *    identical either side of it. Node IDENTITY is the only thing that tells
 *    the two apart, so that is what this checks.
 *
 * There is no WebGL in jsdom, so `SceneCanvas` renders its honest no-3D line
 * instead of a context. That is the point of testing the SHELL here: the layer,
 * the single mount and the layers over it are all DOM, and the renderer is
 * verified where a renderer exists.
 */

/**
 * A microphone that records nothing.
 *
 * The orb is a property of the shell now, so every render of the shell needs
 * one. Nothing in this file presses it — `MicOrb.test.tsx` owns that — so the
 * stub only has to satisfy the shape.
 */
function silentMicrophone(): Microphone {
  return {
    permission: 'granted',
    recording: false,
    levelRef: { current: 0 },
    holdBytesRef: { current: 0 },
    holdMsRef: { current: 0 },
    holdFractionRef: { current: 0 },
    subscribe: () => () => {},
    start: async () => {},
    stop: async () => null,
    release: () => {},
  };
}

const MIC: StageMicProps = {
  present: true,
  state: 'idle',
  microphone: silentMicrophone(),
  onClip: () => {},
};

function renderShell(phase: StagePhase) {
  return render(
    <MemoryRouter>
      <StageShell
        phase={phase}
        mic={MIC}
        character="rho"
        companion="liruf"
        scene="diorama-a"
        backdrop="day"
      >
        <StageLayer label={`layer-${phase}`} placement="fill">
          <p>{`content-${phase}`}</p>
        </StageLayer>
      </StageShell>
    </MemoryRouter>,
  );
}

describe('StageShell', () => {
  it('is its own full-bleed layer, with no app reading column around it', () => {
    const { container } = renderShell('arriving');
    const stage = container.querySelector<HTMLElement>('[data-tutor-stage]');

    expect(stage).not.toBeNull();
    expect(stage?.className).toContain('fixed');
    expect(stage?.className).toContain('inset-0');
    // The three classes that turned the first Tutor into a picture of a stage.
    expect(stage?.className).not.toContain('max-w-container');
    expect(stage?.className).not.toContain('mx-auto');
    expect(container.querySelector('h1')).toBeNull();
  });

  it('mounts exactly one stage, in every phase', () => {
    for (const phase of STAGE_PHASES) {
      const { container, unmount } = renderShell(phase);
      expect(container.querySelectorAll('[data-tutor-stage]')).toHaveLength(1);
      unmount();
    }
  });

  it('keeps the same stage node across a phase change', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <StageShell
          phase="arriving"
          mic={MIC}
          character="rho"
          companion="liruf"
          scene="diorama-a"
          backdrop="day"
          shot="establishing"
        >
          <StageLayer label="first" placement="fill">
            <p>first</p>
          </StageLayer>
        </StageShell>
      </MemoryRouter>,
    );

    const before = container.querySelector('[data-tutor-stage]');

    rerender(
      <MemoryRouter>
        <StageShell
          phase="conversing"
          mic={MIC}
          character="rho"
          companion="liruf"
          scene="diorama-a"
          backdrop="day"
          shot="closeup"
        >
          <StageLayer label="second" placement="fill">
            <p>second</p>
          </StageLayer>
        </StageShell>
      </MemoryRouter>,
    );

    const after = container.querySelector('[data-tutor-stage]');
    // Same NODE, not merely an equal one. A remount would satisfy every
    // rendered-output assertion and still blink the island.
    expect(after).toBe(before);
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  /*
   * THE WAY OUT, and why it gets four assertions instead of one.
   *
   * The route has no sidebar and no tab bar. The first version of this shell
   * still had two controls that said "leave the tutor" and a pointer user in a
   * close-up could reach neither: one was a world rune on `sky.mark.4`, culled
   * whenever the camera stops framing the sky, and the other was `sr-only`,
   * revealed by a key a thumb never presses. "A button with this name exists"
   * was true the whole time it was broken, so a test that only asserts that
   * would have passed. What follows asserts REACHABILITY instead.
   */
  describe('the way out', () => {
    function exitButton() {
      renderShell('conversing');
      const buttons = screen.getAllByRole('button', { name: /leave the tutor/i });
      // Exactly one. Two ways out means two tab stops with the same name, and
      // it was two because neither one worked.
      expect(buttons).toHaveLength(1);
      return buttons[0] as HTMLElement;
    }

    it('is not anchored to the world, so no camera move can cull it', () => {
      const exit = exitButton();
      /*
       * `useAnchorSlot` writes `position: fixed` as an INLINE style onto the
       * node it owns, and only the projector may hide that node. A way out with
       * such an ancestor is a way out the camera can take away, which is
       * precisely the bug: at close-up the sky mark is off frame for most of a
       * session.
       */
      expect(exit.closest('[style*="position: fixed"]')).toBeNull();
      // The two properties the projector flips together on a culled node.
      // Asserted as ATTRIBUTES: jsdom does not reflect `inert` as a property,
      // so reading `.inert` on an element nobody has touched returns undefined
      // and `toBe(false)` fails for the wrong reason.
      expect(exit.hasAttribute('hidden')).toBe(false);
      expect(exit.hasAttribute('inert')).toBe(false);
    });

    it('is visible without focus, because a thumb cannot focus anything', () => {
      const exit = exitButton();
      // `sr-only` is the skip-link grammar and it is right for a skip link. It
      // is wrong for the only navigation on the route.
      expect(exit.className).not.toContain('sr-only');
      expect(exit.textContent).toMatch(/leave the tutor/i);
    });

    it('is the first control a keyboard reaches', () => {
      renderShell('conversing');
      const focusable = document.querySelectorAll('button, [href], input, select, textarea');
      expect(focusable[0]?.textContent).toMatch(/leave the tutor/i);
    });

    it('stands its text on an opaque floor, never on glass over the render', () => {
      const exit = exitButton();
      /*
       * `.lf-glass` is surface at 78%, so 22% of anything sitting directly on
       * it is the moving, rotating, relit island. There is no contrast ratio to
       * compute against a background that changes every frame, which is why
       * /DESIGN.md requires body text on an opaque token here. `HudPlate` puts
       * the floor on its inner element; text directly on the frame has none.
       */
      expect(exit.className).toContain('lf-glass');
      expect(exit.firstElementChild?.className).toContain('bg-surface');
    });
  });
});

/*
 * THE PLACEMENT IS INVISIBLE IN A SCREENSHOT AND DECISIVE TO A FINGER.
 *
 * Two of the three product layers render nothing but `position: fixed` chrome,
 * so `world` and `fill` look identical in every picture anyone has taken of
 * this route. They are not identical: `fill` mounts a `pointer-events-auto`
 * centred column down the middle of the viewport, which quietly eats every tap
 * on the island behind it. The island is a control surface, so that is a dead
 * scene rather than a layout nit, and the only thing that catches it is an
 * assertion on the class the two placements differ by.
 */
describe('StageLayer placement', () => {
  function layer(placement: 'world' | 'bottom' | 'fill') {
    render(
      <StageLayer label={`layer-${placement}`} placement={placement}>
        <p>content</p>
      </StageLayer>,
    );
    return screen.getByRole('region', { name: `layer-${placement}` });
  }

  it('hands the island back every pixel it is not occupying, under "world"', () => {
    const section = layer('world');
    expect(section.className).toContain('pointer-events-none');
    // No inner column at all: the chips position themselves against the world.
    expect(section.querySelector('.pointer-events-auto')).toBeNull();
  });

  it('does mount a tap-catching column under "fill", which is why it is the exception', () => {
    const section = layer('fill');
    expect(section.querySelector('.pointer-events-auto')).not.toBeNull();
  });
});
