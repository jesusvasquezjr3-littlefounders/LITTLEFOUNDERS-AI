/*
 * A minimal in-memory PostgREST stand-in for tests that exercise
 * routes/learn.ts end to end (it makes many sequential REST calls per
 * request — course-chain walks, tree assembly, attempts, progress, stats —
 * hand-sequencing every fetch() call per test would be unreadable). Supports
 * just enough of the query-string dialect services/supabaseRest.ts actually
 * emits: `eq.`, `in.(...)`, `select=` / `order=` / `on_conflict=` (ignored
 * for filtering), `limit=` / `offset=` (applied — the insights export pages
 * with them, and a fake that silently ignored them made a broken pager look
 * correct), plus GET/POST/PATCH.
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
    } else if (value === 'is.null') {
      // analytics_consents active-consent lookups filter on revoked_at=is.null.
      if (row[key] !== null && row[key] !== undefined) return false;
    }
    // Other operators (or=, etc.) aren't used by the routes under test — ignored.
  }
  return true;
}

/** PostgREST applies offset then limit; the export's truncation probe needs both. */
function applyRange(rows: FakeRow[], params: URLSearchParams): FakeRow[] {
  const offset = Number(params.get('offset') ?? '0');
  const limit = params.get('limit');
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const sliced = start > 0 ? rows.slice(start) : rows;
  const n = limit === null ? NaN : Number(limit);
  return Number.isFinite(n) && n >= 0 ? sliced.slice(0, n) : sliced;
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
      const matched = rows.filter((r) => matchesFilters(r, params));
      return respond(200, applyRange(matched, params));
    }

    if (method === 'HEAD') {
      // count=exact consumers read Content-Range, never a body.
      const n = rows.filter((r) => matchesFilters(r, params)).length;
      return new Response(null, { status: 200, headers: { 'Content-Range': `0-${Math.max(0, n - 1)}/${n}` } });
    }

    if (method === 'POST') {
      const parsed = init?.body ? (JSON.parse(String(init.body)) as FakeRow | FakeRow[]) : {};
      // Batch inserts (learning_events) POST an array — one row each.
      if (Array.isArray(parsed)) {
        const onConflict = params.get('on_conflict');
        if (!onConflict) {
          rows.push(...parsed);
          return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, parsed);
        }
        const keys = onConflict.split(',');
        const inserted: FakeRow[] = [];
        for (const body of parsed) {
          const idxExisting = rows.findIndex((r) => keys.every((key) => r[key] === body[key]));
          if (idxExisting >= 0) {
            if (prefer.includes('merge-duplicates')) {
              rows[idxExisting] = { ...rows[idxExisting], ...body };
              inserted.push(rows[idxExisting]!);
            }
            continue;
          }
          rows.push(body);
          inserted.push(body);
        }
        return prefer.includes('return=minimal') ? respond(201, null, true) : respond(201, inserted);
      }
      const body = parsed;
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
