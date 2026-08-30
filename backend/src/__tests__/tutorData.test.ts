import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLearnerMemory,
  grantVoiceConsent,
  insertTutorTurn,
  listTutorTurns,
  searchOwnTurns,
  writeLearnerMemory,
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
 * Found by adversarial review, round 42 (2026-08-30, MEDIUM/HIGH):
 * `writeLearnerMemory` was a plain read-then-write with nothing checking
 * the row was still in the state that was just read. Two concurrent calls
 * for the same (user_id, store) both read the same stale content before
 * either write landed, and whichever write landed last discarded the
 * other's real update — both calls reported success identically. Fixed by
 * moving the compare-and-write into one atomic RPC
 * (`write_learner_memory_checked`, migration 0059) that reports 'written',
 * 'unchanged', or 'conflict' — the last of which this function must now
 * treat as a failed write, not a successful one.
 */
describe('writeLearnerMemory reports a lost concurrent-write race, never silently as success', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const USER = '22222222-2222-4222-8222-222222222222';

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  it('writes through when the RPC reports "written"', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ content: 'Vieja nota.' }])) // the pre-write GET
      .mockResolvedValueOnce(jsonResponse('written')); // the atomic RPC
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemory({
      userId: USER,
      store: 'learner',
      content: 'Nota nueva.',
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toBe(true);
    const rpcCall = fetchMock.mock.calls[1];
    expect(String(rpcCall?.[0])).toContain('/rpc/write_learner_memory_checked');
    const rpcBody = JSON.parse(String(rpcCall?.[1]?.body ?? '{}'));
    expect(rpcBody.p_expected_before).toBe('Vieja nota.');
    expect(rpcBody.p_new_content).toBe('Nota nueva.');
  });

  it('reports false — not true — when the RPC detects a lost race, and logs it distinctly', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ content: 'Vieja nota.' }]))
      .mockResolvedValueOnce(jsonResponse('conflict'));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await writeLearnerMemory({
      userId: USER,
      store: 'learner',
      content: 'Nota que llegó tarde.',
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lost a concurrent write race'));
    warnSpy.mockRestore();
  });

  it('short-circuits before ever calling the RPC when the new content matches what is already stored', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([{ content: 'Misma nota.' }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeLearnerMemory({
      userId: USER,
      store: 'pedagogy',
      content: 'Misma nota.',
      actor: 'oracle-post-session-review',
      sessionId: null,
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the GET only — no ledger noise
  });
});
