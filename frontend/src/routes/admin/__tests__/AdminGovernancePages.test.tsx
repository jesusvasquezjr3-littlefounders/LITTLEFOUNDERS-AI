import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminAuditPage } from '../AdminAuditPage';
import { AdminRolesPage } from '../AdminRolesPage';

const { mockApi, mockGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const AUDIT_ENTRY = {
  id: 42,
  actorId: USER_ID,
  action: 'admin.roles.grant',
  subject: USER_ID,
  detail: { role: 'admin' },
  createdAt: '2026-08-09T12:00:00Z',
};
const HOLDER = {
  userId: USER_ID,
  displayName: 'Staff User',
  username: 'staff_user',
  locale: 'en-US',
  createdAt: '2026-07-01T12:00:00Z',
  roles: ['admin'],
  permissions: ['manage_content'],
  roleAssignments: [{ role: 'admin', grantedAt: '2026-08-01T12:00:00Z', grantedBy: null }],
  permissionAssignments: [{ permission: 'manage_content', grantedAt: '2026-08-02T12:00:00Z', grantedBy: USER_ID }],
  lastChangedAt: '2026-08-02T12:00:00Z',
};

vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ roles: ['superadmin'], getToken: mockGetToken }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string; role?: string }) => {
      if (options?.name || options?.role) return `${key}:${options.name ?? options.role}`;
      return key;
    },
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

function apiOk<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

beforeEach(() => {
  mockApi.mockImplementation((path: string) => {
    if (path.startsWith('/admin/audit')) return apiOk({ entries: [AUDIT_ENTRY], total: 101, limit: 50, offset: 0 });
    if (path === '/admin/roles') return apiOk({ holders: [HOLDER], summary: { totalHolders: 1, totalRoleAssignments: 1, totalPermissionAssignments: 1, roleCounts: { admin: 1 }, permissionCounts: { manage_content: 1 }, lastChangedAt: HOLDER.lastChangedAt } });
    if (path.startsWith('/admin/roles/candidates')) return apiOk({ candidates: [{ userId: '22222222-2222-4222-8222-222222222222', displayName: 'Candidate User', username: 'candidate', locale: 'es-MX', createdAt: null, roles: [] }] });
    return apiOk({});
  });
  mockGetToken.mockResolvedValue('fake-token');
});

describe('Admin governance pages', () => {
  it('uses the exact audit total, pagination, and expanded read-only detail', async () => {
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('admin.audit.totalEvents')).toBeInTheDocument());
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('admin.audit.rangeSummary')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('admin.audit.viewDetail')[0]!);
    expect(screen.getByText('admin.audit.immutableRecord')).toBeInTheDocument();
    expect(screen.getByText('admin.audit.readOnly')).toBeInTheDocument();
  });

  it('offers searchable role assignment and confirms a high-impact revoke', async () => {
    render(<MemoryRouter><AdminRolesPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('admin.roles.roleAssignments')).toBeInTheDocument());

    fireEvent.click(screen.getByText('admin.roles.findUser'));
    fireEvent.change(screen.getByLabelText('admin.roles.candidateSearchLabel'), { target: { value: 'Candidate' } });
    await waitFor(() => expect(screen.getAllByText('Candidate User').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('admin.roles.useUser')[0]!);
    expect(screen.getByDisplayValue('22222222-2222-4222-8222-222222222222')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('admin.roles.manageAccess')[0]!);
    expect(screen.getByText('admin.roles.assignmentHistory')).toBeInTheDocument();
    const revokeButton = screen.getAllByRole('button', { name: /roles\.admin/ }).find((button) => button.className.includes('bg-error-soft'));
    expect(revokeButton).toBeDefined();
    fireEvent.click(revokeButton!);
    expect(screen.getByText('admin.roles.confirmRevokeTitle')).toBeInTheDocument();
    expect(screen.getByText('admin.roles.confirmRevoke')).toBeInTheDocument();
  });
});
