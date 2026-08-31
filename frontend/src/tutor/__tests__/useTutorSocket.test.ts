import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorSocket } from '../useTutorSocket';

/*
 * Found live, testing as a real logged-in kid account in the browser,
 * 2026-08-30 (MEDIUM): a failed websocket handshake (in the incident that
 * surfaced this, a TUTOR_SESSION_SECRET mismatch between Core and Oracle,
 * closing 4001 "session token bad_signature") reached the UI as the generic
 * "the tutor is resting" line with NOTHING in the browser console to
 * diagnose it from — this file's own `onclose` handler had a comment
 * claiming the raw close code and reason were "always logged", and zero
 * `console.*` calls anywhere in the file. Reachable by ANY unclean close,
 * not just this one incident.
 */

class FakeSocket {
  static last: FakeSocket | null = null;
  /** Every instance ever constructed, in creation order — for asserting how many `new WebSocket()` calls actually happened. */
  static instances: FakeSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeSocket.CONNECTING;
  closeCalls: { code?: number; reason?: string }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.instances.push(this);
  }

  send(): void {}

  /** A real WebSocket transitions to CLOSING (or CLOSED, if never connected) the instant close() is called — the caller does not wait for the server. */
  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = this.readyState === FakeSocket.CONNECTING ? FakeSocket.CLOSED : FakeSocket.CLOSING;
  }
}

beforeEach(() => {
  FakeSocket.last = null;
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTutorSocket logs an unclean close, since the UI only ever shows a generic line', () => {
  it('logs the real close code and reason to the console', () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));
    const socket = FakeSocket.last!;

    act(() => {
      socket.onclose?.({ code: 4001, reason: 'session token bad_signature' });
    });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('4001'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('session token bad_signature'),
    );
  });

  it('does not log a clean close (1000) — that is an ordinary ending, not a fault', () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));
    const socket = FakeSocket.last!;

    act(() => {
      socket.onclose?.({ code: 1000, reason: '' });
    });

    expect(console.error).not.toHaveBeenCalled();
  });
});

/*
 * Chasing a live, intermittently-reproducing symptom, round 81/82
 * (2026-08-31, HIGH): a session's first turn was written to Postgres within
 * seconds of starting and never reached the screen. Instrumenting a real
 * browser's `window.WebSocket` constructor during a live reproduction showed
 * TWO real sockets opened for one `begin()` call, using the IDENTICAL
 * session token, both receiving every server message — but that observation
 * came from a headless browser-automation tool already documented elsewhere
 * this session as having its own WebSocket/rendering quirks (closing a
 * CONNECTING socket not reliably preventing 'open' from firing is real,
 * spec-permitted, implementation-defined behavior), so it could not be
 * trusted as proof of an app bug on its own. This test asks the same
 * question against the REACT LOGIC alone, with a fake socket standing in for
 * whatever a real browser does — removing the browser's own timing and
 * close() semantics from the question entirely.
 */
describe('a StrictMode double-invoke of the connecting effect', () => {
  it('closes the FIRST socket instance and leaves the SECOND one live', () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });

    // StrictMode's synchronous mount -> cleanup -> mount means BOTH `new
    // WebSocket()` calls have already happened by the time renderHook
    // returns, and neither has had a chance to reach a real 'open' event yet
    // (this fake never fires one on its own) — so this asserts purely on
    // what the EFFECT itself does, not on any race with the network.
    expect(FakeSocket.instances).toHaveLength(2);
    const [first, second] = FakeSocket.instances as [FakeSocket, FakeSocket];

    expect(first.closeCalls).toHaveLength(1);
    expect(second.closeCalls).toHaveLength(0);

    // The one thing that matters for the live symptom: the SURVIVING
    // instance is the one still capable of receiving a message. A first
    // socket whose close() call did not fully take effect against a real
    // server could still deliver a `turn` — to a component that is by then
    // listening only through the wrapper hook's CURRENT (second) instance.
    act(() => {
      second.onmessage?.({
        data: JSON.stringify({ type: 'turn', seq: 1, say: 'Good to see you.', emotion: 'happy', action: 'wave' }),
      });
    });
  });
});
