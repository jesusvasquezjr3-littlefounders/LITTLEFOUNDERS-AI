import manifest from '../assets/manifest.json';

/**
 * System glyphs: the closed list, drawn in-house
 * to one standard — 24 px grid, 2 px live-area padding, 2 px stroke, round caps
 * and joins, currentColor, no fills. Everything that carries meaning or
 * identity is a class B asset in the manifest instead, never a glyph.
 *
 * ONE SOURCE. The drawings live only in `src/rebuild/assets/manifest.json`, as
 * class A rows; this module reads them and holds no path data of its own.
 * `GLYPH_NAMES` below mirrors the manifest exactly, and nothing draws a 24 px
 * icon elsewhere or imports an icon pack.
 */
export const GLYPH_NAMES = [
  'close', 'back', 'menu', 'chevron', 'check', 'cross', 'plus', 'minus', 'show', 'hide',
  'search', 'settings', 'info', 'warning', 'external', 'microphone', 'send', 'play', 'pause', 'refresh', 'sun', 'moon',
] as const;

export type GlyphName = typeof GLYPH_NAMES[number];

interface GlyphRow { class: string; type: string; names?: Record<string, readonly string[]> }

const rows = (manifest as readonly GlyphRow[]).filter((row) => row.class === 'A' && row.type === 'glyph');

const SYSTEM_GLYPHS: Readonly<Record<GlyphName, readonly string[]>> = Object.freeze(Object.fromEntries(
  rows.flatMap((row) => Object.entries(row.names ?? {})),
) as Record<GlyphName, readonly string[]>);

/** Always decorative: the adjacent word or the control's accessible name carries the meaning. */
export function Glyph({ name, className = 'lf-system-glyph' }: { name: GlyphName; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {SYSTEM_GLYPHS[name].map((d) => <path key={d} d={d} />)}
  </svg>;
}
