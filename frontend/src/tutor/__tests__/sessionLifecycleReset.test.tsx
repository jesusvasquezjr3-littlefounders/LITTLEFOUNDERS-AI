import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useTutorSocket } from '../useTutorSocket';
import { resumeSession } from '../tutorApi';

/*
 * The harnesses below prove the LOGIC works; they cannot prove
 * TutorExperience.tsx itself is wired to that logic, since the real
 * callbacks live inline inside one large component. This scans the REAL
 * source directly for the three actual fixes (matching this codebase's own
 * `mapRefreshAfterSession.test.tsx` pattern).
 */
describe('TutorExperience.tsx itself is wired to all three round-25 fixes', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../TutorExperience.tsx'),
    'utf8',
  );

  it('guards the resume-failure branch against a session that has since moved on', () => {
    expect(source).toContain('sessionRef.current?.sessionId === resumeTargetId');
  });

  it('resets interruptedSeq when a fresh session begins', () => {
    const start = source.indexOf('setSession(result.data);');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('});', start);
    const body = source.slice(start, end);
    expect(body).toContain('setInterruptedSeq(null);');
  });

  it('resets awaitingReply and replyTimedOut when a fresh session begins', () => {
    const start = source.indexOf('setSession(result.data);');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('});', start);
    const body = source.slice(start, end);
    expect(body).toContain('setAwaitingReply(false);');
    expect(body).toContain('setReplyTimedOut(false);');
  });
});

/*
 * Three findings from adversarial review, round 25 (2026-08-30), all in
 * TutorExperience.tsx's session-lifecycle state management — state that
 * survives a session boundary it should not, because a NEW session's own
 * turn-seq counter starts back at 0/1 (oracle/src/tutor/orchestrator.ts's
 * `private seq = 0`), which several pieces of client state did not expect.
 * Each harness below copies the exact logic slice from the real file,
 * matching this codebase's established pattern (see resumeRace.test.tsx,
 * mapRefreshAfterSession.test.tsx) rather than rendering the full component
 * and its 3D stage.
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

/*
 * ============================================================================
 * FINDING 1 (CRITICAL): a stale, refused resume for an ABANDONED session
 * force-closed an unrelated, healthy NEW session.
 * ============================================================================
 */
interface Session {
  sessionId: string;
  socketUrl: string;
}

/** The resume-driving effect PLUS a restart, copied verbatim from TutorExperience.tsx. */
function ResumeVsRestartHarness({ token }: { token: string }) {
  const [session, setSession] = useState<Session | null>({
    sessionId: 'sess-1',
    socketUrl: 'ws://oracle.test/ws?token=sess-1-v1',
  });
  const socket = useTutorSocket(session?.socketUrl ?? null);
  const [phase, setPhase] = useState<'conversing' | 'closing' | 'unavailable'>('conversing');
  const [resuming, setResuming] = useState(false);
  const resumeAttemptedRef = useRef<string | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (phase !== 'conversing') return;
    const ended =
      socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed';
    if (!ended || resuming) return;

    const droppedNotRefused =
      socket.closedReason === null && (socket.error === null || socket.error.code === 'CONNECTION_LOST');
    if (
      droppedNotRefused &&
      session &&
      token &&
      socket.history.length > 0 &&
      resumeAttemptedRef.current !== session.sessionId
    ) {
      resumeAttemptedRef.current = session.sessionId;
      const resumeTargetId = session.sessionId;
      setResuming(true);
      void resumeSession(token, session.sessionId).then((result) => {
        if (result.data) {
          const fresh = result.data;
          setSession((prev) =>
            prev && prev.sessionId === fresh.sessionId ? { ...prev, socketUrl: fresh.socketUrl } : prev,
          );
          return;
        }
        setResuming(false);
        if (sessionRef.current?.sessionId === resumeTargetId) {
          setPhase('closing');
        }
      });
      return;
    }

    const heldAConversation = socket.history.length > 0;
    setPhase(heldAConversation ? 'closing' : 'unavailable');
  }, [phase, socket.closedReason, socket.connection, socket.history.length, socket.error, resuming, session, token]);

  useEffect(() => {
    if (resuming && socket.connection === 'open') setResuming(false);
  }, [resuming, socket.connection]);

  const restart = useCallback((next: Session) => {
    setSession(next);
    setPhase('conversing');
  }, []);

  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="session-id">{session?.sessionId ?? 'none'}</span>
      <button onClick={() => restart({ sessionId: 'sess-2', socketUrl: 'ws://oracle.test/ws?token=sess-2-v1' })}>
        restart
      </button>
    </div>
  );
}

