/*
 * Profile cover presets — TOKEN GRADIENTS ONLY (Jesús, 2026-07-12,
 * NON-NEGOTIABLE: no image uploads for covers or avatars, ever). Each preset
 * is a CSS gradient built from the palette's CSS variables, so covers adapt
 * to light/dark automatically and can never carry foreign content.
 */

export interface CoverPreset {
  id: string;
  css: string;
}

const v = (name: string, alpha = 1) => `rgb(var(--lf-${name}) / ${alpha})`;

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'aurora', css: `linear-gradient(120deg, ${v('primary')}, ${v('delight')} 55%, ${v('accent')})` },
  { id: 'sunset', css: `linear-gradient(135deg, ${v('accent')}, ${v('delight')})` },
  { id: 'ocean', css: `linear-gradient(135deg, ${v('primary-strong')}, ${v('primary')} 45%, ${v('secondary')})` },
  { id: 'forest', css: `linear-gradient(135deg, ${v('success-strong')}, ${v('success')} 55%, ${v('delight')})` },
  { id: 'candy', css: `linear-gradient(135deg, ${v('delight')}, ${v('accent-soft')})` },
  { id: 'ember', css: `linear-gradient(160deg, ${v('accent-strong')}, ${v('accent')} 50%, ${v('warning')})` },
  { id: 'midnight', css: `linear-gradient(135deg, ${v('inverse')}, ${v('primary-strong')})` },
  { id: 'mint', css: `linear-gradient(135deg, ${v('success')}, ${v('secondary')} 70%)` },
  { id: 'grape', css: `linear-gradient(150deg, ${v('primary-strong')}, ${v('delight')})` },
  { id: 'dawn', css: `radial-gradient(120% 120% at 20% 0%, ${v('accent-soft')}, ${v('primary-soft')} 45%, ${v('primary')})` },
];

export const DEFAULT_COVER = 'aurora';

export function coverCss(cover: Record<string, unknown> | undefined | null): string {
  const preset = typeof cover?.preset === 'string' ? cover.preset : DEFAULT_COVER;
  return (COVER_PRESETS.find((p) => p.id === preset) ?? COVER_PRESETS[0]!).css;
}
