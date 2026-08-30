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
 *    able to answer it, ONCE. The offer used to exist only as chips anchored to
 *    three separate world points, and an anchored node is hidden AND inert the
 *    moment its point leaves the frame, so on a phone the answer was decided by
 *    which bearing the placement solver picked. That is the tutor asking a
 *    question nobody can answer, which is why these tests assert REACHABILITY
 *    and not merely rendering. The fix for it then mounted the offer twice and
 *    let a camera move clip one of the copies mid-word, so they now assert
 *    UNIQUENESS as well: a half-read question with its own live Yes button is
 *    worse than either arrangement alone.
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
    turn: { seq: 1, text: TUTOR_LINE, emotion: 'happy', action: 'nod', audioUrl: null, audioPending: false, next: 'ask', policy: null, demonstrate: null, whiteboard: null },
    history: [{ speaker: 'tutor', text: TUTOR_LINE, seq: 1 }],
    segment: null,
    lesson: null,
    budget: 'running',
    remainingMs: 300_000,
    microphone: true,
    micRevoked: false,
    intelDegraded: false,
    adaptationOffer: null,
    closedReason: null,
    error: null,
    thinking: false,
    sendText: vi.fn(),
    sendAudio: vi.fn(async () => undefined),
    streamAudioChunk: vi.fn(),
    commitAudioStream: vi.fn(() => false),
    abandonAudioStream: vi.fn(),
    interrupt: vi.fn(),
    editLast: vi.fn(),
    reportGrade: vi.fn(),
    answerAdaptation: vi.fn(),
    endSession: vi.fn(),
    ...overrides,
  };
}

function conversation(
  socket: TutorSocket,
  ready: boolean,
  overrides: { onDraftChange?: (hasDraft: boolean) => void } = {},
) {
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
      onDraftChange={overrides.onDraftChange ?? vi.fn()}
      resuming={false}
      replyTimedOut={false}
      onRestart={vi.fn()}
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

/**
 * The one control that moves the sheet by hand.
 *
 * Matched on a fragment, because at PEEK the handle also carries what the sheet
 * is holding: its accessible name is the visible label followed by the resize
 * sentence, so that a learner who cannot see the row still hears both what is
 * waiting and that pressing this opens it.
 */
function resizeHandle(): HTMLElement {
  return screen.getByRole('button', { name: /Resize this panel/ });
}

/**
 * The sheet's body, by its own seam.
 *
 * It used to be found through the 2D bubble's accessible name, which worked
 * only while the bubble existed and stopped meaning anything the moment it
 * moved into the caption (/DESIGN.md §Lumen → *One line, one printing, two
 * channels*). `data-plate-body` is the body saying what it is.
 */
function plateBody(): HTMLElement {
  const body = screen
    .getByLabelText('Your tutor and your activity')
    .querySelector<HTMLElement>('[data-plate-body]');
  if (!body) throw new Error('the lesson plate has no body');
  return body;
}

/** The sheet's body is not mounted at PEEK, so this is how a test asks. */
function plateBodyShown(): boolean {
  const body = plateBody();
  return !body.hasAttribute('hidden') && body.style.display !== 'none';
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
  // Conversing is one of the phases the orb is present in, which is what these
  // cases are about; `stageMic.test.tsx` owns the phases where it is not.
  present: true,
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
      <StageShell mic={STAGE_MIC} character="rho" companion="liruf" scene="diorama-a" backdrop="day">
        <StageLayer label="conversation" placement="world">
          {conversation(socket, ready)}
        </StageLayer>
      </StageShell>
    </MemoryRouter>,
  );
}

const WHITEBOARD_TURN = {
  seq: 2,
  text: 'Imaginemos que guardas 10 pesos y cada día te dan 2 más.',
  emotion: 'happy' as const,
  action: 'nod' as const,
  audioUrl: null,
  audioPending: false,
  next: 'ask' as const,
  policy: null,
  demonstrate: null,
  whiteboard: {
    kind: 'sequence' as const,
    start: 10,
    steps: [{ op: 'add' as const, value: 2 }, { op: 'add' as const, value: 2 }],
    unit: 'day' as const,
    values: [10, 12, 14],
    label: 'Cada día te dan 2 más',
    currency: 'MXN' as const,
  },
};


