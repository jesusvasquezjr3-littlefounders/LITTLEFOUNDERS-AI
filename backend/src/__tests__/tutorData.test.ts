import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLearnerMemory, searchOwnTurns } from '../services/tutorData.js';

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
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchOwnTurns('22222222-2222-4222-8222-222222222222', 'remember cookie problem', 3, locale);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { p_locale?: string };
    expect(body.p_locale).toBe(locale);
  });

  it('defaults to es-MX when no locale is given, so an older caller keeps working', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchOwnTurns('22222222-2222-4222-8222-222222222222', 'galletas problema');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { p_locale?: string };
    expect(body.p_locale).toBe('es-MX');
  });
});
