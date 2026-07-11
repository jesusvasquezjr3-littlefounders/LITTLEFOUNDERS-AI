import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Button: chunky rounded-md block (NOT a pill),
 * 4px bottom border; press = translate-y + border collapse (the mockup's
 * clay-button physics). Hover: scale(1.02).
 */

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary border-b-4 border-primary-strong shadow-clay-sm active:translate-y-1 active:border-b-0 active:shadow-clay-pressed',
  secondary:
    'bg-surface text-primary border-b-4 border-surface-sunken shadow-clay-sm active:translate-y-1 active:border-b-0 active:shadow-clay-pressed',
};

export function Button({ variant = 'primary', className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'lf-label motion-safe-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-8 py-4',
        'transition-[transform,box-shadow,background-color] duration-200 hover:scale-[1.02]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