describe('the live whiteboard (V4)', () => {
  /*
   * The owner's own defect: a turn that draws a growth story used to render
   * as plain text beside an unrelated activity, at PEEK on a phone (90 px).
   * A turn carrying `whiteboard` must raise the sheet AND show the board
   * instead of the segment panel — the same treatment an announced activity
   * already gets (see the sibling describe block for that case).
   */
  it('raises a resting sheet and renders the board, not the segment panel', () => {
    const { rerender } = render(conversation(makeSocket(), false));
    expect(plateHeight()).toBe('88px');

    rerender(conversation(makeSocket({ turn: WHITEBOARD_TURN }), false));

    expect(plateHeight()).not.toBe('88px');
    expect(screen.getByText('Cada día te dan 2 más')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Cada día te dan 2 más/ })).toBeInTheDocument();
  });

  it('a graded segment wins the plate over a whiteboard, if both are somehow present', () => {
    const segment = {
      segmentId: '22222222-2222-4222-8222-222222222222',
      seq: 0,
      origin: 'catalog' as const,
      segment: { id: 's', type: 'quiz_mcq', prompt_md: '¿Cuánto es?', difficulty: 2, xp: 20, payload: { options: [{ id: 'a', text_md: '12' }] } },
      scoresXp: true,
      framing: 'Practica esto.',
    };
    render(conversation(makeSocket({ turn: WHITEBOARD_TURN, segment }), false));
    expect(screen.queryByText('Cada día te dan 2 más')).not.toBeInTheDocument();
  });
});

describe('telling the shell about an unsent draft', () => {
  /*
   * FOUND LIVE, 2026-08-29: hands-free listening opens the microphone the
   * instant the tutor's turn ends, with no awareness of whether the learner
   * is typing instead of speaking. Ambient noise crossing the silence
   * detector's threshold mid-sentence submitted a garbled voice transcript
   * OVER what had actually been typed. `onDraftChange` is the composer's
   * only way to tell the shell "do not open the microphone right now" —
   * these tests are the composer's half of that contract; the shell's half
   * (disabling `useHandsFreeTurn`) is asserted directly in
   * useHandsFreeTurn.test.tsx.
   */
  it('reports a draft the instant the learner types a character', () => {
    const onDraftChange = vi.fn();
    render(conversation(makeSocket(), false, { onDraftChange }));
    onDraftChange.mockClear();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });

    expect(onDraftChange).toHaveBeenCalledWith(true);
  });

  it('reports no draft for whitespace-only text', () => {
    // A learner who mashes the space bar has not typed an answer, and the
    // microphone must not stay closed over nothing.
    const onDraftChange = vi.fn();
    render(conversation(makeSocket(), false, { onDraftChange }));
    onDraftChange.mockClear();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(onDraftChange).toHaveBeenCalledWith(false);
  });

  it('reports the draft is gone once the field is cleared', () => {
    const onDraftChange = vi.fn();
    render(conversation(makeSocket(), false, { onDraftChange }));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '15' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(input, { target: { value: '' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(false);
  });

  it('reports the draft is gone once the message is sent', () => {
    const onDraftChange = vi.fn();
    const sendText = vi.fn();
    render(conversation(makeSocket({ sendText }), false, { onDraftChange }));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'cinco' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendText).toHaveBeenCalledWith('cinco');
    expect(onDraftChange).toHaveBeenLastCalledWith(false);
  });
});

/*
 * Found by adversarial review, round 26 (2026-08-30, HIGH): every OTHER way
 * to speak to the tutor already refuses to fire twice — `MicOrb` won't start
 * a new recording while a reply is pending, the "explain differently" chip
 * is gated on `!awaitingReply` — but the composer, "the ONLY channel" when no
 * voice provider is configured, had no such guard. A learner who typed again
 * while waiting could fire a second, billed turn before the first reply had
 * even landed.
 */
