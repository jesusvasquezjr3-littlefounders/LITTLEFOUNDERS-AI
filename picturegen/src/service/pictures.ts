import { craftImagePrompt, OBJECT_TILE_PURPOSES, type PicturePurpose } from '../judge/promptJudge.js';
import { generateImage } from '../gen/qwenImageClient.js';
import { transcodeToWebp } from '../gen/transcode.js';
import { verifyPictorial } from '../verify/pictorialCheck.js';
import { verifyWhiteCanvas } from '../verify/whiteCanvasCheck.js';
import { findByHash, insertAsset, pictureAssetHash } from '../cache/pictureAssetsRepo.js';
import { uploadFile } from '../filebase/client.js';
import { ImageError } from '../gen/errors.js';
import { getConfig, judgeApiKey } from '../env.js';

/*
 * Prism's one job (COURSE_ENGINE.md consumers call this): turn a label into a
 * stored, Depot-hosted illustration — CACHE-FIRST. The flow is:
 *
 *   judge → hash(model,size,prompt) → cache lookup
 *     HIT  → return the stored row, cached:true  (zero paid API calls)
 *     MISS → generate → download → upload to Depot → index in Vault → cached:false
 *
 * An identical request must never pay the image API twice — that is the
 * service's core value ("optimizar consumo, no llamar APIs a cada rato").
 */

export interface GeneratePictureRequest {
  label: string;
  context?: string;
  purpose: PicturePurpose;
}

export interface GeneratePictureResult {
  url: string;
  file_id: string;
  prompt: string;
  model: string;
  cached: boolean;
  /** Fresh Qwen images created for this request; 0 for a cache hit. */
  generated_images: number;
}

/** Injectable seams for tests — defaults are the real judge/network/DB/upload calls. */
export interface GeneratePictureDeps {
  craftImagePrompt: typeof craftImagePrompt;
  generateImage: typeof generateImage;
  transcodeToWebp: typeof transcodeToWebp;
  verifyPictorial: typeof verifyPictorial;
  verifyWhiteCanvas: typeof verifyWhiteCanvas;
  findByHash: typeof findByHash;
  insertAsset: typeof insertAsset;
  uploadFile: typeof uploadFile;
}

const defaultDeps: GeneratePictureDeps = {
  craftImagePrompt, generateImage, transcodeToWebp, verifyPictorial, verifyWhiteCanvas, findByHash, insertAsset, uploadFile,
};

/**
 * Bump on any change to the LOOK of generated art (identity brief, palette,
 * composition rules) — it invalidates the whole cached catalog, which is a
 * full paid regeneration. Failure-mode hardening (negatives/judge rules that
 * only exclude defects, plus the pictorial verifier) does NOT bump: cached
 * images that already conform stay valid, and only the offending rows are
 * deleted surgically (consumption invariant — never re-pay for good art).
 * v3 = code-enforced PICTORIAL_CLAUSE on every prompt.
 * v4 = NO-PEOPLE rule (objects/setting only; the app's non-human characters are
 * rendered separately) — invalidates every image that drew a human.
 * v5 = strict two-dimensional flat-vector identity; prior 3D/plastic-looking
 * scenes no longer represent the LittleFounders educational illustration look.
 * v7 = qwen-image-max provider switch; the model is part of the cache key,
 * while the style discriminator also prevents Forge inheritance from reusing
 * assets produced by the previous model.
 */
export const STYLE_VERSION = 'v7-qwen-image-max-flat-vector';
/** Object tiles also inherit the flat-vector identity while retaining white-canvas rules. */
export const OBJECT_TILE_STYLE_VERSION = 'v8-qwen-image-max-object-white-flat-vector';

/**
 * Object-tile membership is IMPORTED from the judge (OBJECT_TILE_PURPOSES in
 * judge/promptJudge.ts) — the same set that selects the deterministic
 * label-only tile prompt. The tile cache-key collapse below is only correct
 * while both decisions agree, so the set is deliberately one shared constant:
 * a locally-maintained copy that drifted would serve a cross-context wrong
 * image straight from cache.
 */
