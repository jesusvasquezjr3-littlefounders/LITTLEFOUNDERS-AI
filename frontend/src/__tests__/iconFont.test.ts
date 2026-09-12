import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * THE ICON FONT IS PINNED, AND NOTHING ELSE REMEMBERS THAT.
 *
 * Material Symbols Outlined ships as a variable font with three axes — FILL,
 * opsz and wght — and the whole family of every weight from 100 to 700 at
 * every optical size is 2.34 MB. This product varies exactly ONE of them:
 * `.lf-icon` fixes the weight at 400 and `.lf-icon-fill` toggles `FILL`
 * (index.css). Paying 1.9 MB on every first load for axes nothing uses, in
 * front of `font-display: block` which keeps every icon invisible until the
 * file lands, is the single largest avoidable byte in the product.
 *
 * So the vendored file is INSTANCED: wght and opsz pinned, FILL kept live.
 * 2,338,884 -> 457,056 bytes, 80.5% smaller, with all 6,597 glyphs and all
 * 4,386 cmap entries intact — nothing is subset away, which matters because
 * coursegen may emit ANY Material Symbols name (its contract is
 * `z.string().regex(/^[a-z0-9_]+$/)`) and a missing glyph would silently
 * degrade to the `help` fallback across the corpus.
 *
 * To re-vendor after a family upgrade, pin again before committing:
 *
 *   pip install fonttools brotli
 *   python -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; \
 *     f=TTFont('material-symbols-outlined.woff2'); \
 *     i=instancer.instantiateVariableFont(f,{'wght':400,'opsz':24},inplace=False); \
 *     i.flavor='woff2'; i.save('frontend/public/fonts/material-symbols-outlined.woff2')"
 *
 * This test is the thing that notices when someone does not. A size guard is
 * cruder than reading `fvar` back — Node has no woff2 decoder and adding a
 * font library to check one file would cost more than it saves — but the two
 * states are 457 KB and 2.34 MB, so it cannot miss the regression it exists
 * for.
 */

// Resolved from the vitest root (frontend/), not from import.meta.url —
// vitest's transform does not hand this module a file: URL.
const FONT = resolve('public/fonts/material-symbols-outlined.woff2');

/** Comfortably above the pinned 457 KB, far below the 2.34 MB full family. */
const CEILING_BYTES = 700_000;

describe('the vendored icon font', () => {
  it('is the pinned instance, not the full variable family', () => {
    // A missing file would otherwise pass as "not too big".
    expect(existsSync(FONT), `${FONT} does not exist`).toBe(true);
    const { size } = statSync(FONT);

    expect(
      size,
      `material-symbols-outlined.woff2 is ${(size / 1024).toFixed(0)} KB. The pinned instance is ~447 KB; ` +
        'the full variable family is 2.34 MB. If this font was just re-vendored from Google, pin wght and opsz ' +
        'again before committing — see the command in this file.',
    ).toBeLessThan(CEILING_BYTES);
  });
});
