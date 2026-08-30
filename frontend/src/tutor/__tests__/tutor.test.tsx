import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SpeechCaption } from '../SpeechCaption';
import { useTutorSocket } from '../useTutorSocket';
import type { ServerMessage } from '../types';

/*
 * The Tutor's client behaviour, at the two places a mistake is visible to a
 * learner rather than to a developer: what the caption announces, and what the
 * socket does with a message it did not expect.
 */

// ── A controllable fake WebSocket ───────────────────────────────────────────

class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  /**
   * Every existing test in this file relies on a socket that is OPEN the
   * instant it is constructed, so that stays the default — flip this to
   * `true` only for a test that specifically needs the handshake's real,
   * brief CONNECTING window (see "queues a message sent before..." below).
   */
  static startConnecting = false;

  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    this.readyState = FakeSocket.startConnecting ? FakeSocket.CONNECTING : FakeSocket.OPEN;
    FakeSocket.last = this;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  /** Completes the handshake, the way a real WebSocket eventually does. */
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  /** Deliver a server message, the way the real socket would. */
  emit(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const READY: ServerMessage = {
  type: 'ready',
  sessionId: '11111111-1111-4111-8111-111111111111',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  voice: true,
  microphone: true,
  intelDegraded: false,
  locale: 'es-MX',
};

const TURN: ServerMessage = {
  type: 'turn',
  seq: 1,
  say: '¿Cuánto juntarías en cuatro semanas?',
  emotion: 'happy',
  action: 'nod',
  audioUrl: null,
  next: 'ask',
};

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeSocket.last = null;
  FakeSocket.startConnecting = false;
});

