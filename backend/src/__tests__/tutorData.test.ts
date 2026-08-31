import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLearnerMemory,
  getTutorPreferences,
  grantVoiceConsent,
  insertTutorTurn,
  listTutorTurns,
  searchOwnTurns,
  upsertTutorPreferences,
  writeLearnerMemoryPair,
} from '../services/tutorData.js';

/*
 * Found by adversarial review, round 28 (2026-08-30, HIGH): `getLearnerMemory`
 * used to collapse "the read failed" and "this learner genuinely has no
 * memory yet" into the identical `{ learner: null, pedagogy: null }` shape
 * via `rows ?? []` — throwing away the one signal (`serviceRest` returning
 * `null` specifically on a transient failure, vs. a real, successful `[]`)
 * that tells them apart. `routes/tutor.ts` injects the result into Oracle's
 * session as `learnerBrief`, and Oracle's post-session review treats an
 * empty brief as "write a note from scratch" — which then REPLACES whatever
 * real memory existed. A transient failure on session N+1 could silently
 * and permanently erase everything sessions 1..N had accumulated.
 */
describe('getLearnerMemory distinguishes a failed read from a genuinely empty one', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null — not an empty brief — when the read itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))));
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toBeNull();
  });

  it('returns a real, empty brief when the read succeeds and finds no rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }))),
    );
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      learner: null,
      pedagogy: null,
    });
  });

  it('returns the real stored content when rows exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([{ store: 'learner', content: 'Le motivan las metas concretas.' }]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      learner: 'Le motivan las metas concretas.',
      pedagogy: null,
    });
  });
});

/*
 * Found by adversarial review, round 29 (2026-08-30, HIGH): episodic
 * recall's full-text search hardcoded the Spanish Postgres text-search
 * configuration regardless of the session's actual locale, breaking recall
 * unpredictably for en-US/pt-BR sessions — verified against a real local
 * Postgres instance (see database/migrations/0056_recall_locale_aware_fts.sql
 * and its RUNBOOK.md entry for the SQL-level proof). This proves the
 * application-side wiring: the locale the caller passes reaches the RPC
 * body as `p_locale`, and a caller that passes none still gets the
 * es-MX default `search_tutor_turns` itself defaults to.
 */
describe('searchOwnTurns threads the caller\'s locale into the RPC call', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['en-US', 'es-MX', 'pt-BR'] as const)('sends p_locale: %s', async (locale) => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchOwnTurns('22222222-2222-4222-8222-222222222222', 'remember cookie problem', 3, locale);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { p_locale?: string };
    expect(body.p_locale).toBe(locale);
  });

  it('defaults to es-MX when no locale is given, so an older caller keeps working', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchOwnTurns('22222222-2222-4222-8222-222222222222', 'galletas problema');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { p_locale?: string };
    expect(body.p_locale).toBe('es-MX');
  });
});

/*
 * Found by adversarial review, round 30 (2026-08-30, LOW): grantVoiceConsent
 * is check-then-insert across two round trips, not one transaction. The
 * partial unique index on `tutor_voice_consent` (migration 0047) makes two
 * simultaneously-active rows for the same child impossible regardless, so
 * data integrity was never at risk — but the LOSER of a grant/grant race
 * (two devices, or a double-tap) used to be told the write failed
 * (`DATA_UNAVAILABLE` at the route), even though an active consent row for
 * that exact child now exists, written by the winner an instant earlier.
 */
