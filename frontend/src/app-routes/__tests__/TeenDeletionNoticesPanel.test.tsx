import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import { TeenDeletionNoticesPanel } from '../TeenDeletionNoticesPanel';

/*
 * GAP-FIX-R2 (owner review D-14 (b)): the Tutor is told, on /family, that a
 * linked teen asked to delete their own account. Notify only: the name, the
 * date and that the teen can keep it by signing in; no control. Nothing shows
 * when there is nothing to tell, and a failed or malformed read says so.
 */

const mocks = vi.hoisted(() => ({ api: vi.fn(), locale: 'en-US' }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: mocks.locale, language: mocks.locale } }) }));

const NOTICE = { id: '99999999-9999-4999-8999-999999999999', teenUserId: '56565656-5656-4565-8565-565656565656', displayName: 'Mateo',
  scheduledFor: '2026-10-12T12:00:00.000Z', notifiedAt: '2026-09-28T12:00:00.000Z' };
const copy = en.familyDeletionNotices;

beforeEach(() => { mocks.api.mockReset(); mocks.locale = 'en-US'; });

describe('TeenDeletionNoticesPanel (D-14 (b))', () => {
  it('tells the Tutor the teen\'s name, the date and how the teen keeps the account, with no control', async () => {
    mocks.api.mockResolvedValue({ data: { notices: [NOTICE] }, error: null });
    const { container } = render(<TeenDeletionNoticesPanel token="jwt" />);
    expect(await screen.findByRole('heading', { name: copy.title })).toBeVisible();
    expect(screen.getByText('Mateo asked to delete their account. Deletion date: October 12, 2026.')).toBeVisible();
    expect(screen.getByText('Mateo can keep it by signing in before then.')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-deletion-notice]')).not.toBeNull();
    expect(mocks.api).toHaveBeenCalledWith('/family-hub/deletion-notices', { token: 'jwt' });
  });

  it('speaks the Tutor\'s language', async () => {
    mocks.locale = 'es-MX';
    mocks.api.mockResolvedValue({ data: { notices: [NOTICE] }, error: null });
    render(<TeenDeletionNoticesPanel token="jwt" />);
    expect(await screen.findByRole('heading', { name: es.familyDeletionNotices.title })).toBeVisible();
    expect(screen.getByText(/^Mateo pidió borrar su cuenta\. Se borra el 12 de octubre de 2026\.$/)).toBeVisible();
  });

  it('shows nothing when no linked teen asked (or the teen kept the account)', async () => {
    mocks.api.mockResolvedValue({ data: { notices: [] }, error: null });
    const { container } = render(<TeenDeletionNoticesPanel token="jwt" />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
  });

  it('says a failed or malformed read failed, and tries again on request', async () => {
    mocks.api.mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } })
      .mockResolvedValueOnce({ data: { notices: [{ ...NOTICE, scheduledFor: 'soon' }] }, error: null })
      .mockResolvedValueOnce({ data: { notices: [NOTICE] }, error: null });
    render(<TeenDeletionNoticesPanel token="jwt" />);
    expect(await screen.findByText(copy.failed)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(copy.failed)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    expect(await screen.findByText(/Mateo asked to delete their account/)).toBeVisible();
  });

  it('asks nothing without a session', () => {
    const { container } = render(<TeenDeletionNoticesPanel token={null} />);
    expect(container.innerHTML).toBe('');
    expect(mocks.api).not.toHaveBeenCalled();
  });
});
