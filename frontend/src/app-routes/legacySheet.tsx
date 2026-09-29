import { useLayoutEffect, useState, type ReactNode } from 'react';
import legacyCss from '@/index.css?inline';

/*
 * THE LEGACY GLOBAL SHEET LIVES ONLY WHILE A LEGACY SURFACE IS MOUNTED
 * (Frontend Bible 02 rule 23 and D13, 04 section 3, OD-24).
 *
 * `index.css` is the v1 Lesson Player's stylesheet: Tailwind's preflight, the
 * legacy tokens, a legacy `body` ground and legacy keyframes. A plain
 * `import '@/index.css'` (static or dynamic) makes Vite inject a <link>/<style>
 * that is never removed, so after one v1 lesson, or one staff v1 preview, the
 * sheet stayed active for the rest of the session and its element selectors
 * outranked the rebuilt zero-specificity resets on every rebuilt route.
 *
 * The sheet is therefore imported as a string and inserted as ONE
 * `<style data-legacy-island>` while at least one legacy surface is mounted
 * (reference-counted, so the island and a preview never fight), and removed
 * when the last one unmounts. Children render only once the sheet is in the
 * document, so the legacy player never paints or measures unstyled.
 */

export const LEGACY_SHEET_ATTRIBUTE = 'data-legacy-island';

let holders = 0;
let element: HTMLStyleElement | null = null;

/** Inserts the legacy sheet (once) and returns its release; the last release removes it. */
export function acquireLegacySheet(doc: Document = document): () => void {
  holders += 1;
  if (!element || !element.isConnected) {
    element = doc.createElement('style');
    element.setAttribute(LEGACY_SHEET_ATTRIBUTE, '');
    element.textContent = legacyCss;
    doc.head.appendChild(element);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0 && element) {
      element.remove();
      element = null;
    }
  };
}

/** Scopes the legacy sheet to the lifetime of its children (the v1 island, the staff v1 preview). */
export function LegacySheetScope({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const release = acquireLegacySheet();
    setReady(true);
    return release;
  }, []);
  return ready ? <>{children}</> : null;
}
