// Service-role PostgREST client for Vault writes — the twin of
// `coursegen/src/vault/restClient.ts` (gamegen/AGENTS.md: Arcade inherits Forge's
// hard-won rules verbatim rather than re-deriving them).
//
// Arcade is an offline operator CLI, never a request handler, so it NEVER holds a
// user JWT: every call here is service-role and bypasses RLS ON PURPOSE. That is
// load-bearing twice over for the Game Engine:
//
//  1. `games` rows land as status='review' and are invisible to clients until a
//     human flips them to 'published' (GAME_ENGINE.md §9 — generated kid-facing
//     content never auto-publishes).
//  2. `game_documents` has RLS ENABLED WITH ZERO POLICIES (migration 0027),
//     because RLS is row-level and any SELECT policy would also expose the
//     server-only `validation` sidecar. The service role is therefore the only
//     writer this table can ever have.
//
// A non-2xx is SURFACED, never swallowed: publish is the last stage of a paid run,
// and a silently-dropped write would report a game as published that a child can
// never open. The PostgREST error body is carried into the message because that is
// where the actionable detail lives (a constraint name, a missing column).

import { getConfig, requirePublishKeys } from '../env.js';

/** Non-2xx from PostgREST. Carries the raw body — a UNIQUE violation on
 *  `games_topic_position_unique` is a catalog fix, a 401 is a bad service key, and
 *  the message must let an operator tell those apart without re-running the stage. */
export class VaultRestError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(operation: string, path: string, status: number, body: string) {
    super(`vault ${operation} "${path}" failed: HTTP ${status}${body ? ` — ${body.slice(0, 500)}` : ''}`);
    this.name = 'VaultRestError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface RestResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  raw: string;
}

async function vaultRest<T>(path: string, init: RestInit = {}): Promise<RestResult<T>> {
  requirePublishKeys();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
  // Bounded on purpose. An untimed publish fetch can park a slot worker for as long
  // as the OS keeps a half-open socket alive (~20 minutes observed in Forge), and
  // with ARCADE_CONCURRENCY workers a long run can lose every lane and hang with no
  // output. The timeout is config, not a literal (ARCADE_VAULT_TIMEOUT_MS).
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(getConfig().ARCADE_VAULT_TIMEOUT_MS),
    headers: {
      // requirePublishKeys() above already refused when either is missing; the
      // non-null assertions restate that, they do not assume it.
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const raw = await res.text().catch(() => '');
  let body: T | null = null;
  try {
    body = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, raw };
}

/**
 * Upsert-by-unique-key: POST with `Prefer: resolution=merge-duplicates`, which is
 * what makes re-publishing a slot an UPDATE instead of a duplicate row. `onConflict`
 * must name a real UNIQUE constraint's columns (`topic_id,slug` for games,
 * `game_id,locale` for game_documents — migration 0027).
 *
 * Columns NOT present in `rows` are left untouched on conflict (PostgREST
 * semantics), so a caller controls exactly what a re-run overwrites.
 */
export async function vaultUpsert<T>(table: string, rows: readonly unknown[], onConflict: string): Promise<T[]> {
  if (rows.length === 0) return [];
  const path = `/${table}?on_conflict=${onConflict}`;
  const res = await vaultRest<T[]>(path, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok || !res.body) {
    throw new VaultRestError('upsert', path, res.status, res.raw);
  }
  return res.body;
}

/**
 * Service-role read. `pathWithQuery` is the FULL PostgREST path including the
 * leading `/table` and any `?select=…`/filter query string, mirroring
 * `coursegen/src/vault/restClient.ts` and `backend/src/services/supabaseRest.ts`.
 *
 * Returns `[]` for "the query matched nothing" and THROWS for "the query failed" —
 * the two must stay distinguishable (/AGENTS.md §1.14): collapsing a transient
 * PostgREST failure into an empty result would make `resolveTopicPath()` report a
 * real topic as missing and fail an otherwise-good paid run.
 */
export async function vaultSelect<T>(pathWithQuery: string): Promise<T[]> {
  const res = await vaultRest<T[]>(pathWithQuery);
  if (!res.ok) {
    throw new VaultRestError('select', pathWithQuery, res.status, res.raw);
  }
  return res.body ?? [];
}
