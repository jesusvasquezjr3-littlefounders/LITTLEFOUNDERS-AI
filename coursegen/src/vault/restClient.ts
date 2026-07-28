// Service-role PostgREST client for Vault writes — mirrors the pattern in
// backend/src/services/supabaseRest.ts + backend/src/lib/http.ts. Forge
// NEVER has a user JWT (it's an offline CLI, not a request handler), so
// every call here is service-role, bypassing RLS on purpose: hierarchy rows
// land as 'draft'/'review' and are invisible to clients until a human (or
// Core) flips them to 'published' (COURSE_ENGINE.md §4/§6).

import { getConfig, requirePublishKeys } from '../env.js';

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface RestResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
}

async function vaultRest<T>(path: string, init: RestInit = {}): Promise<RestResult<T>> {
  requirePublishKeys();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
  // Bounded: an untimed publish fetch could park a slot worker for as long as the
  // OS keeps a half-open socket alive (~20 minutes observed), silently draining
  // the pool during a multi-day run.
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(getConfig().FORGE_VAULT_TIMEOUT_MS),
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text().catch(() => '');
  let body: T | null = null;
  try {
    body = text ? (JSON.parse(text) as T) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Upsert-by-unique-key: POST with `Prefer: resolution=merge-duplicates`.
 * Columns NOT present in `rows` are left untouched on conflict (PostgREST
 * semantics). Status handling is DELIBERATELY asymmetric: courses/adventures/
 * sagas/topics omit `status`, so a re-run never clobbers an operator's prior
 * 'published' flip — but LESSONS explicitly include `status: 'review'`
 * (publish.ts), so REGENERATING a published lesson downgrades it to review on
 * purpose: new kid-facing content always re-enters the human publish gate
 * (§1.9 / COURSE_ENGINE.md §6). Re-flip with db:publish-course after a regen.
 */
export async function vaultUpsert<T>(table: string, rows: readonly unknown[], onConflict: string): Promise<T[]> {
  if (rows.length === 0) return [];
  const res = await vaultRest<T[]>(`/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok || !res.body) {
    throw new Error(`vault upsert into "${table}" failed: HTTP ${res.status}`);
  }
  return res.body;
}

/**
 * Service-role read. `pathWithQuery` is the full PostgREST path INCLUDING the
 * leading `/table` and any `?select=…`/filter query string (mirrors
 * backend/src/services/supabaseRest.ts, where every read composes the filter
 * into the path). Returns `[]` on an empty result — never null.
 */
export async function vaultSelect<T>(pathWithQuery: string): Promise<T[]> {
  const res = await vaultRest<T[]>(pathWithQuery);
  if (!res.ok) {
    throw new Error(`vault select "${pathWithQuery}" failed: HTTP ${res.status}`);
  }
  return res.body ?? [];
}

/**
 * Service-role PATCH by filter. `pathWithFilter` MUST carry an `eq.`/`in.`
 * filter (PostgREST refuses an unfiltered PATCH) — the caller composes it into
 * the path. `patch` becomes the request body verbatim; only the columns it
 * names are written (PostgREST leaves the rest untouched), which is what makes
 * a document-only backfill safe for the sibling `audio`/`answer_keys` columns.
 */
export async function vaultPatch(pathWithFilter: string, patch: unknown): Promise<void> {
  const res = await vaultRest<unknown>(pathWithFilter, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`vault patch "${pathWithFilter}" failed: HTTP ${res.status}`);
  }
}
