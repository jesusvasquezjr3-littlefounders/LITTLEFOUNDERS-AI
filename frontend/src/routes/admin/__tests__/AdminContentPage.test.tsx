import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminContentPage } from '../AdminContentPage';

/* ------------------------------------------------------------------ */
/*  Mock helpers                                                       */
/* ------------------------------------------------------------------ */

const fakeToken = 'fake-token';

/** Stable-identity mocks hoisted so useCallback deps don't loop.
 *  vi.mock calls are hoisted above imports, so these MUST be vi.hoisted. */
const { mockGetToken, mockApi } = vi.hoisted(() => ({
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
  mockApi: vi.fn(),
}));

const COURSE = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'money-basics',
  title: 'Money Basics',
  subject: 'financial',
  status: 'draft',
  position: 1,
};

function apiOk<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

function apiDefault(path: string) {
  if (path.startsWith('/admin/content') && !path.includes('/status')) {
    return apiOk({ courses: [COURSE] });
  }
  if (path.startsWith('/admin/moderation')) {
    return apiOk({ lessons: [] });
  }
  return apiOk({});
}

mockApi.mockImplementation(apiDefault);

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/api', () => ({
  api: mockApi,
  BASE_URL: 'http://localhost:4000',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US', changeLanguage: () => new Promise(() => {}) },
  }),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    session: null,
    profile: null,
    roles: ['admin'],
    avatarOptions: {},
    meLoaded: true,
    login: vi.fn(),
    signup: vi.fn(),
    completeOAuth: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
    getToken: mockGetToken,
  }),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/content']}>
      <AdminContentPage />
    </MemoryRouter>,
  );
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The Table renders each row twice (mobile card + desktop table, §1.11), so
 * the publish action matches two nodes — click the first. */
function clickPublish() {
  const el = screen.getAllByText('admin.content.publish')[0];
  if (!el) throw new Error('publish action not rendered');
  fireEvent.click(el);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(apiDefault);
  mockGetToken.mockReset();
  mockGetToken.mockResolvedValue(fakeToken);
  vi.clearAllMocks();
});

describe('AdminContentPage — publish outcome', () => {
  it('surfaces the backend refusal code when a publish is blocked', async () => {
    mockApi.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'POST' && path.includes('/status')) {
        return Promise.resolve({
          data: null,
          error: { code: 'RELEASE_VERIFICATION_REQUIRED', message: 'Run Forge verify:course first.' },
        });
      }
      return apiDefault(path);
    });
    renderPage();
    await flushPromises();
    clickPublish();
    await flushPromises();
    // The refusal renders as the code's i18n key (errors.api.<CODE>, §1.6).
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('errors.api.RELEASE_VERIFICATION_REQUIRED');
  });

  it('shows no alert and reloads the course list when a publish succeeds', async () => {
    mockApi.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'POST' && path.includes('/status')) {
        return Promise.resolve({ data: { id: COURSE.id, status: 'published' }, error: null });
      }
      return apiDefault(path);
    });
    renderPage();
    await flushPromises();
    const listLoads = mockApi.mock.calls.filter(([p]) => p === '/admin/content').length;
    clickPublish();
    await flushPromises();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockApi.mock.calls.filter(([p]) => p === '/admin/content').length).toBe(listLoads + 1);
  });

  it('clears a previous refusal when the next action starts', async () => {
    let refuse = true;
    mockApi.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'POST' && path.includes('/status')) {
        return refuse
          ? Promise.resolve({ data: null, error: { code: 'RELEASE_ARCHIVED', message: 'Archived.' } })
          : Promise.resolve({ data: { id: COURSE.id, status: 'published' }, error: null });
      }
      return apiDefault(path);
    });
    renderPage();
    await flushPromises();
    clickPublish();
    await flushPromises();
    expect(screen.getByRole('alert')).toHaveTextContent('errors.api.RELEASE_ARCHIVED');
    refuse = false;
    clickPublish();
    await flushPromises();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
