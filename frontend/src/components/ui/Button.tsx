import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Button: full pill (rounded-full), bold label,
 * 1px press (active:translate-y-px), color-shift hover. No scale, no 3D.
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
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary:
    'border border-outline bg-surface/60 text-content hover:border-primary hover:text-primary',
  success: 'bg-success text-on-success hover:bg-success-strong',
  danger: 'bg-error text-on-error hover:bg-error-strong',
};

export function Button({ variant = 'primary', className, type, children, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'lf-label lf-gaming-btn motion-safe-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-7 py-3.5',
        'transition-[transform,box-shadow,background-color,border-color,color] duration-200 active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {/* Span wrapper to ensure content stays above the caustic pseudo-element */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
