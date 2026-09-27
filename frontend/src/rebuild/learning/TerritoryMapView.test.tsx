import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LearnLinks } from './learnCopy';
import { fetchTerritory, sceneAssetId, SCENE_THEMES, type TerritoryState } from './territory';
import { pathwayTerritoryFixture, territoryFixture, territoryPreviewStates } from './territoryFixtures';
import { TerritoryMapView } from './TerritoryMapView';

/*
 * W2L.2 (L3): the rebuilt course world. What Core computed is what the map
 * says (worlds, topic states, the next lesson, the placement gate, the
 * pathway access), every state has its own screen, and the scene art is our
 * own manifest asset per theme.
 */

const links: LearnLinks = {
  home: '/learn', course: (slug) => `/learn/${slug}`, lesson: (id) => `/learn/lesson/${id}`, placement: (slug) => `/learn/${slug}/placement`,
  territory: (slug) => `/learn/${slug}/territory`, rhythm: '/learn/rhythm', journal: '/learn/journal',
};

function renderMap(state: TerritoryState, extra: Partial<Parameters<typeof TerritoryMapView>[0]> = {}) {
  const onNavigate = vi.fn();
  const view = render(<TerritoryMapView state={state} slug="financial-education" locale="en-US" dark={false} ageBand="6-9" links={links} onNavigate={onNavigate} {...extra} />);
  return { onNavigate, ...view };
}

const worldOf = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('li')!;