describe('useTutorSocket', () => {
  it('opens exactly one socket for a URL', () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=v1.abc.def'));
    expect(FakeSocket.last?.url).toContain('/ws/tutor?token=');
  });

  it('opens nothing when there is no URL', () => {
    renderHook(() => useTutorSocket(null));
    expect(FakeSocket.last).toBeNull();
  });

  it('surfaces a turn and appends it to the transcript', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() => FakeSocket.last?.emit(TURN));

    expect(result.current.turn?.text).toBe(TURN.type === 'turn' ? TURN.say : '');
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]?.speaker).toBe('tutor');
  });

  /*
   * Found by an adversarial review, 2026-08-30 (MEDIUM): on resume, the
   * server's `history` frame already includes the on-screen tutor line
   * (it IS the turn being redrawn), and a `turn` frame for that SAME seq
   * follows right after, by design — so a fresh mount that never processed
   * `history` still gets the active turn. Appending unconditionally on
   * `turn` duplicated it in `history`: invisible while `TutorTranscript`'s
   * own seq-based filter still hid that turn, but printing the same
   * sentence twice once the NEXT turn changed which seq that filter hides.
   */
  it('does not duplicate the redrawn turn that a resume already put in history', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() =>
      FakeSocket.last?.emit({
        type: 'history',
        turns: [
          { speaker: 'learner', text: 'quiero ahorrar', seq: -1 },
          { speaker: 'tutor', text: 'Vamos a jugar con las monedas ahora.', seq: 3 },
        ],
      }),
    );
    // The redraw: the SAME line, same seq, resent as the active `turn`.
    act(() =>
      FakeSocket.last?.emit({
        type: 'turn',
        seq: 3,
        say: 'Vamos a jugar con las monedas ahora.',
        emotion: 'happy',
        action: 'nod',
        audioUrl: null,
        next: 'ask',
      }),
    );

    const matches = result.current.history.filter(
      (entry) => entry.speaker === 'tutor' && entry.text === 'Vamos a jugar con las monedas ahora.',
    );
    expect(matches).toHaveLength(1);

    // A genuinely NEW turn afterward still appends normally.
    act(() =>
      FakeSocket.last?.emit({
        type: 'turn',
        seq: 4,
        say: '¿Cuántas monedas necesitas?',
        emotion: 'happy',
        action: 'nod',
        audioUrl: null,
        next: 'ask',
      }),
    );
    expect(result.current.history).toHaveLength(3);
  });

  it('IGNORES a malformed frame instead of crashing the session', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() => FakeSocket.last?.onmessage?.({ data: 'not json at all' }));
    act(() => FakeSocket.last?.onmessage?.({ data: '{"type":"nonsense"}' }));

    expect(result.current.turn).toBeNull();
    expect(result.current.connection).not.toBe('failed');
  });

  it('turns the microphone off when consent is revoked mid-session', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() => FakeSocket.last?.emit(READY));
    expect(result.current.microphone).toBe(true);

    act(() =>
      FakeSocket.last?.emit({
        type: 'error',
        code: 'CONSENT_REVOKED',
        message: 'turned off',
      }),
    );
    // /ORACLE.md §4.3: revocation takes effect on the next turn, not the next
    // day — and the UI must reflect it immediately, not on a reload.
    expect(result.current.microphone).toBe(false);
  });

  it('clears the activity panel as soon as a result is reported', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() =>
      FakeSocket.last?.emit({
        type: 'segment',
        segmentId: '22222222-2222-4222-8222-222222222222',
        seq: 0,
        origin: 'catalog',
        segment: { id: 's', type: 'quiz_mcq', prompt_md: 'x', difficulty: 1, xp: 5, payload: {} },
        scoresXp: true,
        framing: 'try this',
      }),
    );
    expect(result.current.segment).not.toBeNull();

    act(() => result.current.reportGrade('22222222-2222-4222-8222-222222222222', 100, true));
    // Leaving an answered activity on screen makes the character look like
    // they are talking about nothing.
    expect(result.current.segment).toBeNull();
  });

  it('echoes typed text locally so typing never feels broken on a slow link', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() => result.current.sendText('  hola  '));

    expect(result.current.history.at(-1)).toMatchObject({ speaker: 'learner', text: 'hola' });
    expect(FakeSocket.last?.sent).toHaveLength(1);
    expect(JSON.parse(FakeSocket.last?.sent[0] ?? '{}')).toMatchObject({
      type: 'learner_text',
      text: 'hola',
    });
  });

  it('sends nothing for whitespace', () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    act(() => result.current.sendText('   '));
    expect(FakeSocket.last?.sent).toHaveLength(0);
  });

  /*
   * Found by an adversarial review, 2026-08-30 (CRITICAL): the composer
   * renders fully enabled the instant the socket starts connecting, with no
   * gate on `connection === 'open'`. `sendText` echoes the learner's line
   * into `history` immediately (by design, for perceived responsiveness) and
   * then called the shared `send()`, which used to silently no-op while the
   * socket was still CONNECTING — a real, reachable window on a slow or
   * mobile link. The learner's answer appeared in their own transcript as
   * delivered; the tutor never received it and never replied, with nothing
   * to explain why.
   */
  it('queues a message sent before the handshake completes, instead of silently dropping it', () => {
    FakeSocket.startConnecting = true;
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    expect(result.current.connection).toBe('connecting');

    act(() => result.current.sendText('mi respuesta es 7'));
    // Echoed locally right away, same as always...
    expect(result.current.history.at(-1)).toMatchObject({ speaker: 'learner', text: 'mi respuesta es 7' });
    // ...but NOT actually transmitted yet — the handshake is not done.
    expect(FakeSocket.last?.sent).toHaveLength(0);

    act(() => FakeSocket.last?.open());
    // The moment the socket opens, the queued message is flushed.
    expect(FakeSocket.last?.sent).toHaveLength(1);
    expect(JSON.parse(FakeSocket.last?.sent[0] ?? '{}')).toMatchObject({
      type: 'learner_text',
      text: 'mi respuesta es 7',
    });
  });

  it('closes the socket when the component unmounts', () => {
    const { unmount } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    const socket = FakeSocket.last;
    unmount();
    expect(socket?.closed).toBe(true);
  });

  /*
   * THE SECOND SESSION MUST NOT INHERIT THE FIRST ONE'S ENDING.
   *
   * This is the bug that made "start another session" impossible to demonstrate
   * end to end. Only `connection` used to be reset when the URL changed, so the
   * first session's `closedReason` was still set when the second socket opened.
   * The watcher in `TutorExperience` reads exactly that value, so the new
   * conversation was declared over before its greeting arrived, and the
   * previous transcript came along with it.
   *
   * It is asserted on the HOOK rather than through the UI because the caller
   * cannot fix it: a guard that ignores a stale reason cannot tell it apart
   * from a genuine close.
   */
  it('starts a second session clean, with no trace of the first', () => {
    const { result, rerender } = renderHook(({ url }: { url: string | null }) => useTutorSocket(url), {
      initialProps: { url: 'ws://oracle.test/ws?token=first' } as { url: string | null },
    });

    const first = FakeSocket.last;
    act(() => FakeSocket.last?.emit(READY));
    act(() => FakeSocket.last?.emit(TURN));
    act(() => FakeSocket.last?.emit({ type: 'closed', reason: 'budget_exhausted' }));

    expect(result.current.closedReason).toBe('budget_exhausted');
    expect(result.current.history).toHaveLength(1);

    // The experience drops the URL on the way to the closing phase, then mints
    // a new one. Both transitions have to clear the session, not just the
    // second: a stale reason surviving the null is the same bug.
    rerender({ url: null });
    expect(result.current.closedReason).toBeNull();

    rerender({ url: 'ws://oracle.test/ws?token=second' });

    // A SECOND SOCKET IS ACTUALLY OPEN, on the new token. Clearing the state
    // would be worth nothing if the second session never got a connection, and
    // "the flow is reachable" is the claim this test is here to support.
    expect(FakeSocket.last).not.toBe(first);
    expect(FakeSocket.last?.url).toContain('token=second');
    expect(first?.closed).toBe(true);

    expect(result.current.closedReason).toBeNull();
    expect(result.current.turn).toBeNull();
    expect(result.current.history).toHaveLength(0);
    expect(result.current.segment).toBeNull();
    expect(result.current.adaptationOffer).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.microphone).toBe(false);
    expect(result.current.connection).toBe('connecting');

    // And the second conversation runs. The greeting lands on a transcript that
    // starts empty, with no closing reason waiting to end it on arrival.
    act(() => FakeSocket.last?.emit(READY));
    act(() => FakeSocket.last?.emit(TURN));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.closedReason).toBeNull();
  });
});

describe('SpeechCaption', () => {
  it('exposes the FULL line to a screen reader, not the typewriter slice', async () => {
    render(<SpeechCaption text="Hola, ¿en qué te ayudo?" turnSeq={1} instant={false} />);
    // The visible span animates; the sr-only span must carry the whole
    // sentence from the first frame, or a screen reader stutters through it
    // two characters at a time.
    await waitFor(() => expect(screen.getByText('Hola, ¿en qué te ayudo?')).toBeInTheDocument());
  });

  it('renders the whole line immediately when reduced motion is requested', () => {
    render(<SpeechCaption text="Vamos a contar monedas." turnSeq={1} instant />);
    // Two nodes, and that is correct: the visible one (fully revealed, since
    // the animation is skipped) and the sr-only one that always carries the
    // complete sentence.
    expect(screen.getAllByText('Vamos a contar monedas.')).toHaveLength(2);
  });

  it('renders nothing when there is no line', () => {
    const { container } = render(<SpeechCaption text={null} turnSeq={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
