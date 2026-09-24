import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';

const auth = vi.hoisted(() => ({ session: { user: { id: 'synthetic' } }, roles: ['parent'], meLoaded: true, analyticsEnabled: false }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/family' }) }));
let AnalyticsScripts: ComponentType;
beforeAll(async () => {
  vi.stubEnv('VITE_UMAMI_SRC', 'https://metrics.example.invalid/script.js');
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'synthetic');
  AnalyticsScripts = (await import('./analytics')).AnalyticsScripts;
});
afterAll(() => vi.unstubAllEnvs());
afterEach(() => { vi.unstubAllGlobals(); document.getElementById('lf-umami')?.remove(); delete window.umami; });
it('does not mount before Core permits analytics and ejects after revocation', async () => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { excluded: false, degraded: false } }) }));
  const track = vi.fn(); window.umami = { track };
  auth.analyticsEnabled = false;
  const view = render(<AnalyticsScripts />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(document.getElementById('lf-umami')).toBeNull();
  auth.analyticsEnabled = true; view.rerender(<AnalyticsScripts />);
  await waitFor(() => expect(document.getElementById('lf-umami')).not.toBeNull());
  const beforeRevocation = track.mock.calls.length;
  auth.analyticsEnabled = false; view.rerender(<AnalyticsScripts />);
  await waitFor(() => expect(document.getElementById('lf-umami')).toBeNull());
  expect(track).toHaveBeenCalledTimes(beforeRevocation);
});
