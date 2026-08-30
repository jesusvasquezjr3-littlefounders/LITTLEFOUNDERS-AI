import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useRef, useState } from 'react';
import { useTutorSocket } from '../useTutorSocket';
import { resumeSession } from '../tutorApi';

/*
 * Found by an adversarial review, 2026-08-30 (CRITICAL): a SUCCESSFUL resume
 * used to tear itself down. This harness reproduces the exact effect logic
 * from `TutorExperience.tsx`'s resume-driving effect — copied here rather
 * than exercising the full component, which renders the 3D stage and a large
 * tree of children unrelated to this timing bug — against the REAL
 * `useTutorSocket` hook and a controllable fake WebSocket, so the race is
 * proven against real React scheduling, not a mock of it.
 */

vi.mock('../tutorApi', () => ({ resumeSession: vi.fn() }));

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
    this.onclose?.({ code: 1000 });
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  /** A dropped connection, no close frame — the case resume exists for. */
  dropWithoutFarewell() {
    this.readyState = 3;
    this.onerror?.();
    this.onclose?.({ code: 1006 });
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeSocket.last = null;
});

/** The resume-driving logic, copied verbatim from TutorExperience.tsx. */
function ResumeHarness({ token, sessionId }: { token: string; sessionId: string }) {
  const [socketUrl, setSocketUrl] = useState<string | null>(`ws://oracle.test/ws?token=${sessionId}-v1`);
  const socket = useTutorSocket(socketUrl);
  const [phase, setPhase] = useState<'conversing' | 'closing' | 'unavailable'>('conversing');
  const [resuming, setResuming] = useState(false);
  const resumeAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'conversing') return;
    const ended =
      socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed';
    if (!ended || resuming) return;

    const droppedNotRefused =
      socket.closedReason === null && (socket.error === null || socket.error.code === 'CONNECTION_LOST');
    if (
      droppedNotRefused &&
      socket.history.length > 0 &&
      resumeAttemptedRef.current !== sessionId
    ) {
      resumeAttemptedRef.current = sessionId;
      setResuming(true);
      void resumeSession(token, sessionId).then((result) => {
        if (result.data) {
          const fresh = result.data;
          setSocketUrl(fresh.socketUrl);
          return;
        }
        setResuming(false);
        setPhase('closing');
      });
      return;
    }

    const heldAConversation = socket.history.length > 0;
    setPhase(heldAConversation ? 'closing' : 'unavailable');
  }, [phase, socket.closedReason, socket.connection, socket.history.length, socket.error, resuming, token, sessionId]);

  useEffect(() => {
    if (resuming && socket.connection === 'open') setResuming(false);
  }, [resuming, socket.connection]);

  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="resuming">{String(resuming)}</span>
    </div>
  );
}

describe('the resume-driving effect does not tear down its own successful resume', () => {
  it('reaches the fresh socket, not "closing", after a genuine resume succeeds', async () => {
    vi.mocked(resumeSession).mockResolvedValue({
      data: { sessionId: 'sess-1', socketUrl: 'ws://oracle.test/ws?token=sess-1-v2', socketExpiresAt: '2099-01-01' },
      error: null,
    });

    const { getByTestId } = render(<ResumeHarness token="tok" sessionId="sess-1" />);
    const first = FakeSocket.last!;
    act(() => first.open());
    act(() => first.emit({ type: 'turn', seq: 1, say: 'hola', emotion: 'happy', action: 'nod', audioUrl: null, next: 'ask' }));

    // The connection dies without a farewell — a sleeping phone, a wifi drop.
    act(() => first.dropWithoutFarewell());

    await waitFor(() => expect(resumeSession).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // A SECOND socket was opened for the resume.
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    expect(second.closed).toBe(false);

    act(() => second.open());

    // The fresh socket is left alone: still open, phase never left conversing.
    expect(second.closed).toBe(false);
    expect(getByTestId('phase').textContent).toBe('conversing');
    expect(getByTestId('resuming').textContent).toBe('false');
  });
});
