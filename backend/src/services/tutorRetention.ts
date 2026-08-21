import { getConfig } from '../config.js';
import { serviceRest } from './supabaseRest.js';

/*
 * The 90-day retention sweep (/ORACLE.md §12, migration 0047).
 *
 * "A retention policy nobody runs is not a retention policy" is written in the
 * migration, and this is the half that makes it true. It is called nightly by
 * `.github/workflows/tutor-retention.yml`.
 *
 * TWO DELETIONS, NOT ONE, and the second is the one that is easy to forget.
 * Dropping the session row cascades to turns, segments and safety flags — but
 * the tutor's synthesized audio lives in Depot, outside Postgres, and nothing
 * cascades to it. `purge_expired_tutor_sessions` returns those paths precisely
 * so a caller can finish the job; a sweep that only deleted rows would leave a
 * child's conversation audible at a public URL forever while every database
 * record of it was gone — the worst possible combination, because nothing
 * would remain to tell anyone the files existed.
 *
 * BATCHED AND IDEMPOTENT. The function takes a limit and the caller can run it
 * repeatedly; a partial sweep is a normal outcome, not a failure.
 */

export interface PurgeResult {
  sessionsDeleted: number;
  audioDeleted: number;
  audioFailed: number;
  /** Depot paths whose delete failed. Logged so a retry can target them. */
  orphanedPaths: string[];
}

interface PurgedRow {
  session_id: string;
  audio_paths: string[];
}

/**
 * Runs one batch.
 *
 * Returns `null` when the database call itself failed — the caller must treat
 * that as an error rather than as "nothing to delete". A retention job that
 * reports success on an unreachable database is how a 90-day promise quietly
 * becomes forever.
 */
export async function purgeExpiredTutorSessions(limit = 500): Promise<PurgeResult | null> {
  const rows = await serviceRest<PurgedRow[]>('/rpc/purge_expired_tutor_sessions', {
    method: 'POST',
    body: JSON.stringify({ p_limit: limit }),
  });
  if (rows === null) return null;

  const paths = rows.flatMap((row) => row.audio_paths ?? []).filter((p) => typeof p === 'string' && p !== '');

  let audioDeleted = 0;
  const orphanedPaths: string[] = [];
  for (const path of paths) {
    // Sequential rather than parallel: this runs at 03:00 against a service
    // that also serves lesson audio, and a burst of hundreds of deletes is a
    // self-inflicted outage for no gain — nothing is waiting on this job.
    if (await deleteDepotFile(path)) audioDeleted += 1;
    else orphanedPaths.push(path);
  }

  return {
    sessionsDeleted: rows.length,
    audioDeleted,
    audioFailed: orphanedPaths.length,
    orphanedPaths,
  };
}

/**
 * Deletes one stored audio file.
 *
 * Depot is content-addressed, so the stored path is `<bucket>/<hash>.<ext>`
 * and the delete route takes those two segments (`filebase/src/routes/
 * files.ts`). A URL is accepted too, because `storeTurnAudio` records whatever
 * Depot reported and that has been an absolute URL in every environment so
 * far — parsing defensively costs nothing and guessing wrong leaks a file.
 */
async function deleteDepotFile(pathOrUrl: string): Promise<boolean> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  if (!FILEBASE_URL || !FILEBASE_INTERNAL_KEY) return false;

  const tail = extractBucketAndFile(pathOrUrl);
  if (!tail) return false;

  try {
    const response = await fetch(`${FILEBASE_URL}/api/v1/files/${tail}`, {
      method: 'DELETE',
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    // A 404 means it is already gone, which is the state we wanted.
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** `…/files/tutor-speech/<hash>.mp3` or `tutor-speech/<hash>.mp3` → `tutor-speech/<hash>.mp3`. */
export function extractBucketAndFile(pathOrUrl: string): string | null {
  const withoutQuery = pathOrUrl.split('?')[0] ?? '';
  const marker = '/files/';
  const index = withoutQuery.indexOf(marker);
  const tail = index >= 0 ? withoutQuery.slice(index + marker.length) : withoutQuery.replace(/^\/+/, '');
  const parts = tail.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [bucket, file] = parts;
  if (!bucket || !file) return null;
  return `${encodeURIComponent(bucket)}/${encodeURIComponent(file)}`;
}
