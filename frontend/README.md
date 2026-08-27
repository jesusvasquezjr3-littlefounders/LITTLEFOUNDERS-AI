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

## How the internet sees this site

The app is client-rendered, so everything that does not run JavaScript — every
social unfurler, almost every AI crawler, most scrapers — used to receive the
same 1,080-byte empty shell for every URL. Metadata is therefore built into
real per-route HTML at build time, never attached by React.

- **`scripts/seo/site.mjs`** is the single source of truth: which pages exist,
  whether each may be indexed, and its title/description/H1 in all three
  locales. Change the public surface here and nowhere else.
- **`scripts/seo/build-seo.mjs`** runs automatically after `vite build`. It
  writes `dist/<route>/index.html` with a full `<head>` (Open Graph, Twitter
  card, canonical, JSON-LD) plus a static content shell, and emits
  `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and
  `site.webmanifest`.
- **`app-shell.html`** is what `vercel.json` rewrites unmatched URLs to, and it
  is `noindex`. That is the safe default: a route nobody deliberately
  positioned stays out of the index by construction.

Verify the surface without a build: `npm run seo:check` (repo root).

### Regenerating the social share cards

The cards in `public/og/` are built from the wordmark and the mentor busts by
`scripts/seo/og-card.html` — no stock photography, no generated imagery, and no
image-API spend. Edit `CARD_LINE` / `CARD_KICKER` in `site.mjs`, then:

```bash
npm run seo:cards --prefix frontend
```

It drives headless Chrome over the DevTools Protocol and writes all three
locales at 1200x630. Set `CHROME_PATH` if Chrome is somewhere unusual.

### The one step that cannot be done from code

Ownership of the site has to be proved once, by a human, in each console:
Google Search Console and Bing Webmaster Tools. Paste the token each gives you
into `SITE.verification` in `site.mjs` and redeploy — until then neither
console will show which queries surface the site or whether the sitemap was
read. Submit `https://littlefounders.ai/sitemap.xml` in both once verified.

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
