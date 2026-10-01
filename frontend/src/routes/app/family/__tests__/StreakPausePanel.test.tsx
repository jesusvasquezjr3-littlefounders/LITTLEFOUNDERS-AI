import { enterDate, readDate } from '../../../../rebuild/test/dateParts';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StreakPausePanel } from '../LearningPanels';

/*
 * B.21 (S05.3e): the Family Hub host for the verified parent's holiday pause.
 * It reads the child's streak on the child's own route, sends the pause and
 * its end to Core with the session token, and shows a lost link as no access.
 * Core (and the database function) is the enforcing boundary.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

const streak = (over = {}) => ({ model: 'rest-days-v1', status: 'open', current: 4, best: 12, daysPracticed: 41, restDaysLeft: 1, lastActiveDate: '2026-09-22', pause: null, ...over });
beforeEach(() => mockApi.mockReset());

it('reads the child\'s streak, then pauses it through Core with the session token', async () => {
  mockApi
    .mockResolvedValueOnce({ data: { streak: streak() }, error: null })
    .mockResolvedValueOnce({ data: { streak: streak({ status: 'paused', pause: { startsOn: '2026-09-24', endsOn: '2026-09-30' } }) }, error: null });
  render(<StreakPausePanel kidUserId="kid-1" token="session" />);
  expect(await screen.findByText('Streak: 4 days. Best: 12.')).toBeVisible();
  expect(mockApi.mock.calls[0]![0]).toMatch(/^\/family\/learning\/kids\/kid-1\/streak\?local_date=\d{4}-\d{2}-\d{2}$/);
  const today = readDate('First day');
  enterDate('Last day', today);
  fireEvent.click(screen.getByRole('button', { name: 'Pause streak' }));
  expect(await screen.findByText('Pause saved.')).toBeVisible();
  expect(mockApi.mock.calls[1]).toEqual(['/family/learning/kids/kid-1/streak-pause', {
    token: 'session', method: 'PUT', body: { starts_on: today, ends_on: today, local_date: today },
  }]);
  expect(screen.getByRole('button', { name: 'End pause' })).toBeVisible();
});

it('shows a lost link as no access and never offers the form', async () => {
  mockApi.mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND' } });
  render(<StreakPausePanel kidUserId="kid-2" token="session" />);
  expect(await screen.findByText('This child is no longer linked to you.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Pause streak' })).toBeNull();
});

it('refuses a malformed streak and offers a retry', async () => {
  mockApi.mockResolvedValueOnce({ data: { streak: { ...streak(), status: 'lost' } }, error: null })
    .mockResolvedValueOnce({ data: { streak: streak() }, error: null });
  render(<StreakPausePanel kidUserId="kid-3" token="session" />);
  expect(await screen.findByText('Could not load the streak.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Streak: 4 days. Best: 12.')).toBeVisible();
});
