import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import type { CourseTree } from '../types';
import { CoursePage } from '../CoursePage';
import { TerritoryView } from '../TerritoryPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
// getToken must be a STABLE reference — the page's fetch effect depends on it
// (in the real app it's a memoized useCallback from AuthContext). A fresh
// function per render would re-fire the effect forever.
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken }) };
});

const mockedApi = vi.mocked(api);

const fixtureTree: CourseTree = {
  course: {
    id: 'course-1',
    slug: 'money-basics',
    title: { 'en-US': 'Money Basics' },
    description: { 'en-US': '' },
    subject: 'money',
    progress: { passed: 1, total: 3, pct: 33 },
    placementRequired: false,
  },
  adventures: [
    {
      id: 'adv-open',
      slug: 'adv-open',
      title: { 'en-US': 'Open Adventure' },
      description: { 'en-US': '' },
      theme: 'archipelago',
      position: 1,
      state: 'available',
      progress: { passed: 1, total: 2, pct: 50 },
      sagas: [
        {
          id: 'saga-1',
          slug: 'saga-1',
          title: { 'en-US': 'Trading Saga' },
          icon: 'savings',
          position: 1,
          progress: { passed: 1, total: 2, pct: 50 },
          topics: [
            {
              id: 'topic-1',
              slug: 'topic-1',
              title: { 'en-US': 'What is money' },
              position: 1,
              kind: 'teaching',
              reviewOf: [],
              state: 'not-started',
              lessons: [
                {
                  id: 'lesson-passed',
                  slug: 'l1',
                  title: { 'en-US': 'Lesson One' },
                  position: 1,
                  difficulty: 1,
                  xp_total: 10,
                  estimated_minutes: 5,
                  state: 'passed',
                  bestScore: 100,
                  placementCredited: false,
                },
                {
                  id: 'lesson-current',
                  slug: 'l2',
                  title: { 'en-US': 'Lesson Two' },
                  position: 2,
                  difficulty: 1,
                  xp_total: 15,
                  estimated_minutes: 6,
                  state: 'current',
                  bestScore: 0,
                  placementCredited: false,
                },
              ],
            },
            {
              id: 'topic-2',
              slug: 'topic-2',
              title: { 'en-US': 'Saving basics' },
              position: 2,
              kind: 'teaching',
              reviewOf: [],
              state: 'not-started',
              lessons: [
                {
                  id: 'lesson-locked',
                  slug: 'l3',
                  title: { 'en-US': 'Lesson Three' },
                  position: 1,
                  difficulty: 2,
                  xp_total: 20,
                  estimated_minutes: 8,
                  state: 'locked',
                  bestScore: 0,
                  placementCredited: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'adv-locked',
      slug: 'adv-locked',
      title: { 'en-US': 'Locked Adventure' },
      description: { 'en-US': '' },
      theme: 'forest',
      position: 2,
      state: 'locked',
      progress: { passed: 0, total: 2, pct: 0 },
      sagas: [],
    },
  ],
  nextLessonId: 'lesson-current',
};

function renderCoursePage() {
  return render(
    <MemoryRouter initialEntries={['/learn/money-basics']}>
      <Routes>
        <Route path="/learn/:courseSlug" element={<CoursePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  mockedApi.mockReset();
  await i18n.changeLanguage('en-US');
});

describe('CoursePage', () => {
  it('renders adventure banners and auto-opens the one containing nextLessonId, with correct lesson node states', async () => {
    mockedApi.mockResolvedValueOnce({ data: fixtureTree, error: null });
    renderCoursePage();

    expect(await screen.findByText('Open Adventure')).toBeInTheDocument();
    expect(screen.getByText('Locked Adventure')).toBeInTheDocument();

    // The open adventure auto-expands (nextLessonId lives inside it). This is
    // an EFFECT, so it can land a tick after the banner text appears — assert
    // it with waitFor, not synchronously, or the test flakes ~1 run in 7.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Open Adventure/ })).toHaveAttribute('aria-expanded', 'true'),
    );

    // Its lessons render, threaded with topic headers.
    expect(screen.getByText('What is money')).toBeInTheDocument();
    expect(screen.getByText('Saving basics')).toBeInTheDocument();
    expect(screen.getByText('Lesson One')).toBeInTheDocument();
    expect(screen.getByText('Lesson Three')).toBeInTheDocument();

    // The next lesson is named ONCE. It used to be printed three times over:
    // the row, a rail card, and the rail's chapter list. Three copies of one
    // action is the defect this composition exists to prevent, so the count
    // is asserted rather than merely its presence.
    expect(screen.getAllByText('Lesson Two')).toHaveLength(1);

    // The state a lesson is in is carried by its own row, and the row is the
    // only control: no nested "Start"/"Continue" button inside a button.
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lesson Two/ })).toHaveAccessibleName(/start here/i);

    // Passed lesson is clickable; locked lesson is not.
    const passedButton = screen.getByRole('button', { name: /Lesson One/ });
    expect(passedButton).toBeEnabled();
    const lockedButton = screen.getByRole('button', { name: /Lesson Three/ });
    expect(lockedButton).toBeDisabled();

    // A locked adventure is not an expand trigger, and it says it is locked
    // in its accessible name rather than in a word painted over the artwork.
    expect(screen.queryByRole('button', { name: /Locked Adventure/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Locked Adventure, Locked/)).toBeInTheDocument();

    // Exactly ONE way forward on the page, and it is the floating pill.
    expect(screen.getByRole('button', { name: 'My lesson' })).toBeInTheDocument();
  });

  it('shows an error banner when the tree fetch fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND', message: 'No such course' } });
    renderCoursePage();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find that.");
  });

  it('shows the empty state when a course has no adventures yet', async () => {
    mockedApi.mockResolvedValueOnce({
      data: { ...fixtureTree, adventures: [], nextLessonId: null },
      error: null,
    });
    renderCoursePage();

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('turns playable territory topics into direct lesson links', () => {
    render(
      <MemoryRouter>
        <TerritoryView tree={fixtureTree} locale="en-US" courseSlug="money-basics" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /What is money/ })).toHaveAttribute('href', '/learn/lesson/lesson-current');
  });
});
