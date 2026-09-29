import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoopGoalsConsentPanel } from '@/app-routes/CoopGoalsConsentPanel';
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
beforeEach(() => mockApi.mockReset());

// OD-3 Option B: a self-registered teen's goals together are their own; the Tutor's card says so and reads nothing.
it('tells the Tutor a self-registered teen manages goals together, with no read and no switch', () => {
  render(<CoopGoalsConsentPanel kidUserId="teen" token="session" kidName="Ana" selfManaged />);
  expect(screen.getByText('Ana manages goals together on their own account.')).toBeVisible();
  expect(screen.queryByRole('switch')).toBeNull();
  expect(mockApi).not.toHaveBeenCalled();
});

it('reads the opt-in for a parent-created child', async () => {
  mockApi.mockResolvedValue({ data: { ageFits: true, enabled: false, openGoals: 0 }, error: null });
  render(<CoopGoalsConsentPanel kidUserId="kid" token="session" kidName="Sofía" />);
  expect(await screen.findByRole('switch')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/family/coop-goals/kids/kid', { token: 'session' });
});
