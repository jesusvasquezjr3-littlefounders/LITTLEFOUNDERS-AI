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
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
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
 * semantics) — Forge never includes `status`, so a re-run never clobbers an
 * operator's prior 'published' flip back to 'draft'.
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
