import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorSocket } from '../useTutorSocket';

/*
 * Found by adversarial review, round 34 (2026-08-30, HIGH): an
 * `adaptation_offer` frame is only ever sent when THAT turn's
 * `offerAdaptation` is truthy — there is no explicit "the offer is gone
 * now" frame — and the orchestrator's own notion of "the currently valid
 * offer" moves on with every produced turn (`lastOfferedAdaptation` is
 * overwritten on every model turn). `case 'turn'` never touched
 * `adaptationOffer` at all, so the client's copy could silently go stale:
 * an offer from an earlier turn stayed on screen — hiding the composer,
 * per `ConversationView.tsx`'s `standDown` — even after the tutor had
 * already moved the conversation forward with an ordinary turn that offered
 * nothing.
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

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSocket.last = null;
});

const TURN_BASE = { seq: 1, say: 'hola', emotion: 'happy', action: 'nod', audioUrl: null, audioPending: true };

function SocketHarness({ url }: { url: string }) {
  const socket = useTutorSocket(url);
  return <span data-testid="offer">{String(socket.adaptationOffer)}</span>;
}

describe('useTutorSocket clears a stale adaptation offer on the tutor’s NEXT turn', () => {
  it('drops the offer once an ordinary turn arrives without re-offering it', () => {
    const { getByTestId } = render(<SocketHarness url="ws://oracle.test/ws?token=v1" />);
    const socket = FakeSocket.last!;
    act(() => socket.open());
    act(() => socket.emit({ type: 'ready', microphone: true, intelDegraded: false }));

    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 1, next: 'ask' }));
    act(() => socket.emit({ type: 'adaptation_offer', adaptation: 'slower_pacing' }));
    expect(getByTestId('offer').textContent).toBe('slower_pacing');

    // The tutor's NEXT turn offers nothing — the server sends no frame
    // saying the old offer is gone, only silence where a new offer would be.
    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 2, next: 'ask' }));
    expect(getByTestId('offer').textContent).toBe('null');
  });

  it('does not clear a FRESH offer for the same turn — turn always arrives before its own offer', () => {
    const { getByTestId } = render(<SocketHarness url="ws://oracle.test/ws?token=v1" />);
    const socket = FakeSocket.last!;
    act(() => socket.open());
    act(() => socket.emit({ type: 'ready', microphone: true, intelDegraded: false }));

    act(() => socket.emit({ ...TURN_BASE, type: 'turn', seq: 1, next: 'ask' }));
    act(() => socket.emit({ type: 'adaptation_offer', adaptation: 'more_visual' }));

    expect(getByTestId('offer').textContent).toBe('more_visual');
  });
});
