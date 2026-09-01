import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOffers, startSession } from '../tutorApi';
import type { StartSessionInput } from '../tutorApi';
import { OfferChips } from '../OfferChips';
import type { TutorOffers } from '../types';

/*
 * Confirmed defect, tutor-review-sweep-92 (MEDIUM, session-cap-ux dimension):
 * a SESSION_LIMIT refusal is held ONLY in `TutorExperience.tsx`'s in-memory
 * `startError` (`useState`), with no persistence. Refreshing the page, or
 * navigating away and back, erases all memory that the learner was just
 * refused for hitting today's cap — the exact same fully-enabled, inviting
 * offer chips re-render as if nothing happened, and a child with weak object
 * permanence for "this already happened" can tap right back in and be
 * refused again.
 *
 * A behavioural harness (below) proves the persistence LOGIC works; it
 * cannot prove `TutorExperience.tsx` itself is wired to that logic, since the
 * real callbacks live inline inside one large component that also mounts the
 * 3D stage and a large tree of unrelated children. This file follows this
 * exact directory's own established two-part pattern (`resumeRace.test.tsx`,
 * `preferencesRace.test.tsx`, `sessionLifecycleReset.test.tsx`,
 * `mapRefreshAfterSession.test.tsx`): a source-scan proving the REAL file
 * calls the fix, plus a harness that copies the logic verbatim and drives it
 * against the real `OfferChips` component.
 */

describe('TutorExperience.tsx itself is wired to the session-limit memory fix', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../TutorExperience.tsx'),
    'utf8',
  );

  it('seeds startError from the persisted flag in the SAME tick offers arrives, before OfferChips can render', () => {
    const start = source.indexOf('setOffers(offersResult.data);');
    expect(start).toBeGreaterThan(-1);
    // The picker-phase decision (an existing, unrelated `setPhase` call) is a
    // stable downstream anchor for "the rest of this bootstrap tick".
    const end = source.indexOf('setPhase(\n', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain('startOfLocalDayIso(offersResult.data.locale)');
    expect(body).toContain('refusedToday(userIdRef.current, todayIso)');
    expect(body).toContain("setStartError('SESSION_LIMIT')");
    expect(body).toContain('clearSessionLimit(userIdRef.current)');
  });

  it('persists a SESSION_LIMIT refusal, keyed on the same local-day boundary the server enforces', () => {
    const start = source.indexOf("const code = result.error?.code ?? 'INTERNAL';");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('clearSessionLimit(userIdRef.current);', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain("if (code === 'SESSION_LIMIT')");
    expect(body).toContain('rememberSessionLimit(userIdRef.current, startOfLocalDayIso(offers?.locale');
  });

  it('clears the persisted flag the moment a session actually starts — proof the day rolled over', () => {
    // Anchored to `begin()`'s own error branch, not the first (bootstrap
    // effect's) occurrence of `clearSessionLimit` — the two calls are far
    // apart in the file and only this one matters here.
    const beginStart = source.indexOf("const code = result.error?.code ?? 'INTERNAL';");
    expect(beginStart).toBeGreaterThan(-1);
    const start = source.indexOf('clearSessionLimit(userIdRef.current);', beginStart);
    expect(start).toBeGreaterThan(beginStart);
    const end = source.indexOf('setSession(result.data);', start);
    // The clear must run immediately before the success path, not somewhere
    // unrelated later in the file.
    expect(end).toBeGreaterThan(start);
    expect(end - start).toBeLessThan(200);
  });

  it('disables the offer chips on a SESSION_LIMIT refusal, not only on a message', () => {
    const start = source.indexOf('const offerLayer: OfferLayerProps | null =');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('startError,', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain("startError === 'SESSION_LIMIT'");
  });

  /*
   * Round 96 landed on top of an already-merged round 95 (the duration
   * message itself, keyed on `startErrorResetAt`): a restored refusal that
   * seeds `startError` but leaves `startErrorResetAt` null would silently
   * fall back to round 95's bare "tomorrow" wording the instant a page
   * reload — not a live refusal — is what surfaced the message. This proves
   * the restore path seeds BOTH.
   */
  it('also seeds startErrorResetAt on restore, so a reload shows the same duration a live refusal does', () => {
    const start = source.indexOf('setOffers(offersResult.data);');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('setPhase(\n', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain("setStartError('SESSION_LIMIT')");
    expect(body).toContain('setStartErrorResetAt(');
    // The seed must be inside the SAME `if (refusedToday(...))` branch as
    // `setStartError`, not merely present somewhere in this slice.
    expect(body.indexOf('setStartErrorResetAt(')).toBeGreaterThan(body.indexOf("setStartError('SESSION_LIMIT')"));
    expect(body.indexOf('setStartErrorResetAt(')).toBeLessThan(body.indexOf('} else {'));
  });
});

/*
 * The harness below copies TutorExperience.tsx's own helper functions and the
 * bootstrap-effect / `begin()` slice verbatim, matching this directory's
 * established pattern for logic that lives inline inside one large component
 * (see the file-header comment). It drives the REAL `OfferChips` component so
 * what is asserted is what a learner would actually see: the message, and
 * whether the chips are pressable.
 */

vi.mock('../tutorApi', async () => {
  const actual = await vi.importActual<typeof import('../tutorApi')>('../tutorApi');
  return { ...actual, getOffers: vi.fn(), startSession: vi.fn() };
});

/** jsdom has no media stack; a real `Audio` prints through the virtual
 * console (matches offerChips.test.tsx's own stub). */
class SilentAudio {
  volume = 1;
  currentTime = 0;
  loop = false;
  preload = '';
  paused = true;
  constructor(public src: string) {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const OFFERS: TutorOffers = {
  locale: 'es-MX',
  lastSession: null,
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  sessionCapResetAt: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [],
  faqIds: [],
  canAskOpen: true,
};

const SESSION_LIMIT_KEY_PREFIX = 'lf.tutor.sessionLimitDay.';

/** Copied verbatim from TutorExperience.tsx's `startOfLocalDayIso` — the
 * exact boundary the daily cap resets on, mirrored from
 * `backend/src/routes/tutor.ts`. */
const SESSION_CAP_TIMEZONE: Record<string, string> = {
  'es-MX': 'America/Mexico_City',
  'pt-BR': 'America/Sao_Paulo',
  'en-US': 'America/New_York',
};

function startOfLocalDayIso(locale: string, now: Date = new Date()): string {
  const timeZone = SESSION_CAP_TIMEZONE[locale] ?? SESSION_CAP_TIMEZONE['es-MX'];
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asIfUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  // Floored to the whole second — see the identical comment in
  // TutorExperience.tsx's own copy of this function for why.
  const offsetMs = asIfUtcMs - Math.floor(now.getTime() / 1000) * 1000;
  const localMidnightUtcMs =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0) - offsetMs;
  return new Date(localMidnightUtcMs).toISOString();
}

function refusedToday(userId: string | undefined, todayIso: string): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(SESSION_LIMIT_KEY_PREFIX + userId) === todayIso;
  } catch {
    return false;
  }
}

function rememberSessionLimit(userId: string | undefined, todayIso: string): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(SESSION_LIMIT_KEY_PREFIX + userId, todayIso);
  } catch {
    /* Never worth failing a session over. */
  }
}