describe('grantVoiceConsent tells the race LOSER the truth, not a false failure', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const WINNER_ROW = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: '22222222-2222-4222-8222-222222222222',
    granted_by: '33333333-3333-4333-8333-333333333333',
    consent_text: 'I allow it.',
    locale: 'en-US',
    granted_at: '2026-08-30T00:00:00.000Z',
    revoked_at: null,
  };

  it('returns the winner\'s row instead of null when its own insert loses the race', async () => {
    // Two GETs bracket one POST: the pre-insert check (sees nothing yet —
    // the race has not resolved) and the post-failure re-check (sees the
    // winner's row, which has landed by then).
    let getCount = 0;
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((_url, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        // The loser's insert: refused by the DB's own unique constraint.
        return Promise.resolve(new Response('duplicate key value violates unique constraint', { status: 409 }));
      }
      getCount += 1;
      return Promise.resolve(
        new Response(JSON.stringify(getCount === 1 ? [] : [WINNER_ROW]), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await grantVoiceConsent({
      userId: WINNER_ROW.user_id,
      grantedBy: '44444444-4444-4444-8444-444444444444',
      consentText: 'I allow it.',
      locale: 'en-US',
    });

    expect(result).toEqual(WINNER_ROW);
  });

  it('still returns null when the insert genuinely fails and no active row ever appears', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((_url, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await grantVoiceConsent({
      userId: WINNER_ROW.user_id,
      grantedBy: '44444444-4444-4444-8444-444444444444',
      consentText: 'I allow it.',
      locale: 'en-US',
    });

    expect(result).toBeNull();
  });
});

/*
 * Found by adversarial review, round 35 (2026-08-30, HIGH): the V4
 * whiteboard reached the learner's own screen and nowhere else —
 * `InsertTurnInput` had no field for it and `listTutorTurns`'s SELECT did
 * not name the column, so a session that drew a board lost it silently on
 * replay and on the guardian transcript viewer (migration 0058).
 */
describe('the whiteboard survives the round trip through Core’s own data layer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const BOARD = {
    kind: 'sequence' as const,
    start: 10,
    steps: [{ op: 'add' as const, value: 2 }],
    unit: 'day' as const,
    values: [10, 12],
    label: 'Cada día te dan 2 más',
    currency: 'MXN' as const,
  };

  it('insertTutorTurn sends the board exactly as given, not re-derived', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await insertTutorTurn({
      sessionId: '22222222-2222-4222-8222-222222222222',
      seq: 3,
      speaker: 'tutor',
      text: 'Imaginemos que guardas 10 pesos y cada día te dan 2 más.',
      source: 'model',
      whiteboard: BOARD,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { whiteboard?: unknown };
    expect(body.whiteboard).toEqual(BOARD);
  });

  it('a turn with no board sends whiteboard: null, not an absent field', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await insertTutorTurn({
      sessionId: '22222222-2222-4222-8222-222222222222',
      seq: 1,
      speaker: 'tutor',
      text: 'Hola, ¿en qué trabajamos hoy?',
      source: 'model',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { whiteboard?: unknown };
    expect(body.whiteboard).toBeNull();
  });

  it('listTutorTurns selects the whiteboard column, so a stored board actually comes back', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => {
      expect(String(url)).toContain('whiteboard');
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              session_id: '22222222-2222-4222-8222-222222222222',
              seq: 3,
              speaker: 'tutor',
              text: 'Imaginemos que guardas 10 pesos y cada día te dan 2 más.',
              emotion: 'happy',
              action: 'nod',
              audio_path: null,
              source: 'model',
              created_at: '2026-08-30T00:00:00.000Z',
              whiteboard: BOARD,
            },
          ]),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await listTutorTurns('22222222-2222-4222-8222-222222222222');
    expect(rows?.[0]?.whiteboard).toEqual(BOARD);
  });
});

