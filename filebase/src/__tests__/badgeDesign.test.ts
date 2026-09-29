import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSvg, withoutEmoji, type BadgeKind, type BadgeLocale, type BadgeParams } from '../lib/badge.js';
import { BADGE_MARKS } from '../lib/badgeArt.js';
import { BADGE_DESIGN } from '../lib/badgeDesign.generated.js';

/*
 * The design-system gate for the OD-20 achievement image (gap-fix round 2;
 * Frontend Bible 02 D1, D3, D4, rules 2, 3 and 16; 07 sections 1 and 3).
 * The image is the whole artifact a verified parent sends out, so it is held
 * to the same rules as a rebuilt screen: token colours only (mirrored from
 * the generated sheet and pinned to it here), no gradient, no opacity tint,
 * no emoji, no ellipsis, no system-font text for anything the house faces can
 * draw, and marks equal to the registered class B assets.
 */
const REPO = resolve(import.meta.dirname, '../../..');
const tokenSheet = readFileSync(resolve(REPO, 'frontend/src/rebuild/design/tokens.css'), 'utf8');
const lightBlock = tokenSheet.split('}')[0]!;
const sheetTokens = Object.fromEntries([...lightBlock.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
const tokenHex = new Set(Object.values(sheetTokens));

const KINDS: BadgeKind[] = ['course_badge', 'streak', 'goal_reached'];
const LOCALES: BadgeLocale[] = ['en-US', 'es-MX', 'pt-BR'];
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️/u;

function samples(): BadgeParams[] {
  return KINDS.flatMap((kind) => LOCALES.map((locale) => ({
    kind,
    locale,
    firstName: 'Sofía',
    kicker: 'Insígnia conquistada',
    label: 'Ahorró 50 monedas para "Una bicicleta nueva para las vacaciones de verano"',
  })));
}

describe('the achievement image uses the design system (02, 07)', () => {
  it('mirrors the generated light-mode colour tokens exactly', () => {
    expect(Object.keys(sheetTokens).length).toBeGreaterThan(40);
    expect(BADGE_DESIGN.tokens).toEqual(sheetTokens);
  });

  it('names only token colours, and no gradient, opacity, filter or image (02 rules 2, 3; 07 section 3)', () => {
    for (const params of samples()) {
      const svg = buildSvg(params);
      const colours = [...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
      expect(colours.length).toBeGreaterThan(3);
      expect(colours.filter((colour) => !tokenHex.has(colour)), params.kind).toEqual([]);
      expect(svg).not.toMatch(/Gradient|opacity|<filter|<image|rgba?\(|hsla?\(|url\(/i);
    }
  });

  it('carries no emoji and no ellipsis (07 section 1; 02 D1)', () => {
    for (const params of samples()) {
      const svg = buildSvg(params);
      expect(EMOJI.test(svg), params.kind).toBe(false);
      expect(svg).not.toContain('…');
    }
    const svg = buildSvg({ kind: 'streak', locale: 'en-US', firstName: 'Sofía🔥', kicker: 'Learning streak', label: '⭐ 7-day streak 🎯' });
    expect(EMOJI.test(svg)).toBe(false);
    expect(withoutEmoji('Ana 👩🏽‍🚀 🇲🇽')).toBe('Ana');
  });

  it('draws every Latin string in the house faces as outlines, never as system-font text (02 D3)', () => {
    for (const params of samples()) expect(buildSvg(params)).not.toMatch(/<text\b/);
    // A script outside the Latin subset still shows, through the renderer's fallback.
    expect(buildSvg({ kind: 'streak', locale: 'en-US', firstName: '美玲', kicker: 'Learning streak', label: '7-day streak' })).toMatch(/<text [^>]*>美<\/text>/);
  });

  it('holds both faces with the full Latin set the three locales need', () => {
    const needed = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 áéíóúñüçãõâêôàÁÉÍÓÚÑÜÇÃÕ"-.,:'];
    for (const face of Object.values(BADGE_DESIGN.faces)) expect(needed.filter((char) => !face.glyphs[char])).toEqual([]);
  });

  it('draws each kind with its own registered mark, on its kind colour, with the on-colour text', () => {
    const expected: Record<BadgeKind, [string, string]> = {
      course_badge: [sheetTokens.primary!, sheetTokens['on-primary']!],
      streak: [sheetTokens.reward!, sheetTokens['on-reward']!],
      goal_reached: [sheetTokens.mint!, sheetTokens['on-mint']!],
    };
    for (const kind of KINDS) {
      const svg = buildSvg({ kind, locale: 'en-US', firstName: 'Ana', kicker: 'Badge earned', label: 'Money basics' });
      expect(svg).toContain(BADGE_MARKS[kind].body);
      expect(svg).toContain(`<rect width="1080" height="1920" fill="${expected[kind][0]}"/>`);
      expect(svg).toContain(`<g fill="${expected[kind][1]}"`);
    }
  });

  it('keeps each inlined mark equal to the SVG registered in the frontend manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(REPO, 'frontend/src/rebuild/assets/manifest.json'), 'utf8')) as { id: string; path: string; reviewFamily: string }[];
    for (const mark of Object.values(BADGE_MARKS)) {
      const row = manifest.find((asset) => asset.id === mark.assetId);
      expect(row?.reviewFamily, mark.assetId).toBe('achievement-share');
      const svg = readFileSync(resolve(REPO, 'frontend/public', `.${row!.path}`), 'utf8');
      const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
      expect(inner).toBe(mark.body);
      expect(svg).toContain(`viewBox="0 0 ${mark.width} ${mark.height}"`);
    }
  });
});
