import type { ReactNode } from 'react';
import type { CopyRole } from './copyBudget';
import { Glyph, type GlyphName } from './glyphs';
import { resolveManifestAsset } from './assets';

/*
 * Display components. Status is always a glyph
 * plus a word plus a hue, never the hue alone.
 */

export type StatusTone = 'success' | 'warning' | 'error' | 'sky' | 'primary';

/** Status chip: soft well, strong text, a glyph and a word. */
export function Chip({ tone, glyph, children, role = 'body' }: { tone: StatusTone; glyph: GlyphName; children: ReactNode; role?: CopyRole }) {
  return <span className={`lf-status-chip lf-status-chip--${tone}`} data-copy-role={role}><Glyph name={glyph} /><span>{children}</span></span>;
}

/**
 * The platform's own unit is the seed (`money.seed`): decorative, beside a number and the word "seeds".
 * It is not money, so nothing has to say "simulated".
 */
export const SEED_ASSET_ID = 'money.seed';

export type NoticeTone = 'success' | 'retry' | 'error' | 'info';
const noticeGlyph: Record<NoticeTone, GlyphName> = { success: 'check', retry: 'cross', error: 'warning', info: 'info' };

/** Quieter in-flow notice: soft well, strong text. Announced only when the caller asks for it. */
export function InlineNotice({ tone, children, live = false }: { tone: NoticeTone; children: ReactNode; live?: boolean }) {
  return <p className={`lf-notice lf-notice--${tone}`} data-copy-role="body" role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}>
    <Glyph name={noticeGlyph[tone]} /><span>{children}</span>
  </p>;
}

/**
 * One of our own assets, by manifest id only: never a free URL. Decorative by
 * default, because the word beside it carries the meaning; an informative use
 * passes its translated name. An unregistered or retired id leaves the slot
 * empty and marked `data-refused`: there is no fallback picture and no stock icon.
 */
export function Art({ assetId, label = null, size = 'md' }: { assetId: string; label?: string | null; size?: 'md' | 'lg' }) {
  const asset = resolveManifestAsset(assetId);
  if (!asset) return <span className={`lf-art lf-art--${size}`} data-refused="true" aria-hidden="true" />;
  return <img className={`lf-art lf-art--${size}`} src={asset.path} alt={label ?? ''} aria-hidden={label ? undefined : true}
    data-asset-id={asset.id} data-slot={asset.slot} />;
}
