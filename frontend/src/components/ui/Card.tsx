import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Card: surface + clay + 1px white border (part of
 * the clay illusion — the one border exception) + rounded-lg, ≥24px padding.
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hero?: boolean;
  interactive?: boolean;
}

export function Card({ hero = false, interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border border-white bg-surface shadow-clay dark:border-white/10',
        hero ? 'rounded-xl p-8' : 'rounded-lg p-6',
        interactive &&
          'motion-safe-lift transition-transform duration-300 hover:scale-[1.02]',
        className,
      )}
      {...props}
    />
  );
}