describe('a stale resume refusal does not close the phase of a session it was not for', () => {
  it('leaves a brand-new, already-conversing session alone when an abandoned resume is later refused', async () => {
    let resolveResume: (v: { data: null; error: { code: string; message: string } }) => void;
    vi.mocked(resumeSession).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );

    const { getByText, getByTestId } = render(<ResumeVsRestartHarness token="tok" />);
    const first = FakeSocket.last!;
    act(() => first.open());
    act(() => first.emit({ type: 'turn', seq: 1, say: 'hola', emotion: 'happy', action: 'nod', audioUrl: null, next: 'ask' }));

    // sess-1 drops without a farewell — the resume-driving effect fires and
    // is now in flight, awaiting `resolveResume`.
    act(() => first.dropWithoutFarewell());
    await waitFor(() => expect(resumeSession).toHaveBeenCalledWith('tok', 'sess-1'));

    // Before that stale resume ever settles, the learner restarts into a
    // BRAND NEW session — sess-2 — which opens cleanly and gets its own turn.
    act(() => getByText('restart').click());
    expect(getByTestId('session-id').textContent).toBe('sess-2');
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    act(() => second.open());
    act(() => second.emit({ type: 'turn', seq: 1, say: 'qué gusto verte', emotion: 'happy', action: 'nod', audioUrl: null, next: 'ask' }));
    expect(getByTestId('phase').textContent).toBe('conversing');

    // NOW the abandoned sess-1 resume finally comes back refused.
    await act(async () => {
      resolveResume!({ data: null, error: { code: 'SESSION_ENDED', message: 'the park window expired' } });
      await Promise.resolve();
      await Promise.resolve();
    });

    // sess-2 is healthy and mid-conversation — it must not have been torn
    // down by a refusal that was never about it.
    expect(getByTestId('phase').textContent).toBe('conversing');
    expect(getByTestId('session-id').textContent).toBe('sess-2');
    expect(second.closed).toBe(false);
  });
});

/*
 * ============================================================================
 * FINDING 2 (HIGH) + FINDING 3 (MEDIUM): state keyed only on `turnSeq`
 * matching does not know a BRAND NEW session's turn-seq counter starts over.
 * ============================================================================
 */
interface Turn {
  seq: number;
}

/** The `begin()` reset logic plus the state it resets, copied from TutorExperience.tsx. */
function SessionResetHarness() {
  const [sessionLabel, setSessionLabel] = useState('none');
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnSeq = turn?.seq ?? 0;

  const [interruptedSeq, setInterruptedSeq] = useState<number | null>(null);
  const interrupted = interruptedSeq !== null && interruptedSeq === turnSeq;

  const [awaitingReply, setAwaitingReply] = useState(false);
  const [replyTimedOut, setReplyTimedOut] = useState(false);

  // The pre-existing (insufficient on its own) reset, kept here to prove the
  // fix is the EXPLICIT reset in `begin()`, not a side effect of this one.
  useEffect(() => {
    setAwaitingReply(false);
    setReplyTimedOut(false);
  }, [turnSeq]);

  const begin = useCallback((label: string) => {
    setSessionLabel(label);
    setTurn(null);
    setInterruptedSeq(null);
    setAwaitingReply(false);
    setReplyTimedOut(false);
  }, []);

  return (
    <div>
      <span data-testid="session-label">{sessionLabel}</span>
      <span data-testid="interrupted">{String(interrupted)}</span>
      <span data-testid="awaiting-reply">{String(awaitingReply)}</span>
      <span data-testid="reply-timed-out">{String(replyTimedOut)}</span>
      <button onClick={() => setInterruptedSeq(turnSeq)}>interrupt</button>
      <button onClick={() => setAwaitingReply(true)}>await-reply</button>
      <button onClick={() => setTurn({ seq: (turn?.seq ?? 0) + 1 })}>receive-turn</button>
      <button onClick={() => begin('session-2')}>begin-session-2</button>
    </div>
  );
}

describe('interruptedSeq resets across a new session — found by adversarial review, round 25', () => {
  it('does not mute a brand-new session\'s first turn just because an earlier session\'s first turn was interrupted', () => {
    const { getByText, getByTestId } = render(<SessionResetHarness />);

    // Session 1: receive turn seq=1, interrupt it.
    act(() => getByText('receive-turn').click());
    act(() => getByText('interrupt').click());
    expect(getByTestId('interrupted').textContent).toBe('true');

    // A brand new session begins — its own first turn will ALSO be seq=1.
    act(() => getByText('begin-session-2').click());
    expect(getByTestId('session-label').textContent).toBe('session-2');

    act(() => getByText('receive-turn').click());
    // Without the fix, interruptedSeq (still 1) === turnSeq (1) here too —
    // the new session's real, un-interrupted greeting reads as interrupted.
    expect(getByTestId('interrupted').textContent).toBe('false');
  });
});

describe('awaitingReply/replyTimedOut reset across a new session — found by adversarial review, round 25', () => {
  it('does not carry a stale "awaiting reply" flag into a session that has not received a turn yet either', () => {
    const { getByText, getByTestId } = render(<SessionResetHarness />);

    // Session 1: the learner sends before any turn ever arrives.
    act(() => getByText('await-reply').click());
    expect(getByTestId('awaiting-reply').textContent).toBe('true');

    // Restart into session 2, BEFORE session 1 ever received a turn — so
    // turnSeq stays 0 -> 0, and the old per-turnSeq reset effect's
    // dependency never changes.
    act(() => getByText('begin-session-2').click());

    // The new session must not inherit the old "awaiting reply" state.
    expect(getByTestId('awaiting-reply').textContent).toBe('false');
  });
});
