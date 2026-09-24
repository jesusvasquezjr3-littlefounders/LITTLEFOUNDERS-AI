import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../RequireAuth';

vi.mock('../AuthContext', () => ({ useAuth: () => ({ session: null }) }));

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
