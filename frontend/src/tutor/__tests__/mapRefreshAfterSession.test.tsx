import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useState } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMap, getOffers } from '../tutorApi';
import type { TutorMapResponse } from '../tutorApi';
import type { TutorOffers } from '../types';

/*
 * A behavioural harness (below) proves the LOGIC works; it cannot prove
 * `TutorExperience.tsx` itself is wired to call that logic, since the real
 * callbacks live inline inside one large component rather than as
 * standalone exports. This scans the REAL source directly for the actual
 * regression: `onStartAnother` (the closing screen's ONE way back to
 * `introducing`, reached by every end-of-session path — Finish, or the
 * socket simply closing on its own) must call `refreshOffersAndMap()`.
 */
describe('TutorExperience.tsx itself wires onStartAnother to the refresh', () => {
  it('calls refreshOffersAndMap() from inside onStartAnother', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, '../TutorExperience.tsx'), 'utf8');
    const start = source.indexOf('onStartAnother={() => {');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('}}', start);
    const body = source.slice(start, end);
    expect(body).toContain('refreshOffersAndMap()');
  });
});

/*
 * Found by adversarial review, 2026-08-30 (HIGH): the map/offers refetch
 * existed only inside `TutorExperience.tsx`'s mid-conversation "start over"
 * button (`onRestart`) — the code's own comment even says why: "the session
 * that just ended changed mastery." The ORDINARY end of a session (Finish ->
 * the closing screen -> "Start Another", wired through `ClosingInWorld`'s
 * `onStartAnother`, or the socket simply closing on its own and landing on
 * the same closing screen) never called it at all. `mapOpen` gates the whole
 * map view on `phase === 'introducing'`, so a learner who just finished a
 * session that graded activities returned to a map still drawn from BEFORE
 * the session — a just-mastered node still shown in-progress, a
 * just-unlocked node still drawn locked, a stale review count. No error, no
 * warning: confidently wrong state shown to a child relying on the map to
 * know what to do next.
 *
 * This harness copies `refreshOffersAndMap` and both call sites
 * (`onRestart`, `onStartAnother`) verbatim from `TutorExperience.tsx`,
 * matching this codebase's own established pattern (`resumeRace.test.tsx`)
 * for a timing/wiring bug that does not need the full component (the 3D
 * stage and its large tree of unrelated children) to reproduce.
 */

vi.mock('../tutorApi', async () => {
  const actual = await vi.importActual<typeof import('../tutorApi')>('../tutorApi');
  return { ...actual, getOffers: vi.fn(), getMap: vi.fn() };
});

const FRESH_MAP: TutorMapResponse = {
  nodes: [{ kcId: 'kc-1', kcKey: 'money.saving', strand: 'money_math', title: 'Saving', state: 'available', mastery: 0.9, attempts: 3, skillKey: null }],
  edges: [],
  continueTarget: null,
  review: { count: 0 },
};
const STALE_MAP: TutorMapResponse = {
  nodes: [{ kcId: 'kc-1', kcKey: 'money.saving', strand: 'money_math', title: 'Saving', state: 'in_progress', mastery: 0.4, attempts: 1, skillKey: null }],
  edges: [],
  continueTarget: null,
  review: { count: 2 },
};
const OFFERS: TutorOffers = {
  locale: 'es-MX',
  lastSession: null,
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  sessionCapResetAt: null,
  voiceAvailable: false,
  microphoneBlockedBy: 'POLICY_BLOCKED',
  weakSkills: [],
  faqIds: [],
  canAskOpen: true,
};

beforeEach(() => {
  vi.mocked(getOffers).mockResolvedValue({ data: OFFERS, error: null });
  vi.mocked(getMap).mockResolvedValue({ data: FRESH_MAP, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The refresh function and both call sites, copied verbatim from TutorExperience.tsx. */
function RefreshHarness({ token }: { token: string }) {
  const [phase, setPhase] = useState<'conversing' | 'closing' | 'introducing'>('conversing');
  const [map, setMap] = useState<TutorMapResponse | null>(STALE_MAP);
  const [, setOffers] = useState<TutorOffers | null>(null);

  const refreshOffersAndMap = useCallback(() => {
    if (!token) return;
    void getOffers(token).then((result) => {
      if (result.data) setOffers(result.data);
    });
    void getMap(token).then((result) => {
      if (result.data) setMap(result.data);
    });
  }, [token]);

  const onRestart = () => {
    setPhase('introducing');
    refreshOffersAndMap();
  };

  const onExit = () => {
    setPhase('closing');
  };

  const onStartAnother = () => {
    setPhase('introducing');
    refreshOffersAndMap();
  };

  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="map-review-count">{map?.review.count ?? 'none'}</span>
      <button onClick={onRestart}>restart</button>
      <button onClick={onExit}>exit</button>
      <button onClick={onStartAnother}>start-another</button>
    </div>
  );
}

describe('the map is refetched after EVERY way a session can end, not only the mid-conversation restart', () => {
  it('refreshes the map via the mid-conversation restart path (already worked)', async () => {
    const { getByText, getByTestId } = render(<RefreshHarness token="tok" />);
    expect(getByTestId('map-review-count').textContent).toBe('2');

    act(() => getByText('restart').click());

    await waitFor(() => expect(getMap).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId('map-review-count').textContent).toBe('0'));
  });

  /*
   * THE ACTUAL DEFECT: Finish -> closing -> "Start Another" is the PRIMARY
   * way a child is expected to use this product, and it never refreshed
   * anything.
   */
  it('refreshes the map after Finish -> closing -> "Start Another", the ordinary end-of-session path', async () => {
    const { getByText, getByTestId } = render(<RefreshHarness token="tok" />);
    expect(getByTestId('map-review-count').textContent).toBe('2');

    act(() => getByText('exit').click());
    expect(getByTestId('phase').textContent).toBe('closing');
    // Ending the session alone must not have refetched anything yet.
    expect(getMap).not.toHaveBeenCalled();

    act(() => getByText('start-another').click());

    await waitFor(() => expect(getMap).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId('map-review-count').textContent).toBe('0'));
  });
});
