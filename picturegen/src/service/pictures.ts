import { craftImagePrompt, type PicturePurpose } from '../judge/promptJudge.js';
import { generateImage } from '../gen/qwenImageClient.js';
import { verifyPictorial } from '../verify/pictorialCheck.js';
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
}

/** Injectable seams for tests — defaults are the real judge/network/DB/upload calls. */
export interface GeneratePictureDeps {
  craftImagePrompt: typeof craftImagePrompt;
  generateImage: typeof generateImage;
  verifyPictorial: typeof verifyPictorial;
  findByHash: typeof findByHash;
  insertAsset: typeof insertAsset;
  uploadFile: typeof uploadFile;
}

const defaultDeps: GeneratePictureDeps = { craftImagePrompt, generateImage, verifyPictorial, findByHash, insertAsset, uploadFile };

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
 */
export const STYLE_VERSION = 'v4';

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

  // 1. Cache key over the REQUEST (model, size, label, context, purpose) —
  //    computed BEFORE the judge. The judge is an LLM: two identical requests
  //    produce two slightly different prompts, so hashing the judged prompt
  //    made every repeat a cache MISS (caught live on the first smoke test —
  //    the same request generated twice). Hashing the request is what makes
  //    "an identical request never hits a paid API twice" true, and a HIT now
  //    skips the judge call too.
  // STYLE_VERSION folds the global illustration style (identity brief + base
  // negative) into the cache key: bumping it invalidates every cached asset so
  // a style change regenerates the catalog instead of serving stale art.
  // v2 = enforced BASE_NEGATIVE (no text/logos — first live batch leaked a
  // fake brand wordmark).
  const hash = pictureAssetHash(
    config.IMAGE_MODEL,
    config.IMAGE_SIZE,
    `${STYLE_VERSION} | ${req.purpose ?? 'generic'} | ${req.label} | ${req.context ?? ''}`,
  );

  // 2. Cache-first: a hit returns the stored asset with ZERO paid API calls.
  const hit = await deps.findByHash(hash);
  if (hit) {
    return { url: hit.url, file_id: hit.file_id, prompt: hit.prompt, model: hit.model, cached: true };
  }

  // 3+4. MISS — judge → generate → VERIFY, in a loop. The verifier (a vision
  // model looking at the actual pixels) is what makes the no-text guarantee
  // mechanical: the first live v3 batch proved the positive prompt always
  // wins over negatives ("lemonade stand" grew a signboard with a fake
  // wordmark; quoted denominations got engraved onto coins). The judge runs
  // INSIDE the loop — it is nondeterministic, so each retry is a genuinely
  // new composition. Verifier outage ('unavailable') accepts the image
  // unverified: never block generation on the inspector.
  const maxTries = Math.max(1, config.PICTUREGEN_VERIFY_ATTEMPTS);
  let crafted!: Awaited<ReturnType<typeof craftImagePrompt>>;
  let image!: Awaited<ReturnType<typeof generateImage>>;
  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    crafted = await deps.craftImagePrompt(
      { label: req.label, context: req.context, purpose: req.purpose },
      { apiBase: config.JUDGE_API_BASE, apiKey: judgeApiKey(config), model: config.JUDGE_MODEL },
    );

    // Generate, then ALWAYS download + re-upload (the provider URL is temporary).
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

    if (config.PICTUREGEN_VERIFY_ATTEMPTS === 0) break; // verification disabled
    const verdict = await deps.verifyPictorial(image.bytes, image.contentType, {
      apiBase: config.JUDGE_API_BASE,
      apiKey: judgeApiKey(config),
      model: config.VERIFY_MODEL,
    });
    if (verdict !== 'defect') break; // clean, or verifier unavailable (accept unverified)
    if (attempt === maxTries) {
      // Every attempt rendered a defect (readable text or a person). Fail the
      // request WITHOUT caching — the caller falls back to its icon, and a
      // later retry regenerates fresh.
      throw new ImageError('IMAGE_VERIFICATION_FAILED', `image kept a defect (text/person) after ${maxTries} attempts`);
    }
  }

  const upload = await deps.uploadFile(image.bytes, `${hash}.${extFor(image.contentType)}`, image.contentType, 'lesson-images', 'public', {
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

  return { url: inserted.url, file_id: inserted.file_id, prompt: inserted.prompt, model: inserted.model, cached: false };
}
