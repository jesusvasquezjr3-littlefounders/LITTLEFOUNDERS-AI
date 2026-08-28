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

## Verifying the Lesson Engine the way a person uses it

```bash
npm run verify:lesson-engine                 # 1280x900, dark
npm run verify:lesson-engine -- --mobile     # 375x812
npm run verify:lesson-engine -- --light
npm run verify:lesson-engine -- --only quiz_mcq,fill_blank
```

Opens every segment-type fixture in `/dev/lesson-lab` and plays it with **real pointer
and keyboard events**, hit-testing every control with `elementFromPoint`. It starts Vite
itself and needs only Chrome (set `CHROME_PATH` if it is somewhere unusual, or
`LESSON_LAB_URL` to reuse a dev server that is already running).

It gates the class of defect that shipped on 2026-08-26 — a full-viewport canvas that
swallowed every click while 1,305 unit tests stayed green, because unit tests and
`element.click()` both reach past the thing a user has to get past. It reports, but does
not gate, how many segments reach a verdict: that number measures the driver, not the
engine. See [/LESSON_ENGINE.md](../LESSON_ENGINE.md) §10.1 and [/AGENTS.md](../AGENTS.md) §1.14.

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

### Search-console ownership lives in DNS — done, and easy to break

**Done 2026-08-27.** Google Search Console was verified with a Google-issued
**CNAME record in Vercel DNS**, and Bing Webmaster Tools was then imported from
Search Console rather than verified separately. `sitemap.xml` is submitted in
both, and indexing was requested for `/` and `/how-it-works`.

`SITE.verification` in `site.mjs` is therefore deliberately `null` and should
stay that way. DNS is the most durable proof available: it cannot be dropped by
a deploy, a build change or a refactor of the `<head>`, all of which can drop a
meta tag. A second method is a second thing to keep in sync and protects
against nothing DNS does not already cover.

**The cost of that choice, which is the part worth remembering:** ownership now
depends on a DNS record that nothing in this repo can see. Delete it, or lose
it in a DNS migration, and BOTH consoles un-verify — silently, with the first
symptom being that the data quietly stops arriving. It is listed in
`DEPLOYMENT.md` §1 beside the other records a domain move has to carry across.

Two things to expect in the coverage report, so they are not chased as bugs:
`/families` and `/faq` appear as **excluded by `noindex`** (deliberate — see
`site.mjs`), and new URLs sit in **"Discovered — currently not indexed"** for
weeks on a domain with no authority yet. Neither is fixable in code.

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
