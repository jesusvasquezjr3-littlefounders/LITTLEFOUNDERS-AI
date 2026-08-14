import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExclusionsCard } from './ExclusionsCard';

const { mockAdminData, mockMutate, mockReload } = vi.hoisted(() => ({
  mockAdminData: vi.fn(),
  mockMutate: vi.fn(),
  mockReload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../adminShared', async () => {
  const actual = await vi.importActual<typeof import('../adminShared')>('../adminShared');
  return { ...actual, useAdminData: mockAdminData, useAdminMutation: () => mockMutate };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && typeof values === 'object' && 'count' in values ? `${key} ${String(values.count)}` : key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

const READY = {
  state: 'ready' as const,
  data: {
    self: { ip: '203.0.113.7', excluded: false },
    active: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        network: '198.51.100.0/24',
        label: 'Office',
        reason: null,
        created_by: null,
        created_at: '2026-08-01T00:00:00.000Z',
        revoked_at: null,
        revoked_by: null,
      },
    ],
    suggestions: [
      {
        address: '203.0.113.7',
        userId: 'u1',
        displayName: 'Ada',
        firstSeenAt: '2026-08-01T00:00:00.000Z',
        lastSeenAt: '2026-08-12T00:00:00.000Z',
        hits: 12,
      },
    ],
    coveredAddresses: [],
    windowDays: 30,
  },
};

beforeEach(() => {
  mockMutate.mockReset().mockResolvedValue({ data: {}, error: null });
  mockAdminData.mockReturnValue({ data: READY, reload: mockReload });
});

describe('ExclusionsCard', () => {
  it('excludes the current device without asking the operator to know its address', async () => {
    render(<ExclusionsCard />);
    fireEvent.click(screen.getByRole('button', { name: /excludeSelf/ }));
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith('/admin/analytics/exclusions/self', expect.any(Object), 'POST'),
    );
  });

  it('offers a detected staff address for one-click exclusion', async () => {
    render(<ExclusionsCard />);
    // Appears twice by design: as "your device" and as a detected sighting.
    expect(screen.getAllByText('203.0.113.7', { selector: 'p.lf-number' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /exclusions\.exclude$/ })[0]!);
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(
        '/admin/analytics/exclusions',
        { network: '203.0.113.7', label: 'Ada' },
        'POST',
      ),
    );
  });

  it('revokes through DELETE so the audit trail survives', async () => {
    render(<ExclusionsCard />);
    fireEvent.click(screen.getByRole('button', { name: /revoke/ }));
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(
        '/admin/analytics/exclusions/33333333-3333-4333-8333-333333333333',
        undefined,
        'DELETE',
      ),
    );
  });

  it('states that exclusion does not rewrite history', () => {
    render(<ExclusionsCard />);
    expect(screen.getByText('admin.analytics.exclusions.forwardOnly')).toBeInTheDocument();
  });

  it('shows a failed read as unavailable, never as an empty list', () => {
    mockAdminData.mockReturnValue({ data: { state: 'error', code: 'DATA_UNAVAILABLE' }, reload: mockReload });
    render(<ExclusionsCard />);
    // The active/detected lists must not render at all: "no exclusions" and
    // "we could not check" would otherwise look identical on screen.
    expect(screen.queryByText(/exclusions\.activeEmpty/)).toBeNull();
    expect(screen.queryByText(/exclusions\.detectedEmpty/)).toBeNull();
    expect(screen.getByText('errors.api.DATA_UNAVAILABLE')).toBeInTheDocument();
  });

  it('surfaces a rejected exclusion instead of pretending it worked', async () => {
    mockMutate.mockResolvedValue({ data: null, error: { code: 'CONFLICT', message: 'already covered' } });
    render(<ExclusionsCard />);
    fireEvent.click(screen.getByRole('button', { name: /excludeSelf/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('errors.api.CONFLICT'));
    expect(mockReload).not.toHaveBeenCalledWith(expect.anything());
  });
});
