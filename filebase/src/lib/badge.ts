import sharp from 'sharp';
import { BADGE_MARKS } from './badgeArt.js';
import { BADGE_DESIGN, type BadgeFace } from './badgeDesign.generated.js';

/*
 * Templated (NOT AI-generated) compositor for the shareable-achievement-badge
 * loop. Deliberately separate from Prism/picturegen (/AGENTS.md §1.5): Prism
 * is the ONLY AI-image-generation service and this draws no generated art,
 * calls no model, spends nothing per badge — one deterministic SVG, rasterized
 * once and handed straight back to Core (OD-20: the image is never stored, so
 * it has no company-hosted URL anyone could open or a messaging app could
 * preview).
 *
 * Depot's own boundary (AGENTS.md "owns / does not own") still holds: this
 * function knows nothing about kids, courses or achievements as DOMAIN
 * concepts — it takes already-decided, already-validated display strings and
 * draws pixels. Core decides WHAT the badge says (every word, localized);
 * Depot decides how it looks.
 */

export type BadgeKind = 'course_badge' | 'streak' | 'goal_reached';

export type BadgeLocale = 'en-US' | 'es-MX' | 'pt-BR';

/*
 * F.6 standing constraint (information minimization): the image carries the
 * achievement kind, a server-derived label and a FIRST NAME, nothing else —
 * no age or age band, no surname, no photo, no link (the kicker is Core's
 * fixed localized copy, not data about the child). The type has no field
 * that could carry more, and the route's body schema is `.strict()` so an
 * extra field is refused rather than ignored.
 */
export interface BadgeParams {
  kind: BadgeKind;
  /** Server-derived display label (a course title or "7-day streak"), never raw client text. */
  label: string;
  /** First name ONLY — /AGENTS.md §1.9's "age band + first name" ceiling applies here too (0073). */
  firstName: string;
  /** Language of the image; the label and the kicker arrive already localized from Core. */
  locale: BadgeLocale;
  /** The line above the name ("Badge earned"), localized by Core (backend/src/services/achievementImageCopy.ts); absent = no kicker line. */
  kicker?: string;
}

/*
 * THE HOUSE STYLE (gap-fix round 2; Frontend Bible 02 D1, D3, D4, rules 2, 3
 * and 16; 07 sections 1 and 3). Every colour is a generated Bible 02 token
 * (light mode), mirrored into badgeDesign.generated.ts and pinned to the
 * frontend sheet by test: a solid kind colour with its on-* text colour, the
 * kind's -soft tint behind the mark, no gradient and no opacity. The mark is
 * the registered class B asset (badgeArt.ts), never an emoji. Text is set in
 * the design system's own faces as outlines (Fredoka for the kicker, the name
 * and the wordmark; Nunito for the label), because librsvg cannot load a web
 * font and would fall back to a system face. Nothing is ever cut with an
 * ellipsis: the name shrinks to fit, the label wraps and shrinks step-wise.
 */
const TOKENS = BADGE_DESIGN.tokens;
function token(name: string): string {
  const value = TOKENS[name];
  if (!value) throw new Error(`Unknown design token: ${name}`);
  return value;
}

const THEMES: Record<BadgeKind, { ground: string; on: string; soft: string }> = {
  course_badge: { ground: token('primary'), on: token('on-primary'), soft: token('primary-soft') },
  streak: { ground: token('reward'), on: token('on-reward'), soft: token('reward-soft') },
  // A reached goal is a savings achievement: the Save pocket's mint.
  goal_reached: { ground: token('mint'), on: token('on-mint'), soft: token('mint-soft') },
};

const WIDTH = 1080;
const HEIGHT = 1920;
const CENTER = WIDTH / 2;
/** Text column: 80 px side margins. */
const MEASURE = 920;
const MARK_CENTER_Y = 720;
const MARK_DISC_R = 280;
const MARK_BOX = 300;
const KICKER_BASELINE = 1120;
const KICKER_SIZE = 56;
const NAME_BASELINE = 1250;
const NAME_MAX_PX = 104;
const NAME_MIN_PX = 48;
const LABEL_FIRST_BASELINE = 1350;
const LABEL_LAST_BASELINE_MAX = 1720;
/** Step-wise label sizes: the first that fits the label area wins; the last always renders, wrapped as needed. */
const LABEL_SIZES = [52, 46, 40, 34, 28] as const;
const LABEL_LINE_HEIGHT = 1.3;
const WORDMARK_BASELINE = HEIGHT - 100;
const WORDMARK_SIZE = 40;
/** The S-01 company name. */
const WORDMARK = 'LittleFounders';

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
 * 07 section 1: no emoji on the image. A parent-typed name or a goal title may
 * carry one; it is dropped (with its joiners, variation selectors, keycaps and
 * skin-tone modifiers) rather than drawn by a system emoji font.
 */
const PICTOGRAPHIC = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu;
export function withoutEmoji(text: string): string {
  return text.replace(PICTOGRAPHIC, '').replace(/\s+/g, ' ').trim();
}

const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Advance of one character in font units; a character outside the face is measured as the fallback draws it. */
function advance(face: BadgeFace, char: string): number {
  const glyph = face.glyphs[char];
  if (glyph) return glyph[0];
  return face.unitsPerEm * (WIDE.test(char) ? 1 : 0.6);
}

