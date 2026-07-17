import type { ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { coverCss } from '@/lib/coverPresets';

/*
 * Shared profile header: token-gradient cover + overlapping Avataaars.
 * Used by /profile and public /@username views so a profile looks identical
 * everywhere it appears.
 */
export function ProfileHero({
  cover,
  avatarOptions,
  seed,
  coverAction,
  avatarAction,
}: {
  cover: Record<string, unknown> | null | undefined;
  avatarOptions: Record<string, unknown>;
  seed: string;
  /** e.g. the "edit cover" button (own profile only) */
  coverAction?: ReactNode;
  /** e.g. the "edit avatar" pencil indicator (own profile only) */
  avatarAction?: ReactNode;
}) {
  return (
    <div>
      <div
        className="relative h-36 rounded-xl sm:h-48"
        style={{ backgroundImage: coverCss(cover) }}
        role="img"
        aria-hidden="true"
      >
        {coverAction && <div className="absolute bottom-3 right-3">{coverAction}</div>}
      </div>
      <div className="relative -mt-14 ml-5 h-28 w-28 sm:-mt-16 sm:ml-8 sm:h-32 sm:w-32">
        <Avatar options={avatarOptions} seed={seed} className="h-full w-full bg-surface ring-4 ring-base" />
        {avatarAction && <div className="absolute -bottom-1 -right-1">{avatarAction}</div>}
      </div>
    </div>
  );
}
