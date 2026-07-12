import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { cn } from '@/lib/utils';
import type { AvatarOptions } from '@/lib/avatarOptions';

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
  const uri = useMemo(() => {
    const opts = { seed, ...options } as Record<string, unknown>;
    return createAvatar(avataaars, opts).toDataUri();
  }, [options, seed]);

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
