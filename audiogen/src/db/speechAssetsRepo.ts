import { createHash } from 'node:crypto';
import { getConfig } from '../env.js';

/*
 * Service-role PostgREST access to `speech_assets` — the global TTS cache
 * (database/migrations/0015_speech_assets.sql). Mirrors
 * picturegen/src/cache/pictureAssetsRepo.ts: an identical TTS request must
 * NEVER hit the paid DashScope API twice. The per-lesson manifest in
 * lesson_documents.audio only deduplicates WITHIN one (lesson, locale) row —
 * this table deduplicates across lessons, locales, courses, re-publishes and
 * wiped manifests, because its key is derived purely from the request
 * content, never from where the unit lives.
 */

export interface SpeechAssetRow {
  id: string;
  speech_hash: string;
  model: string;
  voice: string;
  language_type: string;
  text: string;
  url: string;
  file_id: string;
  bytes: number | null;
  duration_ms: number | null;
  mp3_bitrate_kbps: number;
  created_at: string;
}

/** Everything the caller must supply to persist a freshly synthesized asset. */
export type InsertSpeechAsset = Omit<SpeechAssetRow, 'id' | 'created_at'>;

const SELECT = 'id,speech_hash,model,voice,language_type,text,url,file_id,bytes,duration_ms,mp3_bitrate_kbps,created_at';

/**
 * Global cache key. JSON-encodes the tuple (never space-joins it — the
 * manifest-level contentHash's `${text} ${voice} ${model}` concatenation is
 * ambiguity-prone, fine for a per-lesson idempotency stamp but not for a
 * table-wide unique key). language_type joins the key because it is sent to
 * the provider and changes pronunciation; mp3_bitrate_kbps joins because the
 * cache stores the ENCODED MP3 pointer and the source WAV is gone.
 */
export function speechAssetHash(text: string, voice: string, model: string, languageType: string, mp3BitrateKbps: number): string {
  return createHash('sha256').update(JSON.stringify([text, voice, model, languageType, mp3BitrateKbps])).digest('hex');
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

/** Cache lookup — the asset already synthesized for this exact request, or null. */
export async function findSpeechAsset(hash: string): Promise<SpeechAssetRow | null> {
  const res = await rest<SpeechAssetRow[]>(
    `/speech_assets?speech_hash=eq.${encodeURIComponent(hash)}&select=${SELECT}&limit=1`,
  );
  if (!res.ok || !res.body) return null;
  return res.body[0] ?? null;
}

/**
 * Persist a synthesized asset. On `speech_hash` conflict PostgREST is told to
 * IGNORE the duplicate (`resolution=ignore-duplicates`) — two concurrent
 * narrations of the same sentence can't error — then we re-select the winning
 * row so the caller always gets a real, stored asset back.
 */
export async function insertSpeechAsset(row: InsertSpeechAsset): Promise<SpeechAssetRow> {
  const res = await rest<SpeechAssetRow[]>(`/speech_assets?on_conflict=speech_hash&select=${SELECT}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(row),
  });

  if (res.ok && res.body && res.body[0]) return res.body[0];

  const existing = await findSpeechAsset(row.speech_hash);
  if (existing) return existing;

  throw new Error('insertSpeechAsset: speech_assets row was neither inserted nor found');
}