describe('the composer refuses to submit while a reply is already pending', () => {
  function conversationAwaitingReply(socket: TutorSocket) {
    return (
      <ConversationView
        phase="conversing"
        ready={false}
        session={SESSION}
        socket={socket}
        token="test-token"
        speaking={false}
        awaitingReply
        onAwaitReply={vi.fn()}
        onDraftChange={vi.fn()}
        resuming={false}
        replyTimedOut={false}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />
    );
  }

  it('disables the Send button', () => {
    render(conversationAwaitingReply(makeSocket()));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'are you there' } });

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('does not send even if Enter is pressed', () => {
    const sendText = vi.fn();
    render(conversationAwaitingReply(makeSocket({ sendText })));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'are you there' } });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(sendText).not.toHaveBeenCalled();
  });
});

/*
 * Found by adversarial review, round 26 (2026-08-30, HIGH): the transcript's
 * own edit affordance refuses to START a rephrase once an activity or
 * whiteboard is open, but `submitTyped` never re-checked that at SEND time —
 * only at the moment the affordance was clicked. A learner who tapped
 * "Rephrase" and then had a segment arrive before pressing Send could still
 * fire a server-side conversation rewind (`socket.editLast`) while an
 * activity was on screen, exactly the flow this file's own comment says is
 * "not a flow we honour".
 */
describe('an in-progress rephrase is abandoned once an activity opens', () => {
  const LEARNER_LINE = 'is 5 plus 5 equal to 10';
  const historyWithLearnerLine = [
    { speaker: 'tutor' as const, text: TUTOR_LINE, seq: 1 },
    { speaker: 'learner' as const, text: LEARNER_LINE, seq: 2 },
  ];

  it('sends a segment-interrupted rephrase as an ordinary new message, never as a rewind', () => {
    const editLast = vi.fn();
    const sendText = vi.fn();
    const socket = makeSocket({ history: historyWithLearnerLine, editLast, sendText });
    const { rerender } = render(conversation(socket, false));

    // Begin rephrasing the learner's last message.
    fireEvent.click(resizeHandle());
    fireEvent.click(screen.getByRole('button', { name: 'Rephrase this message' }));
    expect(screen.getByPlaceholderText('Rephrase your message…')).toHaveValue(LEARNER_LINE);

    // A segment arrives before the learner presses Send.
    const socketWithSegment = makeSocket({
      history: historyWithLearnerLine,
      editLast,
      sendText,
      segment: {
        segmentId: 'seg-1',
        seq: 2,
        origin: 'bank',
        segment: {
          type: 'coin_count',
          prompt_md: 'Junta las monedas.',
          payload: { currency: 'MXN', denominations: [1, 2, 5, 10], target: 8 },
        },
        scoresXp: true,
        framing: 'Junta las monedas exactas.',
      },
    });
    rerender(conversation(socketWithSegment, false));

    const input = screen.getByPlaceholderText('Type a message…');
    expect(input).toHaveValue(LEARNER_LINE);
    fireEvent.keyDown(input, { key: 'Enter' });

    // Sent as a fresh message, and the conversation was never rewound.
    expect(editLast).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(LEARNER_LINE);
  });
});

