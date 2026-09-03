import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/*
 * THE WHITEBOARD'S DRAWING PRIMITIVES.
 *
 * WHY THIS FILE EXISTS, and why it is small. Every instrument the Tutor draws
 * (/TUTOR_INSTRUMENTS.md) is a different arrangement of a few identical parts:
 * a bar that has to resolve a percentage height, a caption written by the model
 * in a language whose length nobody controls, a number above a shape, a row that
 * scrolls sideways rather than crushing its contents. Both defects this surface
 * has actually shipped were in those parts, not in any instrument's own logic:
 *
 *   1. EVERY BAR RENDERED AT ZERO PIXELS, in every real browser, from launch.
 *      `items-end` on the ROW leaves each column's height content-sized, which
 *      is not a definite containing block, so a bar's `height: N%` cannot
 *      resolve against an ancestor whose height is still being derived FROM
 *      that percentage. Per the CSS sizing spec it behaves as `height: auto`.
 *      Invisible to jsdom (which lays nothing out, so `toHaveStyle({height:
 *      '71%'})` was checking the intent and never the result) and to every
 *      screenshot nobody zoomed into.
 *
 *   2. A MODEL-WRITTEN CAPTION DID NOT TRUNCATE, IT DISAPPEARED. `LessonPlate`'s
 *      `bodyLayout="column"` body is `overflow-hidden` with no scroll — the
 *      board is the one child contractually responsible for its own bounds — so
 *      an unclamped wrap pushed past the ancestor and vanished with no ellipsis
 *      and no signal. es-MX runs ~19% longer than en-US on the same content, and
 *      these labels never pass through `i18n:check` because the model writes
 *      them live.
 *
 * So the kit is deliberately NOT a speculative nine-piece framework. It is the
 * parts the evidence names, built so the two defects above are unreachable BY
 * CONSTRUCTION rather than by remembering: a caller cannot put a bar outside its
 * track, and cannot render a model-written caption without a line ceiling.
 * Primitives are added when an instrument needs one, not in advance
 * (/TUTOR_INSTRUMENTS.md §4.2).
 *
 * WHAT DOES NOT BELONG HERE: arithmetic. Every number these draw was computed
 * server-side and verified twice (`oracle/src/tutor/whiteboard.ts`, then again
 * at the wire). A primitive that derived a value would be a third copy of the
 * arithmetic, free to disagree with the two that already ran.
 */

/**
 * A value this close to zero draws as nothing, not as the visibility floor
 * below.
 *
 * Mirrors `oracle/src/tutor/whiteboard.ts`'s own `ZERO_EPSILON` — duplicated
 * rather than imported, because this package does not depend on `oracle/`
 * (the same hand-mirroring posture `TutorWhiteboardWire` already takes). That
 * module clamps a running value NEGATIVE by a hair of floating-point noise up
 * to exact zero for a legitimate "spend it down to zero" sequence; it does not
 * clamp noise on the POSITIVE side, so a value can still arrive here a hair
 * above zero. Found by adversarial review, round 107: the `Math.max(6, …)`
 * floor did not carve out true zero, so a bar whose own label read "$0" still
 * drew with real height — contradicting its own label on exactly the story beat
 * the feature exists to narrate correctly.
 */
export const ZERO_EPSILON = 1e-9;

/**
 * A bar's height as a percentage of the tallest bar on its board.
 *
 * The `Math.max(6, …)` floor keeps a genuinely small nonzero bar visible; the
 * epsilon check above it keeps a true zero at zero. Shared by every instrument
 * that draws bars so the two can never be spelled differently on two boards.
 */
export function barHeightPct(value: number, max: number): number {
  if (value <= ZERO_EPSILON) return 0;
  return Math.max(6, Math.round((value / Math.max(max, 1)) * 100));
}

/** Locale- and currency-aware number formatting, shared by every instrument. */
export function useValueFormat(currency: string | null): (n: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const fmt = currency
      ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 })
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
    return (n: number) => fmt.format(n);
  }, [i18n.language, currency]);
}

/**
 * THE ROW EVERY BAR-CHART INSTRUMENT SITS IN.
 *
 * `min-h-0 flex-1` is what gives the row a DEFINITE height from its own flex
 * parent — which is what `BarTrack` below then passes down to a bar so its
 * percentage can resolve at all. `overflow-x-auto` is the deliberate escape
 * valve: when too many columns will not fit, the row scrolls sideways rather
 * than crushing captions to an unreadable width. Note there is no
 * `items-end` here, and that is the whole point — see `BarTrack`.
 */
