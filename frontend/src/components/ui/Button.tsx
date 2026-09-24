import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Button: full pill (rounded-full), bold label,
 * TACTILE press, color-shift hover. No scale, no 3D.
 *
 * The press is the tactile tier's (/DESIGN.md §Tactile): the button carries a
 * ridge the height of its own travel, and pressing collapses the ridge as the
 * face descends, so the bottom edge never moves. It replaced a 1px
 * `active:translate-y-px` across the whole product on 2026-09-05 — this is the
 * single most-repeated gesture in the app, and one component owning it is what
 * makes that a one-line change rather than a sweep.
 *
 * The ridge's COLOUR comes from the variant, through `--lf-ridge`, so a
 * destructive button has a red side and a success button a green one. The
 * geometry is written once in the stylesheet; a variant only names a tone.
 *
 * Variant = the action's color, per the Action Color Contract (/DESIGN.md
 * §Colors): primary = the one main CTA (indigo), secondary = alternative/
 * lower-emphasis (outlined glass), success = positive completion, danger =
 * destructive. Never pick a variant by taste — pick by what the action does.
 */

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'lf-tactile-accent bg-accent text-on-accent hover:bg-accent-strong',
  secondary:
    'border border-outline bg-surface/60 text-content hover:border-primary hover:text-primary',
  success: 'lf-tactile-success bg-success text-on-success hover:bg-success-strong',
  danger: 'lf-tactile-danger bg-error text-on-error hover:bg-error-strong',
};

export function buttonClasses(variant: Variant = 'primary', className?: string) {
  return cn(
        'lf-label lf-tactile lf-sheen motion-safe-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-7 py-3.5',
        'transition-[transform,box-shadow,background-color,border-color,color]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      );
}

export function Button({ variant = 'primary', className, type, children, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={buttonClasses(variant, className)}
      {...props}
    >
      {/* Above `.lf-sheen`'s ::before overlay, which sits at z-index -1. */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
