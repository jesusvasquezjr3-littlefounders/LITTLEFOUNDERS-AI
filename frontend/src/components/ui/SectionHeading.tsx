import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/**
 * THE STUDY'S SECTION LOCKUP (/DESIGN.md §The study's component set).
 *
 * A tinted icon tile, a wide-tracked small-caps label, and an optional meta
 * note pinned right. It is the design study's strongest typographic signature
 * and the thing that makes a column of controls read as a laboratory rather
 * than as a pile — and until this component existed, every surface that wanted
 * one hand-rolled it, which is why only the Tutor ever had one.
 *
 * THE HUE IS LOAD-BEARING, not decoration. The tile's colour KEYS the controls
 * underneath it: a section whose cards select in accent has an accent tile, so
 * a glance at the icon says which set you are choosing from. That is why the
 * tone is a required prop rather than a default — a caller has to decide what
 * the group is, and a section with a tone that disagrees with its cards is a
 * section that teaches the wrong thing about its own colour.
 *
 * It renders a real `<h2>`/`<h3>` and returns its own id, so a caller can wire
 * `aria-labelledby` on the group it heads: the lockup is how the section is
 * NAMED, not merely how it is decorated, and a screen reader that meets an
 * unlabelled group of eight radio cards has been handed a list with no title.
 */
export interface SectionHeadingProps {
  /** Material Symbols ligature for the tile. */
  icon: string;
  /** The section's own hue. Keys the controls below it. */
  tone: 'accent' | 'delight' | 'success' | 'warning' | 'error' | 'muted';
  children: ReactNode;
  /** A count, a status, a reward — pinned right, and never a control. */
  meta?: ReactNode;
  /** `h2` by default; `h3` inside a surface that already has one. */
  as?: 'h2' | 'h3';
  /** Wire this onto the group with `aria-labelledby`. */
  id?: string;
  className?: string;
}

const TONE: Record<SectionHeadingProps['tone'], string> = {
  accent: 'text-accent',
  delight: 'text-delight',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
  error: 'text-error-strong',
  muted: 'text-content-muted',
};

export function SectionHeading({
  icon,
  tone,
  children,
  meta,
  as = 'h2',
  id,
  className,
}: SectionHeadingProps) {
  const fallbackId = useId();
  const headingId = id ?? fallbackId;
  const Tag = as;
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('lf-tile h-7 w-7', TONE[tone])}>
          <Icon name={icon} aria-hidden className="!text-[16px]" />
        </span>
        <Tag id={headingId} className="lf-eyebrow truncate text-content">
          {children}
        </Tag>
      </div>
      {meta !== undefined && (
        <span className="lf-caption shrink-0 text-content-muted">{meta}</span>
      )}
    </div>
  );
}