export function BoardRow({
  children,
  gap = 'md',
  justify = 'start',
  grow = true,
  className,
}: {
  children: ReactNode;
  gap?: 'md' | 'lg';
  justify?: 'start' | 'center';
  /**
   * False sizes the row to its CONTENT instead of claiming the plate's free
   * height.
   *
   * `flex-1` exists here for one reason — to hand a definite height down to a
   * percentage-sized bar — so an instrument that draws no bars should not take
   * it. `tokens` was the first: with `flex-1` the row swallowed the whole plate,
   * the coins centred inside it and the total was pushed to the very bottom of
   * the panel, far from the pile it belonged to.
   */
  grow?: boolean;
  className?: string;
}) {
  /*
   * VARIANTS ARE BOUNDED PROPS, NEVER `className` OVERRIDES, and that is a
   * correctness requirement here rather than a taste one: `cn` (lib/utils.ts)
   * is a plain string joiner with no tailwind-merge, so passing `gap-6` to a
   * component that already writes `gap-2` leaves BOTH in the attribute and the
   * winner is decided by the order of the compiled stylesheet — not by the
   * order they appear here. A prop cannot produce that ambiguity.
   */
  return (
    <div
      className={cn(
        'flex min-h-0 overflow-x-auto px-1 pb-1',
        grow ? 'flex-1' : 'shrink-0',
        gap === 'lg' ? 'gap-6' : 'gap-2',
        justify === 'center' && 'justify-center',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * ONE COLUMN OF A BAR CHART — a number, a bar, a caption, stacked.
 *
 * `min-w` is a FLOOR, never a cap: with six categories on a narrow phone the
 * columns hit it and the row scrolls, which is a better failure than six
 * unreadable slivers.
 */
export function BarColumn({
  children,
  minWidth = '4.5rem',
  maxWidth,
  className,
}: {
  children: ReactNode;
  minWidth?: string;
  maxWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-1 flex-col items-center gap-1', className)}
      style={{ minWidth, ...(maxWidth ? { maxWidth } : {}) }}
    >
      {children}
    </div>
  );
}

/**
 * THE BAR, INSIDE ITS OWN TRACK. Defect #1 in this file's header, made
 * unreachable.
 *
 * The track (`flex-1 min-h-0`) is what carries the row's stretched, DEFINITE
 * height down to a real pixel value; `items-end` lives HERE rather than on the
 * row, so bars still grow from a shared bottom baseline without stopping their
 * columns from stretching. The bar itself is a plain child with a percentage
 * height that now has something to resolve against.
 *
 * `bg-accent/70` is the CONFIGURED Tailwind token, not
 * `bg-[color:var(--lf-accent)]/70`. The design token is a bare "R G B" triple
 * meant to be used inside `rgb(var(…) / <alpha>)`; Tailwind cannot decompose an
 * opaque `var()` at build time to attach an alpha, so the arbitrary-value form
 * emitted `background-color: var(--lf-accent)` — an invalid color a browser
 * silently discards, leaving the bar transparent. Both defects together made
 * the bar invisible from launch; only the number above and the caption below
 * were ever seen.
 */
export function BarTrack({
  heightPct,
  grown = true,
  animated = false,
  tone = 'accent',
  className,
}: {
  heightPct: number;
  /** False draws the track empty — used by a reveal that has not reached this bar yet. */
  grown?: boolean;
  animated?: boolean;
  tone?: 'accent' | 'muted';
  className?: string;
}) {
  return (
    <div className={cn('flex w-full min-h-0 flex-1 items-end', className)}>
      <div
        className={cn(
          'w-full rounded-t-md',
          tone === 'accent' ? 'bg-accent/70' : 'bg-content-muted/30',
          animated && 'transition-[height] duration-500 ease-out',
          !grown && 'opacity-0',
        )}
        style={{ height: grown ? `${heightPct}%` : '0%' }}
      />
    </div>
  );
}

/** The number drawn above a shape. Decorative: the accessible name carries it. */
export function ValueLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('lf-number lf-title text-content', className)} aria-hidden="true">
      {children}
    </span>
  );
}

/**
 * A CAPTION THE MODEL WROTE. Defect #2 in this file's header, made unreachable.
 *
 * `line-clamp-2` is a hard, deterministic ceiling: whatever the locale, whatever
 * the length, whatever instrument reuses this, the caption cannot grow past two
 * lines and therefore cannot be pushed out of the plate's `overflow-hidden`
 * body. It trades an invisible loss for a visible ellipsis. Nothing is lost for
 * a screen reader — every board builds its `aria-label` from the raw fields, not
 * from the rendered DOM, so the full text is still announced.
 *
 * Use `Caption` for anything the model wrote and `AxisCaption` for chrome that
 * comes from the locale files, where the length IS controlled and clamping would
 * only hide a translation bug that `i18n:check` should surface instead.
 */
export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('lf-caption line-clamp-2 break-words text-center text-content-muted', className)} aria-hidden="true">
      {children}
    </span>
  );
}

