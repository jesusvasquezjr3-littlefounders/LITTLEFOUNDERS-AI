import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import '@/i18n';
// The document ground only: the legacy global sheet (index.css) loads with the
// OD-24 lesson island, the staff lesson preview and the dev labs, never here.
import '@/rebuild/design/document.css';
import { captureLandingContext } from '@/lib/visitor';

// The dotlottie player's WebAssembly URL is set where the player mounts
// (components/ui/LottieIcon.tsx), not here: an import at the entry put the
// whole player (about 330 kB) in every route's entry chunk, though only the
// OD-24 lesson island plays a Lottie (S10L.2).

// Snapshot UTM + referrer BEFORE React mounts and the SPA can navigate —
// they exist only on the landing URL (/INSIGHTS.md §7). Transmits nothing.
captureLandingContext();

/*
 * A SAFETY NET FOR A BLANK PAGE RESTORED BY THE BACK/FORWARD CACHE.
 *
 * A blind production audit (2026-09-10) pressed the browser's Back button from
 * /tutor and landed on a completely empty document — `#root` had zero
 * children, `navigation.type` was "back_forward", and no error reached the
 * console. That is the signature of the browser restoring a bfcache snapshot
 * that was captured while React had nothing mounted, and it recovers only on a
 * manual re-navigation.
 *
 * This listener is deliberately the narrowest possible net, so it cannot
 * regress anything: it acts ONLY when `event.persisted` is true — a genuine
 * bfcache restore, never a normal load, so there is no reload loop — AND when
 * `#root` is actually empty. A healthy restored page keeps its DOM and is left
 * untouched; a normal navigation never enters this branch at all. If the audit
 * blank has a different root cause (a boot-veil race, a failed lazy chunk),
 * this does not fire and that cause still needs a live repro to pin down — the
 * net is honest about covering the bfcache case and only that.
 */
window.addEventListener('pageshow', (event) => {
  if (event.persisted && document.getElementById('root')?.childElementCount === 0) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
);
