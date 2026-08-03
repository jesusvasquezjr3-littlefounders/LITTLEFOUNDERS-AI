import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { ImageError } from '../gen/errors.js';
import { fallbackPrompt, LF_VISUAL_IDENTITY, OBJECT_TILE_PURPOSES, PICTURE_PURPOSES } from '../judge/promptJudge.js';
import { pictureAssetHash } from '../cache/pictureAssetsRepo.js';
import type { PictureAssetRow } from '../cache/pictureAssetsRepo.js';
import { requestCacheDescriptor } from '../service/pictures.js';

const KEY = 'test-internal-key-0123456789'; // matches test-setup.ts INTERNAL_API_KEY
const CRAFTED_PROMPT = 'A cheerful jar of coins on a sunny lemonade stand';

// Config defaults exercised by the service (env.ts): model qwen-image-max, size 1328*1328.
// Cache key hashes the REQUEST descriptor, never the judged prompt — the judge
// is nondeterministic, so a prompt-keyed cache never hits. Object-tile purposes
// collapse to a label-only descriptor (deterministic prompt ignores purpose and
// context); every other purpose keeps (purpose | label | context).
const HIT_HASH = pictureAssetHash('qwen-image-max', '1328*1328', 'v7-qwen-image-max-flat-vector | generic | a jar of coins | ');
const MISS_HASH = pictureAssetHash('qwen-image-max', '1328*1328', 'v8-qwen-image-max-object-white-flat-vector | object_tile | a jar of coins');

const storedRow: PictureAssetRow = {
  id: '11111111-1111-4111-8111-111111111111',
  prompt_hash: HIT_HASH,
  model: 'qwen-image-max',
  prompt: CRAFTED_PROMPT,
  url: 'https://depot.example/files/lesson-images/abc.png',
  file_id: 'lesson-images/abc.png',
  bytes: 42,
  created_at: '2026-07-23T00:00:00Z',
};

