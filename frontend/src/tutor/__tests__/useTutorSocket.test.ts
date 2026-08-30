import { act, renderHook } from '@testing-library/react';
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
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;

  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  send(): void {}
  close(): void {}
}

beforeEach(() => {
  FakeSocket.last = null;
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
