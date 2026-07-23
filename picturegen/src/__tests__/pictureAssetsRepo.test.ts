import { afterEach, describe, expect, it, vi } from 'vitest';
import { findByHash, insertAsset, pictureAssetHash, type PictureAssetRow } from '../cache/pictureAssetsRepo.js';

const row: PictureAssetRow = {
  id: '11111111-1111-4111-8111-111111111111',
  prompt_hash: 'abc',
  model: 'qwen-image',
  prompt: 'a jar of coins',
  url: 'https://depot.example/files/lesson-images/abc.png',
  file_id: 'lesson-images/abc.png',
  bytes: 12345,
  created_at: '2026-07-23T00:00:00Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pictureAssetHash', () => {
  it('is deterministic and keyed on model + size + prompt', () => {
    const a = pictureAssetHash('qwen-image', '1024*1024', 'a jar of coins');
    const b = pictureAssetHash('qwen-image', '1024*1024', 'a jar of coins');
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex

    expect(pictureAssetHash('qwen-image', '1024*1024', 'a lemon')).not.toBe(a);
    expect(pictureAssetHash('qwen-image', '512*512', 'a jar of coins')).not.toBe(a);
    expect(pictureAssetHash('other-model', '1024*1024', 'a jar of coins')).not.toBe(a);
  });
});

describe('findByHash', () => {
  it('returns the stored row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [row])));
    expect(await findByHash('abc')).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));
    expect(await findByHash('missing')).toBeNull();
  });
});

describe('insertAsset', () => {
  it('returns the inserted representation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(201, [row])));
    const result = await insertAsset({
      prompt_hash: row.prompt_hash,
      model: row.model,
      prompt: row.prompt,
      url: row.url,
      file_id: row.file_id,
      bytes: row.bytes,
    });
    expect(result).toEqual(row);
  });

  it('re-selects the winning row when a concurrent duplicate was ignored', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, [])) // POST — duplicate ignored, empty representation
      .mockResolvedValueOnce(jsonResponse(200, [row])); // re-select via findByHash
    vi.stubGlobal('fetch', fetchImpl);

    const result = await insertAsset({
      prompt_hash: row.prompt_hash,
      model: row.model,
      prompt: row.prompt,
      url: row.url,
      file_id: row.file_id,
      bytes: row.bytes,
    });
    expect(result).toEqual(row);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
