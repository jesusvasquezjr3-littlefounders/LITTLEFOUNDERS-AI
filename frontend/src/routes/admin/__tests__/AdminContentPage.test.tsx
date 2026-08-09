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
  description: 'A practical introduction to money.',
  createdAt: '2026-07-12T00:00:00Z',
  adventureCount: 1,
  sagaCount: 1,
  topicCount: 1,
  lessonCount: 1,
  lessonsByStatus: { review: 1 },
};

const REVIEW_LESSON = {
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'needs-and-wants',
  title: 'Needs and Wants',
  status: 'review',
  courseTitle: 'Money Basics',
  subject: 'money',
  adventureTitle: 'The Money Trail',
  sagaTitle: 'First Steps',
  topicTitle: 'Needs and Wants',
  difficulty: 2,
  xpTotal: 20,
  estimatedMinutes: 8,
  createdAt: '2026-07-13T00:00:00Z',
  locales: ['en-US', 'es-MX'],
};

const LESSON_DETAIL = {
  ...REVIEW_LESSON,
  documents: [
    {
      locale: 'en-US',
      schemaVersion: 1,
      audio: {},
      document: {
        schema_version: 1,
        meta: { slug: 'needs-and-wants', title: 'Needs and Wants', locale: 'en-US', subject: 'money', estimated_minutes: 8, objectives: [], cast: [] },
        scoring: { pass_threshold: 70, hint_penalty_pct: 0, max_attempts: 3, hearts: null },
        segments: [],
      },
    },
  ],
};

function apiOk<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

function apiDefault(path: string) {
  if (path.startsWith('/admin/content') && !path.includes('/status')) {
    return apiOk({ courses: [COURSE], summary: { courses: { total: 1, published: 0, draft: 1, archived: 0 }, lessons: { total: 1, published: 0, review: 1, draft: 0, archived: 0 } } });
  }
  if (path.startsWith('/admin/moderation')) {
    return apiOk({ lessons: [], total: 0 });
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

describe('AdminContentPage — human review surfaces', () => {
  it('opens a course inspector with hierarchy and readiness metadata', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getAllByText('admin.content.viewDetail')[0]!);
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.content.courseDetailTitle');
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.content.hierarchySummary');
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.content.lessonBreakdown');
  });

  it('opens the lesson inspector with a render action and review metadata', async () => {
    mockApi.mockImplementation((path: string) => {
      if (path === '/admin/content') return apiOk({ courses: [COURSE], summary: { courses: { total: 1, published: 0, draft: 1, archived: 0 }, lessons: { total: 1, published: 0, review: 1, draft: 0, archived: 0 } } });
      if (path === '/admin/moderation') return apiOk({ lessons: [REVIEW_LESSON], total: 1 });
      if (path === `/admin/moderation/${REVIEW_LESSON.id}`) return apiOk(LESSON_DETAIL);
      return apiOk({});
    });
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByRole('tab', { name: /admin\.content\.tabs\.lessons/ }));
    expect(screen.getByText('Needs and Wants')).toBeInTheDocument();
    fireEvent.click(screen.getByText('admin.moderation.preview'));
    await flushPromises();
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.moderation.renderTitle');
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.moderation.renderLesson');
    expect(screen.getByRole('dialog')).toHaveTextContent('admin.content.difficulty');
  });
});
