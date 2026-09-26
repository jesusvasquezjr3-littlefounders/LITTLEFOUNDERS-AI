import { useId, type CSSProperties } from 'react';
import { resolveManifestAsset } from '../../design/assets';
import { avatarLayers, COVER_SPRITE, type AvatarLook, type CoverId } from './avatarKit';
import './avatar.css';

/*
 * A person's cartoon avatar and their profile cover, drawn from our own
 * registered sprites (Frontend Bible 07 §1, §3, §6; E.12).
 *
 * Each part is a `<use>` of a manifest-registered SVG file. The person's
 * chosen colours reach the part through CSS variables on the drawing (07
 * §3.1: one file serves both modes); ink, white and the token hues come from
 * the page. If a sprite is not registered, or retired, the slot stays empty
 * and is marked `data-refused`: there is no stock picture, letter or initial
 * standing in for a person (the same rule as `Art` and `MentorAvatar`).
 *
 * The avatar is decorative by default, because the name beside it carries
 * the meaning (07 §8); a surface that shows it alone passes a label.
 */

const AVATAR_ASSETS = ['profile.avatar.body', 'profile.avatar.hair', 'profile.avatar.face', 'profile.avatar.extras'] as const;
const COVER_ASSET = 'profile.cover.presets';

export type CartoonAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * `face` frames the head only: the editor's thumbnails for the eyes, brows,
 * mouth, beard and glasses, where the whole bust would make the part too
 * small to tell apart.
 */
export function CartoonAvatar({ look, size = 'md', label = null, framing = 'bust' }: {
  look: AvatarLook; size?: CartoonAvatarSize; label?: string | null; framing?: 'bust' | 'face';
}) {
  const clip = `lf-avatar-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ready = AVATAR_ASSETS.every((id) => resolveManifestAsset(id) !== null);
  const colours = {
    '--lf-avatar-skin': `#${look.skinColor}`,
    '--lf-avatar-hair': `#${look.hairColor}`,
    '--lf-avatar-clothes': `#${look.clothesColor}`,
  } as CSSProperties;
  return <span className={`lf-cartoon-avatar lf-cartoon-avatar--${size} lf-cartoon-avatar--${framing}`} data-slot="profile-avatar" data-refused={ready ? undefined : 'true'}
    role={ready && label ? 'img' : undefined} aria-label={ready && label ? label : undefined} aria-hidden={ready && label ? undefined : true}>
    {ready ? <svg viewBox={framing === 'face' ? '52 50 96 96' : '0 0 200 200'} focusable="false" style={colours} aria-hidden="true">
      <defs><clipPath id={clip}><circle cx="100" cy="100" r="100" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <circle className="lf-cartoon-avatar-disc" cx="100" cy="100" r="100" />
        {/* The bust at 90% so the tallest hair and headwear stay inside the disc. */}
        <g transform="translate(10 16) scale(.9)">{avatarLayers(look).map((href) => <use key={href} href={href} />)}</g>
      </g>
    </svg> : null}
  </span>;
}

/** The profile cover: one of the ten presets, a flat token composition (E.12: never an upload). */
export function CoverArt({ cover }: { cover: CoverId }) {
  const ready = resolveManifestAsset(COVER_ASSET) !== null;
  return <span className="lf-cover-art" data-slot="profile-cover" data-cover={cover} data-refused={ready ? undefined : 'true'} aria-hidden="true">
    {ready ? <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">
      <use href={`${COVER_SPRITE}#${cover}`} />
    </svg> : null}
  </span>;
}
