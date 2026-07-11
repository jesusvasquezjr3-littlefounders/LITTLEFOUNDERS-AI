import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — Button: chunky pill, press compression, ≥44px hit area. */

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary border-b-4 border-primary-strong hover:-translate-y-0.5 hover:shadow-clay-sm active:translate-y-0.5 active:scale-[0.98] active:shadow-clay-pressed active:border-b-2',
  secondary:
    'bg-surface text-primary shadow-clay-sm hover:-translate-y-0.5 hover:shadow-clay active:translate-y-0.5 active:scale-[0.98] active:shadow-clay-pressed',
};

export function Button({ variant = 'primary', className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'lf-label motion-safe-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-6 py-3',
        'transition-[transform,box-shadow,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
