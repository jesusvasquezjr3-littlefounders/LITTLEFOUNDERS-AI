import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — IconChip: soft-filled icon tile.
 * size "md" = 48px rounded-md (stats/rows) · "lg" = 56px rounded-lg (feature cards).
 */

type Tone = 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
type Size = 'md' | 'lg';

interface IconChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
}

const TONES: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  secondary: 'bg-secondary-soft text-secondary',
  accent: 'bg-accent-soft text-accent-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-strong',
};

const SIZES: Record<Size, string> = {
  md: 'h-12 w-12 rounded-full text-xl',
  lg: 'h-14 w-14 rounded-full text-2xl',
};

export function IconChip({ tone = 'primary', size = 'md', className, ...props }: IconChipProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex items-center justify-center', SIZES[size], TONES[tone], className)}
      {...props}
    />
  );
}
