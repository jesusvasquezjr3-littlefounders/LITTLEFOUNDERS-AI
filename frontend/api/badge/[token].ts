/*
 * Vercel Edge Function — /badge/:token (rewritten from vercel.json, which
 * maps the PUBLIC path to /api/badge/:token, this file's route).
 *
 * RETIRING (OD-20, 24 September 2026). New achievement shares are images the
 * parent sends; no new link is issued. This function serves only legacy
 * links issued before the cutover, until they expire. From
 * BADGE_LINK_ROUTE_RETIRES_AT it answers 410 with the private headers and
 * never asks Core — the dated retirement of the public page. Deleting this
 * file, its vercel.json rewrite, the landing route and the SEO entry is the
 * runbook in docs/rebuild/policies/ACHIEVEMENT-SHARING.md.
 *
 * The ONLY job here is serving correct <head> Open Graph / Twitter tags to
 * an unfurler (WhatsApp, iMessage, Slack, X, …) that reads the raw HTML and
 * never runs JavaScript — build-seo.mjs's static prerender covers every
 * FIXED marketing page the same way, but a badge share is one row per
 * token (0073), so there is no static file to prerender it into. A real
 * human visitor gets the exact same HTML, the SPA boots normally from it
 * (this only edits <head>, nothing in <body>), and
 * src/routes/marketing/BadgeLandingPage.tsx renders the actual interactive
 * page and does its own consent-gated click tracking — this function
 * never calls trackInsight or touches cookies, on purpose (see that
 * component's file header).
 *
 * UNVERIFIED AGAINST A LIVE DEPLOY: local handler tests do not prove Vercel
 * routing or CDN behaviour. Verify with `vercel dev` or a
 * preview deploy, and set the `BACKEND_URL` env var in the Vercel project
 * (Core's public origin) before relying on this in production — it is a
 * deploy-config change, not something this session can make on your behalf.
 */

export const config = { runtime: 'edge' };

interface BadgePayload {
  firstName: string;
  achievementKind: 'course_badge' | 'streak' | 'goal_reached';
  achievementLabel: string;
  imageUrl: string;
}

/** Mirrors backend/src/services/badgeLinkWindow.ts; `npm run sharing:check` keeps them equal. */
export const BADGE_LINK_ROUTE_RETIRES_AT = '2026-10-24T00:00:00.000Z';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const PRIVATE_HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

async function fetchShell(origin: string): Promise<string> {
  const res = await fetch(new URL('/app-shell.html', origin));
  return res.text();
}

function withOgTags(shell: string, badge: BadgePayload): string {
  const title = esc(`${badge.firstName} — ${badge.achievementLabel} · LittleFounders`);
  const description = esc(
    `${badge.firstName} just earned ${badge.achievementLabel} on LittleFounders — where kids learn real money and business skills.`,
  );
  const image = esc(badge.imageUrl);
  const tags = [
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1080" />',
    '<meta property="og:image:height" content="1920" />',
    '<meta property="og:image:type" content="image/png" />',
    `<meta property="og:image:alt" content="${title}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');

  // noindex is UNCHANGED and deliberate (/AGENTS.md §1.15's "failing
  // direction, by construction"): a personal share link must never compete
  // with a real page in search results, but noindex and social-unfurling
  // OG tags are unrelated mechanisms — an unfurler ignores robots directives
  // entirely, so this stays out of the index while still rendering a rich
  // preview in a chat app.
  return shell.replace('<title>LittleFounders</title>', `<title>${title}</title>\n    ${tags}`);
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.pathname.split('/').pop() ?? '';
  const shellOrigin = url.origin;

  if (Date.now() >= Date.parse(BADGE_LINK_ROUTE_RETIRES_AT)) {
    const shell = await fetchShell(shellOrigin);
    return new Response(shell, { status: 410, headers: PRIVATE_HTML_HEADERS });
  }

  if (!TOKEN_RE.test(token)) {
    const shell = await fetchShell(shellOrigin);
    return new Response(shell, { status: 404, headers: PRIVATE_HTML_HEADERS });
  }

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
  const [shell, badgeRes] = await Promise.all([
    fetchShell(shellOrigin),
    fetch(`${backendUrl}/api/v1/badges/${token}`, { cache: 'no-store' }).catch(() => null),
  ]);

  if (!badgeRes || !badgeRes.ok) {
    return new Response(shell, { status: 404, headers: PRIVATE_HTML_HEADERS });
  }
  const body = (await badgeRes.json().catch(() => null)) as { data: BadgePayload | null } | null;
  if (!body?.data) {
    return new Response(shell, { status: 404, headers: PRIVATE_HTML_HEADERS });
  }

  return new Response(withOgTags(shell, body.data), {
    headers: PRIVATE_HTML_HEADERS,
  });
}
