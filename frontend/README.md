# frontend

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** The SPA — learn, tutor, games, tasks, profile.
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
