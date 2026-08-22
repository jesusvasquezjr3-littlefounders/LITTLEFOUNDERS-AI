import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';

/*
 * The tutor's synthesized audio goes to Depot, the same content-addressed
 * store lesson narration and generated art already use.
 *
 * TWO THINGS WORTH KNOWING, both learned the hard way elsewhere in this repo:
 *
 * 1. DEPOT IS CONTENT-ADDRESSED. It serves files at /files/:bucket/:hash.:ext
 *    and the name it stores under has nothing to do with the name we upload.
 *    So the URL must come from the upload RESPONSE and never be constructed by
 *    concatenating a filename — /TUTOR_3D.md §3.2 records what that cost when
 *    the 3D assets tried it.
 * 2. THE MIME TYPE MUST BE ONE DEPOT ACCEPTS. Publishing the 3D scene failed
 *    on exactly this, against a Depot deployment whose code supported the type
 *    but whose RUNNING VERSION did not. Audio/mpeg has been accepted since the
 *    lesson-narration work, so this path is on already-proven ground.
 *
 * Failure here is never fatal. A turn with no audio URL is a captioned turn,
 * which is a worse experience and a working one.
 *
 * ── THE BUCKET NAME IS THE RETENTION POLICY ─────────────────────────────────
 *
 * There are two, and the difference is who the audio belongs to:
 *
 *   tutor-speech          One child's session. The model said it, to them, in
 *                         answer to something they said. Core's nightly sweep
 *                         deletes it with the session at 90 days
 *                         (/ORACLE.md §12, backend/src/services/
 *                         tutorRetention.ts).
 *   tutor-speech-shared   A line out of the closed, human-written scripted set
 *                         (src/tutor/scripted.ts). Identical for every
 *                         learner, contains nothing about anybody, and is
 *                         reused across sessions and across instances — so it
 *                         must NOT be swept. Deleting it would delete nothing
 *                         about anyone and would silence every future session.
 *
 * That distinction is enforced on both ends: this file chooses the bucket, and
 * the sweep refuses to delete anything outside `tutor-speech`. It has to be
 * both, because Depot is content-addressed: the same bytes in the same bucket
 * are the same object, so one session's expiry could otherwise take away a
 * clip a thousand later sessions still point at.
 */

/** Per-session speech. Swept with the session at 90 days. */
export const SESSION_SPEECH_BUCKET = 'tutor-speech';
/** Reusable scripted speech. Learner-independent, and never swept. */
export const SHARED_SPEECH_BUCKET = 'tutor-speech-shared';

export interface StoredAudio {
  /** Absolute, browser-fetchable URL as reported by Depot. */
  url: string;
  /** Depot's own path, for the retention janitor to delete later. */
  path: string;
}

interface DepotUploadResponse {
  data?: { url?: string; path?: string; filename?: string; bucket?: string; deduplicated?: boolean };
  error?: { code: string; message: string } | null;
}

/**
 * Stores one turn's audio, in the bucket that matches how long it may live.
 *
 * Returns `null` on any failure — the caller continues without sound rather
 * than dropping the turn.
 */
export async function storeSpeechAudio(
  audio: Buffer,
  mimeType: string,
  options: { bucket: string; name: string },
): Promise<StoredAudio | null> {
  const config = getConfig();
  if (!config.DEPOT_URL || !config.DEPOT_INTERNAL_KEY) return null;

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `${options.name}.mp3`);
    form.append('bucket', options.bucket);
    // Public read, PII-free: this is a tutor character's synthesized voice, and
    // it is served to the browser exactly like lesson narration is. The child's
    // audio is never here — there is nowhere in this service that stores it.
    form.append('visibility', 'public');

    const response = await withTimeout(
      fetch(`${config.DEPOT_URL}/api/v1/files`, {
        method: 'POST',
        headers: { 'x-internal-api-key': config.DEPOT_INTERNAL_KEY },
        body: form,
      }),
      config.CORE_TIMEOUT_MS,
      'depot upload',
    );

    if (!response.ok) return null;
    const body = (await response.json()) as DepotUploadResponse;
    const url = body.data?.url;
    if (!url) return null;
    return { url, path: body.data?.path ?? url };
  } catch {
    return null;
  }
}

/**
 * Stores one session's turn audio. Swept with the session at 90 days.
 *
 * Kept as its own function rather than folded into the call above because the
 * bucket choice is a privacy decision, and a privacy decision expressed as a
 * default argument is a privacy decision waiting to be forgotten.
 */
export function storeTurnAudio(
  audio: Buffer,
  mimeType: string,
  sessionId: string,
): Promise<StoredAudio | null> {
  return storeSpeechAudio(audio, mimeType, { bucket: SESSION_SPEECH_BUCKET, name: sessionId });
}
