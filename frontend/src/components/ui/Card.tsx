import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — Card: surface + clay + rounded-lg, ≥24px padding. */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hero?: boolean;
  interactive?: boolean;
}

export function Card({ hero = false, interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface shadow-clay',
        hero ? 'rounded-xl p-8' : 'rounded-lg p-6',
        interactive &&
          'motion-safe-lift transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
}
