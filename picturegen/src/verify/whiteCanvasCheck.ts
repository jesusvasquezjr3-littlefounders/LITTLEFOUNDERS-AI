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
 * Ring of sample points INSET from the border, as a fraction of each
 * dimension. Catches the inset-panel dodge: a dark card centered on the
 * canvas with a clean white margin passes a border-only check (reproduced
 * live — a white toy-car icon on a black inset panel with white edges). The
 * ring sits at 12% in from each side: comfortably inside any panel margin the
 * model draws, comfortably outside the centered object (which the corpus
 * shows starts no earlier than ~20% in). Ring pixels use a TOLERANT budget —
 * an object corner clipping one ring point must not fail a good tile, so the
 * ring only rejects when a run of samples is non-white (a panel edge crosses
 * MANY ring points, an object corner crosses few).
 */
const RING_INSET = 0.12;
const RING_MAX_DIRTY_FRACTION = 0.25;

/**
 * Samples every eighth border pixel (at most) plus an inset ring, and rejects
 * a colored canvas, inset card/panel, frame, or broad shadow. Decode failure
 * remains unavailable so the checker is never a liveness dependency.
 */
export async function verifyWhiteCanvas(bytes: Buffer): Promise<WhiteCanvasVerdict> {
  try {
    // Force sRGB before ensureAlpha(): ensureAlpha preserves colourspace, so a
    // grayscale PNG decoded to 2 channels and the channel guard below waved a
    // solid-gray canvas — the exact defect class this checker exists for —
    // through as 'unavailable'.
    const { data, info } = await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width < 2 || info.height < 2 || info.channels < 4) return 'unavailable';
    const step = Math.max(1, Math.floor(Math.min(info.width, info.height) / 128));
    // The stride can skip the final column/row (leaving the bottom-right
    // corner unsampled), so both endpoints are pinned explicitly.
    const xs = new Set<number>([info.width - 1]);
    for (let x = 0; x < info.width; x += step) xs.add(x);
    const ys = new Set<number>([info.height - 1]);
    for (let y = 0; y < info.height; y += step) ys.add(y);
    const coordinates = new Set<number>();
    for (const x of xs) {
      coordinates.add(x);
      coordinates.add((info.height - 1) * info.width + x);
    }
    for (const y of ys) {
      coordinates.add(y * info.width);
      coordinates.add(y * info.width + info.width - 1);
    }
    for (const pixelIndex of coordinates) {
      if (!isWhiteOrTransparent(data, pixelIndex * info.channels)) return 'defect';
    }
    // Inset ring: reject only when a substantial RUN of the ring is non-white.
    const left = Math.round(info.width * RING_INSET);
    const right = info.width - 1 - left;
    const top = Math.round(info.height * RING_INSET);
    const bottom = info.height - 1 - top;
    const ring: number[] = [];
    for (let x = left; x <= right; x += step) {
      ring.push(top * info.width + x);
      ring.push(bottom * info.width + x);
    }
    for (let y = top; y <= bottom; y += step) {
      ring.push(y * info.width + left);
      ring.push(y * info.width + right);
    }
    let dirty = 0;
    for (const pixelIndex of ring) {
      if (!isWhiteOrTransparent(data, pixelIndex * info.channels)) dirty += 1;
    }
    if (ring.length > 0 && dirty / ring.length > RING_MAX_DIRTY_FRACTION) return 'defect';
    return 'clean';
  } catch {
    return 'unavailable';
  }
}
