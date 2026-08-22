import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SafeAreaProvider } from '@/tutor-scene/SafeAreaContext';
import { StageLayer, StageShell, type StageMicProps } from '../stage/StageShell';
import type { Microphone } from '../useMicrophone';
import { ConversationView } from '../ConversationView';
import type { TutorSocket } from '../useTutorSocket';
import type { StartedSession } from '../types';

/*
 * The live conversation, tested at the three places a mistake here is a CHILD's
 * problem rather than a developer's.
 *
 * 1. The tutor asks "shall I explain that differently?" and the learner must be
 *    able to answer it. The offer used to exist only as chips anchored to three
 *    separate world points, and an anchored node is hidden AND inert the moment
 *    its point leaves the frame, so on a phone the answer was decided by which
 *    bearing the placement solver picked. That is the tutor asking a question
 *    nobody can answer, which is why these tests assert REACHABILITY and not
 *    merely rendering.
 * 2. A device with no usable WebGL never fires `ready`, and everything anchored
 *    stays hidden forever. What the tutor SAYS may not go with it.
 * 3. The soft keyboard borrows the lesson plate's height. It has to give it
 *    back, or the 2D bubble — the only mouth two of the four characters have —
 *    stays folded away at 88 px for the rest of the session.
 *
 * The in-scene arrangement itself needs a camera to hang off and is verified by
 * looking at it, per the standing instruction on this project. What runs here is
 * everything that must hold with no camera at all.
 */

const SESSION: StartedSession = {
  sessionId: '33333333-3333-4333-8333-333333333333',
  socketUrl: 'wss://oracle.test/ws/tutor?token=v1.abc.def',
  socketExpiresAt: '2026-08-21T12:00:00.000Z',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  backdrop: 'auto',
  locale: 'en-US',
  voiceAvailable: true,
  microphoneAvailable: true,
  microphoneBlockedBy: null,
};

const TUTOR_LINE = 'A goal is easier to reach when you can see it.';

function makeSocket(overrides: Partial<TutorSocket> = {}): TutorSocket {
  return {
    connection: 'open',
    turn: { seq: 1, text: TUTOR_LINE, emotion: 'happy', action: 'nod', audioUrl: null, next: 'ask' },
    history: [{ speaker: 'tutor', text: TUTOR_LINE, seq: 1 }],
    segment: null,
    budget: 'running',
    remainingMs: 300_000,
    microphone: true,
    intelDegraded: false,
    adaptationOffer: null,
    closedReason: null,
    error: null,
    sendText: vi.fn(),
    sendAudio: vi.fn(async () => undefined),
    reportGrade: vi.fn(),
    answerAdaptation: vi.fn(),
    endSession: vi.fn(),
    ...overrides,
  };
}

function conversation(socket: TutorSocket, ready: boolean) {
  return (
    <ConversationView
      phase="conversing"
      ready={ready}
      session={SESSION}
      socket={socket}
      token="test-token"
      speaking={false}
      awaitingReply={false}
      onAwaitReply={vi.fn()}
      onExit={vi.fn()}
    />
  );
}

function renderConversation(
  socket: TutorSocket,
  { ready = false, wrapper }: { ready?: boolean; wrapper?: (children: ReactNode) => ReactNode } = {},
) {
  const view = conversation(socket, ready);
  return render(<>{wrapper ? wrapper(view) : view}</>);
}

/** The sheet's settled height is the only visible trace of its detent. */
function plateHeight(): string {
  return screen.getByLabelText('Your tutor and your activity').style.height;
}

/** The one control that moves the sheet by hand. */
function resizeHandle(): HTMLElement {
  return screen.getByRole('button', { name: 'Make this panel bigger or smaller' });
}

/** An anchored node is positioned by the projector; nothing else carries this. */
function isAnchored(node: Element | null): boolean {
  return node?.closest('.will-change-transform') !== null && node !== null;
}

