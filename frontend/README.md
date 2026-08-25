# frontend

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** The SPA — learn, tutor, tasks, profile.
**Port (dev):** 5173 · **Deploy:** Vercel

```bash
npm install
cp .env.example .env
npm run dev
npm test
npm run build   # type-check + production build
```

Stack: React 18 + Vite + TypeScript + Tailwind (darkMode class) + react-router 6 + i18next (en-US / es-MX / pt-BR).

## SPA routing on Vercel

This is a client-side-routed SPA (React Router) with **no server-rendered routes** — `vercel.json` rewrites every path to `/index.html` so a direct load or refresh on e.g. `/faq` or `/legal/terms` doesn't 404; React Router then resolves the path client-side. Any new top-level route needs no extra Vercel config — the catch-all already covers it.

## Icon font is self-hosted, not loaded from Google Fonts

`public/fonts/material-symbols-outlined.woff2` is a vendored copy of the variable Material Symbols Outlined font (opsz/wght/FILL/GRAD axes), declared via `@font-face` in `src/index.css`. It is **not** loaded from `fonts.googleapis.com`/`fonts.gstatic.com` — every icon in the product resolves through this one font, and a third-party request is exactly what iOS Safari content blockers (1Blocker, AdGuard, Wipr) and locked-down school/corporate networks are known to drop, which silently breaks every icon at once. Self-hosting removes that entire failure class. `.lf-icon`'s `font-feature-settings: 'liga'` (also in `src/index.css`) is the separate fix for the OTHER icon failure mode: ligature substitution not activating on non-Apple platforms even when the font itself loads fine (see the comments on both rules for the full story).

To refresh the font (a new Material Symbols release, a new glyph needed that an older vendored version doesn't have):

```bash
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,0&display=block" \
  | grep -o 'https://fonts.gstatic.com/[^)]*woff2'
# then curl that URL to public/fonts/material-symbols-outlined.woff2
```

Inter and Sora stay on Google Fonts: unlike the icon font they have a real fallback stack (`tailwind.config.js` → `system-ui, sans-serif`), so a blocked request degrades to a different-looking but fully readable and functional page, not a broken one.
