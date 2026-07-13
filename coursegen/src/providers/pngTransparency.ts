// Pure-JS PNG background removal — no native deps (pngjs only).
// Gemini is prompted for a FLAT LIGHT background; we sample the 4 corners,
// then flood-fill outward from them, punching alpha=0 into any pixel within
// `tolerance` color distance of the sampled background. This intentionally
// only clears the CONNECTED background region (a flood fill, not a global
// color-key) so a light-colored object touching the image interior is not
// hollowed out.

import { PNG } from 'pngjs';

export interface TransparencyOptions {
  /** Euclidean RGB distance under which a pixel counts as "background". Default 24 (out of ~441 max). */
  tolerance?: number;
}

export function makeBackgroundTransparent(pngBuffer: Buffer, opts: TransparencyOptions = {}): Buffer {
  const tolerance = opts.tolerance ?? 24;
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;

  if (width < 2 || height < 2) return pngBuffer;

  const idx = (x: number, y: number): number => (width * y + x) << 2;

  const corners: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const [x, y] of corners) {
    const i = idx(x, y);
    sumR += data[i] ?? 0;
    sumG += data[i + 1] ?? 0;
    sumB += data[i + 2] ?? 0;
  }
  const bgR = sumR / corners.length;
  const bgG = sumG / corners.length;
  const bgB = sumB / corners.length;

  const isBackground = (i: number): boolean => {
    const dr = (data[i] ?? 0) - bgR;
    const dg = (data[i + 1] ?? 0) - bgG;
    const db = (data[i + 2] ?? 0) - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const stack: [number, number][] = [...corners];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [x, y] = next;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) continue;
    visited[pixelIndex] = 1;

    const i = idx(x, y);
    if (!isBackground(i)) continue;

    data[i + 3] = 0; // alpha channel

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return PNG.sync.write(png);
}
