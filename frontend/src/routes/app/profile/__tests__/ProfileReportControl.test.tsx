import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileReportControl } from '../ProfileReportControl';

/*
 * E.3's report control: a predefined category plus an optional note capped
 * at 140 characters, the same cap Core enforces. The reporter is always the
 * session user — the control never names one. A failure keeps the form so
 * nothing typed is lost; success collapses into a short confirmation.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('session') }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'profile.report.action': 'Report',
      'profile.report.title': 'Report this profile',
      'profile.report.categoryLabel': 'What is happening?',
      'profile.report.noteLabel': 'Tell us more (optional)',
      'profile.report.submit': 'Send report',
      'profile.report.cancel': 'Cancel',
      'profile.report.sending': 'Sending…',
      'profile.report.sent': 'Report sent. Thank you for keeping LittleFounders safe.',
      'profile.report.failed': 'Could not send the report. Try again.',
      'profile.report.category.unwanted_contact': 'Unwanted contact',
      'profile.report.category.harassment': 'Harassment or bullying',
      'profile.report.category.inappropriate_content': 'Inappropriate content',
      'profile.report.category.impersonation': 'Pretending to be someone else',
      'profile.report.category.other': 'Something else',
    })[key] ?? key,
  }),
}));

beforeEach(() => mockApi.mockReset());

it('submits the selected category and trimmed note', async () => {
  mockApi.mockResolvedValue({ data: { reported: true }, error: null });
  render(<ProfileReportControl username="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  fireEvent.change(screen.getByLabelText('Tell us more (optional)'), { target: { value: '  keeps messaging me  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByText('Report sent. Thank you for keeping LittleFounders safe.')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/profiles/ana/report', {
    method: 'POST',
    token: 'session',
    body: { category: 'unwanted_contact', note: 'keeps messaging me' },
  });
});

it('sends no note key when the note is left empty', async () => {
  mockApi.mockResolvedValue({ data: { reported: true }, error: null });
  render(<ProfileReportControl username="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByRole('status')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/profiles/ana/report', {
    method: 'POST',
    token: 'session',
    body: { category: 'unwanted_contact', note: undefined },
  });
});

it('caps the note at 140 characters', () => {
  render(<ProfileReportControl username="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  const textarea = screen.getByLabelText('Tell us more (optional)');
  expect(textarea).toHaveAttribute('maxlength', '140');
});

it('keeps the form and the typed note when the report fails', async () => {
  mockApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL' } });
  render(<ProfileReportControl username="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  fireEvent.change(screen.getByLabelText('Tell us more (optional)'), { target: { value: 'still here' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the report. Try again.');
  expect(screen.getByLabelText('Tell us more (optional)')).toHaveValue('still here');
});

it('submits a different category when the user picks one', async () => {
  mockApi.mockResolvedValue({ data: { reported: true }, error: null });
  render(<ProfileReportControl username="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  fireEvent.change(screen.getByLabelText('What is happening?'), { target: { value: 'impersonation' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByRole('status')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/profiles/ana/report', expect.objectContaining({
    body: { category: 'impersonation', note: undefined },
  }));
});
