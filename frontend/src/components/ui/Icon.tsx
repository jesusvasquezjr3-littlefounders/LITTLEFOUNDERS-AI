import { cn } from '@/lib/utils';

/* /DESIGN.md — Material Symbols Outlined is the only icon set. Ligature-based. */

interface IconProps {
  name: string; // Material Symbols ligature name, e.g. "smart_toy"
  fill?: boolean;
  className?: string;
}

export function Icon({ name, fill = false, className }: IconProps) {
  return (
    <span aria-hidden="true" className={cn('lf-icon text-inherit', fill && 'lf-icon-fill', className)}>
      {name}
    </span>
  );
}
