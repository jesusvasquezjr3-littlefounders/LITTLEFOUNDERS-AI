import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * A retired or unregistered sprite leaves the avatar and cover slots empty
 * and marked, with no picture, letter or initial standing in for the person
 * (07 §6: nothing unregistered is drawn). The manifest is replaced here with
 * one that retires the hair sprite and lacks the covers.
 */
vi.mock('../../assets/manifest.json', () => ({
  default: [
    { id: 'profile.avatar.body', class: 'B', type: 'svg', path: '/rebuild/avatar/body.svg', slot: 'profile.avatar', modes: 'both', altKey: 'decorative', reviewStatus: 'draft' },
    { id: 'profile.avatar.hair', class: 'B', type: 'svg', path: '/rebuild/avatar/hair.svg', slot: 'profile.avatar', modes: 'both', altKey: 'decorative', reviewStatus: 'retired' },
    { id: 'profile.avatar.face', class: 'B', type: 'svg', path: '/rebuild/avatar/face.svg', slot: 'profile.avatar', modes: 'both', altKey: 'decorative', reviewStatus: 'draft' },
    { id: 'profile.avatar.extras', class: 'B', type: 'svg', path: '/rebuild/avatar/extras.svg', slot: 'profile.avatar', modes: 'both', altKey: 'decorative', reviewStatus: 'draft' },
  ],
}));

describe('avatar without its registered sprites', () => {
  it('keeps an empty, marked slot and draws nothing else', async () => {
    const { CartoonAvatar, CoverArt } = await import('./CartoonAvatar');
    const { resolveLook } = await import('./avatarKit');
    const { container } = render(<><CartoonAvatar look={resolveLook({}, 'x')} label="Your avatar" /><CoverArt cover="ocean" /></>);
    const avatar = container.querySelector('[data-slot="profile-avatar"]')!;
    expect(avatar.getAttribute('data-refused')).toBe('true');
    expect(avatar.getAttribute('role')).toBeNull();
    expect(avatar.innerHTML).toBe('');
    const cover = container.querySelector('[data-slot="profile-cover"]')!;
    expect(cover.getAttribute('data-refused')).toBe('true');
    expect(cover.innerHTML).toBe('');
    expect(container.textContent).toBe('');
  });
});
