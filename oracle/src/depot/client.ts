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
 */

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
 * Stores one turn's audio. Returns `null` on any failure — the caller
 * continues without sound rather than dropping the turn.
 */
export async function storeTurnAudio(
  audio: Buffer,
  mimeType: string,
  sessionId: string,
): Promise<StoredAudio | null> {
  const config = getConfig();
  if (!config.DEPOT_URL || !config.DEPOT_INTERNAL_KEY) return null;

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `${sessionId}.mp3`);
    form.append('bucket', 'tutor-speech');
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
