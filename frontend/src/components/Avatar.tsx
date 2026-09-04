import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { avatarDataUri, type AvatarOptions } from '@/lib/avatarOptions';

/*
 * DiceBear Avataaars, rendered LOCALLY (@dicebear/core → SVG data URI) — no
 * external avatar service, nothing leaves the browser. The platform-wide
 * face of a user; never an uploaded photo (NON-NEGOTIABLE).
 */

interface AvatarProps {
  options: (AvatarOptions & { seed?: string }) | Record<string, unknown>;
  /** Fallback seed when options carry none (stable per user). */
  seed?: string;
  className?: string;
}

export function Avatar({ options, seed = 'littlefounder', className }: AvatarProps) {
  const uri = useMemo(() => avatarDataUri(options as Record<string, unknown>, seed), [options, seed]);

  return (
    <img
      src={uri}
      alt=""
      aria-hidden="true"
      className={cn('rounded-full bg-surface-sunken', className)}
      draggable={false}
    />
  );
}