/** Width of `text` at `size` px. */
export function measure(face: BadgeFace, text: string, size: number): number {
  let units = 0;
  for (const char of text) units += advance(face, char);
  return (units * size) / face.unitsPerEm;
}

/**
 * Draws `text` centred on the canvas with its baseline at `baseline`. Every
 * character the face holds is its own outline; a character it does not hold
 * (a script outside the Latin subset) is drawn by the renderer's fallback at
 * the same position, so a name in any script still shows.
 */
function drawText(face: BadgeFace, text: string, size: number, baseline: number, fill: string, fallbackFamily: string): string {
  const scale = size / face.unitsPerEm;
  const left = CENTER - measure(face, text, size) / 2;
  let x = 0;
  const parts: string[] = [];
  for (const char of text) {
    const glyph = face.glyphs[char];
    if (glyph) {
      if (glyph[1]) parts.push(`<path transform="translate(${x} 0)" d="${glyph[1]}"/>`);
    } else if (char.trim()) {
      parts.push(`<text x="${x}" y="0" font-family="${fallbackFamily}" font-size="${face.unitsPerEm}">${xmlEscape(char)}</text>`);
    }
    x += advance(face, char);
  }
  return `<g fill="${fill}" transform="translate(${round(left)} ${round(baseline)}) scale(${round(scale, 5)})">${parts.join('')}</g>`;
}

/** Name size: the largest 4 px step down from NAME_MAX_PX that keeps it on one line inside the measure. */
export function fittedNameSize(name: string, face: BadgeFace = BADGE_DESIGN.faces.display): number {
  let size = NAME_MAX_PX;
  while (size > NAME_MIN_PX && measure(face, name, size) > MEASURE) size -= 4;
  return size;
}

/** Splits a word wider than the measure into pieces that fit, character by character (never an ellipsis). */
function splitWord(face: BadgeFace, word: string, size: number, width: number): string[] {
  if (measure(face, word, size) <= width) return [word];
  const pieces: string[] = [];
  let piece = '';
  for (const char of word) {
    if (piece && measure(face, piece + char, size) > width) {
      pieces.push(piece);
      piece = '';
    }
    piece += char;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** Greedy word wrap by measured width, as many lines as the label needs; every word is kept whole or split, never cut. */
export function wrapLabel(label: string, size: number = LABEL_SIZES[0], face: BadgeFace = BADGE_DESIGN.faces.body, width = MEASURE): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean).flatMap((word) => splitWord(face, word, size, width));
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(face, `${last} ${word}`, size) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** The label's size and lines: the largest step whose wrapped lines fit the label area. */
export function layoutLabel(label: string, face: BadgeFace = BADGE_DESIGN.faces.body): { size: number; lines: string[] } {
  for (const size of LABEL_SIZES) {
    const lines = wrapLabel(label, size, face);
    const lastBaseline = LABEL_FIRST_BASELINE + (lines.length - 1) * size * LABEL_LINE_HEIGHT;
    if (lastBaseline <= LABEL_LAST_BASELINE_MAX) return { size, lines };
  }
  const size = LABEL_SIZES[LABEL_SIZES.length - 1]!;
  return { size, lines: wrapLabel(label, size, face) };
}

function drawMark(kind: BadgeKind): string {
  const mark = BADGE_MARKS[kind];
  const scale = MARK_BOX / Math.max(mark.width, mark.height);
  const x = CENTER - (mark.width * scale) / 2;
  const y = MARK_CENTER_Y - (mark.height * scale) / 2;
  return `<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale, 5)})">${mark.body}</g>`;
}

/** The image as SVG markup (exported for the design-system gate test). */
export function buildSvg(params: BadgeParams): string {
  const theme = THEMES[params.kind];
  const display = BADGE_DESIGN.faces.display;
  const body = BADGE_DESIGN.faces.body;
  const name = withoutEmoji(params.firstName);
  const kicker = withoutEmoji(params.kicker ?? '');
  const label = layoutLabel(withoutEmoji(params.label));
  const lines = label.lines.map((line, i) =>
    drawText(body, line, label.size, LABEL_FIRST_BASELINE + i * label.size * LABEL_LINE_HEIGHT, theme.on, 'Nunito, sans-serif'),
  );

  return [
    `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" xml:lang="${params.locale}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.ground}"/>`,
    `<circle cx="${CENTER}" cy="${MARK_CENTER_Y}" r="${MARK_DISC_R}" fill="${theme.soft}"/>`,
    drawMark(params.kind),
    kicker ? drawText(display, kicker, KICKER_SIZE, KICKER_BASELINE, theme.on, 'Fredoka, sans-serif') : '',
    name ? drawText(display, name, fittedNameSize(name, display), NAME_BASELINE, theme.on, 'Fredoka, sans-serif') : '',
    ...lines,
    drawText(display, WORDMARK, WORDMARK_SIZE, WORDMARK_BASELINE, theme.on, 'Fredoka, sans-serif'),
    '</svg>',
  ].filter(Boolean).join('\n');
}

/** Renders a badge to a PNG buffer. Deterministic: identical params produce byte-identical output. */
export async function renderBadgePng(params: BadgeParams): Promise<Buffer> {
  const svg = buildSvg(params);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
