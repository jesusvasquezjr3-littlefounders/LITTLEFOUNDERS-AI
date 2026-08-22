import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { StageLayer, StageShell, STAGE_PHASES, useStageDock, type StageMicProps } from '../StageShell';
import { micForPhase } from '../micForPhase';
import type { Microphone } from '@/tutor/useMicrophone';

/*
 * THE ONE MICROPHONE, IN EVERY PHASE THAT HAS ONE — AND IN NO OTHER.
 *
 * The first half is the assertion the last two builds could not have passed.
 * The orb was mounted inside `OfferChips` and inside `ConversationView`, so
 * `arriving`, `personalizing`, `closing` and `unavailable` had no microphone in
 * the DOM at all — and `personalizing` is the FIRST screen a new learner sees.
 * Every gate was green through it, because nothing enumerated the phases and
 * looked.
 *
 * The second half is what the owner's phone then found, and it is the reason
 * this file no longer says "every phase" flatly. Mounting the orb in `closing`
 * too put a 96 px DISABLED microphone at (139, 632) on top of the "See you
 * soon!" plate, on top of the indigo "Start another session" button — the one
 * action of the phase — and on top of its own explanation. "Present in every
 * phase" and "present in a phase where speaking is over" are different claims;
 * `micForPhase` decides which phases are which, and this walks STAGE_PHASES and
 * holds it to that decision in the DOM.
 *
 * Where the orb IS present the assertions are unchanged: exactly one, with an
 * accessible name, not hidden, not inert, and carrying a visible reason whenever
 * it is disabled (/ORACLE.md §14.1).
 */