/*
 * FOUND BY ADVERSARIAL REVIEW SWEEP tutor-review-sweep-92 (onboarding
 * dimension), HIGH: `tutor_preferences.companion` (migration 0047) carried
 * no DEFAULT, unlike `character` (`DEFAULT 'rho'`). `upsertTutorPreferences`
 * sends a PARTIAL body — `{user_id, ...patch, updated_at}` — so an omitted
 * field is simply absent from the upsert's column list; through
 * `on_conflict=user_id, resolution=merge-duplicates` that is exactly what
 * lets a SECOND-OR-LATER save leave an untouched field alone. But on a
 * learner's FIRST-EVER save (a genuine INSERT, no existing row to fall back
 * on), an absent column lands on the column's own DEFAULT — 'rho' for
 * `character`, and (with no DEFAULT declared) NULL for `companion`, even
 * though `getTutorPreferences` documents 'liruf' as the pairing a brand-new
 * learner is shown before saving anything. `PersonalizeInWorld.tsx`'s
 * `chooseTutor` sends ONLY `{character: id}` on the very first pick, so
 * nearly every new account's first-ever `PUT /preferences` silently and
 * permanently lost its companion this way.
 *
 * Fixed in `database/migrations/0063_tutor_preferences_default_companion.sql`
 * — a real column DEFAULT plus a BEFORE INSERT trigger for the one collision
 * a plain DEFAULT cannot express (picking Liruf as the TUTOR would otherwise
 * default the companion into Liruf too and fail the existing
 * `tutor_preferences_companion_differs` CHECK). Verified against a real,
 * disposable local Postgres instance (not exercised here, since it is
 * schema/trigger behaviour a mocked `fetch` cannot run): a first save
 * touching only `character` landed with `companion = NULL` before the
 * migration and `companion = 'liruf'` after it, while a second save that
 * only touches another field still leaves an already-set companion
 * untouched, both before and after.
 *
 * What IS in scope for a unit test at this layer is the JS-level contract
 * the fix depends on: `upsertTutorPreferences` must keep OMITTING a field
 * the caller did not set, rather than "helpfully" substituting an explicit
 * value — the DB can only tell "omitted" (→ its own DEFAULT) apart from
 * "explicit null" (→ the given value, defaults never override an explicit
 * one) if Core keeps sending the former as a genuinely absent key. Sending
 * an explicit `companion: null` in its place would look identical to a
 * learner's own deliberate "no companion" choice and defeat the DB default
 * outright — the exact class of well-intentioned "fix" this test guards
 * against — and sending an explicit default value back in would reintroduce
 * the lost-update race rounds 34/36/42/51/59/61 already closed elsewhere in
 * this same file, since a second save's PATCH must never carry a field the
 * caller never mentioned.
 */
describe('upsertTutorPreferences leaves an omitted field genuinely absent — the DB (0063) owns the first-row default', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const USER = '22222222-2222-4222-8222-222222222222';

  it('omits companion entirely when the caller does not set it', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await upsertTutorPreferences(USER, { character: 'dina' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as Record<string, unknown>;
    expect('companion' in body).toBe(false);
    expect(body.character).toBe('dina');
  });

  it('still sends an explicit null when the caller deliberately clears the companion', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await upsertTutorPreferences(USER, { companion: null });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? 'null')) as Record<string, unknown>;
    expect('companion' in body).toBe(true);
    expect(body.companion).toBeNull();
  });

  it('still sends the given value when the caller sets a companion explicitly', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await upsertTutorPreferences(USER, { companion: 'zara' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as Record<string, unknown>;
    expect(body.companion).toBe('zara');
  });

  /*
   * The other half of why the bug was PERMANENT rather than a one-read
   * glitch: once a row exists at all, `getTutorPreferences`'s synthetic
   * "never saved anything yet" default (`rows[0] ?? {..., companion:
   * 'liruf', ...}`) never applies again — whatever is actually stored,
   * `null` included, is authoritative forever after the first save.
   */
  it('getTutorPreferences returns a stored null companion verbatim once a row exists — the synthetic default never overrides real data', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              user_id: USER,
              character: 'dina',
              companion: null,
              diorama: 'diorama-a',
              backdrop: 'auto',
              nickname: null,
              adaptations: [],
              updated_at: '2026-08-31T00:00:00.000Z',
            },
          ]),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const prefs = await getTutorPreferences(USER);
    expect(prefs?.companion).toBeNull();
  });
});

