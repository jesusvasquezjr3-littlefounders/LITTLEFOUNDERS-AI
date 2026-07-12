import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Card: rounded-lg surface, hairline outline, soft
 * glass shadow. `onInverse` = frosted-glass variant for navy bands.
 * `hero` = larger radius + padding for banner cards.
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hero?: boolean;
  interactive?: boolean;
  onInverse?: boolean;
}

export function Card({
  hero = false,
  interactive = false,
  onInverse = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        onInverse
          ? 'lf-glass-deep text-on-inverse'
          : 'border border-outline/70 bg-surface shadow-glass',
        hero ? 'rounded-xl p-8' : 'rounded-lg p-6',
        interactive && 'motion-safe-lift transition-transform duration-300 hover:-translate-y-1',
        className,
      )}
      {...props}
    />
  );
}
