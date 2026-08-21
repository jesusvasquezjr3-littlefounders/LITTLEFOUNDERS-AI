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
  static readonly OPEN = 1;

  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
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

  it('closes the socket when the component unmounts', () => {
    const { unmount } = renderHook(() => useTutorSocket('ws://oracle.test/ws'));
    const socket = FakeSocket.last;
    unmount();
    expect(socket?.closed).toBe(true);
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
