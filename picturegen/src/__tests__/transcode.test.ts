import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { transcodeToWebp } from '../gen/transcode.js';

/*
 * The storage transcode must (a) actually shrink real PNGs into WebP, and
 * (b) NEVER lose a paid generation: garbage bytes fall back to the original
 * untouched. (b) is also what keeps route tests with fake Buffer bytes valid.
 */

async function realPng(): Promise<Buffer> {
  // 64×64 flat-color PNG — structurally real, so sharp accepts it.
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 250, g: 200, b: 40 } } })
    .png()
    .toBuffer();
}

describe('transcodeToWebp', () => {
  it('re-encodes a real PNG as WebP and reports the new content type', async () => {
    const png = await realPng();
    const out = await transcodeToWebp(png, 'image/png', 82);
    expect(out.contentType).toBe('image/webp');
    // RIFF....WEBP container magic
    expect(out.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(out.bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(out.bytes.length).toBeLessThan(png.length);
  });

  it('passes WebP input through untouched (no double encode)', async () => {
    const webp = await sharp(await realPng()).webp({ quality: 82 }).toBuffer();
    const out = await transcodeToWebp(webp, 'image/webp', 82);
    expect(out.bytes).toBe(webp);
    expect(out.contentType).toBe('image/webp');
  });

  it('falls back to the ORIGINAL bytes when the input is not a decodable image', async () => {
    const garbage = Buffer.from([1, 2, 3, 4]);
    const out = await transcodeToWebp(garbage, 'image/png', 82);
    expect(out.bytes).toBe(garbage);
    expect(out.contentType).toBe('image/png');
  });

  it('honors the mime parameters suffix when detecting already-webp input', async () => {
    const webp = await sharp(await realPng()).webp().toBuffer();
    const out = await transcodeToWebp(webp, 'image/webp; charset=binary', 82);
    expect(out.bytes).toBe(webp);
  });
});
