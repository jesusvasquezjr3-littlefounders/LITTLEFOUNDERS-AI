import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/*
 * Pulse tracker mounting — the §1.9 fence, enforced in ONE place.
 *
 * Plausible: cookieless, no PII, no persistent identifiers, raw IP/UA never
 * stored (verified against its data policy before adoption — WALKTHROUGH.md
 * 2026-07-20). Safe for every surface INCLUDING kid traffic, so it mounts
 * unconditionally when configured.
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
const PLAUSIBLE_DOMAIN: string | undefined = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
const UMAMI_SRC: string | undefined = import.meta.env.VITE_UMAMI_SRC;
const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;

const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq', '/legal'];

function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return MARKETING_PREFIXES.slice(1).some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
    if (PLAUSIBLE_SRC && PLAUSIBLE_DOMAIN) {
      mountScript('lf-plausible', PLAUSIBLE_SRC, { domain: PLAUSIBLE_DOMAIN });
    }
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
