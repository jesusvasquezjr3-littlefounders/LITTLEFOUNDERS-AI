import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getCurrentLanguage } from "@/i18n";
import routeMeta from "@/seo/route-meta.json";

type RouteMetaEntry = { title: string; description: string; ogDescription: string };
const ROUTE_META = routeMeta as Record<string, Record<string, RouteMetaEntry>>;

/**
 * Keeps document.title/meta-description in sync on client-side SPA navigation.
 * The prerendered static shells (frontend/scripts/prerender-seo.mjs) already set
 * correct per-route meta for the initial HTML response — this covers the case
 * where a user navigates via <Link> without a full page reload.
 */
export function useDocumentMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = ROUTE_META[pathname]?.[getCurrentLanguage()];
    if (!meta) return; // protected/unlisted routes: leave whatever title is already set

    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
  }, [pathname]);
}
