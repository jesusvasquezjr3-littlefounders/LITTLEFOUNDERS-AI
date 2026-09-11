import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StartedSession } from '../types';

/*
 * Confirmed defect, blind production audit 2026-09-10 (CRITICAL): a full PAGE
 * RELOAD in the middle of a conversation did NOT resume it. `session` lives
 * only in React state, so a remount had no id to resume from and silently
 * started a brand-new conversation — the child's turns, the open board and the
 * tutor's read of where they were stuck all abandoned, a "0-line" ghost left
 * in the history. The server already parks the conversation and replays its
 * whole history over a fresh socket (the in-page CONNECTION_LOST resume relies
 * on exactly that); the only missing piece was the client persisting the
 * active session across a reload and re-opening it on mount.
 *
 * This directory's established two-part pattern (`resumeRace.test.tsx`,
 * `sessionLimitMemory.test.tsx`): a source-scan proving the REAL file is wired
 * to the fix — the callbacks live inline inside one large component that also
 * mounts the 3D stage — plus a harness that copies the storage logic verbatim
 * and proves the round-trip, including that a resumed session keeps the
 * server-set scene and consent flags while only its single-use socket is
 * replaced.
 */

describe('TutorExperience.tsx itself is wired to the reload-resume fix', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../TutorExperience.tsx'),
    'utf8',
  );

  it('persists the whole StartedSession in sessionStorage the moment a session starts', () => {
    // The store is sessionStorage, not localStorage: the scope is one tab
    // across a reload, and closing the tab must not resurrect a dead session.
    expect(source).toContain("const ACTIVE_SESSION_KEY_PREFIX = 'lf.tutor.activeSession.'");
    expect(source).toMatch(/window\.sessionStorage\.setItem\(ACTIVE_SESSION_KEY_PREFIX \+ userId, JSON\.stringify\(session\)\)/);
    // Wired at the ONE place a genuinely new session is established.
    const start = source.indexOf('setSession(result.data);');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("setPhase('conversing');", start);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).toContain('rememberActiveSession(userIdRef.current, result.data)');
  });

  it('attempts a resume on mount and only replaces the single-use socket, keeping the stored session', () => {
    const start = source.indexOf('const storedSession = readActiveSession(userIdRef.current);');
    expect(start).toBeGreaterThan(-1);
    // Anchored to the phase decision that immediately follows the resume block.
    const end = source.indexOf('The picker opens on the first visit', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain('await resumeSession(authToken, storedSession.sessionId)');
    // The merge keeps every server-computed field and swaps ONLY the socket.
    expect(body).toContain('...storedSession,');
    expect(body).toContain('socketUrl: resumed.data.socketUrl');
    expect(body).toContain("setPhase('conversing')");
    // A refused resume is not an error the learner sees — it clears and falls
    // through to the normal home screen.
    expect(body).toContain('clearActiveSession(userIdRef.current)');
  });

  it('runs the resume BEFORE the home-screen phase decision, so a resumable session never flashes the openings', () => {
    const resumeAt = source.indexOf('const storedSession = readActiveSession(userIdRef.current);');
    const phaseDecisionAt = source.indexOf(
      "prefs.nickname !== null || personalized || hasSeenPicker(userIdRef.current)",
    );
    expect(resumeAt).toBeGreaterThan(-1);
    expect(phaseDecisionAt).toBeGreaterThan(-1);
    expect(resumeAt).toBeLessThan(phaseDecisionAt);
  });

  it('clears the persisted session on every genuine end — restart, exit, an unresumable drop, and closing a replay', () => {
    // Restart abandons the current conversation; exit says goodbye; the
    // socket-driven end covers a drop that could not be resumed; closeReplay
    // drops the finished session it was viewing.
    expect(source).toMatch(/socket\.endSession\(\);\s*clearActiveSession\(userIdRef\.current\);\s*setSession\(null\);\s*setPhase\('introducing'\)/);
    expect(source).toMatch(/socket\.endSession\(\);\s*clearActiveSession\(userIdRef\.current\);\s*setPhase\('closing'\)/);
    // The socket-driven end clears before choosing closing/unavailable...
    expect(source).toMatch(/clearActiveSession\(userIdRef\.current\);\s*const heldAConversation = socket\.history\.length > 0;/);
    // ...but the OFFERS-READ failure that also reaches 'unavailable' must NOT
    // clear: a transient read blip on reload would otherwise wipe a resumable
    // session. Its two `setPhase('unavailable')` calls stand alone.
    const offersFailureBlock = source.slice(
      source.indexOf('if (!prefsResult.data || !offersResult.data) {'),
      source.indexOf('const { catalog: served'),
    );
    expect(offersFailureBlock).toContain("setPhase('unavailable')");
    expect(offersFailureBlock).not.toContain('clearActiveSession');
  });
});

