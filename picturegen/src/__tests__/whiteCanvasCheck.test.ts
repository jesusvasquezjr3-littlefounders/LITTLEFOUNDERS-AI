import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { verifyWhiteCanvas } from '../verify/whiteCanvasCheck.js';

describe('verifyWhiteCanvas', () => {
  it('accepts a white edge-to-edge canvas and transparent canvas', async () => {
    const white = await sharp({ create: { width: 16, height: 16, channels: 4, background: 'white' } }).png().toBuffer();
    const transparent = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(verifyWhiteCanvas(white)).resolves.toBe('clean');
    await expect(verifyWhiteCanvas(transparent)).resolves.toBe('clean');
  });

  it('rejects a colored canvas and a white card inset on it', async () => {
    const gray = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#667085' } }).png().toBuffer();
    const inset = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#667085' } })
      .composite([{ input: await sharp({ create: { width: 8, height: 8, channels: 4, background: 'white' } }).png().toBuffer(), left: 4, top: 4 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(gray)).resolves.toBe('defect');
    await expect(verifyWhiteCanvas(inset)).resolves.toBe('defect');
  });

  it('fails open when bytes are not a decodable image', async () => {
    await expect(verifyWhiteCanvas(Buffer.from([1, 2, 3]))).resolves.toBe('unavailable');
  });
});