describe('answering the adaptation offer', () => {
  const OFFER = 'slower_pacing' as const;
  const QUESTION = 'Shall I slow down?';

  it('puts the question AND both answers somewhere no camera can take them away', () => {
    const socket = makeSocket({ adaptationOffer: OFFER });
    const { container } = renderConversation(socket, { ready: true });

    /*
     * The guaranteed pair, and the assertion is that it is NOT anchored. An
     * anchored copy would satisfy a naive "is there a yes button" check while
     * still being culled — or clipped — on a real phone.
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

  it('asks the question ONCE, whether or not there is a scene to ask it in', () => {
    /*
     * THE DUPLICATE, ASSERTED AWAY.
     *
     * There was a second copy — question and both answers on one node anchored
     * to `stage.mark.2` — added on the model of a WorldChip and the mesh it
     * mirrors. A WorldChip pairs a DOM control with a PICKABLE MESH, so the
     * learner meets one offer reachable two ways; two DOM copies are two
     * offers, and the anchored one is the copy a camera move can cut in half.
     * Driven at 375x812 it read "Would another example h" at
     * (-42, 105, 263, 57) with its own live "Yes please" at (-2, 170), and at
     * 1280x800 the same pair escaped off the top with "Yes" at (40, -13).
     *
     * Both `ready` states, because the anchored copy only ever mounted in one
     * of them and a test that checked the other would have passed throughout.
     */
    for (const ready of [false, true]) {
      const socket = makeSocket({ adaptationOffer: OFFER });
      const { container, unmount } = renderConversation(socket, { ready });

      expect(container.querySelectorAll('[data-offer]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-answer="yes"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-answer="no"]')).toHaveLength(1);
      // And the one that survived is the one no projection can move.
      expect(isAnchored(container.querySelector('[data-answer="yes"]'))).toBe(false);
      unmount();
    }
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

  /*
   * THE SHEET STANDS DOWN FOR THE LENGTH OF A YES-OR-NO.
   *
   * The tutor asking "shall I explain that differently?" is a moment: the
   * camera swings to the two-shot, the question and its two answers are the
   * only chrome that matters, and an open sheet is a panel across the character
   * being asked. It used to drop only from FULL to HALF, which was measured
   * against a dock that did not yet carry a question and two answers; the
   * answer is the same wherever the sheet was standing, so it is the same rule.
   */
  it('stands a raised lesson sheet down while the question is up', () => {
    const { rerender } = render(conversation(makeSocket(), false));
    // The sheet rests at PEEK, so the learner has to raise it to reach the
    // states this case is about.
    expect(plateHeight()).toBe('88px');

    fireEvent.click(resizeHandle());
    const half = plateHeight();
    expect(half).not.toBe('88px');

    rerender(conversation(makeSocket({ adaptationOffer: OFFER }), false));
    expect(plateHeight()).toBe('88px');

    // Open the transcript all the way and ask again: the detent it was at makes
    // no difference to the answer.
    rerender(conversation(makeSocket(), false));
    fireEvent.click(resizeHandle());
    fireEvent.click(resizeHandle());
    expect(plateHeight()).not.toBe(half);

    rerender(conversation(makeSocket({ adaptationOffer: OFFER }), false));
    expect(plateHeight()).toBe('88px');
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

// ── Where the sheet rests on a phone ────────────────────────────────────────

/**
 * One live activity on the plate, shaped like the real thing.
 *
 * The renderer itself is exercised in the Lesson Engine's own suite; what
 * matters here is only that `socket.segment` is non-null, because that is what
 * the resting sheet has to tell the learner about.
 */
const SEGMENT = {
  segmentId: '44444444-4444-4444-8444-444444444444',
  seq: 3,
  origin: 'live' as const,
  scoresXp: true,
  framing: 'Try this one with me.',
  segment: {
    id: '44444444-4444-4444-8444-444444444444',
    type: 'quiz_mcq',
    prompt_md: 'If you save 25 a week, how much is that in 4 weeks?',
    difficulty: 2,
    xp: 20,
    payload: { options: [{ id: 'a', text_md: '100' }, { id: 'b', text_md: '75' }] },
  },
};

/*
 * THE SHEET RESTS AT PEEK, AND PEEK HAS TO EARN IT.
 *
 * The sheet used to open at HALF — 45% of the viewport — and to raise itself
 * there again the moment an activity arrived. Measured at 375x812 that left
 * 227 px of island on a route whose whole premise is that the island IS the
 * page, and it did it without anybody choosing it. Resting at PEEK is only
 * defensible if PEEK still tells the learner what is waiting and opens on one
 * press, which is what these assert. The alternative — a sheet that rests at
 * 88 px of CLIPPED panel — is how the auto-raise came to be written.
 */
describe('the resting lesson sheet', () => {
  it('rests at PEEK rather than taking half the phone the moment it mounts', () => {
    renderConversation(makeSocket(), { ready: true });
    expect(plateHeight()).toBe('88px');
    expect(plateBodyShown()).toBe(false);
  });

  it('says what is waiting instead of opening itself over the tutor', () => {
    renderConversation(makeSocket({ segment: SEGMENT }), { ready: true });

    // Still resting: an arriving activity is news, not a reason to bury the
    // character who is teaching it.
    expect(plateHeight()).toBe('88px');
    // In words, on the row itself...
    expect(resizeHandle().textContent).toContain('Activity ready');
    // ...and to a learner who is not looking at it. The transcript's own live
    // region is not mounted at PEEK, so this is the only channel left.
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(
      'An activity is ready.',
    );
  });

  /*
   * IT SAYS NOTHING WHEN THERE IS NOTHING TO SAY, corrected 2026-08-22.
   *
   * The row used to print "Conversation" whenever nothing had arrived, which is
   * the name of the screen the learner is standing on (/DESIGN.md §Lumen → What
   * to delete). What the row has to communicate is that it OPENS, and the
   * chevron says that in every locale without a word. The resize sentence is
   * still its accessible name, so nobody loses the control.
   */
  it('spends no words on the resting row when nothing has arrived', () => {
    renderConversation(makeSocket(), { ready: true });
    const handle = resizeHandle();
    expect(handle.textContent).not.toContain('Conversation');
    // The chevron is the whole statement, and it is still there.
    expect(handle.textContent).toContain('keyboard_arrow_up');
    expect(handle.getAttribute('aria-label')).toBe('Resize this panel');
    // No news, no announcement. A row that says something on every turn is a
    // row a learner learns to ignore on the turn that matters.
    expect(screen.queryByText('An activity is ready.')).toBeNull();
  });

  it('carries the visible words into the accessible name of the row', () => {
    renderConversation(makeSocket({ segment: SEGMENT }), { ready: true });
    const name = resizeHandle().getAttribute('aria-label') ?? '';
    // Visible label first: leading with the resize sentence drops the words a
    // learner would say out loud out of the front of the name.
    expect(name.startsWith('Activity ready')).toBe(true);
    expect(name).toContain('Resize this panel');
  });

  it('opens on one press, and the activity is there when it does', () => {
    renderConversation(makeSocket({ segment: SEGMENT }), { ready: true });
    fireEvent.click(resizeHandle());

    expect(plateHeight()).not.toBe('88px');
    expect(plateBodyShown()).toBe(true);
  });

  it('keeps the body out of the tab order while it is resting', () => {
    renderConversation(makeSocket({ segment: SEGMENT }), { ready: true });

    /*
     * `hidden`, not merely clipped by an 88 px window. Clipped content is
     * still focusable and still described, so a keyboard user tabs into an
     * exercise that is not on screen and the focus ring goes somewhere nobody
     * can see — the same defect the projector's cull exists to prevent.
     */
    const body = plateBody();
    expect(body.hasAttribute('hidden')).toBe(true);

    /*
     * AND IT IS REALLY NOT PAINTED, which is a second assertion because it was
     * a second bug. `[hidden] { display: none }` is a 0-1-0 user-agent rule,
     * and the body carries `flex` from an author stylesheet the moment it lays
     * its children out as a column — so the attribute alone reported `hidden`
     * to every script that asked while the whole exercise was laid out below
     * the fold. Measured on `/dev/tutor-lab` at 375x812: three option buttons
     * at y = 925, 986 and 1047 on an 812 px phone, focusable and announced.
     */
    expect(body.style.display).toBe('none');
  });
});

/*
 * ONE SENTENCE, ONE PRINTING, TWO CHANNELS (/DESIGN.md §Lumen).
 *
 * The owner's accessibility requirement is a caption above the speaker's head
 * AND the 2D animated head, for a deaf or hard-of-hearing learner. It was being
 * met by two SURFACES that each printed the whole sentence — measured at
 * 1280x800 as 21 spoken words printed twice, 252 px apart. Both channels are
 * still here; they share one surface, and the sentence is written once.
 */
describe('the tutor says it once', () => {
  it('prints the live line in the caption and nowhere else, sheet wide open', () => {
    const { container } = render(conversation(makeSocket({ segment: SEGMENT }), true));
    // Open the sheet: at PEEK the body is not mounted, which would make this
    // pass for the wrong reason.
    fireEvent.click(resizeHandle());
    expect(plateBodyShown()).toBe(true);

    // The caption is the one surface that carries it. Its `sr-only` twin holds
    // the whole sentence while the typewriter is still revealing it, which is
    // exactly what a screen reader is given.
    const caption = container.querySelector('.lf-speech.fixed');
    expect(caption?.textContent).toContain(TUTOR_LINE);

    // And the plate does not — not in a bubble, and not in the log either,
    // because a log's job is the past (`TutorTranscript` → `spokenSeq`).
    expect(plateBody().textContent).not.toContain(TUTOR_LINE);
  });

  it('keeps the articulating 2D face, in the caption, beside the words', () => {
    const { container } = renderConversation(makeSocket(), { ready: true });
    const caption = container.querySelector('.lf-speech.fixed');
    expect(caption).not.toBeNull();
    // `liruf` and `dina` have no mouth in 3D (/TUTOR_3D.md §3.1), so this is
    // the only articulation half the cast has. It is decoration to a screen
    // reader — the plate around it is the live region carrying the sentence.
    const face = caption?.querySelector('[data-character]');
    expect(face).not.toBeNull();
    expect(face?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('makes the conversation log yield to an activity, without unmounting it', () => {
    // Two turns of history, so that filtering the LIVE one out still leaves a
    // log to look at.
    const earlier = [
      { speaker: 'tutor' as const, text: 'Shall we count some coins?', seq: 0 },
      { speaker: 'tutor' as const, text: TUTOR_LINE, seq: 1 },
    ];
    const { rerender } = render(
      conversation(makeSocket({ segment: SEGMENT, history: earlier }), true),
    );
    fireEvent.click(resizeHandle());
    const log = screen.getByLabelText('Everything said so far');
    const withActivity = log.parentElement?.className ?? '';

    rerender(conversation(makeSocket({ history: earlier }), true));
    const without = screen.getByLabelText('Everything said so far').parentElement?.className ?? '';

    // Capped and able to give the rest back while an exercise is up; free to
    // take the plate when there is none. Never removed: it is a live region and
    // the only place a learner sees what the microphone actually heard.
    expect(withActivity).toContain('max-h-24');
    expect(withActivity).toContain('shrink-[999]');
    expect(without).not.toContain('max-h-24');
  });
});

describe('the bottom edge the sheet and the microphone share', () => {
  it('lifts the dock over the resting sheet, and hands the edge back when the sheet goes', () => {
    /*
     * The second half is a defect found by measuring `/dev/tutor-lab` at
     * 375x812, not by reading the code. Leaving a conversation unmounts the
     * sheet, and nothing published a zero footprint on the way out — so the
     * dock kept the inline `bottom: 393px` it had been given, and on the
     * introduce and goodbye phases the microphone floated a third of the way up
     * the screen with nothing underneath it. The shell cannot infer the absence
     * of a surface it was never told about, so the surface has to say so.
     */
    const view = renderInShell(makeSocket(), true);
    const dock = screen.getByRole('group', { name: 'Talk to your tutor' });
    // PEEK (88) + the sheet's own 16 px inset + the 12 px the dock keeps.
    expect(dock.style.bottom).toBe('116px');

    view.rerender(
      <MemoryRouter>
        <StageShell mic={STAGE_MIC} character="rho" companion="liruf" scene="diorama-a" backdrop="day">
          <StageLayer label="offers" placement="world">
            <p>no sheet on the bottom edge now</p>
          </StageLayer>
        </StageShell>
      </MemoryRouter>,
    );

    // Empty, not `0px`: a zero would override the class that owns the resting
    // inset and weld the microphone to the bottom of the screen.
    expect(dock.style.bottom).toBe('');
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

    // The sheet rests at PEEK, so there is nothing to borrow until a learner
    // has raised it. Raising it is the whole precondition of this test.
    fireEvent.click(resizeHandle());
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

    // Raised once, so the keyboard has a height to borrow.
    fireEvent.click(resizeHandle());
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

  it('borrows nothing from a plate that is already resting', () => {
    renderConversation(makeSocket(), { wrapper: withSafeArea });

    // No clicks: PEEK is where the sheet starts on a phone now.
    expect(plateHeight()).toBe('88px');

    act(() => viewport.resizeTo(Math.round(window.innerHeight / 2)));
    act(() => viewport.resizeTo(window.innerHeight));

    // Nothing was borrowed, so nothing is handed back. Recording PEEK as the
    // borrowed height would later "restore" the sheet to where it already is
    // while claiming a debt had been settled.
    expect(plateHeight()).toBe('88px');
  });

  /*
   * Found by adversarial review, 2026-08-30 (HIGH): an announced segment or
   * whiteboard turn raised the sheet to HALF unconditionally, so a learner
   * who sent a message and got a reply announcing a practice activity BEFORE
   * dismissing the keyboard saw the sheet rise to HALF while the keyboard
   * still covered the bottom of the screen — the exact overlap the
   * keyboard-borrow mechanism above exists to prevent. The raise must be
   * deferred until the keyboard actually closes.
   */
  it('does not raise the sheet for an announced segment while the keyboard is still open', () => {
    const socket = makeSocket();
    const { rerender } = renderConversation(socket, { wrapper: withSafeArea });

    // The keyboard opens while the sheet rests at PEEK — an ordinary learner
    // typing a message before any activity has been announced.
    act(() => viewport.resizeTo(Math.round(window.innerHeight / 2)));
    expect(plateHeight()).toBe('88px');

    // The reply announces a segment while the keyboard is STILL open.
    const announced = makeSocket({
      turn: { ...socket.turn!, seq: 2, next: 'segment' },
      segment: SEGMENT,
    });
    rerender(<>{withSafeArea(conversation(announced, false))}</>);

    // Must NOT have risen yet — the keyboard is still covering the screen.
    expect(plateHeight()).toBe('88px');

    // Only once the keyboard actually closes does the promised activity rise.
    act(() => viewport.resizeTo(window.innerHeight));
    expect(plateHeight()).not.toBe('88px');
  });
});

/*
 * THE DEFECT THE OWNER REPORTED: pressing the microphone produced "Algo salió
 * mal de nuestro lado" and nothing else.
 *
 * Two independent causes, one visible symptom. Oracle's STT was 500ing on every
 * Chrome/Android turn (fixed in oracle/src/voice/inworld.ts), and the error it
 * DID send — `STT_FAILED` — was looked up under `errors.api.*`, a namespace it
 * has never belonged to. The lookup missed, fell back to `errors.api.INTERNAL`,
 * and told a child the platform was broken when the microphone had merely not
 * caught them.
 *
 * These assert the SECOND cause, because the first is unobservable from here:
 * no socket error code may ever render as a key, and none may render as the
 * generic apology when it has a sentence of its own.
 */
describe('a failure says what actually failed', () => {
  const CODES = [
    'STT_FAILED',
    'CONNECTION_LOST',
    'SESSION_EXPIRED',
    'SESSION_NOT_FOUND',
    'BUDGET_EXHAUSTED',
    'SERVICE_DEGRADED',
    'CONSENT_REQUIRED',
    'RATE_LIMITED',
    'NO_SEGMENT',
    'VALIDATION_ERROR',
    'INTERNAL',
  ] as const;

  it.each(CODES)('renders a real sentence for %s, never a raw key', (code) => {
    const socket = makeSocket({ error: { code, message: 'wire detail the child never sees' } });
    const { container } = renderConversation(socket, { ready: true });
    const text = container.textContent ?? '';

    // Never the key itself, and never the wire message.
    expect(text).not.toContain('tutor.conversationError');
    expect(text).not.toContain('errors.api');
    expect(text).not.toContain('wire detail the child never sees');
  });

  it('does not tell a child the platform broke when it simply misheard them', () => {
    const { container } = renderConversation(
      makeSocket({ error: { code: 'STT_FAILED', message: 'socket closed 1006' } }),
      { ready: true },
    );
    const text = container.textContent ?? '';
    // The old behaviour rendered errors.api.INTERNAL — "something went wrong on
    // our side" — for this. The new line is about the microphone.
    expect(text).toMatch(/didn't quite catch that/i);
  });
});
