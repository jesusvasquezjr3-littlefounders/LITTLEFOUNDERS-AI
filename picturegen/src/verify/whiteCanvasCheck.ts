import sharp from 'sharp';

/** Deterministic edge-of-canvas check for a single-object tile. */
export type WhiteCanvasVerdict = 'clean' | 'defect' | 'unavailable';

const MIN_WHITE_CHANNEL = 235;
const MAX_WHITE_SPREAD = 14;
const TRANSPARENT_ALPHA = 8;

function isWhiteOrTransparent(pixel: Buffer, offset: number): boolean {
  const red = pixel[offset] ?? 0;
  const green = pixel[offset + 1] ?? 0;
  const blue = pixel[offset + 2] ?? 0;
  const alpha = pixel[offset + 3] ?? 255;
  if (alpha <= TRANSPARENT_ALPHA) return true;
  return red >= MIN_WHITE_CHANNEL && green >= MIN_WHITE_CHANNEL && blue >= MIN_WHITE_CHANNEL
    && Math.max(red, green, blue) - Math.min(red, green, blue) <= MAX_WHITE_SPREAD;
}

/**
 * Samples every eighth border pixel (at most) and rejects a colored canvas,
 * inset card, frame, or broad shadow. Decode failure remains unavailable so
 * the checker is never a liveness dependency.
 */
export async function verifyWhiteCanvas(bytes: Buffer): Promise<WhiteCanvasVerdict> {
  try {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width < 2 || info.height < 2 || info.channels < 4) return 'unavailable';
    const step = Math.max(1, Math.floor(Math.min(info.width, info.height) / 128));
    const coordinates = new Set<number>();
    for (let x = 0; x < info.width; x += step) {
      coordinates.add(x);
      coordinates.add((info.height - 1) * info.width + x);
    }
    for (let y = 0; y < info.height; y += step) {
      coordinates.add(y * info.width);
      coordinates.add(y * info.width + info.width - 1);
    }
    for (const pixelIndex of coordinates) {
      if (!isWhiteOrTransparent(data, pixelIndex * info.channels)) return 'defect';
    }
    return 'clean';
  } catch {
    return 'unavailable';
  }
}
