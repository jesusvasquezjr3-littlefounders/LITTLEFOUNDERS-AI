import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminIntelPage } from '../AdminIntelPage';

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

function apiOk<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

function apiDefault(path: string) {
  if (path.startsWith('/admin/intel/metrics/summary')) {
    return apiOk({
      dau: 120, wau: 300, mau: 600, totalEvents: 4500,
      week1Retention: 0.42, activationRate: 0.31,
      medianTimeToValue: 48, peakDailyUsers: 200,
      adoption: [{ role: 'kid', routeClass: 'learn', users: 80, sessions: 300, events: 2000 }],
      anomalies: 0,
    });
  }
  if (path.startsWith('/admin/intel/metrics/trends')) {
    return apiOk([{ date: '2026-07-01', value: 100 }, { date: '2026-07-02', value: 115 }]);
  }
  if (path.startsWith('/admin/intel/anomalies/active')) {
    return apiOk([{ metric: 'dau', date: '2026-07-28', value: 50, expected: 120, zScore: -3.2, direction: 'down', severity: 'high', resolved: false }]);
  }
  if (path.startsWith('/admin/intel/funnels/activation')) {
    return apiOk([
      { step: 'Visit', stepOrder: 1, users: 500, conversionFromPrevious: null, dropoffFromPrevious: null },
      { step: 'Signup', stepOrder: 2, users: 200, conversionFromPrevious: 0.4, dropoffFromPrevious: 0.6 },
    ]);
  }
  if (path.startsWith('/admin/intel/retention/cohorts')) {
    return apiOk([{ cohortWeek: '2026-W26', weekOffset: 1, users: 30, cohortSize: 50, retentionPct: 0.6 }]);
  }
  if (path.startsWith('/admin/intel/lessons/dropoff')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/lessons/calibration')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/engagement/leaderboard')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/churn/risk')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/sessions/depth')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/experiments')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/alerts')) {
    return apiOk([]);
  }
  if (path.startsWith('/admin/intel/segments')) {
    return apiOk([]);
  }
  return apiOk([]);
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

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer,
    Line: () => null,
    BarChart: () => null,
    Bar: () => null,
    AreaChart: () => null,
    Area: () => null,
    PieChart: () => null,
    Pie: () => null,
    ComposedChart: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    LineChart: () => null,
  };
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/intel']}>
      <AdminIntelPage />
    </MemoryRouter>,
  );
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
  mockApi.mockReset();
  mockApi.mockImplementation(apiDefault);
  mockGetToken.mockReset();
  mockGetToken.mockResolvedValue(fakeToken);
  vi.clearAllMocks();
});

describe('AdminIntelPage — layout', () => {
  it('renders the admin page shell with title', async () => {
    renderPage();
    await flushPromises();
    expect(screen.getByRole('heading', { level: 1, name: 'admin.intel.title' })).toBeInTheDocument();
  });

  it('renders all nine tab buttons', async () => {
    renderPage();
    await flushPromises();
    expect(screen.getByText('admin.intel.tabs.home')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.trends')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.funnels')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.retention')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.segments')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.people')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.experiments')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.alerts')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.tabs.settings')).toBeInTheDocument();
  });

  it('renders page content', async () => {
    const { container } = renderPage();
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('renders the period filter label', async () => {
    renderPage();
    await flushPromises();
    expect(screen.getByText('admin.intel.filters.period')).toBeInTheDocument();
  });

  it('renders KPI cards on the home tab', async () => {
    renderPage();
    await flushPromises();
    expect(screen.getByText('admin.intel.trends.metricDau')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.trends.metricEvents')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.kpi.w1retention')).toBeInTheDocument();
    expect(screen.getByText('admin.intel.kpi.activation')).toBeInTheDocument();
  });
});

describe('AdminIntelPage — loading state', () => {
  it('shows loading overlay before data resolves', () => {
    mockApi.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});

describe('AdminIntelPage — error resilience', () => {
  it('renders home tab when some api calls fail', async () => {
    mockApi.mockRejectedValue(new Error('Network error'));
    renderPage();
    await flushPromises();
    // Component uses Promise.allSettled — individual failures are swallowed,
    // so the page still renders with null data rather than an error screen.
    expect(screen.getByText('admin.intel.trends.metricDau')).toBeInTheDocument();
  });
});

describe('AdminIntelPage — tab switching', () => {
  it('switches to Trends tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.trends'));
    expect(screen.getByText('admin.intel.trends.title')).toBeInTheDocument();
  });

  it('switches to Funnels tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.funnels'));
    expect(screen.getByText('admin.intel.funnel.title')).toBeInTheDocument();
  });

  it('switches to Retention tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.retention'));
    expect(screen.getByText('admin.intel.retention.cohortTitle')).toBeInTheDocument();
  });

  it('switches to Segments tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.segments'));
    expect(screen.getByText('admin.intel.segments.placeholder')).toBeInTheDocument();
  });

  it('switches to People tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.people'));
    expect(screen.getByText('admin.intel.people.leaderboardTitle')).toBeInTheDocument();
  });

  it('switches to Experiments tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.experiments'));
    expect(screen.getByText('admin.intel.experiments.empty')).toBeInTheDocument();
  });

  it('switches to Alerts tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.alerts'));
    expect(screen.getByText('admin.intel.alerts.empty')).toBeInTheDocument();
  });

  it('switches to Settings tab on click', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.settings'));
    expect(screen.getByText('admin.intel.settings.placeholder')).toBeInTheDocument();
  });

  it('switches back to Home tab', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.trends'));
    expect(screen.getByText('admin.intel.trends.title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('admin.intel.tabs.home'));
    expect(screen.getByText('admin.intel.trends.metricDau')).toBeInTheDocument();
  });
});

describe('AdminIntelPage — empty states', () => {
  it('shows empty placeholder for Experiments tab when no experiments exist', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.experiments'));
    expect(screen.getByText('admin.intel.experiments.empty')).toBeInTheDocument();
  });

  it('shows empty placeholder for Alerts tab when no alerts exist', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.alerts'));
    expect(screen.getByText('admin.intel.alerts.empty')).toBeInTheDocument();
  });

  it('shows placeholder for Segments tab', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.segments'));
    expect(screen.getByText('admin.intel.segments.placeholder')).toBeInTheDocument();
  });

  it('shows placeholder for Settings tab', async () => {
    renderPage();
    await flushPromises();
    fireEvent.click(screen.getByText('admin.intel.tabs.settings'));
    expect(screen.getByText('admin.intel.settings.placeholder')).toBeInTheDocument();
  });
});

describe('AdminIntelPage — accessibility', () => {
  it('contains no native select elements', async () => {
    renderPage();
    await flushPromises();
    expect(document.querySelectorAll('select')).toHaveLength(0);
  });

  it('tab buttons have minimum 44px hit target (min-h-11)', async () => {
    renderPage();
    await flushPromises();
    const tabs = Array.from(document.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.startsWith('admin.intel.tabs.'),
    );
    for (const tab of tabs) {
      expect(tab.classList.contains('min-h-11')).toBe(true);
    }
  });

  it('home tab is displayed by default', async () => {
    renderPage();
    await flushPromises();
    expect(screen.getByText('admin.intel.trends.metricDau')).toBeInTheDocument();
  });
});
