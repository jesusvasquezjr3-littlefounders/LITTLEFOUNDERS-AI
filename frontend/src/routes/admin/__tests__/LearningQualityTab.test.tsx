import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n';
import { learningQualityFixture } from '@/rebuild/learning/learningQualityFixtures';
import { LearningQualityTab } from '../LearningQualityTab';

const { mockGetToken, mockApi } = vi.hoisted(() => ({
  mockGetToken: vi.fn().mockResolvedValue('staff-token'),
  mockApi: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

beforeEach(async () => {
  mockApi.mockReset();
  await i18n.changeLanguage('en-US');
});

describe('S05.3d staff Learning Quality tab', () => {
  it('reads Core’s report with the staff token and records a decision through Core', async () => {
    mockApi.mockImplementation(async (path: string) => path === '/admin/content/learning-quality'
      ? { data: learningQualityFixture(), error: null }
      : { data: { id: 'bbbbbbbb-0000-4000-8000-000000000001', status: 'resolved' }, error: null });
    render(<LearningQualityTab />);
    expect(await screen.findByText('Practice should land at 70-85% first-try success per lesson.')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/admin/content/learning-quality', { token: 'staff-token' });

    const review = screen.getByRole('form');
    fireEvent.click(within(review).getByRole('button', { name: 'Make harder' }));
    fireEvent.change(within(review).getByLabelText('Decision note'), { target: { value: 'Add a transfer item and remove the hint.' } });
    fireEvent.click(within(review).getByRole('button', { name: 'Record decision' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/admin/content/learning-quality/reviews/bbbbbbbb-0000-4000-8000-000000000001/resolve', {
      method: 'POST', token: 'staff-token', body: { decision: 'make_harder', note: 'Add a transfer item and remove the hint.' },
    }));
  });

  it('maps an already-resolved review to the conflict message and a refused read to the error state', async () => {
    mockApi.mockImplementation(async (path: string) => path === '/admin/content/learning-quality'
      ? { data: learningQualityFixture(), error: null }
      : { data: null, error: { code: 'REVIEW_RESOLVED', message: 'resolved' } });
    const { unmount } = render(<LearningQualityTab />);
    const review = await screen.findByRole('form');
    fireEvent.click(within(review).getByRole('button', { name: 'Keep as is' }));
    fireEvent.change(within(review).getByLabelText('Decision note'), { target: { value: 'Still watching this one.' } });
    fireEvent.click(within(review).getByRole('button', { name: 'Record decision' }));
    expect(await within(review).findByRole('alert')).toHaveTextContent('Someone already decided this review.');
    unmount();

    mockApi.mockResolvedValue({ data: null, error: { code: 'FORBIDDEN', message: 'no' } });
    render(<LearningQualityTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load learning quality.');
  });
});
