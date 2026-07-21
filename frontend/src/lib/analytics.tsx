import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/*
 * Pulse tracker mounting — the §1.9 fence, enforced in ONE place.
 *
 * Plausible: cookieless, no PII, no persistent identifiers, raw IP/UA never
 * stored (verified against its data policy before adoption — WALKTHROUGH.md
 * 2026-07-20). Safe for every surface INCLUDING kid traffic, so it mounts
 * unconditionally when configured. Uses Plausible's new-format per-site
 * script (`/js/pa-<id>.js` + `plausible.init()`, v3.2.x): the site domain is
 * baked into the hashed file (no data-domain), and autoCapturePageviews is on
 * by default so SPA route changes track via its History hook — no manual
 * pageview calls. VITE_PLAUSIBLE_SRC is the per-site script URL from
 * Plausible's "Script installation" screen; it is public (embedded on every
 * page), not a secret. We reproduce the init stub PROGRAMMATICALLY (not an
 * inline <script>) so a strict CSP can't block it.
 *
 * Umami: behavioral capture (events; heatmaps/replay ship with its recorder).
 * NON-NEGOTIABLE (§1.9 + pulse/AGENTS.md #4): it must NEVER observe a
 * kid-role session. Policy (WALKTHROUGH.md decision log 2026-07-20):
 *   - guests → marketing pages only (never the auth trust surfaces),
 *   - signed-in parent/admin/superadmin → everywhere in the app,
 *   - kid role present, or any other role → never; eject if already mounted
 *     (script removal stops all future capture in the session).
 *
 * Both scripts self-track SPA navigations; env-unset (local dev) = no-op.
 */

const PLAUSIBLE_SRC: string | undefined = import.meta.env.VITE_PLAUSIBLE_SRC;
const UMAMI_SRC: string | undefined = import.meta.env.VITE_UMAMI_SRC;
const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;

interface Plausible {
  (...args: unknown[]): void;
  q?: unknown[][];
  o?: unknown;
  init?: (opts?: unknown) => void;
}
declare global {
  interface Window {
    plausible?: Plausible;
  }
}

const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq', '/legal'];

function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return MARKETING_PREFIXES.slice(1).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** New-format Plausible: async per-site script + a CSP-safe programmatic init stub. */
function mountPlausible(): void {
  if (!PLAUSIBLE_SRC || document.getElementById('lf-plausible')) return;
  const el = document.createElement('script');
  el.id = 'lf-plausible';
  el.async = true;
  el.src = PLAUSIBLE_SRC;
  document.head.appendChild(el);
  // Queue calls until the async script defines the real impl, then init().
  if (!window.plausible) {
    const q: unknown[][] = [];
    const stub = ((...args: unknown[]) => {
      q.push(args);
    }) as Plausible;
    stub.q = q;
    stub.init = (opts?: unknown) => {
      stub.o = opts ?? {};
    };
    window.plausible = stub;
  }
  window.plausible.init?.();
}

function mountScript(id: string, src: string, dataset: Record<string, string>): void {
  if (document.getElementById(id)) return;
  const el = document.createElement('script');
  el.id = id;
  el.defer = true;
  el.src = src;
  for (const [k, v] of Object.entries(dataset)) el.setAttribute(`data-${k}`, v);
  document.head.appendChild(el);
}

function ejectScript(id: string): void {
  document.getElementById(id)?.remove();
}

export function AnalyticsScripts() {
  const { session, roles, meLoaded } = useAuth();
  const { pathname } = useLocation();

  // Plausible — every surface, once.
  useEffect(() => {
    mountPlausible();
  }, []);

  // Umami — adult surfaces only; kid sessions eject unconditionally.
  useEffect(() => {
    if (!UMAMI_SRC || !UMAMI_WEBSITE_ID) return;

    const isGuest = session === null;
    const isKid = roles.includes('kid');
    const isAdultSurfaceUser = roles.some((r) => ['parent', 'admin', 'superadmin'].includes(r));

    const shouldMount =
      !isKid &&
      ((isGuest && isMarketingPath(pathname)) || (session != null && meLoaded && isAdultSurfaceUser));

    if (shouldMount) {
      mountScript('lf-umami', UMAMI_SRC, { 'website-id': UMAMI_WEBSITE_ID });
    } else if (isKid || (session != null && meLoaded && !isAdultSurfaceUser)) {
      ejectScript('lf-umami');
    }
  }, [session, roles, meLoaded, pathname]);

  return null;
}