beforeEach(() => {
  /*
   * jsdom ships no media pipeline, and the stage's audio element pauses itself
   * on mount. Left alone every shell render here prints a not-implemented
   * stack, which is how a real error stops being read.
   *
   * `beforeEach` rather than `beforeAll`: the `afterEach` below restores every
   * spy, so a one-time install survives exactly one test and the noise comes
   * back for the rest of the file.
   */
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A microphone that records nothing. The shell requires one in every phase. */
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

const STAGE_MIC: StageMicProps = {
  state: 'idle',
  microphone: silentMicrophone(),
  onClip: () => {},
};

/**
 * The layer inside the shell it actually ships inside.
 *
 * `renderConversation` deliberately mounts no shell, which proves the answers
 * survive its absence. It cannot prove the opposite: that they survive its
 * PRESENCE. With a shell the guaranteed pair stops rendering in place and
 * becomes a portal into `dock.above`, and a portal whose target never attaches
 * renders nothing at all while every no-shell assertion stays green. That is
 * the configuration a child meets.
 */
function renderInShell(socket: TutorSocket, ready: boolean) {
  return render(
    <MemoryRouter>
      <StageShell phase="conversing" mic={STAGE_MIC} character="rho" companion="liruf" scene="diorama-a" backdrop="day">
        <StageLayer label="conversation" placement="world">
          {conversation(socket, ready)}
        </StageLayer>
      </StageShell>
    </MemoryRouter>,
  );
}

describe('answering the adaptation offer', () => {
  const OFFER = 'slower_pacing' as const;
  const QUESTION = 'Would you like me to slow down a little?';

  it('puts the question AND both answers somewhere no camera can take them away', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: true });

    /*
     * The guaranteed pair, and the assertion is that it is NOT anchored. With
     * `ready` true the in-world pair exists as well and would satisfy a naive
     * "is there a yes button" check while still being culled on a real phone.
     */
    const guaranteed = container.querySelector<HTMLElement>('[data-offer="guaranteed"]');
    expect(guaranteed).not.toBeNull();
    expect(isAnchored(guaranteed)).toBe(false);

    expect(guaranteed?.textContent).toContain(QUESTION);
    expect(guaranteed?.querySelector('[data-answer="yes"]')).not.toBeNull();
    expect(guaranteed?.querySelector('[data-answer="no"]')).not.toBeNull();
  });

  it('is answerable with no shell to dock into either', () => {
    /*
     * The offer rides the shell's dock, beside the microphone, which is a
     * portal. A portal with no target renders nothing, and "the answers exist
     * as long as the shell that hosts them does" is not the guarantee this
     * finding asked for: the whole point is that answering the tutor may not
     * depend on any container being there. This render mounts no shell.
     */
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: false });

    const guaranteed = container.querySelector<HTMLElement>('[data-offer="guaranteed"]');
    expect(guaranteed).not.toBeNull();
    expect(guaranteed?.querySelectorAll('[data-answer]')).toHaveLength(2);

    container.querySelector<HTMLElement>('[data-offer="guaranteed"] [data-answer="no"]')?.click();
    expect(socket.answerAdaptation).toHaveBeenCalledWith(OFFER, false);
  });

  it('answers YES from the guaranteed pair, with the whole question in its name', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: false });

    const yes = container.querySelector<HTMLElement>('[data-offer="guaranteed"] [data-answer="yes"]');
    // "Yes please" with nothing to say yes to is not a control: a child using a
    // screen reader must hear what they are agreeing to.
    expect(yes?.getAttribute('aria-label')).toContain(QUESTION);

    yes?.click();
    expect(socket.answerAdaptation).toHaveBeenCalledWith(OFFER, true);
  });

  it('answers NO from the guaranteed pair, so declining is always possible', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: false });

    const no = container.querySelector<HTMLElement>('[data-offer="guaranteed"] [data-answer="no"]');
    expect(no?.getAttribute('aria-label')).toContain(QUESTION);

    no?.click();
    expect(socket.answerAdaptation).toHaveBeenCalledWith(OFFER, false);
  });

  it('never shows one answer without the other, on either path', () => {
    for (const ready of [false, true]) {
      const socket = makeSocket({ adaptationOffer: OFFER });
      const { container, unmount } = renderConversation(socket, { ready });

      /*
       * The defect this replaces, stated as an assertion. Three chips on three
       * marks were culled independently, so a learner could be shown a lone
       * "Yes please". Every group that offers one answer must offer both.
       */
      for (const group of container.querySelectorAll<HTMLElement>('[data-offer]')) {
        expect(group.querySelectorAll('[data-answer="yes"]')).toHaveLength(1);
        expect(group.querySelectorAll('[data-answer="no"]')).toHaveLength(1);
        expect(group.textContent).toContain(QUESTION);
      }
      unmount();
    }
  });

  it('holds the in-world question and its answers on ONE anchored node', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: true });

    // One node is one cull decision. Three were three, which is how a bare
    // "Yes please" reached a child's screen with no question beside it.
    const world = container.querySelector<HTMLElement>('[data-offer="world"]');
    expect(world).not.toBeNull();
    expect(isAnchored(world?.querySelector('[data-answer="yes"]') ?? null)).toBe(true);
    expect(isAnchored(world?.querySelector('[data-answer="no"]') ?? null)).toBe(true);
    expect(world?.textContent).toContain(QUESTION);
  });

  it('keeps the in-world pair off a screen that has no scene to put it on', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: false });

    // Mounting it anyway would add a permanently hidden, permanently inert
    // duplicate of the only controls on screen.
    expect(container.querySelector('[data-offer="world"]')).toBeNull();
    expect(container.querySelectorAll('[data-answer]')).toHaveLength(2);
  });

  it('renders nothing at all when the tutor has not asked', () => {
    const socket = makeSocket();
    const { container } = renderConversation(socket, { ready: true });

    expect(container.querySelectorAll('[data-answer]')).toHaveLength(0);
  });

  it('reaches the learner through the dock when the shell IS mounted', () => {
    /*
     * The whole finding, asserted in the shipping configuration.
     *
     * Every other test in this block renders the layer on its own, where
     * `DockSlot` falls back to rendering in place. On the route there IS a
     * shell, so the same JSX travels through `createPortal` into the shell's
     * upper slot instead — a different code path, and the one a child meets.
     * If that target never attached, the guaranteed offer would be absent in
     * production with this file entirely green.
     */
    const socket = makeSocket({ adaptationOffer: OFFER });
    renderInShell(socket, true);

    const dock = screen.getByRole('group', { name: 'Talk to your tutor' });
    const guaranteed = dock.querySelector<HTMLElement>('[data-offer="guaranteed"]');
    expect(guaranteed).not.toBeNull();
    expect(guaranteed?.textContent).toContain(QUESTION);

    /*
     * The dock is viewport-anchored: it rides above the lesson sheet and no
     * camera move can reach it. An anchored ancestor would mean the projector
     * owns this node after all, which is the defect.
     */
    expect(isAnchored(guaranteed)).toBe(false);
    expect(guaranteed?.closest('[hidden]')).toBeNull();
    expect(guaranteed?.closest('[inert]')).toBeNull();

    const yes = guaranteed?.querySelector<HTMLElement>('[data-answer="yes"]');
    const no = guaranteed?.querySelector<HTMLElement>('[data-answer="no"]');
    expect(yes).not.toBeNull();
    expect(no).not.toBeNull();

    yes?.click();
    expect(socket.answerAdaptation).toHaveBeenLastCalledWith(OFFER, true);
    no?.click();
    expect(socket.answerAdaptation).toHaveBeenLastCalledWith(OFFER, false);
  });

  it('puts the question above the microphone, never in front of it', () => {
    /*
     * Order inside the dock is a measurement, not a preference. The column
     * grows upward from an edge the lesson sheet fixes, so whatever sits at the
     * TOP is what a tall dock pushes off the screen. The offer goes first so
     * the overflow is the question rather than the microphone and the composer,
     * which is a bug this route has already shipped once.
     */
    renderInShell(makeSocket({ adaptationOffer: OFFER }), true);

    const dock = screen.getByRole('group', { name: 'Talk to your tutor' });
    const guaranteed = dock.querySelector<HTMLElement>('[data-offer="guaranteed"]') as HTMLElement;
    const orb = Array.from(dock.querySelectorAll<HTMLElement>('button')).find(
      (node) => node.className.includes('rounded-full') && node.className.includes('h-24'),
    );
    expect(orb).toBeDefined();

    // DOCUMENT_POSITION_FOLLOWING: the orb comes after the question in the DOM,
    // so the question is the row above it and the first thing a tab reaches.
    expect(guaranteed.compareDocumentPosition(orb as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('takes a FULL lesson plate down to HALF so the question is not clipped', () => {
    const { rerender } = render(conversation(makeSocket(), false));
    const half = plateHeight();

    // Open the transcript all the way. Measured in a real browser at 375x812,
    // this is the one detent where the dock overflows the top of the screen
    // once it carries a question as well as the orb and the composer.
    fireEvent.click(resizeHandle());
    expect(plateHeight()).not.toBe(half);

    rerender(conversation(makeSocket({ adaptationOffer: OFFER }), false));
    expect(plateHeight()).toBe(half);
  });
});

describe('a conversation on a device that cannot draw the island', () => {
  it('still announces what the tutor said, on a plate that needs no projection', () => {
    const socket = makeSocket();
    const { container } = renderConversation(socket, { ready: false });

    /*
     * The 2D bubble carries the same sentence visually but is deliberately not
     * a live region, because the caption over the character's head is. With no
     * projector the caption never appears, so without this plate a screen
     * reader learner gets a tutor that never says anything.
     */
    // The atomic grammar is the CAPTION's, and only the caption's. The
    // transcript below is a live region too, but an `aria-relevant="additions"`
    // log rather than a sentence announced whole.
    const live = container.querySelectorAll<HTMLElement>('[aria-live="polite"][aria-atomic="true"]');
    expect(live).toHaveLength(1);
    expect(live[0]?.textContent).toContain(TUTOR_LINE);
    expect(isAnchored(live[0] ?? null)).toBe(false);
  });

  it('hands the announcement back to the anchored caption once the island is up', () => {
    const socket = makeSocket();
    const { container } = renderConversation(socket, { ready: true });

    // Exactly one live region either way: two carrying one sentence make a
    // screen reader say everything twice.
    // The atomic grammar is the CAPTION's, and only the caption's. The
    // transcript below is a live region too, but an `aria-relevant="additions"`
    // log rather than a sentence announced whole.
    const live = container.querySelectorAll<HTMLElement>('[aria-live="polite"][aria-atomic="true"]');
    expect(live).toHaveLength(1);
    expect(isAnchored(live[0] ?? null)).toBe(true);
  });

  it('keeps the minutes readable when the sky rune cannot be projected', () => {
    const socket = makeSocket({ budget: 'running', remainingMs: 300_000 });
    const { container } = renderConversation(socket, { ready: false });

    const rune = Array.from(container.querySelectorAll<HTMLElement>('span')).find((node) =>
      node.textContent?.includes('5 min left'),
    );
    expect(rune).toBeDefined();
    expect(isAnchored(rune ?? null)).toBe(false);
  });
});

// ── The soft keyboard ───────────────────────────────────────────────────────

/**
 * The only signal a soft keyboard gives us. `window.innerHeight` does not move
 * on iOS when the keyboard opens, so `SafeAreaProvider` watches this instead.
 */
class FakeVisualViewport extends EventTarget {
  height = window.innerHeight;

  resizeTo(height: number) {
    this.height = height;
    this.dispatchEvent(new Event('resize'));
  }
}

describe('the soft keyboard and the lesson plate', () => {
  let viewport: FakeVisualViewport;

  beforeEach(() => {
    viewport = new FakeVisualViewport();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: viewport,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  function withSafeArea(children: ReactNode) {
    return <SafeAreaProvider>{children}</SafeAreaProvider>;
  }

  it('gives the plate its height back when the keyboard closes', () => {
    renderConversation(makeSocket(), { wrapper: withSafeArea });

    const resting = plateHeight();
    expect(resting).not.toBe('88px');

    // Down to PEEK: an open keyboard plus a half-height sheet leaves the
    // caption nowhere at all at 375 px.
    act(() => viewport.resizeTo(Math.round(window.innerHeight / 2)));
    expect(plateHeight()).toBe('88px');

    /*
     * And back up. Leaving it minimised is the defect: only a brand-new segment
     * or a manual drag could raise it again, so a learner who typed one message
     * lost the 2D bubble, the activity and the transcript for the rest of the
     * session.
     */
    act(() => viewport.resizeTo(window.innerHeight));
    expect(plateHeight()).toBe(resting);
  });

  it('leaves a plate the learner moved while typing exactly where they left it', () => {
    renderConversation(makeSocket(), { wrapper: withSafeArea });

    const resting = plateHeight();
    act(() => viewport.resizeTo(Math.round(window.innerHeight / 2)));
    expect(plateHeight()).toBe('88px');

    // The learner drags it back up themselves, past where it started.
    const handle = resizeHandle();
    fireEvent.click(handle);
    fireEvent.click(handle);
    const chosen = plateHeight();
    expect(chosen).not.toBe('88px');
    expect(chosen).not.toBe(resting);

    // Closing the keyboard must not undo a choice made after it opened.
    act(() => viewport.resizeTo(window.innerHeight));
    expect(plateHeight()).toBe(chosen);
  });

  it('borrows nothing from a plate the learner had already minimised', () => {
    renderConversation(makeSocket(), { wrapper: withSafeArea });

    // Down to PEEK by hand: HALF steps up to FULL, and FULL wraps round.
    const handle = resizeHandle();
    fireEvent.click(handle);
    expect(plateHeight()).not.toBe('88px');
    fireEvent.click(handle);
    expect(plateHeight()).toBe('88px');

    act(() => viewport.resizeTo(Math.round(window.innerHeight / 2)));
    act(() => viewport.resizeTo(window.innerHeight));

    // Nothing was borrowed, so nothing is handed back: the plate stays where
    // the learner deliberately put it.
    expect(plateHeight()).toBe('88px');
  });
});
