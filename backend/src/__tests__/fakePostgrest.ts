/*
 * A minimal in-memory PostgREST stand-in for tests that exercise
 * routes/learn.ts end to end (it makes many sequential REST calls per
 * request — course-chain walks, tree assembly, attempts, progress, stats —
 * hand-sequencing every fetch() call per test would be unreadable). Supports
 * just enough of the query-string dialect services/supabaseRest.ts actually
 * emits: `eq.`, `in.(...)`, `select=` / `order=` / `on_conflict=` (ignored
 * for filtering), plus GET/POST/PATCH.
 */

export type FakeRow = Record<string, unknown>;
export type FakeDb = Record<string, FakeRow[]>;

function matchesFilters(row: FakeRow, params: URLSearchParams): boolean {
  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
    if (value.startsWith('eq.')) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith('in.(') && value.endsWith(')')) {
      const list = value.slice(4, -1).split(',');
      if (!list.includes(String(row[key]))) return false;
    }
    // Other operators (or=, etc.) aren't used by learn.ts — ignored.
  }
  return true;
}

function respond(status: number, body: unknown, minimal = false): Response {
  const text = minimal ? '' : JSON.stringify(body);
  return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
}

/** Builds a `global.fetch` replacement backed by `db` (mutated in place by writes). */
export function createFakeFetch(db: FakeDb): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const marker = '/rest/v1/';
    const idx = url.indexOf(marker);
    if (idx === -1) throw new Error(`fakePostgrest: non-PostgREST URL: ${url}`);
    const [table, queryString = ''] = url.slice(idx + marker.length).split('?');
    if (!table) throw new Error(`fakePostgrest: could not parse table from ${url}`);
    const params = new URLSearchParams(queryString);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const prefer = headers.Prefer ?? '';
    db[table] ??= [];
    const rows = db[table];

    if (method === 'GET') {
      return respond(200, rows.filter((r) => matchesFilters(r, params)));
    }

    if (method === 'POST') {
      const body = init?.body ? (JSON.parse(String(init.body)) as FakeRow) : {};
      const onConflict = params.get('on_conflict');
      if (onConflict) {
        const keys = onConflict.split(',');
        const idxExisting = rows.findIndex((r) => keys.every((k) => r[k] === body[k]));
        if (idxExisting >= 0) {
          if (prefer.includes('merge-duplicates')) rows[idxExisting] = { ...rows[idxExisting], ...body };
          // ignore-duplicates: leave the existing row untouched.
        } else {
          rows.push(body);
        }
      } else {
        rows.push(body);
      }
      return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, [body]);
    }

    if (method === 'PATCH') {
      const body = init?.body ? (JSON.parse(String(init.body)) as FakeRow) : {};
      const matched: FakeRow[] = [];
      db[table] = rows.map((r) => {
        if (!matchesFilters(r, params)) return r;
        const updated = { ...r, ...body };
        matched.push(updated);
        return updated;
      });
      return prefer.includes('return=minimal') ? respond(200, null, true) : respond(200, matched);
    }

    if (method === 'DELETE') {
      db[table] = rows.filter((r) => !matchesFilters(r, params));
      return respond(200, null, true);
    }

    throw new Error(`fakePostgrest: unsupported method ${method}`);
  }) as unknown as typeof fetch;
}
