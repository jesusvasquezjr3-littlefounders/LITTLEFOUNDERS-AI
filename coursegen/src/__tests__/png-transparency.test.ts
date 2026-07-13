import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { makeBackgroundTransparent } from '../providers/pngTransparency.js';

function solidPngWithCenterSquare(size: number, bg: [number, number, number], fg: [number, number, number]): Buffer {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const inCenter = x > size / 4 && x < (3 * size) / 4 && y > size / 4 && y < (3 * size) / 4;
      const [r, g, b] = inCenter ? fg : bg;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe('makeBackgroundTransparent', () => {
  it('zeroes alpha on the flood-filled background region', () => {
    const input = solidPngWithCenterSquare(20, [250, 250, 245], [10, 10, 10]);
    const output = makeBackgroundTransparent(input);
    const png = PNG.sync.read(output);

    const cornerIdx = 0; // (0,0)
    expect(png.data[cornerIdx + 3]).toBe(0);
  });

  it('leaves the foreground subject fully opaque', () => {
    const size = 20;
    const input = solidPngWithCenterSquare(size, [250, 250, 245], [10, 10, 10]);
    const output = makeBackgroundTransparent(input);
    const png = PNG.sync.read(output);

    const centerIdx = (size * Math.floor(size / 2) + Math.floor(size / 2)) << 2;
    expect(png.data[centerIdx + 3]).toBe(255);
  });

  it('does not clear pixels outside the tolerance from the sampled background', () => {
    // Background sampled from corners is [250,250,245]; a mid-brightness gray
    // ring is far enough (euclidean distance > default tolerance) to survive.
    const size = 20;
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) << 2;
        png.data[idx] = 250;
        png.data[idx + 1] = 250;
        png.data[idx + 2] = 245;
        png.data[idx + 3] = 255;
      }
    }
    // A single pixel far from the background color, NOT connected to the corners via background pixels
    // (surrounded by a ring of foreground so flood fill can't reach it) — still ends up opaque because
    // flood fill only clears CONNECTED background pixels, not a global color key.
    const midIdx = (size * 10 + 10) << 2;
    png.data[midIdx] = 5;
    png.data[midIdx + 1] = 5;
    png.data[midIdx + 2] = 5;
    const output = makeBackgroundTransparent(PNG.sync.write(png));
    const result = PNG.sync.read(output);
    expect(result.data[midIdx + 3]).toBe(255);
  });
});