describe('course world (L3)', () => {
  it('shows every world with its scene, progress and where the learner is; worlds not reached show only their name', () => {
    const { container } = renderMap({ status: 'ready', map: territoryFixture() });
    expect(screen.getByRole('heading', { level: 1, name: 'Your map' })).toBeTruthy();
    expect(container.querySelectorAll('.lf-territory-world')).toHaveLength(4);
    const forest = worldOf('The needs forest');
    expect(within(forest).getByText('You are here')).toBeTruthy();
    expect(forest.querySelector('[data-asset-id="scene.forest.art"]')).toBeTruthy();
    expect(worldOf('Coin island').querySelector('[data-asset-id="scene.archipelago.art"]')).toBeTruthy();
    expect(within(worldOf('Coin island')).getByText('Done')).toBeTruthy();
    // The fog of war: name, count and "Later"; no scene, no topics to open.
    const city = worldOf('Market city');
    expect(within(city).getByText('Later')).toBeTruthy();
    expect(city.querySelector('img')).toBeNull();
    expect(within(city).queryByRole('button')).toBeNull();
    // Reviews due come from Core's spaced-review layer, said in words.
    expect(screen.getByText('1 topic to review')).toBeTruthy();
    expect(container.querySelector('[data-age-band="6-9"]')).toBeTruthy();
  });

  it('opens a world to its topics: the next lesson opens with the course to return to, a closed topic says when it opens', () => {
    const { onNavigate } = renderMap({ status: 'ready', map: territoryFixture() });
    const forest = worldOf('The needs forest');
    const toggle = within(forest).getByRole('button', { name: 'Topics' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(forest).getByRole('heading', { level: 3, name: 'Needs and wants' })).toBeTruthy();
    const next = within(forest).getByRole('button', { name: /Wants can wait/ });
    expect(next.textContent).toContain('Next step');
    fireEvent.click(next);
    expect(onNavigate).toHaveBeenCalledWith('/learn/lesson/t-wants-l2', { courseSlug: 'financial-education' });
    // A passed topic reopens its first lesson (a review); a topic with every lesson closed is not pressable.
    fireEvent.click(within(forest).getByRole('button', { name: /What we need/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('/learn/lesson/t-needs-l1', { courseSlug: 'financial-education' });
    expect(within(forest).queryByRole('button', { name: /Pick one/ })).toBeNull();
    expect(within(forest).getByText('Opens later')).toBeTruthy();
  });

  it('marks a review due in words, never by colour alone', () => {
    renderMap({ status: 'ready', map: territoryFixture() });
    const island = worldOf('Coin island');
    fireEvent.click(within(island).getByRole('button', { name: 'Topics' }));
    expect(within(island).getByRole('button', { name: /Counting coins/ }).textContent).toContain('Review');
  });

  it('offers the placement first and opens no lesson until it is taken', () => {
    const { onNavigate } = renderMap({ status: 'ready', map: territoryFixture(true) });
    const start = screen.getByRole('link', { name: 'Start' });
    expect(start.getAttribute('href')).toBe('/learn/financial-education/placement');
    fireEvent.click(start);
    expect(onNavigate).toHaveBeenCalledWith('/learn/financial-education/placement', undefined);
    const forest = worldOf('The needs forest');
    fireEvent.click(within(forest).getByRole('button', { name: 'Topics' }));
    expect(within(forest).queryAllByRole('button').filter((button) => button.classList.contains('lf-list-row--pressable'))).toHaveLength(0);
    expect(screen.queryByText('1 topic to review')).toBeNull();
  });

  it('under the pathway engine: a younger chapter is an extra, a chapter closed by age is counted and never listed (OD-16)', () => {
    const { container } = renderMap({ status: 'ready', map: pathwayTerritoryFixture() }, { ageBand: '13-17' });
    expect(screen.queryByText('Household stars')).toBeNull();
    expect(screen.getByText('1 chapter for older learners')).toBeTruthy();
    expect(container.querySelectorAll('.lf-territory-world')).toHaveLength(3);
    expect(worldOf('The budget kingdom').querySelector('[data-asset-id="scene.kingdom.art"]')).toBeTruthy();
  });

  it('draws no scene for a theme it does not know, rather than a stand-in', () => {
    const map = territoryFixture();
    map.adventures[1] = { ...map.adventures[1]!, theme: 'meadow' };
    renderMap({ status: 'ready', map });
    expect(worldOf('The needs forest').querySelector('img')).toBeNull();
    expect(sceneAssetId('meadow')).toBeNull();
    expect(SCENE_THEMES.map(sceneAssetId)).toEqual(SCENE_THEMES.map((theme) => `scene.${theme}.art`));
  });

  it('keeps the same heading element from loading to ready (route focus survives the answer)', () => {
    const { rerender } = renderMap({ status: 'loading' });
    const loading = screen.getByRole('heading', { level: 1 });
    expect(loading.textContent).toBe('Loading your map');
    rerender(<TerritoryMapView state={{ status: 'ready', map: territoryFixture() }} slug="financial-education" locale="en-US" dark={false} links={links} onNavigate={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(loading);
  });

  it('has a way forward from every state it can show', () => {
    const onRetry = vi.fn();
    const { onNavigate, unmount } = renderMap(territoryPreviewStates.prerequisite!, { courseTitles: { entrepreneurship: 'Start a business' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start a business' }));
    expect(onNavigate).toHaveBeenCalledWith('/learn/entrepreneurship');
    unmount();
    const offline = renderMap(territoryPreviewStates.offline!, { onRetry });
    expect(screen.getByRole('heading', { level: 1, name: 'You are offline' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    offline.unmount();
    const age = renderMap(territoryPreviewStates.age!);
    expect(screen.getByRole('heading', { level: 1, name: 'Not open yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Courses' }).getAttribute('href')).toBe('/learn');
    age.unmount();
    renderMap(territoryPreviewStates.error!, { locale: 'pt-BR' });
    expect(screen.getByRole('heading', { level: 1, name: 'Mapa indisponível' })).toBeTruthy();
  });
});

describe('course world data (GET /learn/courses/:slug/tree)', () => {
  const reply = (data: unknown, error: { code: string; missingPrerequisites?: string[] } | null = null) => async () => ({ data, error });
  it('reads the tree Core serves under either engine and refuses what Core refuses', async () => {
    expect(await fetchTerritory('financial-education', reply(pathwayTerritoryFixture()))).toMatchObject({ status: 'ready' });
    expect(await fetchTerritory('x', reply(null, { code: 'COURSE_AGE_RESTRICTED' }))).toEqual({ status: 'age-restricted' });
    expect(await fetchTerritory('x', reply(null, { code: 'COURSE_PREREQUISITE_REQUIRED', missingPrerequisites: ['entrepreneurship'] })))
      .toEqual({ status: 'prerequisite', missing: ['entrepreneurship'] });
    expect(await fetchTerritory('x', reply(null, { code: 'NOT_FOUND' }))).toEqual({ status: 'not-found' });
    expect(await fetchTerritory('x', reply(null, { code: 'NETWORK' }))).toEqual({ status: 'offline' });
    expect(await fetchTerritory('x', async () => { throw new Error('lost'); })).toEqual({ status: 'offline' });
    // A malformed tree is unavailable, never partly drawn.
    expect(await fetchTerritory('x', reply({ course: {} }))).toEqual({ status: 'error' });
  });

  it('asks for the course it was given, encoded', async () => {
    const request = vi.fn(reply(territoryFixture()));
    await fetchTerritory('money basics', request);
    expect(request).toHaveBeenCalledWith('/learn/courses/money%20basics/tree');
  });
});
