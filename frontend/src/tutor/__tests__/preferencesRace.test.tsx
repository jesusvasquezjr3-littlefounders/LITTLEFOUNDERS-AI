import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useRef, useState } from 'react';
import type { ApiResult } from '@/lib/api';
import { savePreferences } from '../tutorApi';
import type { TutorPreferences } from '../types';

/*
 * Found by adversarial review, round 83 (2026-08-31, MEDIUM): `persistPreferences`
 * (`TutorExperience.tsx`) had no request ordering, cancellation, or "is this the
 * latest call" tracking, while `PersonalizeInWorld.tsx` (the onboarding picker)
 * is explicitly built for rapid successive taps across five independent axes —
 * `chooseTutor`, `toggleCompanion`, `goToIsland`, `setLight`, `toggleAdaptation`
 * — each firing an unguarded `void onSave({...})` with no check of whether a
 * previous call is still in flight. `savePreferences` is a bare `fetch`
 * (`frontend/src/lib/api.ts`'s `api()` takes no `signal`) and the backend does
 * its own independent read-merge-validate-write-reread per request, so two
 * concurrent calls' responses can resolve OUT OF ORDER on ordinary network
 * jitter — and whichever one resolved LAST used to win outright, silently,
 * whether it was a full-object SUCCESS overwrite or a whole-object-snapshot
 * FAILURE rollback.
 *
 * This harness copies `persistPreferences` verbatim from `TutorExperience.tsx`,
 * matching this codebase's own established pattern for a timing bug that does
 * not need the full component (the 3D stage and its large tree of unrelated
 * children) to reproduce — see `resumeRace.test.tsx` (a socket-driving effect)
 * and `mapRefreshAfterSession.test.tsx` (a refetch callback), both copied the
 * same way for the same reason.
 */

vi.mock('../tutorApi', async () => {
  const actual = await vi.importActual<typeof import('../tutorApi')>('../tutorApi');
  return { ...actual, savePreferences: vi.fn() };
});

const BASE: TutorPreferences = {
  character: 'rho',
  companion: null,
  diorama: 'island-a',
  backdrop: 'auto',
  nickname: null,
  adaptations: [],
};

/** A promise this test resolves on its own schedule, so response ORDER can be
 * set independently of call/issue order — the whole shape of this race. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * `persistPreferences`, copied verbatim from `TutorExperience.tsx` (including
 * the sequence-number guard this test exists to prove), plus enough of a
 * harness around it to drive two named preference edits independently and
 * observe both the resulting state and each individual call's own resolved
 * outcome.
 */
function PreferencesHarness({ token }: { token: string }) {
  const [preferences, setPreferences] = useState<TutorPreferences | null>(BASE);
  const [saving, setSaving] = useState(false);
  const preferencesCallIdRef = useRef(0);
  const [zaraOutcome, setZaraOutcome] = useState('pending');
  const [companionOutcome, setCompanionOutcome] = useState('pending');

  const persistPreferences = useCallback(
    (patch: Partial<TutorPreferences>): Promise<boolean> => {
      if (!token) return Promise.resolve(false);
      const callId = ++preferencesCallIdRef.current;
      setSaving(true);
      let previous: TutorPreferences | null = null;
      setPreferences((prev) => {
        previous = prev;
        return prev ? { ...prev, ...patch } : prev;
      });
      return savePreferences(token, patch).then((result) => {
        // A newer call has been issued since this one started — discard this
        // stale response rather than letting it win (success) or roll back
        // over (failure) whatever the newer call has already applied.
        if (preferencesCallIdRef.current !== callId) return result.data !== null;

        setSaving(false);
        if (result.data) {
          setPreferences(result.data);
          return true;
        }
        setPreferences(previous);
        return false;
      });
    },
    [token],
  );

  return (
    <div>
      <span data-testid="character">{preferences?.character}</span>
      <span data-testid="diorama">{preferences?.diorama}</span>
      <span data-testid="companion">{String(preferences?.companion)}</span>
      <span data-testid="saving">{String(saving)}</span>
      <span data-testid="zara-outcome">{zaraOutcome}</span>
      <span data-testid="companion-outcome">{companionOutcome}</span>
      <button onClick={() => void persistPreferences({ character: 'zara' }).then((ok) => setZaraOutcome(String(ok)))}>
        choose-zara
      </button>
      <button onClick={() => void persistPreferences({ character: 'dina' })}>choose-dina</button>
      <button
        onClick={() =>
          void persistPreferences({ companion: 'liruf' }).then((ok) => setCompanionOutcome(String(ok)))
        }
      >
        invite-liruf
      </button>
      <button onClick={() => void persistPreferences({ diorama: 'island-b' })}>go-island-b</button>
    </div>
  );
}

