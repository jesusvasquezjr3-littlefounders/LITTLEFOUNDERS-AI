import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { AdminGenerationPage } from '@/routes/admin/AdminGenerationPage';
import type { GenerationOverview } from '@/routes/admin/generationTypes';

// React Flow internal components depend on browser APIs (ResizeObserver, DOM
// measurements, requestAnimationFrame) that are not available in jsdom and
// cause the test runner to hang. Mock the whole module — PipelineFlow's
// visual correctness is verified in-browser; what we test here is the page
// logic (tabs, states, data flow).
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn()],
}));
vi.mock('@xyflow/react/dist/style.css', () => ({}));

/*
 * /admin/generation dashboard tests. Mocks useAdminData and api calls to
 * exercise the three tabs: Live Monitor, Run History, and Analytics.
 */

// ── Mock data ────────────────────────────────────────────────────────────────

const EMPTY_OVERVIEW: GenerationOverview = { tracks: [], runs: [] };

const OVERVIEW_WITH_DATA: GenerationOverview = {
  tracks: [
    {
      trackId: 'trk-001',
      courseSlug: 'financial-education',
      budgetUsd: 50,
      halted: null,
      totals: { published: 42, failed: 3, usd: 12.34 },
      failureHeatmap: { written: 2, reviewed: 1 },
      mopUp: ['adv1/saga1/topic1/lesson3'],
      shards: 5,
      updatedAt: '2026-07-27T00:00:00Z',
    },
  ],
  runs: [
    {
      runId: 'run-abc123',
      trackId: 'trk-001',
      courseSlug: 'financial-education',
      register: 'kid',
      published: 8,
      failed: 1,
      slotsEnumerated: 10,
      tokensUsed: 500000,
      usdUsed: 3.45,
      cachedTokens: 200000,
      imagesGenerated: 12,
      imagesBilled: 8,
      updatedAt: '2026-07-27T00:00:00Z',
    },
  ],
};

// ── Mock module ──────────────────────────────────────────────────────────────

const mockOverviewData = vi.hoisted(() => ({
  data: { state: 'loading' as const } as { state: 'loading' | 'error' | 'ready'; data?: GenerationOverview; code?: string },
  reload: vi.fn().mockResolvedValue(undefined),
}));

const mockRunDetailData = vi.hoisted(() => ({
  data: { state: 'loading' as const } as { state: 'loading' | 'error' | 'ready'; data?: { run: unknown; slots: unknown[] }; code?: string },
  reload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/routes/admin/adminShared', async () => {
  const actual = await vi.importActual<typeof import('@/routes/admin/adminShared')>('@/routes/admin/adminShared');
  return {
    ...actual,
    useAdminData: (path: string) => {
      if (path === '/admin/generation') return mockOverviewData;
      if (path.startsWith('/admin/generation/runs/')) return mockRunDetailData;
      return { data: { state: 'loading' }, reload: vi.fn() };
    },
  };
});

// api is called directly by LiveStats and AnalyticsCharts.
vi.mock('@/lib/api', () => ({
  api: vi.fn().mockImplementation((path: string) => {
    if (path.startsWith('/admin/generation/analytics')) {
      return Promise.resolve({
        data: {
          courseSlug: null,
          runsAnalyzed: 0,
          costTrend: [],
          qualityTrend: [],
          cacheEfficiency: [],
          failureByStage: [],
          failureByLocale: [],
          stageSuccessRate: { stage: 'overall', passed: 0, failed: 0, rate: 0 },
          costForecast: null,
          averages: { costPerPublished: null, tokensPerLesson: null, cacheHitPct: null },
        },
        error: null,
      });
    }
    if (path.startsWith('/admin/generation/coach')) {
      return Promise.resolve({
        data: {
          courseSlug: null, trackId: null, runsAnalyzed: 0,
          outcomes: { published: 0, failed: 0, other: 0 },
          failureHeatmap: {},
          topErrors: [],
          judge: {
            judged: 0, dimensionMeans: {}, dimensionMins: {},
            cyclesHistogram: { cycle1: 0, cycle2: 0, cycle3: 0, earlyStops: 0 },
            worstLessons: [],
          },
          cost: { totalUsd: 0, totalTokens: 0, cacheHitPct: 0 },
          images: { generated: 0, billed: 0, inherited: 0 },
          proposedActions: [],
        },
        error: null,
      });
    }
    // RunTimeline reads data.snapshots — the generic fallback below has no
    // such key, which used to throw inside render and fail the whole run.
    if (path.startsWith('/admin/generation/snapshots/')) {
      return Promise.resolve({ data: { runId: 'run-1', snapshots: [] }, error: null });
    }
    return Promise.resolve({ data: { activeRuns: [] }, error: null });
  }),
}));

// Auth token mock — provides a full AuthContextValue shape.
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    session: null,
    profile: null,
    roles: ['superadmin'],
    avatarOptions: {},
    meLoaded: true,
    login: vi.fn(),
    signup: vi.fn(),
    completeOAuth: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
    getToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));


// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminGenerationPage />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
  await i18n.changeLanguage('en-US');
  mockOverviewData.data = { state: 'loading' };
  mockRunDetailData.data = { state: 'loading' };
  vi.clearAllMocks();
});

describe('AdminGenerationPage — layout', () => {
  it('renders the admin page shell with title', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Generation' })).toBeInTheDocument();
  });

  it('shows loading spinner while overview loads', () => {
    mockOverviewData.data = { state: 'loading' };
    renderPage();
    expect(screen.getByText('Loading generation telemetry…')).toBeInTheDocument();
  });

  it('shows error state when overview fails', () => {
    mockOverviewData.data = { state: 'error', code: 'UPSTREAM_FAILED' };
    renderPage();
    expect(screen.getByText('Data unavailable')).toBeInTheDocument();
  });

  it('renders the four tab buttons', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    expect(screen.getByRole('tab', { name: /Live Monitor/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Run History/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Analytics/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Coach/ })).toBeInTheDocument();
  });

  it('defaults to the Live Monitor tab', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    expect(screen.getByRole('tab', { name: /Live Monitor/, selected: true })).toBeInTheDocument();
  });
});

describe('AdminGenerationPage — tab switching', () => {
  it('switches to Run History tab on click', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Run History/ }));
    expect(screen.getByRole('tab', { name: /Run History/, selected: true })).toBeInTheDocument();
    expect(screen.getByText(/No generation runs recorded yet/)).toBeInTheDocument();
  });

  it('switches to Analytics tab on click', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Analytics/ }));
    expect(screen.getByRole('tab', { name: /Analytics/, selected: true })).toBeInTheDocument();
  });

  it('shows track cards when data is present and on History tab', () => {
    mockOverviewData.data = { state: 'ready', data: OVERVIEW_WITH_DATA };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Run History/ }));
    expect(screen.getByText('trk-001')).toBeInTheDocument();
    expect(screen.getByText(/financial-education/)).toBeInTheDocument();
  });
});

describe('AdminGenerationPage — live tab idle state', () => {
  it('shows idle message when no active run exists', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    expect(screen.getByText('No active generation run')).toBeInTheDocument();
  });
});

describe('AdminGenerationPage — run history inspector', () => {
  it('shows run inspector when runs exist', () => {
    mockOverviewData.data = { state: 'ready', data: OVERVIEW_WITH_DATA };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Run History/ }));
    expect(screen.getByText('Run inspector')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument(); // track badge
  });

  it('shows halted badge for a halted track', () => {
    const haltedOverview: GenerationOverview = {
      tracks: [{
        ...OVERVIEW_WITH_DATA.tracks[0]!,
        halted: 'BudgetExceededError: tokens exceeded $50 cap',
      }],
      runs: [],
    };
    mockOverviewData.data = { state: 'ready', data: haltedOverview };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Run History/ }));
    expect(screen.getByText('Halted')).toBeInTheDocument();
    expect(screen.getByText(/BudgetExceededError/)).toBeInTheDocument();
  });

  it('shows empty state when no runs exist', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Run History/ }));
    expect(screen.getByText(/No generation runs recorded yet/)).toBeInTheDocument();
  });

  it('switches to Coach tab on click', () => {
    mockOverviewData.data = { state: 'ready', data: EMPTY_OVERVIEW };
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Coach/ }));
    expect(screen.getByRole('tab', { name: /Coach/, selected: true })).toBeInTheDocument();
  });
});
