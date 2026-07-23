import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ImageError } from '../gen/errors.js';
import { fallbackPrompt, LF_VISUAL_IDENTITY } from '../judge/promptJudge.js';
import { pictureAssetHash } from '../cache/pictureAssetsRepo.js';
import type { PictureAssetRow } from '../cache/pictureAssetsRepo.js';

const KEY = 'test-internal-key-0123456789'; // matches test-setup.ts INTERNAL_API_KEY
const CRAFTED_PROMPT = 'A cheerful jar of coins on a sunny lemonade stand';

// Config defaults exercised by the service (env.ts): model qwen-image, size 1024*1024.
// Cache key hashes the REQUEST descriptor (purpose | label | context), never the
// judged prompt — the judge is nondeterministic, so a prompt-keyed cache never hits.
const HIT_HASH = pictureAssetHash('qwen-image', '1024*1024', 'v3 | generic | a jar of coins | ');
const MISS_HASH = pictureAssetHash('qwen-image', '1024*1024', 'v3 | lesson_option | a jar of coins | saving up');

const storedRow: PictureAssetRow = {
  id: '11111111-1111-4111-8111-111111111111',
  prompt_hash: HIT_HASH,
  model: 'qwen-image',
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
      data: { url: storedRow.url, file_id: storedRow.file_id, prompt: storedRow.prompt, model: 'qwen-image', cached: true },
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

describe('POST /api/v1/pictures — cache MISS', () => {
  it('runs the full judge → generate → upload → insert flow with the correct hash', async () => {
    const craftImagePrompt = vi.fn().mockResolvedValue({ prompt: CRAFTED_PROMPT, negative: 'text, watermark' });
    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), contentType: 'image/png' });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { craftImagePrompt, findByHash, generateImage, uploadFile, insertAsset } } });
    const res = await request(app)
      .post('/api/v1/pictures')
      .set('x-internal-api-key', KEY)
      .send({ label: 'a jar of coins', context: 'saving up', purpose: 'lesson_option' });

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(false);
    expect(res.body.data.url).toBe(uploadResult.url);
    expect(res.body.data.file_id).toBe(uploadResult.id);
    expect(res.body.error).toBeNull();

    expect(findByHash).toHaveBeenCalledWith(MISS_HASH);
    expect(generateImage).toHaveBeenCalledWith(
      { prompt: CRAFTED_PROMPT, negativePrompt: 'text, watermark' },
      expect.objectContaining({ model: 'qwen-image', size: '1024*1024' }),
    );
    // Upload targets the lesson-images bucket, filename keyed on the cache hash.
    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      `${MISS_HASH}.png`,
      'image/png',
      'lesson-images',
      'public',
      expect.any(Object),
    );
    expect(insertAsset).toHaveBeenCalledWith(expect.objectContaining({ prompt_hash: MISS_HASH, model: 'qwen-image', prompt: CRAFTED_PROMPT }));
  });

  it('still generates when the judge fails — using the deterministic fallback prompt', async () => {
    // Real judge, but its HTTP call fails → craftImagePrompt falls back deterministically.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const fbPrompt = fallbackPrompt({ label: 'a piggy bank', context: 'saving money', purpose: 'generic' }).prompt;
    const fbHash = pictureAssetHash('qwen-image', '1024*1024', 'v3 | generic | a piggy bank | saving money');

    const findByHash = vi.fn().mockResolvedValue(null);
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.from([7]), contentType: 'image/png' });
    const uploadFile = vi.fn().mockResolvedValue(uploadResult);
    const insertAsset = vi.fn().mockImplementation(async (r: PictureAssetRow) => ({ ...storedRow, ...r }));

    const app = createApp({ pictures: { generatePicture: { findByHash, generateImage, uploadFile, insertAsset } } });
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
