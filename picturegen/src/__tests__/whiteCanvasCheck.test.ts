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

  it('rejects a grayscale-encoded gray canvas — grayscale must not bypass the check', async () => {
    const grayGrayscale = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#808080' } })
      .greyscale()
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(grayGrayscale)).resolves.toBe('defect');
  });

  it('accepts a grayscale-encoded white canvas', async () => {
    const whiteGrayscale = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } })
      .greyscale()
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(whiteGrayscale)).resolves.toBe('clean');
  });

  it('detects a violation confined to the bottom-right corner between sampling strides', async () => {
    // 258px → stride 2; width-1 = 257 is odd, so the corner pixel falls
    // between strides on BOTH the bottom row and the right column.
    const patch = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#d92d20' } }).png().toBuffer();
    const cornered = await sharp({ create: { width: 258, height: 258, channels: 4, background: 'white' } })
      .composite([{ input: patch, left: 257, top: 257 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(cornered)).resolves.toBe('defect');
  });

  it('rejects the inset-panel dodge: a dark card centered on a clean white margin', async () => {
    // Reproduced live: a white toy-car icon on a solid black panel whose white
    // margins passed the border-only check. The panel here covers the central
    // 76% (edges at 12% in), so the inset ring crosses it on all four sides.
    const panel = await sharp({ create: { width: 304, height: 304, channels: 4, background: '#111111' } }).png().toBuffer();
    const dodge = await sharp({ create: { width: 400, height: 400, channels: 4, background: 'white' } })
      .composite([{ input: panel, left: 48, top: 48 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(dodge)).resolves.toBe('defect');
  });

  it('accepts a large centered object that crosses the inset ring on one side', async () => {
    // A tall/wide object may legitimately reach past the ring on ONE side —
    // the check rejects only when the ring's CORNER arcs are dirty (a panel
    // covers all four corners; an object edge does not).
    const blob = await sharp({ create: { width: 120, height: 160, channels: 4, background: '#2f6fed' } }).png().toBuffer();
    const bigObject = await sharp({ create: { width: 400, height: 400, channels: 4, background: 'white' } })
      .composite([{ input: blob, left: 140, top: 190 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(bigObject)).resolves.toBe('clean');
  });

  it('accepts a large centered ROUND object that crosses the ring on all four sides', async () => {
    // The production false-positive class that made the first full-ring
    // version reject ~88% of good tiles (fe-prod-20260803 ledger): a good
    // tile whose object spans ~76% of the frame crosses a 12%-inset ring
    // through its BULK on every side — but its rounded shape never reaches
    // the ring's corner arcs, which is what the check now measures.
    const circle = Buffer.from(
      '<svg width="400" height="400"><circle cx="200" cy="200" r="152" fill="#e8590c"/></svg>',
    );
    const bigRound = await sharp({ create: { width: 400, height: 400, channels: 4, background: 'white' } })
      .composite([{ input: circle, left: 0, top: 0 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(bigRound)).resolves.toBe('clean');
  });

  it('tolerates a single NEAR-white border pixel (compression noise), not a gross one', async () => {
    // Live false positive: a good tile rejected for ONE border pixel at 231
    // of 665 sampled. Near-white (>=210, low spread) within 1% is noise …
    const nearWhite = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 231, g: 231, b: 228, alpha: 1 } } }).png().toBuffer();
    const noisy = await sharp({ create: { width: 400, height: 400, channels: 4, background: 'white' } })
      .composite([{ input: nearWhite, left: 201, top: 0 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(noisy)).resolves.toBe('clean');
    // … while a single GROSS pixel (an object or color crossing the edge)
    // still rejects.
    const gross = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 120, g: 180, b: 240, alpha: 1 } } }).png().toBuffer();
    const crossed = await sharp({ create: { width: 400, height: 400, channels: 4, background: 'white' } })
      .composite([{ input: gross, left: 201, top: 0 }])
      .png()
      .toBuffer();
    await expect(verifyWhiteCanvas(crossed)).resolves.toBe('defect');
  });

  it('fails open when bytes are not a decodable image', async () => {
    await expect(verifyWhiteCanvas(Buffer.from([1, 2, 3]))).resolves.toBe('unavailable');
  });
});