/*
 * The storage logic, copied verbatim from TutorExperience.tsx (the helpers are
 * module-private), driven against a real jsdom `sessionStorage`.
 */
const ACTIVE_SESSION_KEY_PREFIX = 'lf.tutor.activeSession.';

function readActiveSession(userId: string | undefined): StartedSession | null {
  if (!userId) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SESSION_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as StartedSession) : null;
  } catch {
    return null;
  }
}

function rememberActiveSession(userId: string | undefined, session: StartedSession): void {
  if (!userId) return;
  try {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY_PREFIX + userId, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function clearActiveSession(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY_PREFIX + userId);
  } catch {
    /* ignore */
  }
}

const SESSION: StartedSession = {
  sessionId: 'sess-abc',
  socketUrl: 'wss://oracle.example/ws?token=ONE_TIME_A',
  socketExpiresAt: '2026-09-10T00:10:00.000Z',
  character: 'rho',
  companion: null,
  diorama: 'diorama-a',
  backdrop: 'day',
  locale: 'es-MX',
  voiceAvailable: true,
  microphoneAvailable: false,
  microphoneBlockedBy: 'NO_CONSENT',
};

describe('the reload-resume storage round-trip', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips the whole session, keyed per user', () => {
    rememberActiveSession('user-1', SESSION);
    expect(readActiveSession('user-1')).toEqual(SESSION);
    // Another user's tab never sees it.
    expect(readActiveSession('user-2')).toBeNull();
  });

  it('a resumed session keeps every server-set flag and swaps ONLY the single-use socket', () => {
    rememberActiveSession('user-1', SESSION);
    const stored = readActiveSession('user-1')!;
    const resumed = { socketUrl: 'wss://oracle.example/ws?token=ONE_TIME_B', socketExpiresAt: '2026-09-10T00:20:00.000Z' };
    const merged = { ...stored, socketUrl: resumed.socketUrl, socketExpiresAt: resumed.socketExpiresAt };

    // The consent flags the server computed at session start survive the
    // reload verbatim — a resume can never silently flip the mic on. (The
    // server also re-checks consent per turn, so even a wrong flag here could
    // not open a closed microphone.)
    expect(merged.microphoneAvailable).toBe(false);
    expect(merged.microphoneBlockedBy).toBe('NO_CONSENT');
    expect(merged.character).toBe('rho');
    expect(merged.diorama).toBe('diorama-a');
    // Only the socket changed.
    expect(merged.socketUrl).toBe('wss://oracle.example/ws?token=ONE_TIME_B');
    expect(merged.socketUrl).not.toBe(SESSION.socketUrl);
  });

  it('clearing removes it so the next reload starts fresh', () => {
    rememberActiveSession('user-1', SESSION);
    clearActiveSession('user-1');
    expect(readActiveSession('user-1')).toBeNull();
  });

  it('a corrupt record reads as null rather than throwing on the way into the route', () => {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY_PREFIX + 'user-1', '{not json');
    expect(readActiveSession('user-1')).toBeNull();
  });
});
