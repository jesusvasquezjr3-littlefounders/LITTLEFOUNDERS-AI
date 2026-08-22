import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../env.js';

/*
 * The pre-generated speech manifest — `oracle/speech.pregenerated.json`.
 *
 * WHAT IT IS. Every fixed line this service can speak, synthesised ONCE by
 * `npm run speech:pregenerate -- --confirm`, stored in Depot's shared bucket,
 * and recorded here as a URL against the content hash of the line. The runtime
 * looks a line up before it looks at a provider, so the whole scripted set —
 * the greetings, the safety lines, the closes, the fallbacks — costs nothing
 * for the rest of the product's life (/ORACLE.md §15).
 *
 * IT IS TRACKED CONFIG, NOT A SECRET, and the precedent is
 * `oracle/voices.enrolled.json`: URLs to world-readable audio in our own
 * Depot, useless to anyone as leverage, and enormously useful in a diff. A
 * re-generation becomes a reviewable change rather than an untracked side
 * effect on one machine.
 *
 * KEYED ON CONTENT, NOT ON A NAME. The key is a hash of the exact text plus
 * the provider's voice fingerprint (`speech.ts`), so:
 *
 *   - editing a scripted line orphans its entry instead of playing the old
 *     audio for the new text — a cached line is always the line that was
 *     actually reviewed;
 *   - re-enrolling a character's voice orphans their entries instead of
 *     serving last month's actor;
 *   - an orphan is a MISS, which costs one paid call and then caches, so the
 *     failure mode of a stale manifest is a bill, never a silence.
 *
 * A MISSING FILE IS NORMAL. A deployment that has never run the script has no
 * manifest and simply pays the cache path instead. Loud enough to notice
 * (`/api/v1/tutor/status` reports the count), quiet enough not to be an
 * outage.
 */

export interface PregeneratedEntry {
  /** Absolute URL exactly as Depot reported it. Never constructed here. */
  url: string;
  /** Which scripted line this is, for a human reading the file. */
  key: string;
  character: string;
  locale: string;
  /** First few words, so a reviewer can see what they are approving. */
  preview: string;
  chars: number;
}

interface Manifest {
  generated?: string;
  /** The DEPOT_URL the URLs below were produced against. */
  depot?: string;
  lines?: Record<string, PregeneratedEntry>;
}

const MANIFEST_PATH = fileURLToPath(new URL('../../speech.pregenerated.json', import.meta.url));

let loaded: Manifest | null = null;
let warnedAboutDepot = false;

function manifest(): Manifest {
  if (loaded) return loaded;
  try {
    loaded = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  } catch {
    // Absent or unreadable is a supported state: every line falls through to
    // the cache and then to a paid call. Never an error, never a silence.
    loaded = {};
  }
  return loaded;
}

/**
 * The stored URL for this content key, or `null`.
 *
 * Warns ONCE if the manifest was produced against a different Depot than this
 * instance is configured with. Those URLs would still resolve — they are
 * absolute — but they would be another environment's files, which is exactly
 * the kind of thing that works in staging and embarrasses you in production.
 */
export function pregeneratedUrl(contentKey: string): string | null {
  const data = manifest();
  const entry = data.lines?.[contentKey];
  if (!entry) return null;

  const configured = getConfig().DEPOT_URL;
  if (!warnedAboutDepot && data.depot && configured && !entry.url.startsWith(data.depot)) {
    warnedAboutDepot = true;
    console.warn(
      `[oracle] speech manifest was generated against ${data.depot} but this instance uses ` +
        `${configured} — serving the manifest's URLs anyway; re-run speech:pregenerate here if that is wrong`,
    );
  }
  return entry.url;
}

/** How many lines this instance can speak for free. Reported on /status. */
export function pregeneratedCount(): number {
  return Object.keys(manifest().lines ?? {}).length;
}

export function pregeneratedGeneratedAt(): string | null {
  return manifest().generated ?? null;
}

/** Test seam, and used by the generator script after it rewrites the file. */
export function resetPregeneratedManifest(): void {
  loaded = null;
  warnedAboutDepot = false;
}
