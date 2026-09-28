import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme/useTheme';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ComponentProps } from 'react';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import type { LessonDocument } from '@/lesson-engine/core/types';
import type LessonPlayerType from '@/lesson-engine/player/LessonPlayer';
import { LessonRoute } from '../LessonRoute';
import { goalBulletPilotDocument } from '@/rebuild/learning/GoalBulletBoard';
import { allocationPilotDocument } from '@/rebuild/learning/AllocationBoard';
import { fractionNumberLinePilotDocument } from '@/rebuild/learning/FractionNumberLineBoard';
import { fractionAreaPilotDocument } from '@/rebuild/learning/FractionAreaBoard';
import { numberLinePilotDocument } from '@/rebuild/learning/NumberLineBoard';
import { workedExamplePilotDocument } from '@/rebuild/learning/WorkedExampleBoard';
import { functionMachinePilotDocument } from '@/rebuild/learning/FunctionMachineBoard';
import { barModelPilotDocument } from '@/rebuild/learning/BarModelBoard';
import { schemaDiagramPilotDocument } from '@/rebuild/learning/SchemaDiagramBoard';
import { cpaFadingPilotDocument } from '@/rebuild/learning/CpaFadingBoard';
import { decideJustifyPilotDocument } from '@/rebuild/learning/DecisionReasonsBoard';
import { trackInsight } from '@/lib/insights';

const mockNavigate = vi.fn();
const { mockGetToken } = vi.hoisted(() => ({ mockGetToken: vi.fn<() => Promise<string | null>>() }));

/*
 * The route reads the learner's register once per lesson (B.23, S05.3g). That
 * read is answered here, apart from the queued responses each test sets up for
 * the lesson and completion calls, so those sequences stay exactly as written.
 * `registerReply.current` is Core's answer (default: unavailable, which reads
 * as the youngest register).
 */
const { registerReply } = vi.hoisted(() => ({ registerReply: { current: { data: null as unknown, error: { code: 'UNAVAILABLE' } as { code: string } | null } } }));
vi.mock('@/lib/api', () => {
  const apiMock = vi.fn();
  const routed = (path: string, init?: unknown) => (path === '/learn/register' ? Promise.resolve(registerReply.current) : apiMock(path, init));
  return { api: Object.assign(routed, { __mock: apiMock }) };
});
vi.mock('@/lib/insights', async () => ({ ...(await vi.importActual<typeof import('@/lib/insights')>('@/lib/insights')), trackInsight: vi.fn() }));
// getToken must be a STABLE reference — the route's fetch effect depends on it
// (in the real app it's a memoized useCallback from AuthContext). A fresh
// function per render would re-fire the effect forever.
vi.mock('@/auth/AuthContext', () => {
  return { useAuth: () => ({ getToken: mockGetToken, session: { user: { id: 'audit-learner' } } }) };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/lesson-engine/player/LessonPlayer', () => ({
  default: ({ onComplete, onExit, register }: ComponentProps<typeof LessonPlayerType>) => (
    <div data-testid="live-player" data-register={register}>
      <button type="button" onClick={() => onComplete?.({ score: 100, passed: true, xp: 10, seconds_spent: 42 })}>
        mock-complete
      </button>
      <button type="button" onClick={onExit}>
        mock-exit
      </button>
    </div>
  ),
}));
/* The Mentor stage renders its live 3D only where the renderer's device probe finds WebGL (Bible 08 §7). */
vi.mock('@/tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('@/tutor-scene/TutorStage', () => ({
  TutorStage: (props: { scene?: string; character?: string }) => (
    <div data-testid="tutor-stage" data-scene={props.scene} data-character={props.character} />
  ),
}));

const mockedApi = vi.mocked((api as unknown as { __mock: typeof api }).__mock);

const fixtureDocument: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'l1', title: 'Lesson One', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: [], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [],
};

