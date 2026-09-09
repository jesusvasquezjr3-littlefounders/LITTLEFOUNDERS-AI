import sharp from 'sharp';

/*
 * Templated (NOT AI-generated) compositor for the shareable-achievement-badge
 * loop. Deliberately separate from Prism/picturegen (/AGENTS.md §1.5): Prism
 * is the ONLY AI-image-generation service and this draws no art, calls no
 * model, spends nothing per badge — one deterministic SVG, rasterized once,
 * then content-addressed like every other Depot object (a re-request with
 * the same params reuses the same bytes for free, same as any other upload).
 *
 * Depot's own boundary (AGENTS.md "owns / does not own") still holds: this
 * function knows nothing about kids, courses or achievements as DOMAIN
 * concepts — it takes already-decided, already-validated display strings and
 * draws pixels. Core decides WHAT the badge says; Depot decides how it looks.
 */

export type BadgeKind = 'course_badge' | 'streak' | 'goal_reached';

export interface BadgeParams {
  kind: BadgeKind;
  /** Server-derived display label (a course title or "7-day streak"), never raw client text. */
  label: string;
  /** First name ONLY — /AGENTS.md §1.9's "age band + first name" ceiling applies here too (0073). */
  firstName: string;
  ageBand?: '6-8' | '9-11' | '12-14';
}

const WIDTH = 1080;
const HEIGHT = 1920;

// DESIGN.md tokens — brand indigo for course badges, warning/flame amber for
// streaks. Kept as the two literal palettes DESIGN.md already defines rather
// than inventing a third badge-specific palette.
const PALETTES: Record<BadgeKind, { from: string; to: string; accent: string }> = {
  course_badge: { from: '#4f46e5', to: '#4338ca', accent: '#eef2ff' },
  streak: { from: '#d97706', to: '#b45309', accent: '#fffbeb' },
  // The Family Hub wallet's own Save-jar green (StatCard tone="success",
  // /DESIGN.md), not a new hue — a goal is a savings achievement.
  goal_reached: { from: '#0e9f6e', to: '#0a7a55', accent: '#e3f8ef' },
};

/** XML-escapes text so a kid's name or a label can never break out of the SVG document. */
function xmlEscape(text: string): string {
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
        return '&apos;';
    }
  });
}

function buildSvg(params: BadgeParams): string {
  const palette = PALETTES[params.kind];
  const name = xmlEscape(params.firstName);
  const label = xmlEscape(params.label);
  const kicker = xmlEscape(
    params.kind === 'streak' ? '¡Racha!' : params.kind === 'goal_reached' ? '¡Meta alcanzada!' : '¡Logro desbloqueado!',
  );
  const emoji = params.kind === 'streak' ? '🔥' : params.kind === 'goal_reached' ? '🎯' : '⭐';

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.from}" />
      <stop offset="100%" stop-color="${palette.to}" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <circle cx="${WIDTH / 2}" cy="640" r="260" fill="${palette.accent}" opacity="0.16" />
  <circle cx="${WIDTH / 2}" cy="640" r="200" fill="${palette.accent}" opacity="0.9" />
  <text x="${WIDTH / 2}" y="660" font-family="Nunito, 'Segoe UI', sans-serif" font-size="120" font-weight="800"
        fill="${palette.to}" text-anchor="middle">${emoji}</text>
  <text x="${WIDTH / 2}" y="980" font-family="Nunito, 'Segoe UI', sans-serif" font-size="56" font-weight="700"
        fill="${palette.accent}" text-anchor="middle" opacity="0.85">${kicker}</text>
  <text x="${WIDTH / 2}" y="1080" font-family="Nunito, 'Segoe UI', sans-serif" font-size="88" font-weight="800"
        fill="#ffffff" text-anchor="middle">${name}</text>
  <text x="${WIDTH / 2}" y="1180" font-family="Nunito, 'Segoe UI', sans-serif" font-size="52" font-weight="600"
        fill="${palette.accent}" text-anchor="middle">${label}</text>
  <text x="${WIDTH / 2}" y="${HEIGHT - 100}" font-family="Nunito, 'Segoe UI', sans-serif" font-size="40" font-weight="700"
        fill="${palette.accent}" text-anchor="middle" opacity="0.75">LittleFounders</text>
</svg>`;
}

/** Renders a badge to a PNG buffer. Deterministic: identical params produce byte-identical output (content-address dedup upstream relies on this). */
export async function renderBadgePng(params: BadgeParams): Promise<Buffer> {
  const svg = buildSvg(params);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
