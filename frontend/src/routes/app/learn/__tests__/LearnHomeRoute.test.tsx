import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { ThemeProvider } from '@/theme/useTheme';
import { childPathFixture } from '@/rebuild/learning/coursePathFixtures';
import { childShelf, childTree, SHELF_TITLES } from '@/rebuild/learning/learnHomeFixtures';
import { clearCoursesCache, writeCoursesCache } from '../coursesCache';
import { LearnHomeRoute } from '../LearnHomeRoute';
import { CoursePathRedirect, CourseRoute } from '../CourseRoute';

/*
 * W2L.1: the hosts of the rebuilt learner home and course screen, against
 * Core's real envelope (api() mocked at the transport, nothing else): which
 * endpoints each page reads, what survives a failure, the stale-while-
 * revalidate shelf, the engine switch and the /path redirect.
 */

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/lib/insights', async () => ({ ...(await vi.importActual<typeof import('@/lib/insights')>('@/lib/insights')), trackInsight: vi.fn() }));
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  const session = { user: { id: 'kid-1' } };
  return { useAuth: () => ({ getToken, session, profile: { display_name: 'Sofía Pérez' } }) };
});

const mockedApi = vi.mocked(api);
type Answer = { data: unknown; error: null } | { data: null; error: { code: string; message: string; missingPrerequisites?: string[] } };
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string, extra: Record<string, unknown> = {}): Answer => ({ data: null, error: { code, message: code, ...extra } });

function answer(table: Record<string, Answer | (() => Answer)>) {
  mockedApi.mockImplementation((async (path: string) => {
    const entry = Object.entries(table).find(([prefix]) => path === prefix || path.startsWith(`${prefix}?`));
    const value = entry ? (typeof entry[1] === 'function' ? entry[1]() : entry[1]) : refuse('NOT_FOUND');
    return value;
  }) as unknown as typeof api);
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderAt(path: string) {
  return render(<ThemeProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/learn" element={<LearnHomeRoute />} />
      <Route path="/learn/:courseSlug" element={<CourseRoute />} />
      <Route path="/learn/:courseSlug/path" element={<CoursePathRedirect />} />
    </Routes>
    <Where />
  </MemoryRouter></ThemeProvider>);
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mockedApi.mockReset();
});
afterEach(() => clearCoursesCache());

describe('learner home host', () => {
  it('reads the shelf, the featured course, the rhythm, the prompts and the register, and shows the next lesson', async () => {
    answer({
      '/learn/courses': ok(childShelf()),
      '/learn/courses/financial-education/path': refuse('PATHWAY_ENGINE_DISABLED'),
      '/learn/courses/financial-education/tree': ok(childTree()),
      '/learn/rhythm': refuse('INTERNAL'),
      '/learn/bridges': ok({ prompts: [] }),
      '/learn/register': refuse('INTERNAL'),
    });
    renderAt('/learn');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hi, Sofía' })).toBeTruthy();
    const hero = await screen.findByRole('region', { name: 'Needs and wants' });
    expect(within(hero).getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/learn/lesson/l-needs-1');
    const paths = mockedApi.mock.calls.map(([path]) => path);
    expect(paths).toEqual(expect.arrayContaining(['/learn/courses', '/learn/courses/financial-education/path', '/learn/courses/financial-education/tree', '/learn/bridges', '/learn/register']));
    expect(paths.some((path) => path.startsWith('/learn/rhythm?local_date='))).toBe(true);
    // The rhythm read failed: the streak card still offers the way to it; the page stays whole.
    expect(screen.getByRole('link', { name: 'Your rhythm' })).toBeTruthy();
    // Unknown register: the youngest (most protective) Copy Budget band.
    expect(document.querySelector('[data-screen="learn-home"]')?.getAttribute('data-age-band')).toBe('6-9');
  });

  it('paints the shelf it already had and keeps it when the fresh read fails', async () => {
    writeCoursesCache('kid-1', childShelf().courses);
    answer({ '/learn/courses': refuse('INTERNAL'), '/learn/register': ok({ register: 'teen', copy_band: '13-17', policy_version: 'x', graduation: null }) });
    renderAt('/learn');
    expect(screen.getByRole('article', { name: 'Money basics' })).toBeTruthy();
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/courses', expect.anything()));
    expect(screen.queryByRole('heading', { name: 'Courses unavailable' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Money basics' })).toBeTruthy();
  });

  it('says a failed shelf is unavailable and a lost connection is offline', async () => {
    answer({ '/learn/courses': refuse('INTERNAL') });
    const first = renderAt('/learn');
    expect(await screen.findByRole('heading', { name: 'Courses unavailable' })).toBeTruthy();
    first.unmount();
    mockedApi.mockReset();
    mockedApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'Network error' } } as never);
    renderAt('/learn');
    expect(await screen.findByRole('heading', { name: 'You are offline' })).toBeTruthy();
  });
});

describe('course host', () => {
  it('shows the pathway course when that engine is on', async () => {
    answer({ '/learn/courses/financial-education/path': ok(childPathFixture()), '/learn/register': refuse('INTERNAL') });
    renderAt('/learn/financial-education');
    expect(await screen.findByRole('region', { name: 'More to open' })).toBeTruthy();
    expect(mockedApi.mock.calls.map(([path]) => path)).not.toContain('/learn/courses/financial-education/tree');
  });

  it('keeps the old /path address working as a redirect to the one course screen', async () => {
    answer({ '/learn/courses/financial-education/path': refuse('PATHWAY_ENGINE_DISABLED'), '/learn/courses/financial-education/tree': ok(childTree()) });
    renderAt('/learn/financial-education/path');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/learn/financial-education'));
    expect(await screen.findByRole('button', { name: 'Lessons' })).toBeTruthy();
  });

  it('names a missing prerequisite by its title, reading the shelf when none is cached (B.2)', async () => {
    answer({
      '/learn/courses/investing/path': refuse('PATHWAY_ENGINE_DISABLED'),
      '/learn/courses/investing/tree': refuse('COURSE_PREREQUISITE_REQUIRED', { missingPrerequisites: ['entrepreneurship'] }),
      '/learn/courses': ok(childShelf()),
    });
    renderAt('/learn/investing');
    expect(await screen.findByRole('heading', { name: 'One step first' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: new RegExp(SHELF_TITLES.entrepreneurship['en-US']) })).toBeTruthy();
  });

  it('gives the age safeguard its own screen', async () => {
    answer({ '/learn/courses/investing/path': refuse('COURSE_AGE_RESTRICTED') });
    renderAt('/learn/investing');
    expect(await screen.findByRole('heading', { name: 'Not open yet' })).toBeTruthy();
  });
});