/** Chrome from the locale files — "Start", "Week 1". Not clamped; see `Caption`. */
export function AxisCaption({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('lf-caption text-content-muted', className)} aria-hidden="true">
      {children}
    </span>
  );
}

/**
 * ONE DISCRETE, DENOMINATED OBJECT — a coin or a note.
 *
 * The first primitive here that is not a bar, and the reason the kit exists at
 * all rather than being folded into the two bar-chart instruments that already
 * shipped: `tokens` draws a collection of things a learner can count twice two
 * different ways, which is precisely what several remediation moves ask for and
 * what no height-of-a-number can express (`biggest-coin-first`: "keep the coins
 * on the table where they can be picked up").
 *
 * Size is a bounded scale, never a free number — a token's size carries meaning
 * (a bigger coin looks bigger) and letting it be arbitrary would let a board
 * imply a value ordering the server never verified.
 */
export function Token({
  size = 'md',
  tone = 'accent',
  children,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'accent' | 'muted';
  children?: ReactNode;
  className?: string;
}) {
  const box = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-[13px]' : 'h-11 w-11 text-[11px]';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border-2 font-semibold tabular-nums',
        tone === 'accent' ? 'border-accent bg-accent/15 text-content' : 'border-content-muted/40 bg-surface text-content-muted',
        box,
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/**
 * A LABELLED CONTAINER — a pile, a jar, a bucket.
 *
 * `label` is optional on purpose, and that is a pedagogical requirement rather
 * than an API convenience: `three-piles-in-out-left` instructs the tutor to
 * "make three places… and leave them UNNAMED", naming them only once something
 * is inside. A container that demanded its label up front could not perform the
 * move it exists for.
 */
export function Bin({
  label,
  children,
  className,
}: {
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col items-center gap-1.5', className)}>
      <div className="flex min-h-0 w-full flex-1 flex-wrap content-end items-end justify-center gap-1 rounded-md border-2 border-dashed border-content-muted/35 p-1.5">
        {children}
      </div>
      {label ? <Caption>{label}</Caption> : <span className="lf-caption text-content-muted/0" aria-hidden="true">&nbsp;</span>}
    </div>
  );
}

/**
 * A HORIZONTAL PROPORTIONAL BAR — a length that means a quantity.
 *
 * The sibling of `BarTrack`, and it exists for the same structural reason in the
 * other axis: a percentage WIDTH resolves against a parent whose width is
 * definite, which `w-full` on a block-level track guarantees. Segments are laid
 * out in order and sized by fraction, so a caller cannot produce a bar whose
 * pieces do not add up to the track they sit in.
 *
 * `dashed` draws a segment as an outline rather than a fill — how a bar model
 * shows THE UNKNOWN. It is drawn at its real width because making the unknown's
 * size apparent is the entire point of the representation; what is never drawn
 * is its VALUE, which is the answer.
 */
export function HBar({
  segments,
  className,
}: {
  segments: { fraction: number; dashed?: boolean; tone?: 'accent' | 'muted' }[];
  className?: string;
}) {
  return (
    <div className={cn('flex h-7 w-full overflow-hidden rounded-md bg-content-muted/10', className)}>
      {segments.map((segment, i) => (
        <div
          key={i}
          className={cn(
            'h-full min-w-0 first:rounded-l-md last:rounded-r-md',
            segment.dashed
              ? 'border-2 border-dashed border-accent bg-transparent'
              : segment.tone === 'muted'
                ? 'bg-content-muted/30'
                : 'bg-accent/70',
            i > 0 && !segment.dashed && 'border-l border-surface',
          )}
          style={{ width: `${Math.max(0, Math.min(100, segment.fraction * 100))}%` }}
        />
      ))}
    </div>
  );
}
