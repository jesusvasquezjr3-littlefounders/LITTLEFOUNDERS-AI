/**
 * Class A system glyphs (Frontend Bible 07 §2): the closed list, drawn in-house
 * to one spec — 24 px grid, 2 px stroke, round caps and joins, currentColor,
 * no fills. Everything that carries meaning or identity is a class B asset in
 * the manifest instead, never a glyph from here.
 *
 * The product may hold at most 24 glyphs. `show` and `hide` are one glyph
 * family (07 §2), so the budget counts families, not names.
 */
export const SYSTEM_GLYPHS = {
  close: ['M6 6l12 12M18 6L6 18'],
  back: ['M19 12H5M11 6l-6 6 6 6'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  chevron: ['M9 6l6 6-6 6'],
  check: ['M5 12l4 4L19 6'],
  cross: ['M6 6l12 12M18 6L6 18'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  show: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z'],
  hide: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z', 'M4 4l16 16'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z', 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 11v6M12 7.5v.01'],
  warning: ['M12 3.5L2.5 20h19L12 3.5z', 'M12 10v4M12 17v.01'],
  external: ['M14 4h6v6M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  microphone: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0M12 18v3'],
  send: ['M4 12l16-8-6 16-2-7-8-1z'],
  play: ['M8 5v14l11-7-11-7z'],
  pause: ['M8 5v14M16 5v14'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
} as const satisfies Record<string, readonly string[]>;

export type GlyphName = keyof typeof SYSTEM_GLYPHS;

/** One glyph family per budget slot; paired names share a slot. */
export const GLYPH_FAMILIES: readonly (readonly GlyphName[])[] = [
  ['close'], ['back'], ['menu'], ['chevron'], ['check'], ['cross'], ['plus'], ['minus'], ['show', 'hide'],
  ['search'], ['settings'], ['info'], ['warning'], ['external'], ['microphone'], ['send'], ['play'],
  ['pause'], ['refresh'],
];

export const GLYPH_BUDGET = 24;

/** Always decorative: the adjacent word or the control's accessible name carries the meaning (02 rule 6). */
export function Glyph({ name, className = 'lf-system-glyph' }: { name: GlyphName; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {SYSTEM_GLYPHS[name].map((d) => <path key={d} d={d} />)}
  </svg>;
}
