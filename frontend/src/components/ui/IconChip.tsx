import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — IconChip: 48px rounded-md square, -soft fill. */

type Tone = 'primary' | 'secondary' | 'accent';

interface IconChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONES: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  secondary: 'bg-secondary-soft text-secondary',
  accent: 'bg-accent-soft text-accent',
};

export function IconChip({ tone = 'primary', className, ...props }: IconChipProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-md text-xl',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
