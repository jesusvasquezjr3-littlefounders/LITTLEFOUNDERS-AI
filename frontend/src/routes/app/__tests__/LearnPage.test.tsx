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

describe('LearnPage', () => {
  it('keeps the active learning track filter readable and exposes its state', async () => {
    mockedApi.mockResolvedValueOnce({
      data: {
        courses: [
          {
            id: 'course-business',
            slug: 'first-business',
            title: { 'en-US': 'First Business' },
            lessonCount: 4,
            progress: { passed: 0, total: 4, pct: 0 },
          },
          {
            id: 'course-money',
            slug: 'money-basics',
            title: { 'en-US': 'Money Basics' },
            lessonCount: 4,
            progress: { passed: 0, total: 4, pct: 0 },
          },
        ],
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    );

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
});