const uploadResult = {
  id: 'lesson-images/fresh.png',
  url: 'https://depot.example/files/lesson-images/fresh.png',
  bytes: 99,
  mime: 'image/png',
  deduplicated: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('internal auth', () => {
  it('rejects requests with no x-internal-api-key', async () => {
    const res = await request(createApp()).post('/api/v1/pictures').send({ label: 'coins' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
  });

  it('rejects requests with the wrong key', async () => {
    const res = await request(createApp()).post('/api/v1/pictures').set('x-internal-api-key', 'wrong').send({ label: 'coins' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/v1/pictures — validation', () => {
  it('returns 400 VALIDATION_ERROR for an empty label', async () => {
    const res = await request(createApp()).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for an unknown purpose', async () => {
    const res = await request(createApp())
      .post('/api/v1/pictures')
      .set('x-internal-api-key', KEY)
      .send({ label: 'coins', purpose: 'banner' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/pictures — cache HIT', () => {
  it('returns the stored row and NEVER calls judge / generate / upload / insert', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT });
    const findByHash = vi.fn().mockResolvedValue(storedRow);
    const generateImage = vi.fn();
    const uploadFile = vi.fn();
    const insertAsset = vi.fn();

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, uploadFile, insertAsset } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'a jar of coins' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { url: storedRow.url, file_id: storedRow.file_id, prompt: storedRow.prompt, model: 'qwen-image-max', cached: true, generated_images: 0 },
      error: null,
    });
    // Cache-first invariant: a hit spends ZERO paid API calls — including the judge.
    expect(findByHash).toHaveBeenCalledWith(HIT_HASH);
    expect(craftImagePrompt).not.toHaveBeenCalled();
    expect(generateImage).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(insertAsset).not.toHaveBeenCalled();
  });
});

describe('requestCacheDescriptor — object-tile key collapsing', () => {
  it('collapses the four tile purposes and ignores context for the same label', () => {
    const descriptors = (['item_card', 'option_card', 'lesson_option', 'memory_card'] as const).map((purpose, i) =>
      requestCacheDescriptor({ label: 'Limones', context: `lesson ${i}`, purpose }),
    );
    expect(new Set(descriptors).size).toBe(1);
    expect(descriptors[0]).toBe('v8-qwen-image-max-object-white-flat-vector | object_tile | Limones');
  });

  it('normalizes label whitespace but distinguishes different labels', () => {
    expect(requestCacheDescriptor({ label: '  Limones ', purpose: 'item_card' }))
      .toBe(requestCacheDescriptor({ label: 'Limones', purpose: 'item_card' }));
    expect(requestCacheDescriptor({ label: 'Naranjas', purpose: 'item_card' }))
      .not.toBe(requestCacheDescriptor({ label: 'Limones', purpose: 'item_card' }));
  });

  it('keeps purpose and context in the key for non-tile purposes', () => {
    const sceneA = requestCacheDescriptor({ label: 'Limones', context: 'lesson A', purpose: 'scene' });
    const sceneB = requestCacheDescriptor({ label: 'Limones', context: 'lesson B', purpose: 'scene' });
    expect(sceneA).not.toBe(sceneB);
    expect(sceneA).toContain('scene');
    expect(sceneA).toContain('lesson A');
  });

  it('collapse membership matches the judge OBJECT_TILE_PURPOSES set for every purpose', () => {
    // The cache-key collapse and the deterministic-prompt selection share ONE
    // exported set (judge/promptJudge.ts) — this walks every purpose and pins
    // that the service's collapsing follows exactly that membership, so a new
    // purpose can never drift into the wrong cache regime unnoticed.
    for (const purpose of PICTURE_PURPOSES) {
      const descriptor = requestCacheDescriptor({ label: 'Limones', context: 'lesson A', purpose });
      if (OBJECT_TILE_PURPOSES.has(purpose)) {
        expect(descriptor).toBe('v8-qwen-image-max-object-white-flat-vector | object_tile | Limones');
      } else {
        expect(descriptor).toContain(`| ${purpose} |`);
        expect(descriptor).toContain('lesson A');
      }
    }
  });

  it('looks up ONE cache row for the same tile label across purposes and contexts', async () => {
    const findByHash = vi.fn().mockResolvedValue(storedRow);
    const app = createApp({ pictures: { generatePicture: { findByHash } } });

    await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'Limones', context: 'lesson A', purpose: 'item_card' });
    await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'Limones', context: 'lesson B', purpose: 'memory_card' });

    // Byte-identical paid requests share one key — never billed twice.
    expect(findByHash).toHaveBeenCalledTimes(2);
    expect(findByHash.mock.calls[0]?.[0]).toBe(findByHash.mock.calls[1]?.[0]);
  });
});

describe('POST /api/v1/pictures — cache MISS', () => {
  it('runs the full judge → generate → verify → TRANSCODE → upload → insert flow with the correct hash', async () => {
    // A structurally real PNG — the storage transcode (gen/transcode.ts) must
    // turn it into WebP before the Depot upload.
    const realPng = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 250, g: 200, b: 40 } } })
      .png()
      .toBuffer();
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text, watermark' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: realPng, contentType: 'image/png' });
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'clean', hasText: false, hasPerson: false, hasNonWhiteBackground: false });
    const verifyWhiteCanvas = vi.fn().mockResolvedValue('clean');
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial, verifyWhiteCanvas, uploadFile, insertAsset } } });
    const res = await request(app)
      .post('/api/v1/pictures')
      .set('x-internal-api-key', KEY)
      .send({ label: 'a jar of coins', context: 'saving up', purpose: 'lesson_option' });

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(false);
    expect(res.body.data.generated_images).toBe(1);
    expect(res.body.data.url).toBe(uploadResult.url);
    expect(res.body.data.file_id).toBe(uploadResult.id);
    expect(res.body.error).toBeNull();

    expect(findByHash).toHaveBeenCalledWith(MISS_HASH);
    expect(generateImage).toHaveBeenCalledWith(
      { prompt: CRAFTED_PROMPT, negativePrompt: 'text, watermark' },
      expect.objectContaining({ model: 'qwen-image-max', size: '1328*1328' }),
    );
    // The verifier saw the ORIGINAL PNG bytes (webp support never has to be proven).
    expect(verifyPictorial).toHaveBeenCalledWith(realPng, 'image/png', expect.any(Object));
    // Upload targets the lesson-images bucket, filename keyed on the cache
    // hash — and carries the TRANSCODED WebP, not the PNG.
    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      `${MISS_HASH}.webp`,
      'image/webp',
      'lesson-images',
      'public',
      expect.any(Object),
    );
    const uploadedBytes = uploadFile.mock.calls[0]?.[0] as Buffer;
    expect(uploadedBytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(insertAsset).toHaveBeenCalledWith(expect.objectContaining({ prompt_hash: MISS_HASH, model: 'qwen-image-max', prompt: CRAFTED_PROMPT }));
  });

  it('stores the ORIGINAL bytes when the transcode cannot decode them — a paid generation is never lost', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), contentType: 'image/png' });
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'clean', hasText: false, hasPerson: false, hasNonWhiteBackground: false });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial, uploadFile, insertAsset } } });
    const res = await request(app)
      .post('/api/v1/pictures')
      .set('x-internal-api-key', KEY)
      .send({ label: 'a jar of coins', context: 'saving up', purpose: 'lesson_option' });

    expect(res.status).toBe(200);
    expect(uploadFile).toHaveBeenCalledWith(
      Buffer.from([1, 2, 3]),
      `${MISS_HASH}.png`,
      'image/png',
      'lesson-images',
      'public',
      expect.any(Object),
    );
  });

  it('still generates when the judge fails — using the deterministic fallback prompt', async () => {
    // Real judge, but its HTTP call fails → craftImagePrompt falls back deterministically.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const fbPrompt = fallbackPrompt({ label: 'a piggy bank', context: 'saving money', purpose: 'generic' }).prompt;
    const fbHash = pictureAssetHash('qwen-image-max', '1328*1328', 'v7-qwen-image-max-flat-vector | generic | a piggy bank | saving money');

    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([7]), contentType: 'image/png' });
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'clean', hasText: false, hasPerson: false, hasNonWhiteBackground: false });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { findByHash, generateImage, verifyPictorial, uploadFile, insertAsset } } });
    const res = await request(app)
      .post('/api/v1/pictures')
      .set('x-internal-api-key', KEY)
      .send({ label: 'a piggy bank', context: 'saving money' });

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(false);
    expect(res.body.data.prompt).toBe(fbPrompt);
    expect(res.body.data.prompt).toContain(LF_VISUAL_IDENTITY.slice(0, 300));
    expect(findByHash).toHaveBeenCalledWith(fbHash);
    expect(generateImage).toHaveBeenCalled();
  });

  it('regenerates from a FRESH judge prompt when the verifier finds text, then succeeds', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([9]), contentType: 'image/png' });
    const verifyPictorial = vi.fn()
      .mockResolvedValueOnce({ verdict: 'defect', hasText: true, hasPerson: false, hasNonWhiteBackground: false })
      .mockResolvedValueOnce({ verdict: 'clean', hasText: false, hasPerson: false, hasNonWhiteBackground: false });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial, uploadFile, insertAsset } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'a jar of coins' });

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(false);
    // The judge re-runs each attempt (it is nondeterministic — a retry is a new composition).
    expect(craftImagePrompt).toHaveBeenCalledTimes(2);
    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(verifyPictorial).toHaveBeenCalledTimes(2);
    // Only the CLEAN image is uploaded and cached.
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(insertAsset).toHaveBeenCalledTimes(1);
    // Retry cost fix (2026-08-03): the first attempt carries no defect hint,
    // but the second re-sends the EXACT defect the first attempt's verifier
    // caught — so the retry's prompt can reinforce it instead of blindly
    // re-rolling the same instruction.
    expect(craftImagePrompt.mock.calls[0]![0]).toEqual(expect.objectContaining({ previousDefect: undefined }));
    expect(craftImagePrompt.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ previousDefect: { nonWhiteBackground: false, text: true, person: false } }),
    );
  });

  it('fails with IMAGE_VERIFICATION_FAILED and caches NOTHING when every attempt renders text', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([9]), contentType: 'image/png' });
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'defect', hasText: true, hasPerson: false, hasNonWhiteBackground: false });
    const uploadFile = vi.fn();
    const insertAsset = vi.fn();

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial, uploadFile, insertAsset } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'a jar of coins' });

    // 422, NOT 502: the provider answered and its answer failed the qwen-vl
    // check, which is deterministic for this prompt. coursegen's
    // withTransportRetry retries 5xx, so answering 502 here made Forge
    // re-request a terminal failure — up to 12 paid generations per target.
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ data: null, error: { code: 'IMAGE_VERIFICATION_FAILED', message: expect.any(String) } });
    expect(res.body.error.message).toContain('text');
    expect(res.headers['x-picturegen-generated-images']).toBe('3');
    // PICTUREGEN_VERIFY_ATTEMPTS default = 3 attempts, all verified, none stored.
    expect(generateImage).toHaveBeenCalledTimes(3);
    expect(verifyPictorial).toHaveBeenCalledTimes(3);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(insertAsset).not.toHaveBeenCalled();
  });

  it('accepts the image unverified when the verifier is unavailable (never-block)', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([9]), contentType: 'image/png' });
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'unavailable', hasText: null, hasPerson: null, hasNonWhiteBackground: null });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial, uploadFile, insertAsset } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'a jar of coins' });

    expect(res.status).toBe(200);
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(insertAsset).toHaveBeenCalledTimes(1);
  });

  it('counts a generated-but-undownloadable image in the billable header', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text' });
    const findByHash = vi.fn().mockResolvedValue(null);
    // Attempt 1 generates (billed) but renders a defect; attempt 2 is billed
    // at the provider yet its temporary result URL fails to download.
    const generateImage = vi.fn()
      .mockResolvedValueOnce({ bytes: Buffer.from([9]), contentType: 'image/png' })
      .mockRejectedValueOnce(new ImageError('IMAGE_DOWNLOAD_FAILED', 'Image download responded 500'));
    const verifyPictorial = vi.fn().mockResolvedValue({ verdict: 'defect', hasText: true, hasPerson: false, hasNonWhiteBackground: false });

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, verifyPictorial } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'a jar of coins' });

    expect(res.status).toBe(502); // download failure stays retryable
    expect(res.body.error.code).toBe('IMAGE_DOWNLOAD_FAILED');
    // DashScope bills at generation: BOTH attempts reach the ledger count.
    expect(res.headers['x-picturegen-generated-images']).toBe('2');
  });

  it('returns a 502 IMAGE_PROVIDER_ERROR envelope when the provider hard-fails', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockRejectedValue(new ImageError('IMAGE_PROVIDER_ERROR', 'DashScope responded 400'));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage } } });
    const res = await request(app).post('/api/v1/pictures').set('x-internal-api-key', KEY).send({ label: 'coins' });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ data: null, error: { code: 'IMAGE_PROVIDER_ERROR', message: expect.any(String) } });
  });
});
