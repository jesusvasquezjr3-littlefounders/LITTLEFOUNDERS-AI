import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorSocket } from '../useTutorSocket';

/*
 * C.8/C.12 and C.16 — the client API layer for the stop-or-continue offer
 * and the closing summary. The offer is shown only while the server says it
 * is open; a new turn without one clears it; answering sends exactly one
 * `session_end_response` and clears it at once (no double answer); the
 * closing summary is kept for the closing state and reset with the session.
 * The fake socket is the same shape `adaptationOfferStale.test.tsx` uses.
 */

class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readonly sent: string[] = [];

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

let latest: ReturnType<typeof useTutorSocket> | null = null;

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSocket.last = null;
  latest = null;
});

/** The connecting effect defers its real `new WebSocket()` one microtask. */
async function flushSocketConnect(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

const TURN_BASE = { seq: 1, say: 'hola', emotion: 'happy', action: 'nod', audioUrl: null, audioPending: true };

function SocketHarness({ url }: { url: string }) {
  const socket = useTutorSocket(url);
  latest = socket;
  return <span data-testid="offer">{String(socket.sessionEndOffer)}</span>;
}

async function openSession() {
  const view = render(<SocketHarness url="ws://oracle.test/ws?token=v1" />);
  await flushSocketConnect();
  const socket = FakeSocket.last!;
  act(() => socket.open());
  act(() => socket.emit({ type: 'ready', microphone: true, intelDegraded: false }));
  return { view, socket };
}

describe('useTutorSocket — the C.8/C.12 stop-or-continue offer', () => {
  it('opens on session_end_offer after its turn, and a new turn without one clears it', async () => {
    const { view, socket } = await openSession();
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 1, next: 'ask' }));
    act(() => socket.emit({ type: 'session_end_offer' }));
    expect(view.getByTestId('offer').textContent).toBe('true');
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 2, next: 'ask' }));
    expect(view.getByTestId('offer').textContent).toBe('false');
  });

  it('answering sends one session_end_response and clears the offer at once', async () => {
    const { view, socket } = await openSession();
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 1, next: 'ask' }));
    act(() => socket.emit({ type: 'session_end_offer' }));
    act(() => latest!.answerSessionEnd(false));
    expect(view.getByTestId('offer').textContent).toBe('false');
    const answers = socket.sent
      .map((m) => JSON.parse(m) as { type: string })
      .filter((m) => m.type === 'session_end_response');
    expect(answers).toEqual([{ type: 'session_end_response', accepted: false }]);
  });
});

describe('useTutorSocket — the C.16 closing summary', () => {
  it('keeps the closing script the server sent before closed, and drops any open offer', async () => {
    const { socket } = await openSession();
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 1, next: 'ask' }));
    act(() => socket.emit({ type: 'session_end_offer' }));
    act(() => socket.emit({ type: 'session_closing', script: 'interrupted', effort: null, topic: 'Needs and wants' }));
    act(() => socket.emit({ type: 'closed', reason: 'hard_budget' }));
    expect(latest!.closingSummary).toEqual({ script: 'interrupted', effort: null, topic: 'Needs and wants' });
    expect(latest!.sessionEndOffer).toBe(false);
    expect(latest!.closedReason).toBe('hard_budget');
  });
});

describe('useTutorSocket — the C.19 check-in', () => {
  it('opens on check_in after the check-in turn; a new turn or the closing clears it', async () => {
    const { socket } = await openSession();
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 3, next: 'ask' }));
    act(() => socket.emit({ type: 'check_in' }));
    expect(latest!.checkInOpen).toBe(true);
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 4, next: 'ask' }));
    expect(latest!.checkInOpen).toBe(false);

    act(() => socket.emit({ type: 'check_in' }));
    act(() => socket.emit({ type: 'session_closing', script: 'safety_stop', effort: null, topic: null }));
    expect(latest!.checkInOpen).toBe(false);
  });

  it('answering sends exactly one check_in_response and clears the chips at once', async () => {
    const { socket } = await openSession();
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 3, next: 'ask' }));
    act(() => socket.emit({ type: 'check_in' }));
    act(() => latest!.answerCheckIn(false));
    expect(latest!.checkInOpen).toBe(false);
    const answers = socket.sent
      .map((m) => JSON.parse(m) as { type: string })
      .filter((m) => m.type === 'check_in_response');
    expect(answers).toEqual([{ type: 'check_in_response', aligned: false }]);
  });
});
