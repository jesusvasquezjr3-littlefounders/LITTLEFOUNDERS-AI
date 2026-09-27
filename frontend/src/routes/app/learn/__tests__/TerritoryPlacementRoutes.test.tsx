import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { ThemeProvider } from '@/theme/useTheme';
import { childShelf } from '@/rebuild/learning/learnHomeFixtures';
import { territoryFixture } from '@/rebuild/learning/territoryFixtures';
import { LEARNER_REGISTER_POLICY_VERSION } from '@/rebuild/design/learnerRegisterPolicy.generated';
import { clearCoursesCache, readCoursesCache, writeCoursesCache } from '../coursesCache';
import { PlacementRoute } from '../PlacementRoute';
import { TerritoryRoute } from '../TerritoryRoute';

/*
 * W2L.2: the hosts of the rebuilt course world (L3) and placement flow (L4)
 * against Core's real envelope (api() mocked at the transport, nothing else):
 * what each reads, the register band, the chosen Mentor, and where a stored
 * placement lands the learner.
 */

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  const session = { user: { id: 'kid-1' } };
  return { useAuth: () => ({ getToken, session, profile: { display_name: 'Sofía Pérez' } }) };
});

const mockedApi = vi.mocked(api);
type Answer = { data: unknown; error: null } | { data: null; error: { code: string; message: string; missingPrerequisites?: string[] } };
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string, extra: Record<string, unknown> = {}): Answer => ({ data: null, error: { code, message: code, ...extra } });

function answer(table: Record<string, Answer | ((body: unknown) => Answer)>) {
  mockedApi.mockImplementation((async (path: string, options?: { body?: unknown }) => {
    const entry = Object.entries(table).find(([prefix]) => path === prefix);
    return entry ? (typeof entry[1] === 'function' ? entry[1](options?.body) : entry[1]) : refuse('NOT_FOUND');
  }) as unknown as typeof api);
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}|${JSON.stringify(location.state ?? null)}`}</p>;
}

function renderAt(path: string) {
  return render(<ThemeProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/learn/:courseSlug/territory" element={<TerritoryRoute />} />
      <Route path="/learn/:courseSlug/placement" element={<PlacementRoute />} />
    </Routes>
    <Where />
  </MemoryRouter></ThemeProvider>);
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mockedApi.mockReset();
});
afterEach(() => clearCoursesCache());

describe('course world host', () => {
  it('reads the tree and the register, and draws the map in the learner band', async () => {
    answer({
      '/learn/courses/financial-education/tree': ok(territoryFixture()),
      '/learn/register': ok({ register: 'transition', copy_band: '10-12', policy_version: LEARNER_REGISTER_POLICY_VERSION, graduation: null }),
    });
    renderAt('/learn/financial-education/territory');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your map' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'The needs forest' })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-screen="territory"]')?.getAttribute('data-age-band')).toBe('10-12'));
    expect(mockedApi.mock.calls.map(([path]) => path)).not.toContain('/learn/courses/financial-education/path');
  });

  it('names a missing prerequisite by its title (B.2)', async () => {
    answer({
      '/learn/courses/investing/tree': refuse('COURSE_PREREQUISITE_REQUIRED', { missingPrerequisites: ['entrepreneurship'] }),
      '/learn/courses': ok(childShelf()),
    });
    renderAt('/learn/investing/territory');
    expect(await screen.findByRole('heading', { level: 1, name: 'One step first' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Start a business/ })).toBeTruthy();
  });
});

describe('placement host', () => {
  const result = { frontier: 12, startTopicId: 't', startLessonId: 'lesson-12', creditedLessonCount: 12, creditedTopicCount: 12, totalTopicCount: 200,
    method: 'adaptive_quiz', cappedByPrerequisite: false, framing: { path: 'adaptive_quiz', start: 'further_in', basis: 'prior_exposure', learner_chosen: false } };

  it('runs on the full-hue single-state screen with the chosen Mentor, and lands on the lesson Core chose', async () => {
    writeCoursesCache('kid-1', childShelf().courses);
    let steps = 0;
    answer({
      '/placement/money-basics/intake': ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: false }),
      '/placement/money-basics/step': () => (steps++ === 0
        ? ok({ kind: 'ask', probe: { topicId: 't-1', prompt: 'Q1', options: ['A', 'B'] }, questionNumber: 1, questionsRemaining: 2, phase: 'search' })
        : ok({ kind: 'done', result })),
      '/placement/money-basics/commit': ok(result),
      '/tutor/preferences': ok({ character: 'dina', personalized: true }),
      '/learn/register': ok({ register: 'young', copy_band: '6-9', policy_version: LEARNER_REGISTER_POLICY_VERSION, graduation: null }),
    });
    renderAt('/learn/money-basics/placement');
    const shell = await waitFor(() => { const node = document.querySelector('[data-shell="single-state"]'); if (!node) throw new Error('no shell'); return node; });
    expect(shell.getAttribute('data-hue')).toBe('sky');
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(await screen.findByRole('heading', { level: 1, name: "Let's find your start" })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-mentor-character]')?.getAttribute('data-mentor-character')).toBe('dina'));
    await waitFor(() => expect(document.querySelector('[data-screen="placement-welcome"]')?.getAttribute('data-age-band')).toBe('6-9'));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(await screen.findByRole('button', { name: /B/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start here' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/learn/lesson/lesson-12|{"courseSlug":"money-basics"}'));
    // Placement credits changed the progress the shelf shows.
    expect(readCoursesCache('kid-1')).toBeNull();
  });

  it('opens the course when a start is already stored for it', async () => {
    answer({
      '/placement/money-basics/intake': ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: false }),
      '/placement/money-basics/commit': refuse('PLACEMENT_ALREADY_COMPLETE'),
    });
    renderAt('/learn/money-basics/placement');
    fireEvent.click(await screen.findByRole('button', { name: 'From the beginning' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/learn/money-basics|null'));
  });
});
