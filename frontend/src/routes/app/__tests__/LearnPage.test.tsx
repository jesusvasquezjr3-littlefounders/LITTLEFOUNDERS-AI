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

function renderWith(count: number) {
  mockedApi.mockResolvedValueOnce({ data: { courses: courses(count) }, error: null });
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

    // The resume card names the featured course, and its own card names it
    // again. Nothing else does: no category caption echoing the filter that
    // is not on screen, no lesson-count badge echoing the progress total,
    // no per-card CTA echoing the card it sits in.
    expect(await screen.findAllByText('First Business')).toHaveLength(2);
    expect(screen.queryByText('4 lessons')).not.toBeInTheDocument();
    expect(screen.queryByText('Financial Literacy')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Course Map')).not.toBeInTheDocument();
  });
});
