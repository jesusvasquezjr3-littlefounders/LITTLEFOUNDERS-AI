import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Card: liquid glass surface with rim light,
 * hairline edge, and layered atmospheric depth.
 * `onInverse` = deep glass variant for inverse bands.
 * `hero` = larger radius + padding for banner cards.
 *
 * `interactive` is the one that changed on 2026-09-05. A card you can press
 * is an OBJECT, so it gets the tactile tier's ridge (/DESIGN.md §Tactile) and
 * presses like every other control in the product. It keeps the hover lift —
 * hover says "this responds" on a pointer device, and the press says "you got
 * it" on every device; a phone only ever sees the second, which is exactly
 * why the lift alone was never enough feedback.
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
          : 'lf-glass',
        hero ? 'rounded-xl p-8' : 'rounded-lg p-6',
        interactive && 'lf-tactile motion-safe-lift hover:-translate-y-1',
        className,
      )}
      {...props}
    />
  );
}
