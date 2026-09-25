import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * The learner tab when the chosen Mentor has no live avatar render (for
 * example after the owner retires one in review): the name stays, the picture
 * slot disappears, and nothing stands in for the real model (02 rule 21, 07
 * §4). Every character has a render today, so the manifest is replaced here.
 */
vi.mock('../assets/manifest.json', () => ({
  default: [
    { id: 'mentor.zara.avatar.light', class: 'B', type: 'render', path: '/rebuild/mentor-avatars/zara-light.png', slot: 'mentor.avatar', aspect: '1:1',
      modes: 'light', background: 'transparent', character: 'zara', poseId: 'ambient.idle', sourceModel: '/scenes/zara.glb', altKey: 'decorative', reviewStatus: 'retired' },
    { id: 'mentor.rho.avatar.light', class: 'B', type: 'render', path: '/rebuild/mentor-avatars/rho-light.png', slot: 'mentor.avatar', aspect: '1:1',
      modes: 'light', character: 'rho', poseId: 'ambient.idle', sourceModel: '/scenes/rho.glb', altKey: 'decorative', reviewStatus: 'draft' },
  ],
}));

describe('Mentor tab without a live render', () => {
  it('keeps the name and draws no picture, letter or glyph for a retired or non-transparent render', async () => {
    const { LearnerShell, RebuildProvider } = await import('./controls');
    const { findMentorAvatar } = await import('./assets');
    expect(findMentorAvatar('zara', 'light')).toBeNull();
    expect(findMentorAvatar('rho', 'light')).toBeNull();
    for (const [name, character] of [['Zara', 'zara'], ['Dr. Rho', 'rho']] as const) {
      const { container, unmount } = render(<RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
        <LearnerShell appName="LittleFounders" pageTitle="Learn" routeKey="learn" locale="en-US" labels={{ skip: 'Skip to content', navigation: 'Main' }}
          items={[{ id: 'learn', label: 'Learn', href: '?page=learn' }]} current="learn" mentor={{ href: '?page=mentor', name: 'Mentor', character }}>
          <h1 data-copy-role="heading">Learn</h1>
        </LearnerShell>
      </RebuildProvider>);
      const tab = [...container.querySelectorAll('.lf-tabbar a')].find((link) => link.textContent === name)!;
      expect(tab).toBeDefined();
      expect(tab.querySelector('img, svg, [data-slot]')).toBeNull();
      unmount();
    }
  });
});
