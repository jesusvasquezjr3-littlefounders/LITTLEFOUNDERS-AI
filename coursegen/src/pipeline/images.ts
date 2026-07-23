// images stage — OPTIONAL per slot (COURSE_ENGINE.md §4). Fills `image_url`
// on visual segments (`picture_choice` options, `memory_flip` card sides) by
// asking Prism (picturegen/) for each illustration. Prism owns the whole
// image concern: the art-director judge (LF visual identity), the qwen-image
// generation, Depot storage, and the cache that guarantees an identical
// request never hits the paid API twice — Forge only embeds the returned
// public URL. Skips CLEANLY (never fails the run, never fails the SLOT) on
// ANY failure — `--no-images`, Prism not configured, Prism down, provider
// quota. Each is a per-OPTION skip (icon stays the fallback, never emojis —
// DESIGN.md / LESSON_ENGINE.md §5.2 #8); only NOT_CONFIGURED short-circuits
// the whole document (no Prism = no point trying the rest). A lesson must
// never be unpublishable just because an illustration failed.

import { requestPicture } from '../providers/picturegen.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

export interface IllustrateOptions {
  /** `--no-images` CLI flag. */
  skip?: boolean;
}

export interface IllustrateDeps {
  request?: typeof requestPicture;
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

interface MemoryFlipPair {
  a_md: string;
  a_image_url?: string;
  b_md: string;
  b_image_url?: string;
}

export async function illustrateSegments(
  document: LessonDocumentParsed,
  options: IllustrateOptions = {},
  deps: IllustrateDeps = {},
): Promise<IllustrateResult> {
  if (options.skip) return { document, generated: 0, skippedReason: 'flag' };

  const request = deps.request ?? requestPicture;

  const cloned = structuredClone(document) as LessonDocumentParsed;
  let generated = 0;

  // Returns the asset url, or undefined when this ONE illustration failed
  // (its icon stays the fallback — never fails the segment). Rethrows
  // ProviderNotConfiguredError so the caller can bail the whole document.
  async function tryIllustrate(
    label: string,
    context: string,
    purpose: 'lesson_option' | 'memory_card',
  ): Promise<string | undefined> {
    try {
      const picture = await request({ label, context, purpose });
      generated++;
      return picture.url;
    } catch (err) {
      if (err instanceof ProviderNotConfiguredError) throw err;
      // Any other failure (Prism down, upstream quota, timeout) is this ONE
      // illustration's problem, not the lesson's — icon stays the fallback.
      console.warn(`images: skipping illustration for "${label}" — ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  try {
    for (const segment of cloned.segments) {
      if (segment.type === 'picture_choice') {
        const payload = segment.payload as { options: PictureChoiceOption[] };
        for (const option of payload.options) {
          if (option.image_url) continue;
          const url = await tryIllustrate(option.label, segment.prompt_md, 'lesson_option');
          if (url) option.image_url = url;
        }
      } else if (segment.type === 'memory_flip') {
        const payload = segment.payload as { pairs: MemoryFlipPair[] };
        for (const pair of payload.pairs) {
          if (!pair.a_image_url) {
            const url = await tryIllustrate(pair.a_md, segment.prompt_md, 'memory_card');
            if (url) pair.a_image_url = url;
          }
          if (!pair.b_image_url) {
            const url = await tryIllustrate(pair.b_md, segment.prompt_md, 'memory_card');
            if (url) pair.b_image_url = url;
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      // Prism not configured — clean skip, return the UNMODIFIED original
      // document (icons stay the fallback); no point trying the rest.
      return { document, generated: 0, skippedReason: 'not-configured' };
    }
    throw err;
  }

  return { document: cloned, generated };
}
