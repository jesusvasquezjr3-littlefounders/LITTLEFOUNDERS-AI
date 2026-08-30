import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useTutorSocket } from '../useTutorSocket';

/*
 * Found by adversarial review, round 30 (2026-08-30, LOW-MEDIUM): a live
 * guardian revocation set `socket.microphone = false` (correctly closing
 * the mic) but nothing PERSISTENT recorded that a revocation was the
 * reason — the transient `error` banner that named it is cleared by the
 * tutor's own very next turn (`useTutorSocket.ts`'s `case 'turn'`), and
 * `TutorExperience.tsx` computed the displayed reason from
 * `session.microphoneBlockedBy`, a value fixed once at session creation
 * and never updated. So for the rest of the session the child saw the
 * generic "voice unavailable" copy instead of "a grown-up needs to turn
 * the microphone on for you" — a wrong, and less actionable, explanation.
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

/** Exposes the real hook's fields as text, so a real websocket drives real state. */
function SocketHarness({ url }: { url: string }) {
  const socket = useTutorSocket(url);
  return (
    <div>
      <span data-testid="microphone">{String(socket.microphone)}</span>
      <span data-testid="mic-revoked">{String(socket.micRevoked)}</span>
    </div>
  );
}

describe('useTutorSocket tracks a live consent revocation persistently', () => {
  it('sets micRevoked on CONSENT_REVOKED, and it survives past the next turn', async () => {
    const { getByTestId } = render(<SocketHarness url="ws://oracle.test/ws?token=v1" />);
    const socket = FakeSocket.last!;
    act(() => socket.open());
    act(() =>
      socket.emit({ type: 'ready', microphone: true, intelDegraded: false }),
    );
    expect(getByTestId('mic-revoked').textContent).toBe('false');

    act(() =>
      socket.emit({ type: 'error', code: 'CONSENT_REVOKED', message: 'The microphone was turned off.' }),
    );
    expect(getByTestId('microphone').textContent).toBe('false');
    expect(getByTestId('mic-revoked').textContent).toBe('true');

    // The tutor's own very next turn clears the transient error banner —
    // `micRevoked` must NOT clear with it.
    act(() =>
      socket.emit({ type: 'turn', seq: 1, say: 'hola', emotion: 'happy', action: 'nod', audioUrl: null, next: 'ask' }),
    );
    await waitFor(() => expect(getByTestId('mic-revoked').textContent).toBe('true'));
  });

  it('resets on a fresh ready frame — a genuinely new session starts clean', async () => {
    const { getByTestId } = render(<SocketHarness url="ws://oracle.test/ws?token=v1" />);
    const socket = FakeSocket.last!;
    act(() => socket.open());
    act(() => socket.emit({ type: 'ready', microphone: true, intelDegraded: false }));
    act(() => socket.emit({ type: 'error', code: 'CONSENT_REVOKED', message: 'The microphone was turned off.' }));
    expect(getByTestId('mic-revoked').textContent).toBe('true');

    // A fresh ready (a new session, or a resume where consent is active again).
    act(() => socket.emit({ type: 'ready', microphone: true, intelDegraded: false }));
    expect(getByTestId('mic-revoked').textContent).toBe('false');
  });
});

describe('TutorExperience.tsx itself is wired to prefer a live revocation over the stale session value', () => {
  it('reads socket.micRevoked before falling back to session.microphoneBlockedBy', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, '../TutorExperience.tsx'), 'utf8');
    const start = source.indexOf('const blockedBy =');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf(';', source.indexOf('VOICE_UNAVAILABLE', start));
    const body = source.slice(start, end);
    expect(body).toContain('socket.micRevoked');
    expect(body).toContain("'CONSENT_REQUIRED'");
  });
});
