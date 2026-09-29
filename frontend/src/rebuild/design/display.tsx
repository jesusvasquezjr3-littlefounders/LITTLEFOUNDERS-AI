import { useId, type PointerEvent, type ReactNode } from 'react';
import type { CopyRole } from './copyBudget';
import { Glyph, type GlyphName } from './glyphs';
import { Button } from './buttons';
import { resolveManifestAsset, resolveMentorRender } from './assets';
import { withPressFeedback } from './motion';

/*
 * Display components (Frontend Bible 02 §3 components, §4.2 reserved hues,
 * §4.4 separation by fill, §9.2 feedback grammar). Status is always a glyph
 * plus a word plus a hue, never the hue alone (02 rule 6).
 */

export type StatusTone = 'success' | 'warning' | 'error' | 'sky' | 'primary';

/** Status chip: soft well, strong text, a glyph and a word (02 `chip-status`). */
export function Chip({ tone, glyph, children, role = 'body' }: { tone: StatusTone; glyph: GlyphName; children: ReactNode; role?: CopyRole }) {
  return <span className={`lf-status-chip lf-status-chip--${tone}`} data-copy-role={role}><Glyph name={glyph} /><span>{children}</span></span>;
}

/** The coin mark (07 §1 class B `money.coin`, 02 §9.5): decorative, beside a number and the word "coins", only for money. */
export const COIN_ASSET_ID = 'money.coin';
function CoinMark() {
  const asset = resolveManifestAsset(COIN_ASSET_ID);
  return asset ? <img className="lf-coin-mark" src={asset.path} alt="" aria-hidden="true" data-asset-id={asset.id} /> : null;
}

/**
 * A coin quantity (02 §9.5 "Shape by object type": the coin shape is used only
 * for money): the coin art, then the text, which always carries the number and
 * the glossary word "coins" in the reader's language ("12 coins", "12 monedas",
 * "12 moedas"). The art is decorative; the words carry the meaning.
 */
export function CoinAmount({ children, size = 'sm', className }: { children: ReactNode; size?: 'sm' | 'lg'; className?: string }) {
  return <span className={`lf-coin-amount${size === 'lg' ? ' lf-coin-amount--lg' : ''}${className ? ` ${className}` : ''}`} data-copy-role="data" data-money="coins">
    <CoinMark /><span>{children}</span>
  </span>;
}

/**
 * Reward chip: coins, XP, streak (02 `chip-reward`). Reward gold is never a
 * status. `coin` marks a coin quantity with the coin art; XP and a streak never
 * carry it (the coin means money only).
 */
export function RewardChip({ children, coin = false }: { children: ReactNode; coin?: boolean }) {
  return <span className={`lf-status-chip lf-status-chip--reward${coin ? ' lf-status-chip--coins' : ''}`} data-copy-role="data" data-money={coin ? 'coins' : undefined}>
    {coin ? <CoinMark /> : null}{coin ? <span>{children}</span> : children}
  </span>;
}

