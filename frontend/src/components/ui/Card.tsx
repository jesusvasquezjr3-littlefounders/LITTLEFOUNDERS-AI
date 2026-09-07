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
        /*
         * THE STUDY'S TWO CARD RADII (2026-09-07, §Shape).
         *
         * Was `xl` (32px) for a hero and `lg` (24px) for everything else. The
         * study has nothing at 32px: its cards are 16px and only its modal
         * shell reaches 24px, and a 32px corner on a dense panel reads as a
         * different product sharing the screen. A hero keeps the larger of the
         * two because it is furniture rather than a card.
         */
        hero ? 'rounded-lg p-8' : 'rounded-md p-6',
        interactive && 'lf-tactile motion-safe-lift hover:-translate-y-1',
        className,
      )}
      {...props}
    />
  );
}