/*
 * Found by adversarial review, round 42 (2026-08-30, MEDIUM/HIGH): the
 * memory write was a plain read-then-write with nothing checking
 * the row was still in the state that was just read. Two concurrent calls
 * for the same (user_id, store) both read the same stale content before
 * either write landed, and whichever write landed last discarded the
 * other's real update — both calls reported success identically. Fixed by
 * moving the compare-and-write into one atomic RPC
 * (`write_learner_memory_checked`, migration 0059) that reports 'written',
 * 'unchanged', or 'conflict' — the last of which this function must now
 * treat as a failed write, not a successful one.
 *
 * Round 51 (2026-08-30, MEDIUM) then found that comparing against a value
 * this function read ITSELF, moments before the compare, could never
 * actually catch two overlapping SESSIONS — see `writeLearnerMemoryPair`'s
 * own comment. `expectedBefore` is now the CALLER's belief, not an internal
 * read, so the tests below no longer mock a pre-write GET at all — there
 * isn't one anymore.
 */
/*
 * Round 61 (2026-08-30, MEDIUM — deferred that round, closed as round 75)
 * then found the last gap, and it was on the READ side: both fixes above make
 * ONE store's write correct, and the post-session review writes TWO. The
 * route looped and awaited one RPC per store — two transactions — so a reader
 * could land between them and see one brand-new note beside one stale one.
 * `write_learner_memory_pair_checked` (migration 0061) takes both proposals in
 * one call, so the whole per-store contract below is preserved and only the
 * VISIBILITY changes: both stores move together, or neither does. The
 * end-to-end torn-read regression lives at the route, in `tutor.test.ts`,
 * because that is the layer that used to do the looping.
 */
