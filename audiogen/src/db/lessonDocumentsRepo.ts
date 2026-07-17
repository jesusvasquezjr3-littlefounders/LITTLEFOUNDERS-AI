import { getConfig } from '../env.js';
import type { LessonDocument, LessonLocale } from '../types/lessonDocument.js';

/*
 * Service-role PostgREST access to `lesson_documents` — mirrors
 * backend/src/services/supabaseRest.ts's asServiceRole() pattern (writes
 * reserved to the service role; Echo never reads on behalf of a user).
 *
 * Schema: database/migrations/0007_course_hierarchy.sql —
 *   lesson_documents(lesson_id uuid, locale text, schema_version int,
 *                     document jsonb, answer_keys jsonb, audio jsonb,
 *                     updated_at) PRIMARY KEY (lesson_id, locale)
 * No SELECT RLS policy exists on this table BY DESIGN (0007's comment: a
 * "published chain" policy would still expose `answer_keys` on the same
 * row) — only the service role can read it, which is exactly what this
 * module uses. Echo NEVER selects `answer_keys` — the select clause below
 * is deliberately narrow (invariant, AGENTS.md).
 */

export interface LessonDocumentRow {
  lesson_id: string;
  locale: LessonLocale;
  document: LessonDocument;
  /** DB default is '{}'::jsonb (not null) until Echo's first write — treat fields as optional. */
  audio: Partial<LessonAudioManifest> | null;
}

export interface AudioUnitEntry {
  file_id: string;
  url: string;
  hash: string;
  bytes: number;
  duration_ms: number | null;
  voice: string;
}

export interface LessonAudioManifest {
  version: 1;
  voice_profile: string;
  units: Record<string, AudioUnitEntry>;
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

export async function getLessonDocument(lessonId: string, locale: LessonLocale): Promise<LessonDocumentRow | null> {
  const res = await rest<LessonDocumentRow[]>(
    `/lesson_documents?lesson_id=eq.${encodeURIComponent(lessonId)}&locale=eq.${encodeURIComponent(locale)}&select=lesson_id,locale,document,audio`,
  );
  if (!res.ok || !res.body) return null;
  return res.body[0] ?? null;
}

/** PK is (lesson_id, locale) — no synthetic id column. */
export async function patchLessonDocumentAudio(
  lessonId: string,
  locale: LessonLocale,
  document: LessonDocument,
  audio: LessonAudioManifest,
): Promise<boolean> {
  const res = await rest<unknown>(
    `/lesson_documents?lesson_id=eq.${encodeURIComponent(lessonId)}&locale=eq.${encodeURIComponent(locale)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ document, audio }),
    },
  );
  return res.ok;
}

export interface PendingLessonDocument {
  lesson_id: string;
  locale: LessonLocale;
}

/**
 * Batch mode source query: `lesson_documents` rows belonging to a published
 * lesson whose audio manifest hasn't been generated yet (`audio` still the
 * DB default `{}`, so `audio->>version` reads NULL).
 */
export async function listPendingLessonDocuments(): Promise<PendingLessonDocument[]> {
  const res = await rest<PendingLessonDocument[]>(
    `/lesson_documents?select=lesson_id,locale,lessons!inner(status)&lessons.status=eq.published&audio->>version=is.null`,
  );
  return res.ok && res.body ? res.body : [];
}