function isObjectTile(purpose: PicturePurpose): boolean {
  return OBJECT_TILE_PURPOSES.has(purpose);
}

function styleVersionFor(purpose: PicturePurpose): string {
  return isObjectTile(purpose) ? OBJECT_TILE_STYLE_VERSION : STYLE_VERSION;
}

/**
 * Canonical purpose token for the object-tile cache key. The four tile
 * purposes share ONE deterministic, label-only prompt (promptJudge skips the
 * art director and ignores context entirely), so "Limones" as an item_card in
 * lesson A and as a memory_card in lesson B is byte-for-byte the same paid
 * DashScope request. The key therefore collapses purpose to this token and
 * drops context — keying on either billed the identical request once per
 * (purpose, context) pair. Re-keying orphans any pre-existing tile cache rows
 * (acceptable: production has generated nothing yet).
 */
const OBJECT_TILE_CACHE_TOKEN = 'object_tile';

/** Tile prompts embed the label modulo surrounding whitespace; normalize so equivalent labels share one asset. */
function normalizeTileLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

/** Stable per-request cache descriptor — hashed together with (model, size) into the cache key. */
export function requestCacheDescriptor(req: GeneratePictureRequest): string {
  if (isObjectTile(req.purpose)) {
    return `${styleVersionFor(req.purpose)} | ${OBJECT_TILE_CACHE_TOKEN} | ${normalizeTileLabel(req.label)}`;
  }
  return `${styleVersionFor(req.purpose)} | ${req.purpose} | ${req.label} | ${req.context ?? ''}`;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFor(contentType: string): string {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return EXT_BY_MIME[base] ?? 'png';
}

export async function generatePicture(
  req: GeneratePictureRequest,
  overrides: Partial<GeneratePictureDeps> = {},
): Promise<GeneratePictureResult> {
  const deps = { ...defaultDeps, ...overrides };
  const config = getConfig();

  // 1. Cache key over the REQUEST — computed BEFORE the judge. The judge is
  //    an LLM: two identical requests produce two slightly different prompts,
  //    so hashing the judged prompt made every repeat a cache MISS (caught
  //    live on the first smoke test — the same request generated twice).
  //    Hashing the request is what makes "an identical request never hits a
  //    paid API twice" true, and a HIT now skips the judge call too. Object
  //    tiles hash only (style version, tile token, label): their prompt is
  //    deterministic and label-only, so purpose/context must not fragment the
  //    key (see requestCacheDescriptor).
  // STYLE_VERSION folds the global illustration style (identity brief + base
  // negative) into the cache key: bumping it invalidates every cached asset so
  // a style change regenerates the catalog instead of serving stale art.
  // v2 = enforced base negative list (no text/logos — first live batch leaked a
  // fake brand wordmark).
  const hash = pictureAssetHash(config.IMAGE_MODEL, config.IMAGE_SIZE, requestCacheDescriptor(req));

  // 2. Cache-first: a hit returns the stored asset with ZERO paid API calls.
  const hit = await deps.findByHash(hash);
  if (hit) return { url: hit.url, file_id: hit.file_id, prompt: hit.prompt, model: hit.model, cached: true, generated_images: 0 };

  // 3+4. MISS — judge → generate → VERIFY, in a loop. The verifier (a vision
  // model looking at the actual pixels) is what makes the no-text guarantee
  // mechanical: the first live v3 batch proved the positive prompt always
  // wins over negatives ("lemonade stand" grew a signboard with a fake
  // wordmark; quoted denominations got engraved onto coins). The judge runs
  // INSIDE the loop — it is nondeterministic, so each retry is a genuinely
  // new composition. Verifier outage ('unavailable') accepts the image
  // unverified: never block generation on the inspector.
  const maxTries = Math.max(1, config.PICTUREGEN_VERIFY_ATTEMPTS);
  let generatedImages = 0;
  let crafted!: Awaited<ReturnType<typeof craftImagePrompt>>;
  let image!: Awaited<ReturnType<typeof generateImage>>;
  try {
    for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    crafted = await deps.craftImagePrompt(
      { label: req.label, context: req.context, purpose: req.purpose },
      { apiBase: config.JUDGE_API_BASE, apiKey: judgeApiKey(config), model: config.JUDGE_MODEL },
    );

    // Generate, then ALWAYS download + re-upload (the provider URL is temporary).
      try {
        image = await deps.generateImage(
        { prompt: crafted.prompt, negativePrompt: crafted.negative },
        {
          apiBase: config.IMAGE_API_BASE,
          apiKey: config.IMAGE_API_KEY,
          model: config.IMAGE_MODEL,
          size: config.IMAGE_SIZE,
          timeoutMs: config.PICTUREGEN_TIMEOUT_MS,
          maxAttempts: config.PICTUREGEN_MAX_ATTEMPTS,
        },
        );
      } catch (err) {
        // DashScope bills when the image is GENERATED; downloading its
        // temporary result URL happens after. A generated-but-undownloadable
        // image is still a paid generation and must reach the billable count.
        if (err instanceof ImageError && err.code === 'IMAGE_DOWNLOAD_FAILED') generatedImages += 1;
        throw err;
      }
      generatedImages += 1;

      if (config.PICTUREGEN_VERIFY_ATTEMPTS === 0) break; // verification disabled
      const whiteCanvas = isObjectTile(req.purpose) ? await deps.verifyWhiteCanvas(image.bytes) : 'clean';
      const inspection = whiteCanvas === 'defect'
        ? { verdict: 'defect' as const, hasText: false, hasPerson: false }
        : await deps.verifyPictorial(image.bytes, image.contentType, {
          apiBase: config.JUDGE_API_BASE,
          apiKey: judgeApiKey(config),
          model: config.VERIFY_MODEL,
        });
      if (inspection.verdict !== 'defect') break; // clean, or verifier unavailable (accept unverified)
      if (attempt === maxTries) {
      // Every attempt rendered a defect (readable text or a person). Fail the
      // request WITHOUT caching — the caller falls back to its icon, and a
      // later retry regenerates fresh.
        const flags = [
          inspection.hasText === true ? 'text' : null,
          inspection.hasPerson === true ? 'person' : null,
          whiteCanvas === 'defect' ? 'non-white background' : null,
        ].filter((flag): flag is string => flag !== null);
        throw new ImageError(
          'IMAGE_VERIFICATION_FAILED',
          `image kept a defect (${flags.join('+') || 'unknown'}) after ${maxTries} attempts`,
          generatedImages,
        );
      }
    }

  // 4b. Storage transcode (PNG → WebP q~82, −96.9% measured) — AFTER the
  // verifier saw the original pixels, BEFORE the bytes become the stored
  // content address. Falls back to the original bytes on encode failure:
  // the generation is already paid for.
    const stored = await deps.transcodeToWebp(image.bytes, image.contentType, config.IMAGE_WEBP_QUALITY);

    const upload = await deps.uploadFile(stored.bytes, `${hash}.${extFor(stored.contentType)}`, stored.contentType, 'lesson-images', 'public', {
    filebaseUrl: config.FILEBASE_URL,
    internalKey: config.FILEBASE_INTERNAL_KEY,
    });

  // 5. Index in Vault (on-conflict re-select makes concurrent duplicates safe).
    const inserted = await deps.insertAsset({
    prompt_hash: hash,
    model: config.IMAGE_MODEL,
    prompt: crafted.prompt,
    url: upload.url,
    file_id: upload.id,
    bytes: upload.bytes,
    });

    return { url: inserted.url, file_id: inserted.file_id, prompt: inserted.prompt, model: inserted.model, cached: false, generated_images: generatedImages };
  } catch (err) {
    if (err instanceof ImageError) {
      if (err.generatedImages >= generatedImages) throw err;
      throw new ImageError(err.code, err.message, generatedImages);
    }
    throw new ImageError('IMAGE_GENERATION_FAILED', err instanceof Error ? err.message : 'Image generation failed', generatedImages);
  }
}
