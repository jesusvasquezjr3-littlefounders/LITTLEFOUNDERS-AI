import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Button: full pill (rounded-full), bold label,
 * 1px press (active:translate-y-px), color-shift hover. No scale, no 3D.
 *
 * Variant = the action's color, per the Action Color Contract (/DESIGN.md
 * §Colors): primary = the one main CTA (papaya), secondary = alternative/
 * lower-emphasis (outlined glass), success = positive completion, danger =
 * destructive. Never pick a variant by taste — pick by what the action does.
 */

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-glass-sm hover:bg-accent-strong',
  secondary:
    'border border-outline bg-surface/60 text-content hover:border-primary hover:text-primary',
  success: 'bg-success text-on-success shadow-glass-sm hover:bg-success-strong',
  danger: 'bg-error text-on-error shadow-glass-sm hover:bg-error-strong',
};

export function Button({ variant = 'primary', className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'lf-label motion-safe-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-7 py-3.5',
        'transition-[transform,box-shadow,background-color,border-color,color] duration-200 active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
