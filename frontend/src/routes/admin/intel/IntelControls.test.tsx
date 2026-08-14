import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntelExportCard, IntelPeriodPicker, StaffExclusionNote, intelWindowQuery } from './IntelControls';

const { mockAdminData, mockGetToken, mockFetch } = vi.hoisted(() => ({
  mockAdminData: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
  mockFetch: vi.fn(),
}));

vi.mock('../adminShared', async () => {
  const actual = await vi.importActual<typeof import('../adminShared')>('../adminShared');
  return { ...actual, useAdminData: mockAdminData };
});
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && 'share' in values ? `${key} ${String(values.share)}` : key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

beforeEach(() => {
  // restoreAllMocks() in afterEach clears the hoisted implementation, so the
  // token has to be re-armed or the request goes out unauthenticated.
  mockGetToken.mockResolvedValue('fake-token');
  mockAdminData.mockReturnValue({ data: { state: 'loading' }, reload: vi.fn() });
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['x']),
    headers: { get: () => 'attachment; filename="intel.csv"' },
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('intelWindowQuery', () => {
  it('serializes a preset and an explicit range the way dataintel parses them', () => {
    expect(intelWindowQuery({ days: 30 })).toBe('days=30');
    expect(intelWindowQuery({ days: 30, from: '2026-06-01', to: '2026-06-30' })).toBe(
      'days=30&from=2026-06-01&to=2026-06-30',
    );
  });

  it('ignores a half-specified range rather than sending a broken one', () => {
    // The backend rejects from-without-to; not sending it keeps the console on
    // the preset it is actually displaying.
    expect(intelWindowQuery({ days: 7, from: '2026-06-01' })).toBe('days=7');
  });
});

describe('IntelPeriodPicker', () => {
  it('emits a preset selection', async () => {
    const onChange = vi.fn();
    render(<IntelPeriodPicker selection={{ days: 30 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /admin\.intel\.filters\.period/ }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'admin.intel.filters.days90' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: 'admin.intel.filters.days90' }));
    expect(onChange).toHaveBeenCalledWith({ days: 90 });
  });

  it('emits a custom range with a day span matching the dates', async () => {
    const onChange = vi.fn();
    render(<IntelPeriodPicker selection={{ days: 30, from: '2026-06-01', to: '2026-06-30' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'admin.analytics.customApply' }));
    // 1 June to 30 June inclusive is 30 days, so week-grained views derived
    // from `days` stay consistent with the range beside them.
    expect(onChange).toHaveBeenCalledWith({ days: 30, from: '2026-06-01', to: '2026-06-30' });
  });
});

describe('StaffExclusionNote', () => {
  it('says nothing until it knows, rather than implying nothing was filtered', () => {
    const { container } = render(<StaffExclusionNote windowQuery="days=30" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the removed share so a stalled filter is visible', () => {
    mockAdminData.mockReturnValue({
      data: {
        state: 'ready',
        data: {
          windowDays: 30,
          includedEvents: 367,
          excludedEvents: 3502,
          excludedShare: 0.905,
          staffUsers: 2,
          includedAttempts: 0,
          excludedAttempts: 24,
          lastStaffEventAt: '2026-08-13T00:00:00.000Z',
        },
      },
      reload: vi.fn(),
    });
    render(<StaffExclusionNote windowQuery="days=30" />);
    expect(screen.getByText(/admin\.intel\.staffExcluded\.events/)).toHaveTextContent('90.5%');
  });
});

describe('IntelExportCard', () => {
  it('downloads the active window, not a default one', async () => {
    render(<IntelExportCard selection={{ days: 90, from: '2026-06-01', to: '2026-06-30' }} />);
    fireEvent.click(screen.getByRole('button', { name: /admin\.intel\.export\.csv/ }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/intel-export.csv?days=90&from=2026-06-01&to=2026-06-30'),
        { headers: { Authorization: 'Bearer fake-token' } },
      ),
    );
  });

  it('surfaces a failed export instead of downloading an empty file', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'DATA_UNAVAILABLE' } }) });
    render(<IntelExportCard selection={{ days: 30 }} />);
    fireEvent.click(screen.getByRole('button', { name: /admin\.intel\.export\.xlsx/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('errors.api.DATA_UNAVAILABLE'));
  });
});