function renderLessonRoute(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries']) {
  return render(
    <ThemeProvider><MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/learn/lesson/:lessonId" element={<LessonRoute />} />
      </Routes>
    </MemoryRouter></ThemeProvider>,
  );
}

beforeEach(async () => {
  sessionStorage.clear();
  mockedApi.mockReset();
  mockGetToken.mockReset().mockResolvedValue('token-123');
  mockNavigate.mockReset();
  registerReply.current = { data: null, error: { code: 'UNAVAILABLE' } };
  await i18n.changeLanguage('en-US');
});

afterEach(() => vi.unstubAllGlobals());

describe('LessonRoute', () => {
  it('retains the completion run and payload after a failed save and route remount', async () => {
    const lesson = { data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null };
    mockedApi.mockResolvedValueOnce(lesson).mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } });
    const first = renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByText('mock-complete'));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(2));
    const initialBody = mockedApi.mock.calls[1]?.[1]?.body;
    first.unmount();
    mockedApi.mockResolvedValueOnce(lesson).mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByText('mock-complete'));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(4));
    expect(mockedApi.mock.calls[3]?.[1]?.body).toEqual(initialBody);
  });
  it('fetches the lesson document and renders the player', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);

    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1', { token: 'token-123' });
  });

  it('B.9: shows the resurfaced decision once, before the lesson, and ignores a malformed recall', async () => {
    const recall = {
      entry_id: 'entry-1', lesson_title: { 'en-US': 'The lemonade stand' }, situation: 'What price brings me closer to the guitar?',
      choice: '10 coins, double the price', first_choice: '5 coins, the usual', outcome: 'Two neighbors buy.', relevance: 'same-arc', recorded_at: '2026-09-20T10:00:00.000Z',
    };
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument, narrative_recall: recall }, error: null });
    const first = renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Remember this?' })).toBeInTheDocument();
    expect(screen.getByText('10 coins, double the price')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'What happened' }));
    expect(screen.getByText('5 coins, the usual')).toBeInTheDocument();
    expect(screen.queryByText('mock-complete')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
    first.unmount();
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument, narrative_recall: { ...recall, situation: '' } }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Remember this?' })).toBeNull();
  });

  it('shows the rebuilt offline state and retries the lesson request', async () => {
    mockedApi
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } })
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Connection lost' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledTimes(2);
  });

  it('uses the rebuilt load-error state for a non-network lesson failure', async () => {
    mockedApi
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'unexpected response' } })
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Lesson unavailable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
  });

  it('routes a delivered v2 document into the rebuilt lesson renderer without passing age evidence', async () => {
    const document = goalBulletPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi.mockResolvedValueOnce({ data: {
      lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {},
    }, error: null })
      // GAP-FIX-R1 (OD-17): an ungraded lesson still pins a run; it completes through view receipts, so no token is issued.
      .mockResolvedValueOnce({ data: { run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: {} }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Reach a savings goal' })).toBeInTheDocument();
    expect(mockedApi.mock.calls[1]?.[0]).toBe('/learn/lessons/lesson-1/v2-runs');
    expect(screen.queryByText('mock-complete')).toBeNull();
  });

  it('mounts the rebuilt lesson and its state screens inside the design system root, in the app mode and document language', async () => {
    localStorage.setItem('lf-theme', 'dark');
    try {
      mockedApi
        .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } })
        .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'es-MX', document: goalBulletPilotDocument('es-MX', '6-9'), audio: {} }, error: null })
        .mockResolvedValueOnce({ data: { run_id: '99999999-9999-4999-8999-999999999999', version_id: (goalBulletPilotDocument('es-MX', '6-9') as { version_id: string }).version_id,
          expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: {} }, error: null });
      renderLessonRoute(['/learn/lesson/lesson-1']);
      const offline = await screen.findByRole('heading', { name: 'Connection lost' });
      // The design-system root is the element that carries the mode and the language.
      expect(offline.closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
      expect(offline.closest('[data-theme]')).toHaveAttribute('lang', 'en-US');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      const title = await screen.findByRole('heading', { level: 1, name: 'Alcanza una meta' });
      const root = title.closest('[data-theme]');
      expect(root).toHaveAttribute('data-theme', 'dark');
      expect(root).toHaveAttribute('lang', 'es-MX');
      expect(root).toHaveAttribute('data-age-band', '6-9');
    } finally { localStorage.removeItem('lf-theme'); }
  });

  it('starts a version-pinned v2 attempt and sends its opaque segment token only when the learner checks a valid allocation', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'opaque-signed-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    const addSave = await screen.findByRole('button', { name: 'Save: Add' });
    for (let count = 0; count < 4; count++) fireEvent.click(addSave);
    const addSpend = screen.getByRole('button', { name: 'Spend: Add' });
    for (let count = 0; count < 8; count++) fireEvent.click(addSpend);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(
      '/learn/lessons/lesson-1/grade',
      expect.objectContaining({ method: 'POST', token: 'token-123', body: {
        segment_id: 'allocate-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'opaque-signed-token', answer: { save: 4, spend: 8, share: 0 },
      } }),
    ));
    expect(await screen.findByText('Your plan meets the goal.')).toBeInTheDocument();
    expect(mockedApi.mock.calls[1]).toEqual(['/learn/lessons/lesson-1/v2-runs', { method: 'POST', token: 'token-123', body: {} }]);
  });

  it('projects the response mentor stage into the compact Mentor band of the rebuilt lesson', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const v2Document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: {
        lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: v2Document, audio: {},
        mentor_stage: { character: 'zara', scene: 'diorama-a' },
      }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: v2Document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'opaque-signed-token' },
      }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);

    await screen.findByRole('button', { name: 'Save: Add' });
    expect(document.querySelector('.lf-mentor-band')?.getAttribute('data-mentor-character')).toBe('zara');
    expect(await screen.findByTestId('tutor-stage')).toHaveAttribute('data-scene', 'diorama-a');
  });

  it('completes an authenticated M3 fraction number-line after its authoritative correct verdict', async () => {
    const document = fractionNumberLinePilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'fraction-01': 'fraction-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.change(await screen.findByRole('slider', { name: 'Place the fraction' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      method: 'POST', token: 'token-123', body: {
        segment_id: 'fraction-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'fraction-attempt-token', answer: { value: '3/4' },
      },
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes an authenticated M6 equal-area fraction after its authoritative correct verdict', async () => {
    const document = fractionAreaPilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'fraction-area-01': 'area-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByRole('button', { name: 'Shaded parts: More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      method: 'POST', token: 'token-123', body: {
        segment_id: 'fraction-area-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'area-attempt-token', answer: { n: 1, d: 2 },
      },
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes an authenticated M2 whole-number line after its authoritative correct verdict', async () => {
    const document = numberLinePilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'place-01': 'line-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.change(await screen.findByRole('slider', { name: 'Place the point' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      method: 'POST', token: 'token-123', body: {
        segment_id: 'place-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'line-attempt-token', answer: { value: '7' },
      },
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes authenticated M9/M10 after the learner reveals and solves the faded worked example', async () => {
    const document = workedExamplePilotDocument('en-US', 1) as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'worked-example-01': 'worked-example-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Predict the next result' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show next step' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Write the result: Sale price' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      method: 'POST', token: 'token-123', body: {
        segment_id: 'worked-example-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'worked-example-attempt-token', answer: { values: { 'discount-subtract': '40', 'sale-price': '40' } },
      },
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('B.12/B.5: grades a reasoning answer through its signed token and renders the Core replay receipt', async () => {
    const document = decideJustifyPilotDocument('en-US', '10-12') as { version_id: string };
    const runId = '99999999-9999-4999-8999-999999999999';
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: runId, version_id: document.version_id, expires_at: '2026-09-24T12:00:00.000Z', resumed: false, met_segment_ids: [],
        attempt_tokens: { 'decide-01': 'decide-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: false, score: 0, judgment: { quality: 'sound' } }, replayed: false, retry_attempt_token: 'decide-retry-token' }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100, judgment: { quality: 'unsupported' } }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 0, passed: true, receipt: {
        schema_version: 2, completion_id: runId, lesson_id: 'pilot-decide-justify', version_id: document.version_id, locale: 'en-US',
        first_try_correct: 0, graded_count: 1, awarded_xp: 0, duration_seconds: 42, previous_best_percent: 100,
        replay: { kind: 'replay', notice: 'best_kept', best_score_kept: true, xp_policy: 'improvement_only' },
        judgment: { assessed: 1, sound: 1, partial: 0, unsupported: 0 },
      } }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByRole('button', { name: 'Spend all now' }));
    fireEvent.click(screen.getByRole('button', { name: 'It gets me closer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Your reason explains it well.')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      body: { segment_id: 'decide-01', run_id: runId, attempt_token: 'decide-attempt-token', answer: { choice: 'spend-all', reason: 'reason-goal' } },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 4 coins' }));
    fireEvent.click(screen.getByRole('button', { name: 'I just picked one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('That choice works.')).toBeInTheDocument();
    // The retry used the renewed one-use token, never the consumed one.
    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      body: expect.objectContaining({ attempt_token: 'decide-retry-token', answer: { choice: 'save-first', reason: 'reason-lucky' } }),
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish lesson' }));
    expect(await screen.findByText('Your saved best is still 100%. This was practice.')).toBeInTheDocument();
    expect(screen.getByText('Well-explained choices')).toBeInTheDocument();
    expect(vi.mocked(trackInsight)).toHaveBeenCalledWith('replay_notice_view', { lessonId: 'lesson-1', routeClass: 'learn' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  it('completes authenticated M13 after the learner tries an input and states the function rule', async () => {
    const document = functionMachinePilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'function-machine-01': 'function-machine-attempt-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByRole('radio', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.change(screen.getByLabelText('Multiply by'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Then add'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check rule' }));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({
      method: 'POST', token: 'token-123', body: {
        segment_id: 'function-machine-01', run_id: '99999999-9999-4999-8999-999999999999',
        attempt_token: 'function-machine-attempt-token', answer: { multiplier: '5', offset: '10' },
      },
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes authenticated M7 only after Core accepts its structure and independent answer receipts', async () => {
    const document = barModelPilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'bar-structure-01': 'structure-token', 'bar-answer-01': 'answer-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'bar-structure-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'structure-token', answer: { model: 'comparison' },
    } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('How many coins does the smaller bar show?'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'bar-answer-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'answer-token', answer: { value: '19' },
    } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes authenticated M8 only after Core accepts each schema, slot, and answer receipt', async () => {
    const document = schemaDiagramPilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'schema-structure-01': 'schema-token', 'schema-slots-01': 'slots-token', 'schema-answer-01': 'answer-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.click(await screen.findByRole('radio', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'schema-structure-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'schema-token', answer: { schema: 'change' },
    } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Earned'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Spent'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'schema-slots-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'slots-token', answer: { income: '24', spending: '9' },
    } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('How many coins are left?'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'schema-answer-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'answer-token', answer: { value: '15' },
    } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('completes authenticated M1 only after its concrete, pictorial, then abstract receipts', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: 'concrete-retry-token' }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your answer' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'cpa-concrete-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'concrete-token', answer: { value: '6' },
    } })));
    expect(await screen.findByRole('heading', { name: 'See it' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'cpa-pictorial-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'pictorial-token', answer: { value: '7' },
    } })));
    expect(await screen.findByRole('heading', { name: 'Write it' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: {
      segment_id: 'cpa-abstract-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'abstract-token', answer: { value: '7' },
    } })));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/complete', expect.objectContaining({
      method: 'POST', token: 'token-123', body: expect.objectContaining({ run_id: '99999999-9999-4999-8999-999999999999' }),
    })));
  });

  it('resumes M7 at its first pending independent answer without reopening the met structure', async () => {
    const document = barModelPilotDocument('en-US') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: true, met_segment_ids: ['bar-structure-01'], attempt_tokens: { 'bar-structure-01': 'structure-token', 'bar-answer-01': 'answer-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Solve the model' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Build the model' })).toBeNull();
    fireEvent.change(screen.getByLabelText('How many coins does the smaller bar show?'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: expect.objectContaining({
      segment_id: 'bar-answer-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'answer-token', answer: { value: '19' },
    }) })));
  });

  it('resumes M1 at the abstract response after its earlier representation receipts are met', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: true, met_segment_ids: [], attempted_segment_ids: ['cpa-concrete-01', 'cpa-pictorial-01'], attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Write it' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Build it' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: expect.objectContaining({
      segment_id: 'cpa-abstract-01', run_id: '99999999-9999-4999-8999-999999999999', attempt_token: 'abstract-token', answer: { value: '7' },
    }) })));
  });

  it('reopens the final M1 symbol after a review instead of exposing Finish', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: true, met_segment_ids: [],
        attempted_segment_ids: ['cpa-concrete-01', 'cpa-pictorial-01', 'cpa-abstract-01'],
        attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Write it' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish lesson' })).toBeNull();
  });

  it('keeps the final M1 symbol actionable after review and renews only its token', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [],
        attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: 'abstract-retry-token' }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    const answer = await screen.findByRole('textbox', { name: 'Your answer' });
    fireEvent.change(answer, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByRole('heading', { name: 'See it' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByRole('heading', { name: 'Write it' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Try counting again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish lesson' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: expect.objectContaining({
      segment_id: 'cpa-abstract-01', attempt_token: 'abstract-retry-token', answer: { value: '7' },
    }) })));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeInTheDocument();
  });

  it('keeps M1 actionable after a grading transport failure without calling it a learning review', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [],
        attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('Try counting again.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi).toHaveBeenLastCalledWith('/learn/lessons/lesson-1/grade', expect.objectContaining({ body: expect.objectContaining({
      segment_id: 'cpa-concrete-01', attempt_token: 'concrete-token', answer: { value: '7' },
    }) })));
    expect(await screen.findByRole('heading', { name: 'See it' })).toBeInTheDocument();
  });

  it('restores a v2 run ID after reload but never writes its opaque token to session storage', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    const run = { run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
      expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'opaque-signed-token' } };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: run, error: null });
    const first = renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByRole('button', { name: 'Save: Add' });
    first.unmount();

    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: { ...run, resumed: true }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByRole('button', { name: 'Save: Add' });

    expect(mockedApi.mock.calls[3]).toEqual(['/learn/lessons/lesson-1/v2-runs', {
      method: 'POST', token: 'token-123', body: { run_id: run.run_id },
    }]);
    expect(sessionStorage.getItem('lf.lesson.checkpoint.v1:audit-learner:lesson-1')).not.toContain('opaque-signed-token');
  });

  it('uses the replacement token after review so the learner can correct an answer', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: { run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id, expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'first-token' } }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: 'second-token' }, error: null })
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    const addSave = await screen.findByRole('button', { name: 'Save: Add' });
    for (let count = 0; count < 3; count++) fireEvent.click(addSave);
    const addSpend = screen.getByRole('button', { name: 'Spend: Add' });
    for (let count = 0; count < 9; count++) fireEvent.click(addSpend);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(window.document.querySelector('.lf-learning-feedback--review')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Spend: Remove' }));
    fireEvent.click(addSave);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(mockedApi.mock.calls[3]?.[1]).toMatchObject({ body: expect.objectContaining({ attempt_token: 'second-token' }) }));
    expect(await screen.findByText('Your plan meets the goal.')).toBeInTheDocument();
  });

  it('fails closed when the v2 run response names a different public version', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: 'another-public-version',
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'opaque-signed-token' },
      }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Update the app' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(mockedApi).toHaveBeenCalledTimes(2);
  });

  it('fails closed when recovery returns a malformed attempted representation list', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: true, met_segment_ids: [],
        attempted_segment_ids: { segment: 'cpa-concrete-01' },
        attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Update the app' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(mockedApi).toHaveBeenCalledTimes(2);
  });

  it('fails closed when recovery skips an earlier CPA representation', async () => {
    const document = cpaFadingPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: true, met_segment_ids: [],
        attempted_segment_ids: ['cpa-pictorial-01'],
        attempt_tokens: { 'cpa-concrete-01': 'concrete-token', 'cpa-pictorial-01': 'pictorial-token', 'cpa-abstract-01': 'abstract-token' },
      }, error: null });

    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Update the app' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('posts the measured seconds_spent on complete WITHOUT navigating away (the Results screen must stay up until the kid exits)', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    mockedApi.mockResolvedValueOnce({ data: { score: 100, passed: true, xp_earned: 10, xp_delta: 10, streak_days: 1, streak_extended: true, first_today: true, minutes_learned: 1, lessons_completed: 1, progress: { passed: 1, total: 1, pct: 100 }, next_lesson_id: null }, error: null });

    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);
    await screen.findByText('mock-complete');

    fireEvent.click(screen.getByText('mock-complete'));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        '/learn/lessons/lesson-1/complete',
        expect.objectContaining({
          method: 'POST',
          token: 'token-123',
          body: { seconds_spent: 42, run_id: expect.any(String), local_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        }),
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not send a pending completion after the learner leaves the route', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    const view = renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByText('mock-complete');
    let resolveToken!: (token: string) => void;
    mockGetToken.mockImplementationOnce(() => new Promise(resolve => { resolveToken = resolve }));
    fireEvent.click(screen.getByText('mock-complete'));
    view.unmount();
    resolveToken('another-learner-token');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it('navigates back to the course page on exit, using the courseSlug passed via location state', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);
    await screen.findByText('mock-exit');

    fireEvent.click(screen.getByText('mock-exit'));

    expect(mockNavigate).toHaveBeenCalledWith('/learn/money-basics');
  });

  it('falls back to /learn on exit when no courseSlug was passed', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByText('mock-exit');

    fireEvent.click(screen.getByText('mock-exit'));

    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  it('W2L.4: a deep-linked lesson finds its way back through the course Core names, and ignores a malformed one', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1', course_slug: 'investing' }, locale: 'en-US', document: fixtureDocument }, error: null });
    const { unmount } = renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByText('mock-exit');
    fireEvent.click(screen.getByText('mock-exit'));
    expect(mockNavigate).toHaveBeenCalledWith('/learn/investing');
    unmount();
    mockNavigate.mockClear();
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1', course_slug: '../admin' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByText('mock-exit');
    fireEvent.click(screen.getByText('mock-exit'));
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  it('shows the rebuilt load-error state with a way back when the lesson fetch fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'Content service unreachable' } });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Lesson unavailable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  /* W2L.3: each refusal Core gives has its own screen, and none offers a retry that could only fail again. */
  it.each([
    ['LESSON_LOCKED', 'Opens later'],
    ['COURSE_PREREQUISITE_REQUIRED', 'One step first'],
    ['NOT_FOUND', 'Lesson not found'],
    ['COURSE_AGE_RESTRICTED', 'This lesson is for later'],
    ['UNSUPPORTED_LESSON', 'This lesson is not ready'],
  ])('W2L.3: says the %s refusal plainly, with the way back to the course and no retry', async (code, heading) => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code, message: 'refused' } });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn/money-basics');
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it('W2L.3: a v2 run that cannot start for a lost connection is the offline screen, not a lesson that needs an update, and retries', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'Network error' } })
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: {
        run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
        expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'allocate-01': 'opaque-signed-token' },
      }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Connection lost' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Update the app' })).toBeNull();
    // The connection coming back retries by itself.
    window.dispatchEvent(new Event('online'));
    expect(await screen.findByRole('button', { name: 'Save: Add' })).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledTimes(4);
  });

  it('W2L.3: a v2 run Core refuses is said as the refusal, and one it cannot sign yet offers a retry', async () => {
    const document = allocationPilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'LESSON_LOCKED', message: 'This lesson is still locked' } });
    const first = renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Opens later' })).toBeInTheDocument();
    first.unmount();
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'LESSON_ATTEMPT_UNAVAILABLE', message: 'This lesson attempt is not ready' } });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Lesson unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('uses the rebuilt task-scoped screen for a lesson-age refusal', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'LESSON_AGE_ELIGIBILITY_REQUIRED', message: 'Age eligibility is required' } });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'We need your age details' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  /*
   * PLACEMENT_REQUIRED is a missing step, not an error: Core 403s every
   * lesson-access endpoint until the course's placement quiz is taken, and
   * /learn will happily offer the lesson anyway. Showing the banner made the
   * learner read a red message and then press a button that lands on the
   * course page, which redirects to that same quiz — so go straight there.
   */
  it('sends the learner to the placement quiz instead of a dead-end error', async () => {
    mockedApi.mockResolvedValueOnce({
      data: null,
      error: { code: 'PLACEMENT_REQUIRED', message: "Complete this course's placement quiz first" },
    });

    render(
      <ThemeProvider><MemoryRouter initialEntries={[{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]}>
        <Routes>
          <Route path="/learn/lesson/:lessonId" element={<LessonRoute />} />
          <Route path="/learn/:courseSlug/placement" element={<div>placement quiz</div>} />
        </Routes>
      </MemoryRouter></ThemeProvider>,
    );

    expect(await screen.findByText('placement quiz')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps an honest rebuilt placement state when the course is unknown', async () => {
    // A bare deep link carries no router state, so there is no courseSlug to
    // build the placement URL from. Being visibly stuck beats a wrong redirect.
    mockedApi.mockResolvedValueOnce({
      data: null,
      error: { code: 'PLACEMENT_REQUIRED', message: "Complete this course's placement quiz first" },
    });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('heading', { name: 'Placement comes first' })).toBeInTheDocument();
  });
});