beforeAll(() => {
  // jsdom ships no media pipeline, and the stage's audio element pauses itself
  // on mount. Left alone it prints a not-implemented stack on every render.
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

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

/**
 * The orb, described exactly the way the product describes it: by asking
 * `micForPhase` and translating the keys it returns. A fixture that hard-coded
 * `state: 'idle'` would prove the shell renders AN orb and nothing about the
 * one a learner actually meets.
 */
function micFor(phase: (typeof STAGE_PHASES)[number]): StageMicProps {
  const plan = micForPhase({
    phase,
    blockedBy: null,
    live: phase === 'conversing',
    recording: false,
    awaitingReply: false,
    speaking: false,
    starting: false,
  });
  return {
    present: plan.present,
    state: plan.state,
    microphone: silentMicrophone(),
    blockedReason: plan.blockedReason,
    // The real experience runs these through `t()`. Anything non-empty is
    // enough here: what is under test is that a reason REACHES the orb.
    blockedCopy: plan.blockedKey ? `reason:${plan.blockedKey}` : null,
    idleCopy: plan.idleKey ? `idle:${plan.idleKey}` : undefined,
    onClip: () => {},
  };
}

function renderPhase(phase: (typeof STAGE_PHASES)[number]) {
  return render(
    <MemoryRouter>
      <StageShell
        mic={micFor(phase)}
        character="rho"
        companion="liruf"
        scene="diorama-a"
        backdrop="day"
      >
        <StageLayer label={`layer-${phase}`} placement="world">
          <p>{`content-${phase}`}</p>
        </StageLayer>
      </StageShell>
    </MemoryRouter>,
  );
}

/** Every control that is the microphone, however it is currently named. */
function orbs(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((node) => node.className.includes('rounded-full') && node.className.includes('h-24'));
}

/** The phases whose plan says the orb is on screen. */
const PHASES_WITH_ORB = STAGE_PHASES.filter((phase) => micFor(phase).present);

describe('the microphone is a property of the stage', () => {
  it('is mounted exactly once in every phase whose plan says it is present', () => {
    for (const phase of PHASES_WITH_ORB) {
      const { unmount } = renderPhase(phase);
      const found = orbs();
      // ONE. Two owners is what left four phases with none, and two orbs would
      // be two `useMicrophone` calls and two live recording indicators.
      expect(found, phase).toHaveLength(1);
      unmount();
    }
  });

  /*
   * The absence is asserted as tightly as the presence, and the list is spelled
   * out rather than derived, so that removing the orb from a SECOND phase is a
   * deliberate edit to this line and not a quiet consequence of a plan change.
   * Going missing by accident is the original bug; going missing on purpose is
   * a product decision, and only one has been made.
   */
  it('is absent from exactly one phase, and it is the one where speaking is over', () => {
    const absent = STAGE_PHASES.filter((phase) => !micFor(phase).present);
    expect(absent).toEqual(['closing']);

    const { unmount } = renderPhase('closing');
    // Not merely disabled — not in the DOM. A disabled 96 px orb here landed on
    // the goodbye plate, on the indigo "start another session" button and on
    // its own reason line, all at 375 px.
    expect(orbs()).toHaveLength(0);
    unmount();
  });

  it('is never hidden, inert or nameless, in any phase that has one', () => {
    for (const phase of PHASES_WITH_ORB) {
      const { unmount } = renderPhase(phase);
      const orb = orbs()[0] as HTMLElement;
      expect(orb.getAttribute('aria-label')?.trim(), phase).toBeTruthy();
      // The two properties the projector flips together on a culled node. The
      // orb is viewport-anchored precisely so no camera move can set them.
      expect(orb.hasAttribute('hidden'), phase).toBe(false);
      expect(orb.hasAttribute('inert'), phase).toBe(false);
      expect(orb.closest('[style*="position: fixed"]'), phase).toBeNull();
      unmount();
    }
  });

  it('says why, in place, in every phase where it cannot be used', () => {
    for (const phase of PHASES_WITH_ORB) {
      const { container, unmount } = renderPhase(phase);
      const orb = orbs()[0] as HTMLElement;
      if (orb.getAttribute('aria-disabled') === 'true') {
        const described = (orb.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
        const lines = described
          .map((id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? '')
          .join(' ')
          .trim();
        // A dashed ring with no sentence is an absent control wearing a ring:
        // a learner cannot tell it apart from a microphone that is broken.
        expect(lines.length, phase).toBeGreaterThan(0);
      }
      unmount();
    }
  });

  it('is disabled on the phases where it is on screen and nothing could be recorded', () => {
    for (const phase of ['arriving', 'personalizing', 'unavailable'] as const) {
      const { unmount } = renderPhase(phase);
      // Present and honest, not absent. There is no socket in any of these, so
      // a live-looking orb would be a promise the screen cannot keep.
      expect(orbs()[0]?.getAttribute('aria-disabled'), phase).toBe('true');
      unmount();
    }
  });

  it('is live on the two phases where a press does something', () => {
    for (const phase of ['introducing', 'conversing'] as const) {
      const { unmount } = renderPhase(phase);
      expect(orbs()[0]?.hasAttribute('aria-disabled'), phase).toBe(false);
      unmount();
    }
  });
});

/*
 * THE DOCK RIDES ABOVE WHATEVER IS UNDER IT.
 *
 * On a phone the personalization plate and the lesson sheet both sit on the
 * bottom edge, and so does the orb. Two elements cannot both own that edge:
 * before the shell owned it, the microphone sat ON TOP of the sheet, measured
 * in a real browser at a 381 px footprint and a computed `bottom` of 12 px. The
 * channel is imperative because a sheet drag writes sixty rectangles a second,
 * so the only visible trace is the inline style — which is exactly what this
 * reads.
 */
function DockProbe({ height }: { height: number }) {
  const dock = useStageDock();
  return (
    <div
      data-probe=""
      ref={(node) => {
        if (!node) {
          dock?.keepClearOf(null);
          return;
        }
        // jsdom lays nothing out, so the surface states its own size the way a
        // real one would: `height` tall, sitting 16 px off the bottom edge.
        node.getBoundingClientRect = () =>
          ({ height, bottom: window.innerHeight - 16, top: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        dock?.keepClearOf(node);
      }}
    />
  );
}

describe('the dock', () => {
  function renderWithProbe(height: number) {
    return render(
      <MemoryRouter>
        <StageShell
          mic={micFor('personalizing')}
          character="rho"
          companion="liruf"
          scene="diorama-a"
          backdrop="day"
        >
          <StageLayer label="probe" placement="world">
            <DockProbe height={height} />
          </StageLayer>
        </StageShell>
      </MemoryRouter>,
    );
  }

  it('lifts clear of a surface that claims the bottom edge', () => {
    renderWithProbe(200);
    const dock = screen.getByRole('group', { name: 'Talk to your tutor' });
    // 200 tall + the 16 px it is inset by + the gap the dock keeps.
    expect(dock.style.bottom).toBe('228px');
  });

  it('hands the resting inset back when that surface goes away', () => {
    const view = renderWithProbe(200);
    const dock = screen.getByRole('group', { name: 'Talk to your tutor' });
    expect(dock.style.bottom).not.toBe('');
    view.rerender(
      <MemoryRouter>
        <StageShell
          mic={micFor('introducing')}
          character="rho"
          companion="liruf"
          scene="diorama-a"
          backdrop="day"
        >
          <StageLayer label="probe" placement="world">
            <p>nothing on the bottom edge now</p>
          </StageLayer>
        </StageShell>
      </MemoryRouter>,
    );
    // Empty, not zero: a `bottom: 0px` would override the class that owns the
    // resting inset and weld the orb to the bottom of the screen.
    expect(screen.getByRole('group', { name: 'Talk to your tutor' }).style.bottom).toBe('');
  });
});
