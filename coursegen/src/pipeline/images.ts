// images stage — OPTIONAL per slot (COURSE_ENGINE.md §4). Generates
// illustrations for visual-option segments missing `image_url` (today:
// `picture_choice`), uploads them to filebase, and patches the url back in.
// Skips CLEANLY (never fails the run, never fails the SLOT) on ANY
// provider-level failure — `--no-images`, no API key, quota/billing
// exhausted (429 with limit:0 is a real, non-transient case we hit live),
// network errors, timeouts. Each is a per-OPTION skip (icon stays the
// fallback, never emojis — DESIGN.md / LESSON_ENGINE.md §5.2 #8); only
// NOT_CONFIGURED short-circuits the whole document (no key = no point
// trying the rest). A lesson must never be unpublishable just because an
// illustration failed — that would make "images are optional" a lie.

import { getConfig } from '../env.js';
import { generateImage } from '../providers/gemini.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
import type { UsageLedger } from '../providers/usage.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

export interface FilebaseUploadResult {
  id: string;
  url: string;
}

interface FilebaseResponse {
  data: { id: string; url: string; bytes: number; mime: string; deduplicated: boolean } | null;
  error: { code: string; message: string } | null;
}

/**
 * POST {FILEBASE_URL}/api/v1/files — multipart field `file`, fields
 * `bucket`/`visibility`, header `x-internal-api-key`. Contract confirmed by
 * the filebase service owner (2026-07-12): response `{data:{id,url,bytes,
 * mime,deduplicated}}`, public GET at `{FILEBASE_URL}/files/<id>`.
 */
export async function uploadToFilebase(pngBuffer: Buffer, filename: string): Promise<FilebaseUploadResult> {
  const c = getConfig();
  if (!c.FILEBASE_URL || !c.FILEBASE_INTERNAL_KEY) {
    throw new Error('images: FILEBASE_URL/FILEBASE_INTERNAL_KEY not configured');
  }

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), filename);
  form.append('bucket', 'lesson-images');
  form.append('visibility', 'public');

  const res = await fetch(`${c.FILEBASE_URL}/api/v1/files`, {
    method: 'POST',
    headers: { 'x-internal-api-key': c.FILEBASE_INTERNAL_KEY },
    body: form,
  });
  const json = (await res.json().catch(() => null)) as FilebaseResponse | null;
  if (!res.ok || !json?.data) {
    throw new Error(`images: filebase upload failed — HTTP ${res.status} ${json?.error?.message ?? ''}`.trim());
  }
  return { id: json.data.id, url: json.data.url };
}

export interface IllustrateOptions {
  /** `--no-images` CLI flag. */
  skip?: boolean;
}

export interface IllustrateDeps {
  ledger?: UsageLedger;
  generate?: typeof generateImage;
  upload?: typeof uploadToFilebase;
}

export type SkippedReason = 'flag' | 'not-configured';

export interface IllustrateResult {
  document: LessonDocumentParsed;
  generated: number;
  skippedReason?: SkippedReason;
}

interface PictureChoiceOption {
  id: string;
  label: string;
  image_url?: string;
}

export async function illustrateSegments(
  document: LessonDocumentParsed,
  options: IllustrateOptions = {},
  deps: IllustrateDeps = {},
): Promise<IllustrateResult> {
  if (options.skip) return { document, generated: 0, skippedReason: 'flag' };

  const generate = deps.generate ?? generateImage;
  const upload = deps.upload ?? uploadToFilebase;

  const cloned = structuredClone(document) as LessonDocumentParsed;
  let generated = 0;

  for (const segment of cloned.segments) {
    if (segment.type !== 'picture_choice') continue;
    const payload = segment.payload as { options: PictureChoiceOption[] };
    for (const option of payload.options) {
      if (option.image_url) continue;
      try {
        const image = await generate({
          prompt: `${option.label} — context: ${segment.prompt_md}`,
          operation: 'image',
          ledger: deps.ledger,
        });
        const uploaded = await upload(image.pngBuffer, `${segment.id}-${option.id}.png`);
        option.image_url = uploaded.url;
        generated++;
      } catch (err) {
        if (err instanceof ProviderNotConfiguredError) {
          // No key at all — clean skip, return the UNMODIFIED original document
          // (icons stay the fallback); no point trying the remaining options.
          return { document, generated: 0, skippedReason: 'not-configured' };
        }
        // Any other provider failure (quota/billing, HTTP, network, timeout,
        // or an unexpected shape from the API) is this ONE option's problem,
        // not the lesson's — leave its icon as the fallback and keep going.
        console.warn(`images: skipping illustration for ${segment.id}/${option.id} — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { document: cloned, generated };
}
