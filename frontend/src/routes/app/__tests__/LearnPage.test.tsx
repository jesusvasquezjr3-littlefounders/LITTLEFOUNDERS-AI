import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { LearnPage } from '../LearnPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken, profile: { display_name: 'Alex Rivera' } }) };
});
vi.mock('@/components/characters/control/CharacterActor', () => ({ default: () => <div aria-hidden="true" /> }));
vi.mock('@/components/characters/DinaCharacter', () => ({ DinaCharacter: () => <div aria-hidden="true" /> }));
vi.mock('@/routes/app/learn/LearnerNarrativePanel', () => ({ LearnerNarrativePanel: () => null }));
vi.mock('@/routes/app/learn/RegisterGraduationPanel', () => ({ RegisterGraduationPanel: () => null }));

const mockedApi = vi.mocked(api);

beforeEach(async () => {
  mockedApi.mockReset();
  await i18n.changeLanguage('en-US');
});

const CATALOG = [
  ['course-business', 'first-business', 'First Business'],
  ['course-money', 'money-basics', 'Money Basics'],
  ['course-financial-education', 'financial-education', 'Financial Education'],
  ['course-saving', 'saving-superpowers', 'Saving Superpowers'],
  ['course-lemonade', 'first-lemonade-stand', 'First Lemonade Stand'],
  ['course-entrepreneurship', 'entrepreneurship', 'Entrepreneurship'],
  ['course-investing', 'investing', 'Investing'],
] as const;

function courses(count: number) {
  return CATALOG.slice(0, count).map(([id, slug, title]) => ({
    id,
    slug,
    title: { 'en-US': title },
    lessonCount: 4,
    progress: { passed: 0, total: 4, pct: 0 },
  }));
}

/*
 * Answer BY URL, not by call order. The page makes a second, dependent request
 * for the featured course's tree (the chapter list), and a `mockResolvedValueOnce`
 * left that one returning undefined — which the page now survives, but which
 * also meant the test was quietly exercising a failure path rather than the
 * screen a learner sees.
 */
function renderWith(count: number) {
  mockedApi.mockImplementation(async (path: string) => {
    if (path.endsWith('/tree')) return { data: null, error: { code: 'NOT_FOUND', message: 'no tree in this fixture' } };
    return { data: { courses: courses(count) }, error: null };
  });
  return render(
    <MemoryRouter>
      <LearnPage />
    </MemoryRouter>,
  );
}

describe('LearnPage', () => {
  it('keeps the active learning track filter readable and exposes its state', async () => {
    renderWith(7);

    const allTracks = await screen.findByRole('button', { name: /All Tracks/ });
    const entrepreneurship = screen.getByRole('button', { name: /Entrepreneurship/ });

    expect(allTracks).toHaveAttribute('aria-pressed', 'true');
    expect(allTracks).toHaveClass('bg-accent', 'text-on-accent');
    expect(allTracks).not.toHaveClass('bg-secondary');

    fireEvent.click(entrepreneurship);

    expect(entrepreneurship).toHaveAttribute('aria-pressed', 'true');
    expect(allTracks).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByText('First Business').length).toBeGreaterThan(0);
    expect(screen.queryByText('Money Basics')).not.toBeInTheDocument();
  });

  it('hides the track filter while the whole catalog already fits on one screen', async () => {
    const view = renderWith(3);

    expect(await screen.findByText('Money Basics')).toBeInTheDocument();
    // Four controls to remove one row is not a filter, it is furniture.
    expect(screen.queryByRole('button', { name: /All Tracks/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    // Every course still reaches the learner.
    expect(screen.getAllByText('First Business').length).toBeGreaterThan(0);
    expect(view.container.querySelector('.lf-course-badge')).toBeInTheDocument();
  });

  it('says each course once: art, title, and one pair of numbers', async () => {
    renderWith(3);

    /*
     * ONCE, and this is the assertion the redesign actually changed. It used
     * to expect TWO — a hero card naming the featured course and a grid card
     * naming it again — under a test whose own name said "once". The carousel
     * replaced both with one card per course, so the number now agrees with
     * the sentence. Nothing else echoes it: no category caption for a filter
     * that is not on screen, no lesson-count badge repeating the progress
     * total, no per-card CTA naming the card it sits in.
     */
    expect(await screen.findAllByText('First Business')).toHaveLength(1);
    expect(screen.queryByText('4 lessons')).not.toBeInTheDocument();
    expect(screen.queryByText('Financial Literacy')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Course Map')).not.toBeInTheDocument();
  });

  it('explains when the featured course could not load instead of silently omitting it', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path.endsWith('/tree')) return { data: null, error: { code: 'NOT_FOUND', message: 'no tree in this fixture' } };
      return {
        data: {
          courses: courses(1),
          unavailableFeaturedCourse: {
            slug: 'money-basics',
            title: { 'en-US': 'Money Basics' },
          },
        },
        error: null,
      };
    });
    render(<MemoryRouter><LearnPage /></MemoryRouter>);

    expect(await screen.findByRole('status')).toHaveTextContent("We couldn't load this right now");
    expect(screen.getByRole('status')).toHaveTextContent('Money Basics is unavailable for the moment.');
  });
});
