import manifest from '../assets/manifest.json';

/**
 * Class A system glyphs (Frontend Bible 07 §2): the closed list, drawn in-house
 * to one spec — 24 px grid, 2 px live-area padding, 2 px stroke, round caps
 * and joins, currentColor, no fills. Everything that carries meaning or
 * identity is a class B asset in the manifest instead, never a glyph.
 *
 * ONE SOURCE. The drawings live only in `src/rebuild/assets/manifest.json`, as
 * class A rows that all declare the same `source`; this module reads them and
 * holds no path data of its own. `scripts/check-rebuild-assets.mjs` (part of
 * `spec:check` and every build) enforces the budget, the single source, the
 * glyph spec, that `GLYPH_NAMES` below mirrors the manifest exactly, and that
 * no rebuilt file draws a 24 px icon or imports an icon pack.
 *
 * The product may hold at most 24 glyphs. `show` and `hide` are one glyph
 * family (07 §2), so the budget counts families (manifest rows), not names.
 */
export const GLYPH_NAMES = [
  'close', 'back', 'menu', 'chevron', 'check', 'cross', 'plus', 'minus', 'show', 'hide',
  'search', 'settings', 'info', 'warning', 'external', 'microphone', 'send', 'play', 'pause', 'refresh',
] as const;

export type GlyphName = typeof GLYPH_NAMES[number];

interface GlyphRow { class: string; type: string; names?: Record<string, readonly string[]> }

const rows = (manifest as readonly GlyphRow[]).filter((row) => row.class === 'A' && row.type === 'glyph');

export const SYSTEM_GLYPHS: Readonly<Record<GlyphName, readonly string[]>> = Object.freeze(Object.fromEntries(
  rows.flatMap((row) => Object.entries(row.names ?? {})),
) as Record<GlyphName, readonly string[]>);

/** One glyph family per budget slot (one manifest row); paired names share a slot. */
export const GLYPH_FAMILIES: readonly (readonly GlyphName[])[] = rows.map((row) => Object.keys(row.names ?? {}) as GlyphName[]);

export const GLYPH_BUDGET = 24;

/** Always decorative: the adjacent word or the control's accessible name carries the meaning (02 rule 6). */
export function Glyph({ name, className = 'lf-system-glyph' }: { name: GlyphName; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {SYSTEM_GLYPHS[name].map((d) => <path key={d} d={d} />)}
  </svg>;
}