/** A wrapping row of chips. */
export function ChipGroup({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="lf-chip-group" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

/** Pointer handlers a board adds to a chip the learner can also drag (Bible 05 §4, GAP-FIX-R4). */
export interface ChipDrag {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void; onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void; onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
}

/**
 * A pressable filter or pick chip; selection adds a check, not just a colour.
 * `drag` makes it an object the learner can drag onto a board region; pressing
 * it still picks it up for the tap path (tap the object, then the place).
 */
export function ChoiceChip({ selected, onToggle, children, disabled, drag }: { selected: boolean; onToggle: () => void; children: ReactNode; disabled?: boolean; drag?: ChipDrag }) {
  return <button type="button" className={`lf-choice-chip${drag ? ' lf-choice-chip--drag' : ''}`} aria-pressed={selected} disabled={disabled} data-copy-role="option" onClick={onToggle}
    onPointerDown={withPressFeedback(drag?.onPointerDown)} onPointerMove={drag?.onPointerMove} onPointerUp={drag?.onPointerUp} onPointerCancel={drag?.onPointerCancel}>
    {selected ? <Glyph name="check" /> : null}<span>{children}</span>
  </button>;
}

/**
 * A reply chip in the Mentor's response area (08 §2): a suggested answer the
 * learner sends with one press ("We're good", "Not really"). It is an `option`
 * control (8 words, 5 for ages 6–9) and never a toggle: answering moves the
 * turn on, so it has no pressed state. Chips offered together share one look,
 * none is preselected, and the caller lays the group out. It keeps the button
 * base (focus ring, 56 px target, press feedback) with a sunken fill, so it
 * has its own boundary on a surface panel in both themes (02 §4.4).
 */
export function ReplyChip({ children, onPress, disabled, className, ...data }: {
  children: ReactNode; onPress: () => void; disabled?: boolean; className?: string;
} & { [attribute: `data-${string}`]: string | undefined }) {
  return <button type="button" {...data} className={`lf-button lf-reply-chip${className ? ` ${className}` : ''}`} data-copy-role="option"
    disabled={disabled} onClick={onPress} onPointerDown={withPressFeedback()}>{children}</button>;
}

/** Solid label pill. Accent is excluded: it is reserved for the call to action (02 §4.2). */
export type PillTone = 'primary' | 'success' | 'reward' | 'sky' | 'mint' | 'berry' | 'inverse';
export function Pill({ tone, children, role = 'body' }: { tone: PillTone; children: ReactNode; role?: CopyRole }) {
  return <span className={`lf-pill lf-pill--${tone}`} data-copy-role={role}>{children}</span>;
}

export type CardTone = 'neutral' | 'primary' | 'sky' | 'mint' | 'berry';
/**
 * Neutral cards separate by a soft elevation (light) or surface step (dark);
 * identity cards are a solid hue with no border (02 §4.4). An identity card's
 * meaning is carried three ways, so a hue card requires a heading.
 */
export function Card({ tone = 'neutral', heading, headingLevel = 2, as: Tag = 'section', children }: {
  tone?: CardTone; heading?: string; headingLevel?: 2 | 3; as?: 'section' | 'article' | 'div'; children?: ReactNode;
} & ({ tone?: 'neutral' } | { tone: Exclude<CardTone, 'neutral'>; heading: string })) {
  const id = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return <Tag className={`lf-card lf-card--${tone}`} aria-labelledby={heading && Tag !== 'div' ? id : undefined}>
    {heading ? <Heading id={id} className="lf-card-heading" data-copy-role="heading">{heading}</Heading> : null}
    {children}
  </Tag>;
}

export function List({ label, children }: { label: string; children: ReactNode }) {
  return <ul className="lf-list" aria-label={label}>{children}</ul>;
}

/** 56 px list row. The trailing slot drops to its own line when the title needs the room (02 §7 rule 6). */
export function ListRow({ title, supporting, leading, trailing, onPress, titleRole = 'body' }: {
  title: ReactNode; supporting?: ReactNode; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; titleRole?: CopyRole;
}) {
  const content = <>
    {leading ? <span className="lf-list-row-leading">{leading}</span> : null}
    <span className="lf-list-row-text">
      <span className="lf-list-row-title" data-copy-role={titleRole}>{title}</span>
      {supporting ? <span className="lf-list-row-supporting" data-copy-role="body">{supporting}</span> : null}
    </span>
    {trailing ? <span className="lf-list-row-trailing">{trailing}</span> : null}
    {onPress ? <Glyph name="chevron" className="lf-system-glyph lf-list-row-chevron" /> : null}
  </>;
  return <li className="lf-list-item">{onPress
    ? <button type="button" className="lf-list-row lf-list-row--pressable" onClick={onPress} onPointerDown={withPressFeedback()}>{content}</button>
    : <div className="lf-list-row">{content}</div>}</li>;
}

export type NoticeTone = 'success' | 'retry' | 'error' | 'info';
const noticeGlyph: Record<NoticeTone, GlyphName> = { success: 'check', retry: 'cross', error: 'warning', info: 'info' };

/**
 * Solid feedback banner (02 `banner-correct` / `banner-try-again`): it names
 * what happened. `retry` is the wrong-answer tone: warning gold and a cross,
 * never red and never a penalty. `error` is for system errors only.
 */
export function Banner({ tone, children, action, live = true }: {
  tone: NoticeTone; children: ReactNode; action?: ReactNode;
  /** False when the caller keeps a persistent live region around the banner, so the message is announced once, not twice. */
  live?: boolean;
}) {
  return <div className={`lf-banner lf-banner--${tone}`} role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}>
    <Glyph name={noticeGlyph[tone]} />
    <span className="lf-banner-text" data-copy-role="body">{children}</span>
    {action ? <span className="lf-banner-action">{action}</span> : null}
  </div>;
}

/** Quieter in-flow notice: soft well, strong text. Announced only when the caller asks for it. */
export function InlineNotice({ tone, children, live = false }: { tone: NoticeTone; children: ReactNode; live?: boolean }) {
  return <p className={`lf-notice lf-notice--${tone}`} data-copy-role="body" role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}>
    <Glyph name={noticeGlyph[tone]} /><span>{children}</span>
  </p>;
}

/**
 * The capsule is progress (02 §9.5). The value is written as text as well as
 * drawn. `labelHidden` is for a bar whose value the screen already writes next
 * to it (the lesson top bar's "2/4"): the label then names the bar for
 * assistive technology only, and no head row is drawn.
 */
