import { craftImagePrompt, type PicturePurpose } from '../judge/promptJudge.js';
import { generateImage } from '../gen/qwenImageClient.js';
import { findByHash, insertAsset, pictureAssetHash } from '../cache/pictureAssetsRepo.js';
import { uploadFile } from '../filebase/client.js';
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
  findByHash: typeof findByHash;
  insertAsset: typeof insertAsset;
  uploadFile: typeof uploadFile;
}

const defaultDeps: GeneratePictureDeps = { craftImagePrompt, generateImage, findByHash, insertAsset, uploadFile };

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
  const hash = pictureAssetHash(
    config.IMAGE_MODEL,
    config.IMAGE_SIZE,
    `${req.purpose ?? 'generic'} | ${req.label} | ${req.context ?? ''}`,
  );

  // 2. Cache-first: a hit returns the stored asset with ZERO paid API calls.
  const hit = await deps.findByHash(hash);
  if (hit) {
    return { url: hit.url, file_id: hit.file_id, prompt: hit.prompt, model: hit.model, cached: true };
  }

  // 3. MISS — art-director judge crafts the prompt (never throws — falls back
  //    deterministically), then generate.
  const crafted = await deps.craftImagePrompt(
    { label: req.label, context: req.context, purpose: req.purpose },
    { apiBase: config.JUDGE_API_BASE, apiKey: judgeApiKey(config), model: config.JUDGE_MODEL },
  );

  // 4. Generate, then ALWAYS download + re-upload (the provider URL is temporary).
  const image = await deps.generateImage(
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
