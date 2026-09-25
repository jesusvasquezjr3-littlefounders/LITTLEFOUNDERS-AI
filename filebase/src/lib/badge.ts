import sharp from 'sharp';

/*
 * Templated (NOT AI-generated) compositor for the shareable-achievement-badge
 * loop. Deliberately separate from Prism/picturegen (/AGENTS.md §1.5): Prism
 * is the ONLY AI-image-generation service and this draws no art, calls no
 * model, spends nothing per badge — one deterministic SVG, rasterized once
 * and handed straight back to Core (OD-20: the image is never stored, so it
 * has no company-hosted URL anyone could open or a messaging app could
 * preview).
 *
 * Depot's own boundary (AGENTS.md "owns / does not own") still holds: this
 * function knows nothing about kids, courses or achievements as DOMAIN
 * concepts — it takes already-decided, already-validated display strings and
 * draws pixels. Core decides WHAT the badge says; Depot decides how it looks.
 */

export type BadgeKind = 'course_badge' | 'streak' | 'goal_reached';

export type BadgeLocale = 'en-US' | 'es-MX' | 'pt-BR';

/*
 * F.6 standing constraint (information minimization): the image carries the
 * achievement kind, a server-derived label and a FIRST NAME, nothing else —
 * no age or age band, no surname, no photo, no link. The type has no field
 * that could carry more, and the route's body schema is `.strict()` so an
 * extra field is refused rather than ignored.
 */
export interface BadgeParams {
  kind: BadgeKind;
  /** Server-derived display label (a course title or "7-day streak"), never raw client text. */
  label: string;
  /** First name ONLY — /AGENTS.md §1.9's "age band + first name" ceiling applies here too (0073). */
  firstName: string;
  /** Language of the image's own kicker line; the label arrives already localized from Core. */
  locale: BadgeLocale;
}

const KICKERS: Record<BadgeLocale, Record<BadgeKind, string>> = {
  'en-US': { streak: 'Streak!', goal_reached: 'Goal reached!', course_badge: 'Badge earned!' },
  'es-MX': { streak: '¡Racha!', goal_reached: '¡Meta alcanzada!', course_badge: '¡Logro desbloqueado!' },
  'pt-BR': { streak: 'Sequência!', goal_reached: 'Meta alcançada!', course_badge: 'Conquista desbloqueada!' },
};

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

/*
 * The image is now the whole artifact the parent sends (OD-20), so a long
 * first name or label must stay inside the 1080 px canvas instead of being
 * clipped: the name shrinks to fit one line, and the label wraps at word
 * boundaries onto at most four centred lines (Core caps it at 80 chars).
 */
const NAME_MAX_PX = 88;
const LABEL_LINE_CHARS = 30;

/** Font size that keeps `text` inside ~920 px at an average glyph width of 0.6 em. */
function fittedNameSize(text: string): number {
  const chars = Math.max(1, [...text].length);
  return Math.max(40, Math.min(NAME_MAX_PX, Math.floor(920 / (chars * 0.6))));
}

/** Greedy word wrap; a single over-long word is hard-split so nothing can overflow. */
export function wrapLabel(label: string, perLine = LABEL_LINE_CHARS, maxLines = 4): string[] {
  const words = label.trim().split(/\s+/).flatMap((word) => {
    const chars = [...word];
    const parts: string[] = [];
    for (let i = 0; i < chars.length; i += perLine) parts.push(chars.slice(i, i + perLine).join(''));
    return parts;
  });
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && [...`${last} ${word}`].length <= perLine) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${[...kept[maxLines - 1]!].slice(0, perLine - 1).join('')}…`;
  return kept;
}

function buildSvg(params: BadgeParams): string {
  const palette = PALETTES[params.kind];
  const name = xmlEscape(params.firstName);
  const nameSize = fittedNameSize(params.firstName);
  const labelLines = wrapLabel(params.label)
    .map((line, i) => `<tspan x="${WIDTH / 2}" dy="${i === 0 ? 0 : 64}">${xmlEscape(line)}</tspan>`)
    .join('');
  const kicker = xmlEscape(KICKERS[params.locale][params.kind]);
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
  <text x="${WIDTH / 2}" y="1080" font-family="Nunito, 'Segoe UI', sans-serif" font-size="${nameSize}" font-weight="800"
        fill="#ffffff" text-anchor="middle">${name}</text>
  <text x="${WIDTH / 2}" y="1180" font-family="Nunito, 'Segoe UI', sans-serif" font-size="52" font-weight="600"
        fill="${palette.accent}" text-anchor="middle">${labelLines}</text>
  <text x="${WIDTH / 2}" y="${HEIGHT - 100}" font-family="Nunito, 'Segoe UI', sans-serif" font-size="40" font-weight="700"
        fill="${palette.accent}" text-anchor="middle" opacity="0.75">LittleFounders</text>
</svg>`;
}

/** Renders a badge to a PNG buffer. Deterministic: identical params produce byte-identical output. */
export async function renderBadgePng(params: BadgeParams): Promise<Buffer> {
  const svg = buildSvg(params);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