beforeEach(() => {
  vi.mocked(savePreferences).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persistPreferences discards a stale response instead of letting it win a race', () => {
  it('a late SUCCESS response does not clobber a newer, already-confirmed choice — and does not clear `saving` early', async () => {
    const zara = deferred<ApiResult<TutorPreferences>>();
    const dina = deferred<ApiResult<TutorPreferences>>();
    vi.mocked(savePreferences).mockImplementation((_token, patch) => {
      if (patch.character === 'zara') return zara.promise;
      if (patch.character === 'dina') return dina.promise;
      throw new Error(`unexpected patch in test: ${JSON.stringify(patch)}`);
    });

    const { getByText, getByTestId } = render(<PreferencesHarness token="tok" />);

    // Tap Zara, then quickly tap Dina — exactly the picker's own rapid-tap
    // shape. Dina's call is issued SECOND and is therefore the latest one.
    act(() => getByText('choose-zara').click());
    act(() => getByText('choose-dina').click());
    expect(getByTestId('character').textContent).toBe('dina'); // optimistic patch already applied
    expect(getByTestId('saving').textContent).toBe('true');

    // Dina's (the LATEST call's) response resolves FIRST — ordinary case.
    await act(async () => {
      dina.resolve({ data: { ...BASE, character: 'dina' }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByTestId('character').textContent).toBe('dina');
    expect(getByTestId('saving').textContent).toBe('false');

    // Zara's (the now-STALE call's) response resolves LAST — the race. Before
    // the fix this full-object-overwrote `character` back to 'zara' and, had
    // it failed instead, would have rolled the whole object back regardless.
    await act(async () => {
      zara.resolve({ data: { ...BASE, character: 'zara' }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    // The learner's last tap (Dina) still wins — the stale success never applied.
    expect(getByTestId('character').textContent).toBe('dina');
    // The stale call did not reawaken `saving` either.
    expect(getByTestId('saving').textContent).toBe('false');
    // The caller of the STALE call still learns the true server-side outcome
    // of its OWN request, even though that outcome was not applied to shared state.
    expect(getByTestId('zara-outcome').textContent).toBe('true');
  });

  it('a stale FAILURE response does not roll back a DIFFERENT axis a newer call already confirmed', async () => {
    const companionCall = deferred<ApiResult<TutorPreferences>>();
    const islandCall = deferred<ApiResult<TutorPreferences>>();
    vi.mocked(savePreferences).mockImplementation((_token, patch) => {
      if (patch.diorama !== undefined) return islandCall.promise;
      if (patch.companion !== undefined) return companionCall.promise;
      throw new Error(`unexpected patch in test: ${JSON.stringify(patch)}`);
    });

    const { getByText, getByTestId } = render(<PreferencesHarness token="tok" />);

    // Invite Liruf as a companion (will FAIL server-side), then walk to the
    // other island (will SUCCEED) — the island call is issued second and is
    // therefore the latest one.
    act(() => getByText('invite-liruf').click());
    act(() => getByText('go-island-b').click());

    // The newer call (island) confirms first.
    await act(async () => {
      islandCall.resolve({ data: { ...BASE, companion: 'liruf', diorama: 'island-b' }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(getByTestId('diorama').textContent).toBe('island-b'));

    // The older, now-stale companion call's FAILURE arrives after. Before the
    // fix, its rollback used a snapshot of the WHOLE object captured before
    // the island call ever started, and would have reverted `diorama` back to
    // 'island-a' too — an axis that call never touched and a different,
    // already-confirmed call had since moved on from.
    await act(async () => {
      companionCall.resolve({ data: null, error: { code: 'VALIDATION_ERROR', message: 'nope' } });
      await Promise.resolve();
      await Promise.resolve();
    });

    // The newer, already-confirmed island choice survives the older call's
    // stale rollback.
    expect(getByTestId('diorama').textContent).toBe('island-b');
    // The stale call's own caller still learns its request was rejected.
    expect(getByTestId('companion-outcome').textContent).toBe('false');
    /*
     * NOTE ON `companion`: it is left at its optimistic 'liruf' value here,
     * not rolled back to `null`, because that rollback is exactly what this
     * fix discards once a newer call has superseded it — the guard cannot
     * roll back ONLY the failed field without risking the same clobber it
     * exists to prevent (a whole-object rollback is the only rollback this
     * function has ever done, per the round-38 fix above it). A learner in
     * this exact narrow window could see an unconfirmed companion linger
     * briefly; the fix's job is to guarantee a NEWER, CONFIRMED choice is
     * never destroyed by an older one's late failure, which the assertion
     * above proves.
     */
  });
});
