import sharp from 'sharp';

/** Deterministic edge-of-canvas check for a single-object tile. */
export type WhiteCanvasVerdict = 'clean' | 'defect' | 'unavailable';

const MIN_WHITE_CHANNEL = 235;
const MAX_WHITE_SPREAD = 14;
const TRANSPARENT_ALPHA = 8;
/**
 * A NEAR-white border pixel (all channels in [210, 235)) is compression/AA
 * noise, not a canvas defect — a live tile ('Limonada') was rejected for ONE
 * border pixel at 231 of 665 sampled. Up to 1% of border samples may be
 * near-white; a GROSS pixel (any channel < 210 or spread > 40) is a real
 * intrusion — colored canvas, panel, or an object crossing the edge — and a
 * single one still rejects. Full inversions (665/665 dirty) and the gray/
 * cream card drifts (every sample near 180–220) stay far outside both limits.
 */
const NEAR_WHITE_CHANNEL = 210;
const NEAR_WHITE_MAX_SPREAD = 40;
const BORDER_NEAR_MISS_FRACTION = 0.01;

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
 * Inset-panel detection via the CORNER ARCS of a ring inset from the border.
 * Catches the inset-panel dodge: a dark card centered on the canvas with a
 * clean white margin passes a border-only check (reproduced live — a white
 * toy-car icon on a black inset panel with white edges).
 *
 * Why corners and not the whole ring: production tiles legitimately draw the
 * object at 60–80% of the frame, so a full ring at 12% inset runs THROUGH the
 * object's bulk and the first ring shipped rejected ~88% of good tiles (live
 * ledger, fe-prod-20260803). A centered object — even a large one — leaves
 * the ring's CORNER regions empty (a circle spanning 80% of the frame is
 * still 13% short of the ring corner on the diagonal), while an inset panel
 * covers all four ring corners by construction. Reject only when at least
 * three of the four corner arcs are majority-non-white: one dirty corner is
 * an object quirk, three is a panel.
 */
const RING_INSET = 0.12;
/** Fraction of each ring side, adjacent to the corner, sampled per arc. */
const CORNER_ARC_FRACTION = 0.2;
const CORNER_DIRTY_MAJORITY = 0.5;
const MIN_DIRTY_CORNERS = 3;

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
    let nearMisses = 0;
    for (const pixelIndex of coordinates) {
      const offset = pixelIndex * info.channels;
      if (isWhiteOrTransparent(data, offset)) continue;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const gross = Math.min(red, green, blue) < NEAR_WHITE_CHANNEL
        || Math.max(red, green, blue) - Math.min(red, green, blue) > NEAR_WHITE_MAX_SPREAD;
      if (gross) return 'defect';
      nearMisses += 1;
    }
    if (nearMisses / coordinates.size > BORDER_NEAR_MISS_FRACTION) return 'defect';
    // Ring corner arcs: a panel covers all four; a centered object none.
    const left = Math.round(info.width * RING_INSET);
    const right = info.width - 1 - left;
    const top = Math.round(info.height * RING_INSET);
    const bottom = info.height - 1 - top;
    const armX = Math.max(step, Math.round((right - left) * CORNER_ARC_FRACTION));
    const armY = Math.max(step, Math.round((bottom - top) * CORNER_ARC_FRACTION));
    const corners: Array<[number, number, 1 | -1, 1 | -1]> = [
      [left, top, 1, 1],
      [right, top, -1, 1],
      [left, bottom, 1, -1],
      [right, bottom, -1, -1],
    ];
    let dirtyCorners = 0;
    for (const [cx, cy, dx, dy] of corners) {
      let dirty = 0;
      let total = 0;
      for (let off = 0; off <= armX; off += step) {
        total += 1;
        if (!isWhiteOrTransparent(data, (cy * info.width + cx + dx * off) * info.channels)) dirty += 1;
      }
      for (let off = step; off <= armY; off += step) {
        total += 1;
        if (!isWhiteOrTransparent(data, ((cy + dy * off) * info.width + cx) * info.channels)) dirty += 1;
      }
      if (total > 0 && dirty / total > CORNER_DIRTY_MAJORITY) dirtyCorners += 1;
    }
    if (dirtyCorners >= MIN_DIRTY_CORNERS) return 'defect';
    return 'clean';
  } catch {
    return 'unavailable';
  }
}