export function ProgressBar({ label, value, max, valueText, tone = 'primary', labelHidden = false, className }: {
  label: string; value: number; max: number; valueText: string; tone?: 'primary' | 'mint' | 'reward'; labelHidden?: boolean; className?: string;
}) {
  const id = useId();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const naming = labelHidden ? { 'aria-label': label } : { 'aria-labelledby': id };
  return <div className={`lf-progress lf-progress--${tone}${labelHidden ? ' lf-progress--bare' : ''}${className ? ` ${className}` : ''}`}>
    {labelHidden ? null : <div className="lf-progress-head">
      <span id={id} className="lf-input-label" data-copy-role="body">{label}</span>
      <span className="lf-progress-value" data-copy-role="data">{valueText}</span>
    </div>}
    <div className="lf-progress-track" role="progressbar" {...naming} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}>
      <span className="lf-progress-fill" style={{ inlineSize: `${percent}%` }} />
    </div>
  </div>;
}

/**
 * Placeholder shapes while something loads. They shimmer (OD-28, owner review
 * item V-04): busy motion, not one of the three idle slots (motion.tsx), it
 * stops when the content arrives and is off under reduced motion, where the
 * shapes stay still. Decorative: the status words beside them carry the meaning.
 */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <span className="lf-skeleton" aria-hidden="true" data-busy-motion="shimmer">
    {Array.from({ length: lines }, (_, index) => <span key={index} className="lf-skeleton-line" />)}
  </span>;
}

export function LoadingState({ label, lines = 3 }: { label: string; lines?: number }) {
  return <div className="lf-loading" role="status">
    <p className="lf-loading-label" data-copy-role="body">{label}</p>
    <Skeleton lines={lines} />
  </div>;
}

/**
 * One of our own class B assets (07 §3, §6), by manifest id only: never a free
 * URL, and never a Mentor render (those go through `MentorAvatar`, which checks
 * the real model and pose). Decorative by default, because the word beside it
 * carries the meaning (07 §8: an asset never replaces a label the person needs);
 * an informative use passes its translated name. An unregistered, retired or
 * render id leaves the slot empty and marked `data-refused`: there is no
 * fallback picture and no stock icon.
 */
export function Art({ assetId, label = null, size = 'md' }: { assetId: string; label?: string | null; size?: 'md' | 'lg' }) {
  const asset = resolveManifestAsset(assetId);
  if (!asset || asset.type === 'render') return <span className={`lf-art lf-art--${size}`} data-refused="true" aria-hidden="true" />;
  return <img className={`lf-art lf-art--${size}`} src={asset.path} alt={label ?? ''} aria-hidden={label ? undefined : true}
    data-asset-id={asset.id} data-slot={asset.slot} />;
}

function StateArt({ assetId }: { assetId?: string }) {
  const asset = assetId ? resolveManifestAsset(assetId) : null;
  return asset ? <img className="lf-state-art" src={asset.path} alt="" aria-hidden="true" data-asset-id={asset.id} /> : null;
}

/** Nothing to show yet. Says what will appear and offers the next step; never blames. */
export function EmptyState({ heading, body, action, artAssetId }: { heading: string; body?: string; action?: ReactNode; artAssetId?: string }) {
  const id = useId();
  return <section className="lf-state lf-state--empty" aria-labelledby={id}>
    <StateArt assetId={artAssetId} />
    <h2 id={id} className="lf-state-heading" data-copy-role="heading">{heading}</h2>
    {body ? <p className="lf-state-body" data-copy-role="body">{body}</p> : null}
    {action ? <div className="lf-state-action">{action}</div> : null}
  </section>;
}

/** A failure the person can recover from: what happened, and a retry that shows while it is in flight. */
export function ErrorState({ heading, body, retryLabel, retryingLabel, retrying = false, onRetry }: {
  heading: string; body?: string; retryLabel: string; retryingLabel: string; retrying?: boolean; onRetry: () => void;
}) {
  const id = useId();
  return <section className="lf-state lf-state--error" aria-labelledby={id} role="alert">
    <span className="lf-state-glyph"><Glyph name="warning" /></span>
    <h2 id={id} className="lf-state-heading" data-copy-role="heading">{heading}</h2>
    {body ? <p className="lf-state-body" data-copy-role="body">{body}</p> : null}
    <div className="lf-state-action"><Button variant="accent" pending={retrying} pendingLabel={retryingLabel} onClick={onRetry}>{retryLabel}</Button></div>
  </section>;
}

/**
 * The Mentor avatar slot. It accepts only a manifest-registered render of the
 * real 3D model in a catalogue pose; an unknown, retired or non-render asset
 * leaves the slot empty. There is no letter, glyph or look-alike fallback
 * (02 rule 21, 07 §4).
 */
export function MentorAvatar({ renderId, label, size = 'md' }: { renderId: string; label: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const asset = resolveMentorRender(renderId);
  return <span className={`lf-avatar lf-avatar--${size}`} data-slot="mentor-avatar" data-refused={asset ? undefined : 'true'}
    role={asset && label ? 'img' : undefined} aria-label={asset && label ? label : undefined} aria-hidden={asset && label ? undefined : true}>
    {asset ? <img src={asset.path} alt="" data-character={asset.character} data-pose={asset.poseId} data-asset-id={asset.id} /> : null}
  </span>;
}
