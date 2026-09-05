/*
 * Releasing the boot veil (/DESIGN.md §Motion recipe 11).
 *
 * index.html arms the veil before the first paint and owns the release ITSELF
 * (`window.__lfBoot.release`), so the dissolve's duration is read from the
 * stylesheet that declares it instead of being hand-copied into this bundle —
 * the drift class §1.14 keeps naming. What lives here is the only part the
 * bundle is in a position to know: WHEN there is something worth looking at.
 *
 * Idempotent by construction. StrictMode double-invokes effects in
 * development, and the fail-open in index.html can fire at any time; a second
 * release must not restart a dissolve that is already running.
 */

declare global {
  interface Window {
    __lfBoot?: { release(): void };
  }
}

/**
 * How long the reveal will wait for webfonts before going anyway.
 *
 * It waits at all because Material Symbols is `font-display: block` — every
 * icon in the product is INVISIBLE until it resolves, so revealing first shows
 * a chrome full of holes that fills in afterwards. It waits only briefly
 * because the fonts are third-party (Inter, Sora from Google Fonts) and a
 * blocked or slow font request must never be able to hold the product behind a
 * veil: past this cap the app arrives and the text swaps in when it can.
 */
const FONT_WAIT_MS = 1200;

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve();
      return;
    }
    // Two frames: the first is scheduled before the commit paints, the second
    // runs after it. One frame reveals a still-empty page on slower devices.
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function fontsSettled(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.ready) return Promise.resolve();
  return Promise.race([
    fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
  ]);
}

/**
 * Dissolve the boot veil, once the app has actually painted a frame.
 *
 * A no-op unless index.html armed it, which is what keeps the no-JavaScript
 * path — and every crawler that runs none — looking at the prerendered shell
 * rather than at a pane that never lifts.
 */
export async function releaseBootVeil(): Promise<void> {
  if (!window.__lfBoot) return;
  await afterNextPaint();
  await fontsSettled();
  window.__lfBoot.release();
}