describe('writeLearnerMemoryPair reports a lost concurrent-write race, never silently as success', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const USER = '22222222-2222-4222-8222-222222222222';

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  it('writes both stores through in ONE call when the RPC reports "written" for each', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ learner: 'written', pedagogy: 'written' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Nota nueva.', pedagogy: 'Enseñanza nueva.' },
      expectedBefore: { learner: 'Vieja nota.', pedagogy: 'Vieja enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toEqual({ learner: true, pedagogy: true });
    // ONE round trip for the pair — the whole point. Two would be two
    // transactions, and a window between them.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const rpcCall = fetchMock.mock.calls[0];
    expect(String(rpcCall?.[0])).toContain('/rpc/write_learner_memory_pair_checked');
    const rpcBody = JSON.parse(String(rpcCall?.[1]?.body ?? '{}'));
    expect(rpcBody.p_learner_expected).toBe('Vieja nota.');
    expect(rpcBody.p_learner_new).toBe('Nota nueva.');
    expect(rpcBody.p_pedagogy_expected).toBe('Vieja enseñanza.');
    expect(rpcBody.p_pedagogy_new).toBe('Enseñanza nueva.');
  });

  it('reports false — not true — for the store that lost a race, and logs it distinctly', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ learner: 'conflict', pedagogy: 'written' }));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Nota que llegó tarde.', pedagogy: 'Enseñanza nueva.' },
      expectedBefore: { learner: 'Vieja nota.', pedagogy: 'Vieja enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    // Per-store verdicts, deliberately unchanged by the pair fix: one store
    // losing its own compare-and-swap does not discard the other's write.
    expect(result).toEqual({ learner: false, pedagogy: true });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lost a concurrent write race'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('store learner'));
    warnSpy.mockRestore();
  });

  it('reports success without ledger noise when the RPC finds nothing actually changed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ learner: 'unchanged', pedagogy: 'unchanged' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Misma nota.', pedagogy: 'Misma enseñanza.' },
      expectedBefore: { learner: 'Misma nota.', pedagogy: 'Misma enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toEqual({ learner: true, pedagogy: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /*
   * A review that proposed nothing for one store. The RPC must be told NULL —
   * "skip this store" — and must report no verdict for it at all, so the
   * caller can still tell "nothing was asked of it" apart from "it failed".
   * `learner_memory.content` is NOT NULL: a proposal of nothing is not a
   * proposal to forget.
   */
  it('skips a store with nothing proposed instead of writing null over it', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ learner: 'written' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Nota nueva.', pedagogy: null },
      expectedBefore: { learner: 'Vieja nota.', pedagogy: 'Vieja enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toEqual({ learner: true });
    expect(result).not.toHaveProperty('pedagogy');
    const rpcBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(rpcBody.p_pedagogy_new).toBeNull();
    expect(rpcBody.p_pedagogy_after_hash).toBeNull();
  });

  it('does not call the RPC at all when the review proposed nothing for either store', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: null, pedagogy: null },
      expectedBefore: { learner: 'Vieja nota.', pedagogy: 'Vieja enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /*
   * §1.14, failure must be distinguishable from emptiness: an absent key
   * means "nothing was proposed for that store", so a failed call must not
   * come back as an empty map — every store that WAS proposed reports false.
   */
  it('reports every proposed store as not landed when the call itself fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Nota nueva.', pedagogy: 'Enseñanza nueva.' },
      expectedBefore: { learner: 'Vieja nota.', pedagogy: 'Vieja enseñanza.' },
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toEqual({ learner: false, pedagogy: false });
  });

  /*
   * THE ACTUAL ROUND-51 REPRO, now at pair granularity: two overlapping
   * sessions for the same learner, each proposing content computed from the
   * SAME session-start belief. Session A writes first and wins outright.
   * Session B's own `expectedBefore` still names the ORIGINAL belief (not a
   * value re-read after A's write, which is exactly what the old, long-
   * removed internal GET would have done) — so B correctly loses instead of
   * silently clobbering A's real, already-landed update.
   */
  it('correctly refuses a second session\'s write when a first session already moved the rows it both started from', async () => {
    /*
     * URL-aware on purpose, not just RPC-aware: this exact mock also proves
     * the OLD, pre-round-51 implementation (a GET of the live row, THEN the
     * RPC) was vulnerable, by faithfully modeling BOTH real endpoints
     * against ONE shared `stored` value — a GET reads whatever the rows
     * genuinely hold right now, exactly like real PostgREST would.
     */
    const stored: Record<string, string> = {
      learner: 'Nota original de la sesión anterior.',
      pedagogy: 'Enseñanza original de la sesión anterior.',
    };
    const fetchMock = vi.fn(async (url: unknown, init?: { body?: string }) => {
      if (String(url).includes('/learner_memory?')) {
        return jsonResponse(Object.entries(stored).map(([store, content]) => ({ store, content })));
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string | null>;
      const verdicts: Record<string, string> = {};
      for (const store of ['learner', 'pedagogy'] as const) {
        const proposal = body[`p_${store}_new`];
        if (proposal === null || proposal === undefined) continue;
        if (stored[store] !== body[`p_${store}_expected`]) verdicts[store] = 'conflict';
        else if (stored[store] === proposal) verdicts[store] = 'unchanged';
        else {
          stored[store] = proposal;
          verdicts[store] = 'written';
        }
      }
      return jsonResponse(verdicts);
    });
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const sharedBelief = {
      learner: 'Nota original de la sesión anterior.',
      pedagogy: 'Enseñanza original de la sesión anterior.',
    };
    const sessionA = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Actualización real de la sesión A.', pedagogy: 'Enseñanza real de la sesión A.' },
      expectedBefore: sharedBelief,
      actor: 'oracle-post-session-review',
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    const sessionB = await writeLearnerMemoryPair({
      userId: USER,
      stores: { learner: 'Propuesta obsoleta de la sesión B.', pedagogy: 'Enseñanza obsoleta de la sesión B.' },
      expectedBefore: sharedBelief, // B's belief never saw A's write
      actor: 'oracle-post-session-review',
      sessionId: '33333333-3333-4333-8333-333333333333',
    });

    expect(sessionA).toEqual({ learner: true, pedagogy: true });
    expect(sessionB).toEqual({ learner: false, pedagogy: false });
    // A's real update survives, WHOLE — never half of A beside half of B.
    expect(stored).toEqual({
      learner: 'Actualización real de la sesión A.',
      pedagogy: 'Enseñanza real de la sesión A.',
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lost a concurrent write race'));
    warnSpy.mockRestore();
  });
});