describe('LessonRoute: the lesson layer and the legacy island (W2L.3)', () => {
  const numberLineRun = (document: { version_id: string }) => ({ data: {
    run_id: '99999999-9999-4999-8999-999999999999', version_id: document.version_id,
    expires_at: '2026-09-23T12:00:00.000Z', resumed: false, met_segment_ids: [], attempt_tokens: { 'place-01': 'line-attempt-token' },
  }, error: null });

  it('keeps one layer from opening to the lesson: the skip link first, the title per screen, focus on the new heading', async () => {
    const document = numberLinePilotDocument('en-US', '6-9') as { version_id: string; title: string };
    let answer: (value: unknown) => void = () => undefined;
    mockedApi
      .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve as (value: unknown) => void; }))
      .mockResolvedValueOnce(numberLineRun(document));
    renderLessonRoute(['/learn/lesson/lesson-1']);
    expect(await screen.findByRole('heading', { name: 'Opening lesson' })).toBeInTheDocument();
    const layer = window.document.querySelector('[data-shell="lesson"]');
    expect(window.document.title).toBe('Lesson · LittleFounders');
    answer({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null });
    await screen.findByRole('slider', { name: 'Place the point' });
    // The same layer element: the lesson moved screens inside it.
    expect(window.document.querySelector('[data-shell="lesson"]')).toBe(layer);
    expect(layer).toHaveAttribute('data-lesson-screen', 'lesson');
    expect(window.document.title).toBe(`${document.title} · LittleFounders`);
    const heading = screen.getByRole('heading', { level: 1, name: document.title });
    await waitFor(() => expect(window.document.activeElement).toBe(heading));
    const skip = layer!.firstElementChild;
    expect(skip?.tagName).toBe('A');
    expect(skip?.textContent).toBe('Skip to content');
    expect(skip?.getAttribute('href')).toBe(`#${layer!.querySelector('main')!.id}`);
    expect(layer!.querySelectorAll('main')).toHaveLength(1);
  });

  it('B.8: places the compact Mentor stage on a board other than the allocation pilot', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const document = numberLinePilotDocument('en-US', '6-9') as { version_id: string };
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {}, mentor_stage: { character: 'liruf', scene: 'diorama-b' } }, error: null })
      .mockResolvedValueOnce(numberLineRun(document));
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByRole('slider', { name: 'Place the point' });
    const band = window.document.querySelector('.lf-learning-inner > .lf-mentor-band');
    expect(band).toHaveAttribute('data-mentor-character', 'liruf');
    expect(await screen.findByTestId('tutor-stage')).toHaveAttribute('data-scene', 'diorama-b');
  });

  it('OD-24: plays a v1 lesson in the legacy island, outside the rebuilt layer', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    const player = await screen.findByTestId('live-player');
    // No design-system root (the element carrying the mode) around the legacy player.
    expect(player.closest('div[data-theme]')).toBeNull();
    expect(window.document.querySelector('[data-shell="lesson"]')).toBeNull();
  });

  it('OD-7: shows the badge Core named on the result, with the course it was earned in', async () => {
    const document = numberLinePilotDocument('en-US', '6-9') as { version_id: string };
    const runId = '99999999-9999-4999-8999-999999999999';
    mockedApi
      .mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document, audio: {} }, error: null })
      .mockResolvedValueOnce(numberLineRun(document))
      .mockResolvedValueOnce({ data: { verdict: { correct: true, score: 100 }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { score: 100, passed: true, receipt: {
        schema_version: 2, completion_id: runId, lesson_id: 'pilot-number-line', version_id: document.version_id, locale: 'en-US',
        first_try_correct: 1, graded_count: 1, awarded_xp: 10, duration_seconds: 42, previous_best_percent: 0,
        replay: { kind: 'first', notice: 'none', best_score_kept: false, xp_policy: 'improvement_only' },
        celebrations: ['lesson-complete', 'course-complete', 'badge-earned'],
      } }, error: null });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'investing' } }]);
    fireEvent.change(await screen.findByRole('slider', { name: 'Place the point' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish lesson' }));
    const badge = await screen.findByText('Badge earned');
    expect(badge).toHaveAttribute('data-celebrate', 'badge-earned');
    expect(badge.querySelector('[data-asset-id="course.investing.icon"]')).not.toBeNull();
    expect(window.document.title).toBe('Your result · LittleFounders');
    await waitFor(() => expect(window.document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Lesson complete!' })));
  });
});

describe("LessonRoute: the live player reads the learner's register (B.23, S05.3g)", () => {
  const lesson = () => ({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });

  it("hands the live player the register Core resolved, so a teen's cast is calm and a teen result carries no milestone motion", async () => {
    registerReply.current = { data: { register: 'teen', copy_band: '13-17', policy_version: '2026-09-24.1', graduation: null }, error: null };
    mockedApi.mockResolvedValueOnce(lesson());
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await waitFor(() => expect(screen.getByTestId('live-player').getAttribute('data-register')).toBe('teen'));
  });

  it('reads as the youngest register while Core is unavailable, never guessing upward', async () => {
    mockedApi.mockResolvedValueOnce(lesson());
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await waitFor(() => expect(screen.getByTestId('live-player').getAttribute('data-register')).toBe('young'));
  });

  it('refuses a register payload whose band disagrees with the register (a malformed answer is the youngest register)', async () => {
    registerReply.current = { data: { register: 'adult', copy_band: '6-9', policy_version: '2026-09-24.1', graduation: null }, error: null };
    mockedApi.mockResolvedValueOnce(lesson());
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await waitFor(() => expect(screen.getByTestId('live-player').getAttribute('data-register')).toBe('young'));
  });
});
