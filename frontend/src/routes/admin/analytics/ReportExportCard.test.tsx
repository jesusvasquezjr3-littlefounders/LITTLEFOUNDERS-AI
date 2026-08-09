import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportExportCard } from './ReportExportCard';

const { mockGetToken, mockFetch } = vi.hoisted(() => ({
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
  mockFetch: vi.fn(),
}));

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => values?.audience ? `${key} ${values.audience}` : key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

beforeEach(() => {
  mockFetch.mockClear();
  mockGetToken.mockResolvedValue('fake-token');
  mockFetch.mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['pdf']),
    headers: { get: () => 'attachment; filename="report.pdf"' },
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ReportExportCard', () => {
  it('exports the selected report view with the active filter query', async () => {
    render(<ReportExportCard period="30d" filterQuery="&filters=encoded" />);

    fireEvent.click(screen.getByRole('button', { name: 'admin.analytics.reports.download' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/analytics/report.pdf?period=30d&audience=full&filters=encoded'),
      { headers: { Authorization: 'Bearer fake-token' } },
    ));
  });

  it('lets the admin change the report view before exporting', async () => {
    render(<ReportExportCard period="12mo" filterQuery="" />);
    fireEvent.click(screen.getByRole('button', { name: 'admin.analytics.reports.audienceLabel: admin.analytics.reports.audiences.full' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'admin.analytics.reports.audiences.marketing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: 'admin.analytics.reports.audiences.marketing' }));
    fireEvent.click(screen.getByRole('button', { name: 'admin.analytics.reports.download' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/analytics/report.pdf?period=12mo&audience=marketing'),
      expect.anything(),
    ));
  });
});
