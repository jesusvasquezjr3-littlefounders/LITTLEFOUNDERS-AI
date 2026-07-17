import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — Badge: pill, soft fill, bold caption type. */

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'lf-caption inline-flex items-center rounded-full bg-surface-sunken px-3 py-1 font-bold text-content-muted',
        className,
      )}
      {...props}
    />
  );
}
