import { createHash } from 'crypto';
import { getConfig } from '../env.js';

/*
 * Service-role PostgREST access to `picture_assets` — the cache-first heart
 * of Prism. Mirrors audiogen/src/db/lessonDocumentsRepo.ts's asServiceRole()
 * pattern (writes reserved to the service role). An identical request must
 * NEVER hit the paid image API twice: the (model, size, prompt) hash is a
 * UNIQUE key, and generation is skipped whenever a row already exists.
 *
 * Schema (migration owned by another engineer — assumed present):
 *   picture_assets(
 *     id uuid default, prompt_hash text UNIQUE, model text, prompt text,
 *     url text, file_id text, bytes int, created_at timestamptz)
 */

export interface PictureAssetRow {
  id: string;
  prompt_hash: string;
  model: string;
  prompt: string;
  url: string;
  file_id: string;
  bytes: number;
  created_at: string;
}

/** Everything the caller must supply to persist a freshly generated asset. */
export type InsertPictureAsset = Pick<PictureAssetRow, 'prompt_hash' | 'model' | 'prompt' | 'url' | 'file_id' | 'bytes'>;

const SELECT = 'id,prompt_hash,model,prompt,url,file_id,bytes,created_at';

/** The cache key — identical (model, size, prompt) always maps to one asset. */
/**
 * Cache key = sha256(model + size + REQUEST descriptor). The request (purpose |
 * label | context) — never the judged prompt — is what gets hashed: the judge
 * is an LLM whose output varies between identical calls, so a prompt-based key
 * degraded every repeat into a paid regeneration (observed on the first live
 * smoke test). The judged prompt is stored alongside as metadata.
 */
export function pictureAssetHash(model: string, size: string, requestDescriptor: string): string {
  return createHash('sha256').update(`${model} ${size} ${requestDescriptor}`).digest('hex');
}

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function rest<T>(path: string, init: RestInit = {}): Promise<{ ok: boolean; status: number; body: T | null }> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    return { ok: false, status: 0, body: null };
  }
  const text = await res.text().catch(() => '');
  let body: T | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

/** Cache lookup — the row for this exact (model, size, prompt) hash, or null. */
export async function findByHash(hash: string): Promise<PictureAssetRow | null> {
  const res = await rest<PictureAssetRow[]>(
    `/picture_assets?prompt_hash=eq.${encodeURIComponent(hash)}&select=${SELECT}&limit=1`,
  );
  if (!res.ok || !res.body) return null;
  return res.body[0] ?? null;
}

/**
 * Persist a generated asset. On `prompt_hash` conflict PostgREST is told to
 * IGNORE the duplicate (`resolution=ignore-duplicates`) — so two concurrent
 * generations of the same prompt can't error — then we re-select the winning
 * row so the caller always gets a real, stored asset back.
 */
export async function insertAsset(row: InsertPictureAsset): Promise<PictureAssetRow> {
  const res = await rest<PictureAssetRow[]>(`/picture_assets?on_conflict=prompt_hash&select=${SELECT}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(row),
  });

  if (res.ok && res.body && res.body[0]) return res.body[0];

  // Duplicate was ignored (empty representation) — the concurrent winner is
  // already stored; re-select it so callers still get a persisted row.
  const existing = await findByHash(row.prompt_hash);
  if (existing) return existing;

  throw new Error('insertAsset: picture_assets row was neither inserted nor found');
}
