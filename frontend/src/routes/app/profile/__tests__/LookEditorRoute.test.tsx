import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RebuildProvider } from '@/rebuild/design/controls';
import { LookEditorRoute } from '../LookEditorRoute';

/*
 * P2 on its real data plane (E.12): every part is a named radio group, what is
 * written is exactly the closed option set, the cover is written only when it
 * changed, and a failed save keeps the person's edits on screen.
 */

const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refresh: vi.fn().mockResolvedValue(undefined), track: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/lib/insights', () => ({ trackInsight: mocks.track }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
const auth = { session: { user: { id: '33333333-3333-4333-8333-333333333333' } }, roles: [] as string[], getToken: mocks.token, refreshMe: mocks.refresh };
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

const STORED = { skinColor: ['ffdbb4'], top: ['bob'], hairColor: ['2c1b18'], eyes: ['happy'], eyebrows: ['default'], mouth: ['smile'],
  clothing: ['hoodie'], clothesColor: ['5199e4'], facialHairProbability: 0, accessoriesProbability: 0, seed: 'kept_seed' };
let writes: { path: string; body: unknown }[] = [];
let failAvatar = false;

beforeEach(async () => {
  vi.clearAllMocks();
  writes = [];
  failAvatar = false;
  mocks.api.mockImplementation(async (path: string, options: { method?: string; body?: unknown } = {}) => {
    if (!options.method) return { data: { avatarOptions: STORED, cover: { preset: 'ocean' } }, error: null };
    writes.push({ path, body: options.body });
    if (failAvatar && path === '/profile/avatar') return { data: null, error: { code: 'INTERNAL', message: 'Synthetic' } };
    return { data: { updated: true }, error: null };
  });
  await i18n.changeLanguage('en-US');
});

function renderEditor() {
  return render(<MemoryRouter initialEntries={['/profile/avatar']}>
    <RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
      <Routes><Route path="/profile/avatar" element={<LookEditorRoute />} /><Route path="/profile" element={<p>profile page</p>} /></Routes>
    </RebuildProvider>
  </MemoryRouter>);
}

describe('look editor (P2)', () => {
  it('names every part and every option, and shows the stored choices as selected', async () => {
    renderEditor();
    const hair = await screen.findByRole('group', { name: 'Hair and headwear' });
    expect(within(hair).getByRole('radio', { name: 'Bob' })).toBeChecked();
    expect(within(hair).getAllByRole('radio')).toHaveLength(16);
    for (const part of ['Skin tone', 'Hair color', 'Eyes', 'Eyebrows', 'Mouth', 'Beard', 'Clothes', 'Clothes color', 'Glasses', 'Cover']) {
      expect(screen.getByRole('group', { name: part })).toBeInTheDocument();
    }
    expect(within(screen.getByRole('group', { name: 'Glasses' })).getByRole('radio', { name: 'None' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Cover' })).getByRole('radio', { name: 'Ocean' })).toBeChecked();
    // No raw option identifier is an accessible name.
    for (const radio of screen.getAllByRole('radio')) expect(radio.getAttribute('aria-label') ?? radio.parentElement?.textContent).not.toMatch(/^[a-z]+[A-Z0-9]|^[0-9a-f]{6}$/);
  });

  it('saves exactly the closed option set, and the cover only when it changed, then returns to the profile', async () => {
    renderEditor();
    fireEvent.click(within(await screen.findByRole('group', { name: 'Glasses' })).getByRole('radio', { name: 'Round glasses' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Eyes' })).getByRole('radio', { name: 'Wink' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save look' }));
    expect(await screen.findByText('profile page')).toBeInTheDocument();
    expect(writes).toEqual([{ path: '/profile/avatar', body: { options: {
      skinColor: ['ffdbb4'], top: ['bob'], hairColor: ['2c1b18'], eyes: ['wink'], eyebrows: ['default'], mouth: ['smile'], clothing: ['hoodie'], clothesColor: ['5199e4'],
      facialHairProbability: 0, accessoriesProbability: 100, accessories: ['round'], seed: 'kept_seed',
    } } }]);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith('avatar_edit', { routeClass: 'profile' });
  });

  it('writes a changed cover as a preset id', async () => {
    renderEditor();
    fireEvent.click(within(await screen.findByRole('group', { name: 'Cover' })).getByRole('radio', { name: 'Midnight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save look' }));
    await screen.findByText('profile page');
    expect(writes.map((write) => write.path)).toEqual(['/profile/avatar', '/profile/cover']);
    expect(writes[1]!.body).toEqual({ preset: 'midnight' });
  });

  it('keeps the edits on screen and says so when the save fails', async () => {
    failAvatar = true;
    renderEditor();
    fireEvent.click(within(await screen.findByRole('group', { name: 'Mouth' })).getByRole('radio', { name: 'Tongue out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save look' }));
    expect(await screen.findByText('Your look was not saved. Try again.')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Mouth' })).getByRole('radio', { name: 'Tongue out' })).toBeChecked();
    expect(screen.queryByText('profile page')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save look' })).not.toHaveAttribute('aria-busy'));
  });

  it('draws a random look from the closed catalogue (a cosmetic draw; nothing is earned)', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Random look' }));
    for (const part of ['Skin tone', 'Hair and headwear', 'Eyes', 'Clothes']) {
      expect(within(screen.getByRole('group', { name: part })).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
    }
    expect(writes).toEqual([]);
  });
});
