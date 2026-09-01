import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeCodeToReason, useTutorSocket } from '../useTutorSocket';

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
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

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
  it('logs the real close code and reason to the console', async () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));
    // Construction is deferred one microtask (see the describe block below) —
    // flush it before reaching for the socket this render is expected to have
    // opened.
    await act(async () => {
      await Promise.resolve();
    });
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

  it('does not log a clean close (1000) — that is an ordinary ending, not a fault', async () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));
    await act(async () => {
      await Promise.resolve();
    });
    const socket = FakeSocket.last!;

    act(() => {
      socket.onclose?.({ code: 1000, reason: '' });
    });

    expect(console.error).not.toHaveBeenCalled();
  });
});

/*
 * RUNBOOK.md Round 81/82, closed: a session's first turn was written to
 * Postgres within seconds of starting and never reached the screen.
 *
 * Round 82 instrumented a real browser's `window.WebSocket` constructor
 * during a live reproduction and saw TWO real sockets opened with the
 * IDENTICAL session token — both received every server message — but,
 * correctly, treated that as an observation rather than a proof: the tool
 * doing the observing was already documented elsewhere that same session as
 * having its own real-time quirks. This suite closes the loop with two
 * separate pieces of hard evidence gathered afterward, neither of which
 * depends on that tool at all.
 *
 * First, server-side: a small script (kept out of the repo — a throwaway
 * probe, not a fixture) logged in for real, minted one real single-use
 * session token via Core's real `/tutor/sessions` endpoint, and opened TWO
 * real `ws` connections to the REAL, unmodified, already-running Oracle
 * dev server with that identical token, fired back to back with no await
 * between them. Both reached `open` — confirming Round 82's own caveat that
 * `close()` on a CONNECTING socket does not reliably stop it from finishing
 * its handshake — but the SECOND one was then immediately closed 4001
 * "session token replayed" by Oracle's own nonce ledger, while the FIRST
 * went on to receive `ready`, `turn`, `state` and `turn_audio` in full. That
 * confirmed the mechanism the loser hits is a REAL one, on the real server,
 * independent of any test tooling.
 *
 * Second, client-side: a dedicated React-semantics check (not committed here
 * either) proved that `useTutorSocket`'s own effect, given a dependency that
 * changes from `null` to a real URL on an ALREADY-mounted component (exactly
 * how `TutorExperience` calls this hook — `phase`/`session` both start null
 * and only become real via a later state update, never on the very first
 * render), is invoked exactly ONCE under StrictMode — no double-invoke. That
 * specific trigger could not be reproduced against this repository's current
 * phase machine, live, in several attempts with `window.WebSocket`
 * instrumented directly (this session's own hunt, kept honest here rather
 * than claimed as reproduced). What the SAME check also proved, and what the
 * two tests below exercise: StrictMode DOES still double-invoke an effect
 * whose dependency is ALREADY non-null on a component's very first render —
 * a shape this hook has to be correct under regardless of which caller
 * produces it, now or later.
 *
 * So the fix does not try to win a race it cannot always see coming. It
 * removes the LOSING SIDE'S OWN MOVE: `new WebSocket(...)` is deferred one
 * microtask, so a run that StrictMode discards has its `cancelled` flag set
 * by cleanup BEFORE that callback ever executes, and never dials out at
 * all. Oracle's nonce ledger is then simply never asked to arbitrate between
 * two sockets sharing this hook's token, because there is only ever one.
 */
describe('the connecting effect defers construction so a discarded run never dials out', () => {
  it('constructs no socket at all synchronously — the real connect is deferred', () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));

    // If this ever regresses to constructing inline again, this is the line
    // that would catch it: a discarded StrictMode run can only be cancelled
    // before it dials out if dialing out has not already happened by the
    // time cleanup gets to run.
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('under a StrictMode double-invoke, constructs EXACTLY ONE socket once the deferred microtask runs — never two', async () => {
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });

    // StrictMode's mount -> cleanup -> mount is synchronous and complete by
    // the time renderHook returns; flushing one microtask is enough to let
    // whichever deferred callback was never cancelled actually run.
    await act(async () => {
      await Promise.resolve();
    });

    // The whole point: not "two, but the second is closed" (what this test
    // asserted before this fix) — ONE. The discarded run's `new WebSocket()`
    // never happened, so Oracle's single-use nonce ledger never had two
    // claimants to arbitrate between in the first place.
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0]?.closeCalls).toHaveLength(0);

    // The one surviving instance still works normally.
    act(() => {
      FakeSocket.instances[0]?.onmessage?.({
        data: JSON.stringify({ type: 'turn', seq: 1, say: 'Good to see you.', emotion: 'happy', action: 'wave' }),
      });
    });
  });

  it('even mounting FRESH with the url already set (the one shape that DOES double-invoke) still yields exactly one socket', async () => {
    // Unlike the app's own call site (url starts null, becomes real on a
    // later update — the case above), this is the shape Round 82's own test
    // used: the dependency is non-null on the very FIRST render. The
    // dedicated React-semantics check this suite's own comment describes
    // confirmed StrictMode DOES double-invoke in exactly this shape — so
    // this hook has to hold up against it regardless of whether today's
    // phase machine happens to produce it.
    renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=xyz'), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('queues a message sent during the deferred window instead of dropping it — the socket does not exist yet', async () => {
    const { result } = renderHook(() => useTutorSocket('ws://oracle.test/ws/tutor?token=abc'));

    // `socketRef.current` is still null here: the deferred `new WebSocket()`
    // has not run yet. Before this fix this window did not exist — the
    // socket was constructed synchronously in the same effect pass that
    // reset the pending queue — so a send here is exercising a wait that is
    // new specifically because of the deferral this file introduces.
    expect(FakeSocket.instances).toHaveLength(0);
    act(() => {
      result.current.sendText('are you there?');
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(FakeSocket.instances).toHaveLength(1);
    const socket = FakeSocket.instances[0]!;
    // Not yet flushed: the fake never reaches OPEN on its own.
    expect(socket.sent).toHaveLength(0);

    act(() => {
      socket.readyState = FakeSocket.OPEN;
      socket.onopen?.();
    });

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: 'learner_text', text: 'are you there?' });
  });
});

/*
 * /ORACLE.md §15.2 item 1: 4029 is the platform-wide spend circuit breaker's
 * OWN close code (`oracle/src/ws/protocol.ts`'s `CLOSE_CODES.SPEND_CEILING`),
 * kept numerically distinct from 4013 so an operator's logs can tell "cost
 * control tripped" apart from "moderation is down" — but it maps to the SAME
 * learner-facing reason, since a business-side cost ceiling is not something
 * to explain to a child.
 */
describe('closeCodeToReason', () => {
  it('maps the spend-ceiling code to the same generic reason as SERVICE_DEGRADED', () => {
    expect(closeCodeToReason(4029)).toBe('SERVICE_DEGRADED');
    expect(closeCodeToReason(4013)).toBe('SERVICE_DEGRADED');
  });

  it('still falls back to CONNECTION_LOST for an unrecognised code', () => {
    // 1006 above all — "closed abnormally, no close frame" — must never be
    // read as a server fault.
    expect(closeCodeToReason(1006)).toBe('CONNECTION_LOST');
  });
});
