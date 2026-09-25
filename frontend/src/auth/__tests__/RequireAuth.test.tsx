import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../RequireAuth';

const auth = vi.hoisted(() => ({ value: { session: null, accountDeletion: null } as { session: unknown; accountDeletion: unknown } }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../RequireAgeScreen', () => ({ RequireAgeScreen: ({ children }: { children: ReactNode }) => <>{children}</> }));

function LoginDestination() {
  const state = useLocation().state as { from: string; returnState: unknown };
  return <output>{state.from}{JSON.stringify(state.returnState)}</output>;
}

describe('protected deep links', () => {
  it('preserves query parameters and fragments when sending a visitor to login', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/tasks', search: '?kidId=learner-2', hash: '#pending', state: { courseSlug: 'money-basics' } }]}>
      <Routes>
        <Route path="/tasks" element={<RequireAuth><div>Private tasks</div></RequireAuth>} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByText('/tasks?kidId=learner-2#pending{"courseSlug":"money-basics"}')).toBeInTheDocument();
    expect(screen.queryByText('Private tasks')).not.toBeInTheDocument();
  });
});

describe('a scheduled self-service deletion (E.6)', () => {
  it('sends a signed-in account with a pending deletion to the deletion screen instead of the app', async () => {
    auth.value = { session: { user: { id: 'u' } }, accountDeletion: { status: 'pending', scheduledFor: '2026-10-08T00:00:00.000Z' } };
    render(<MemoryRouter initialEntries={['/tasks']}>
      <Routes>
        <Route path="/tasks" element={<RequireAuth><div>Private tasks</div></RequireAuth>} />
        <Route path="/account-deletion" element={<div>Deletion screen</div>} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByText('Deletion screen')).toBeInTheDocument();
    expect(screen.queryByText('Private tasks')).not.toBeInTheDocument();
  });

  it('lets an account with no deletion through', async () => {
    auth.value = { session: { user: { id: 'u' } }, accountDeletion: null };
    render(<MemoryRouter initialEntries={['/tasks']}>
      <Routes>
        <Route path="/tasks" element={<RequireAuth><div>Private tasks</div></RequireAuth>} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByText('Private tasks')).toBeInTheDocument();
  });
});