function clearSessionLimit(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(SESSION_LIMIT_KEY_PREFIX + userId);
  } catch {
    /* ditto */
  }
}

/**
 * The bootstrap-effect read + `begin()` write/clear, copied verbatim from
 * TutorExperience.tsx (minus the preferences/catalog/map fetches, which this
 * defect has nothing to do with). A fresh instance of this component stands
 * in for a fresh mount — a page refresh, or navigating away and back — the
 * same way `ResumeHarness`/`RefreshHarness` stand in for the real component in
 * the other files this pattern comes from.
 */
function SessionLimitHarness({ token, userId }: { token: string; userId: string }) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [offers, setOffers] = useState<TutorOffers | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startErrorResetAt, setStartErrorResetAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOffers(token).then((result) => {
      if (cancelled || !result.data) return;
      setOffers(result.data);
      const todayIso = startOfLocalDayIso(result.data.locale);
      if (refusedToday(userIdRef.current, todayIso)) {
        setStartError('SESSION_LIMIT');
        // Mirrors TutorExperience.tsx's own restore-time echo (round 96): an
        // ESTIMATE (today's boundary + 24h) so a restored refusal shows the
        // same duration message a live one does, not the bare fallback.
        setStartErrorResetAt(new Date(new Date(todayIso).getTime() + 24 * 60 * 60 * 1000).toISOString());
      } else {
        clearSessionLimit(userIdRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const begin = useCallback(
    (input: StartSessionInput) => {
      setStarting(true);
      setStartError(null);
      setStartErrorResetAt(null);
      void startSession(token, input).then((result) => {
        setStarting(false);
        if (result.error || !result.data) {
          const code = result.error?.code ?? 'INTERNAL';
          setStartError(code);
          setStartErrorResetAt(result.error?.resetAt ?? null);
          if (code === 'SESSION_LIMIT') {
            rememberSessionLimit(userIdRef.current, startOfLocalDayIso(offers?.locale ?? 'es-MX'));
          }
          return;
        }
        clearSessionLimit(userIdRef.current);
      });
    },
    [token, offers],
  );

  if (!offers) return <div data-testid="loading" />;

  return (
    <OfferChips
      phase="introducing"
      map={null}
      ready={false}
      timedOut={false}
      offers={offers}
      starting={starting || !offers.canStart || startError === 'SESSION_LIMIT'}
      startError={startError}
      startErrorResetAt={startErrorResetAt}
      onStart={begin}
      onPersonalize={() => {}}
      onReplay={() => {}}
      token={token}
      character="rho"
      nickname="Robi"
    />
  );
}

beforeEach(() => {
  vi.stubGlobal('Audio', SilentAudio);
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/** A native `disabled` button is what actually blocks a click (`hud/
 * HudPlate.tsx` spreads `disabled` onto the element only `as="button"`), so
 * this is the real signal a learner's tap would hit — not merely a class. */
function anyChipDisabled(container: HTMLElement): boolean {
  const chips = container.querySelectorAll<HTMLButtonElement>('[data-opening]');
  return chips.length > 0 && [...chips].every((chip) => chip.disabled);
}

describe('a SESSION_LIMIT refusal survives a remount', () => {
  it('shows the refused state immediately on a fresh mount, instead of repainting the fully-enabled, cheerful chips', async () => {
    vi.mocked(getOffers).mockResolvedValue({ data: OFFERS, error: null });
    vi.mocked(startSession).mockResolvedValue({
      data: null,
      error: { code: 'SESSION_LIMIT', message: 'You have used all of today’s tutor sessions' },
    });

    // First mount: the ordinary arrival. Offers load, chips are cheerful —
    // no refusal has happened yet in this test.
    const first = render(<SessionLimitHarness token="tok" userId="learner-1" />);
    await waitFor(() => expect(first.container.querySelectorAll('[data-opening]').length).toBeGreaterThan(0));
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(anyChipDisabled(first.container)).toBe(false);

    // The learner taps an opening and IS refused — the cap really was hit.
    act(() => {
      first.container.querySelector<HTMLElement>('[data-opening="open"]')?.click();
    });
    await waitFor(() => expect(startSession).toHaveBeenCalled());
    await waitFor(() => expect(anyChipDisabled(first.container)).toBe(true));
    expect(screen.getAllByRole('status').map((n) => n.textContent).join(' ')).toContain(
      "today's tutor time",
    );

    // A full page reload: the whole component tree is torn down and a brand
    // new one mounts, with no in-memory state carried over. Only
    // `window.localStorage` — real in jsdom, untouched by the unmount — can
    // possibly survive this boundary.
    first.unmount();

    // `GET /offers` on the fresh mount answers exactly as it did the first
    // time — today's real production behaviour, whether or not the sibling
    // fix to `/offers` cap-awareness has landed by the time this merges. It
    // has no memory of the refusal either, so nothing OTHER than the
    // persisted local flag can account for the refused state reappearing.
    vi.mocked(getOffers).mockResolvedValue({ data: OFFERS, error: null });

    const second = render(<SessionLimitHarness token="tok" userId="learner-1" />);
    await waitFor(() => expect(second.container.querySelectorAll('[data-opening]').length).toBeGreaterThan(0));

    // THE FIX: the refused state renders immediately, with no further tap —
    // this is exactly the fully-enabled, cheerful re-render the bug report
    // describes, proven NOT to happen.
    expect(anyChipDisabled(second.container)).toBe(true);
    const restoredMessage = screen.getAllByRole('status').map((n) => n.textContent).join(' ');
    expect(restoredMessage).toContain("today's tutor time");
    // Round 96's OWN restore must not regress round 95's duration message
    // into its bare "tomorrow" fallback — a real "in N hours/minutes" phrase
    // is what proves `startErrorResetAt` was seeded, not just `startError`.
    expect(restoredMessage).not.toContain('Come back tomorrow');
    expect(restoredMessage).toMatch(/in \d+ (hour|minute)/);
  });

  it('does not let a stale flag from a PREVIOUS day suppress a fresh day\'s offer', async () => {
    // Pre-seed a refusal recorded on a calendar day nowhere near today.
    const along = new Date('2020-01-15T18:00:00Z');
    window.localStorage.setItem(
      SESSION_LIMIT_KEY_PREFIX + 'learner-2',
      startOfLocalDayIso('es-MX', along),
    );

    vi.mocked(getOffers).mockResolvedValue({ data: OFFERS, error: null });

    const { container } = render(<SessionLimitHarness token="tok" userId="learner-2" />);
    await waitFor(() => expect(container.querySelectorAll('[data-opening]').length).toBeGreaterThan(0));

    // Today's boundary does not match the stored one — the stale flag must
    // not suppress this offer.
    expect(anyChipDisabled(container)).toBe(false);
    expect(screen.queryAllByRole('status')).toHaveLength(0);

    // And the stale entry is cleaned up rather than left to be re-read forever.
    expect(window.localStorage.getItem(SESSION_LIMIT_KEY_PREFIX + 'learner-2')).toBeNull();
  });
});
