import { useMemo } from 'react';
import { LiveContentStatusPanel, LiveReviewDecision, PackRelease } from '../../mentor/LiveContentGovernance';
import type { LiveContentStatus, TutorPackSummary } from '../../mentor/liveContentApi';
import { MentorQualityDashboard } from '../../staff/MentorQualityDashboard';
import { previewMentorQuality } from '../../staff/mentorQualityFixtures';
import { LearningQualityPanel } from '../../learning/LearningQualityPanel';
import { learningQualityFixture } from '../../learning/learningQualityFixtures';
import { StaffOverview } from '../../staff/console/StaffOverview';
import { StaffUsers } from '../../staff/console/StaffUsers';
import { StaffAccess } from '../../staff/console/StaffAccess';
import { StaffAudit } from '../../staff/console/StaffAudit';
import { StaffReports } from '../../staff/console/StaffReports';
import { StaffEmails } from '../../staff/console/StaffEmails';
import { StaffContent } from '../../staff/console/StaffContent';
import { StaffGeneration } from '../../staff/console/StaffGeneration';
import { StaffMentorQuality } from '../../staff/console/StaffMentorQuality';
import { StaffAnalytics } from '../../staff/console/StaffAnalytics';
import { StaffIntel } from '../../staff/console/StaffIntel';
import { analyticsView } from '../../staff/console/analyticsApi';
import { intelView } from '../../staff/console/intelApi';
import { contentView } from '../../staff/console/contentApi';
import { generationView } from '../../staff/console/generationApi';
import { fixtureApi, type FixtureState } from '../../staff/console/staffConsoleFixtures';
import { staffViewer } from '../../staff/console/staffConsoleApi';
import { framed, type PreviewContext, type PreviewRegistry } from './types';

/*
 * Lane 6 (staff): the staff console's rebuilt panels.
 */

/*
 * C.5 / C.6 preview fixtures for the staff surfaces. Default: everyday topics
 * open but RAISED after an issue, sensitive topics PAUSED by a Stage 7 trip.
 * `?judge=uncalibrated` shows the state production starts in until the owner
 * runs the calibration (OD-23).
 */
const PREVIEW_LIVE_STATUS = (judge: string | null): LiveContentStatus => ({
  calibration: judge === 'uncalibrated'
    ? { state: 'uncalibrated', ageDays: null, judgeModel: null, recordedAt: null, maxAgeDays: 35 }
    : { state: 'passed', ageDays: 12, judgeModel: 'qwen3-max', recordedAt: '2026-09-12T00:00:00Z', maxAgeDays: 35 },
  categories: judge === 'uncalibrated'
    ? [
      { category: 'standard', suspended: true, reasons: ['uncalibrated'], rate: 0.15, baseline: 0.15, floor: 0.15, elevated: false, decisionsToRestore: 0, pending: 0, overdue: 0 },
      { category: 'sensitive', suspended: true, reasons: ['uncalibrated'], rate: 0.5, baseline: 0.5, floor: 0.5, elevated: false, decisionsToRestore: 0, pending: 0, overdue: 0 },
    ]
    : [
      { category: 'standard', suspended: false, reasons: [], rate: 0.5, baseline: 0.15, floor: 0.15, elevated: true, decisionsToRestore: 64, pending: 3, overdue: 0 },
      { category: 'sensitive', suspended: true, reasons: ['concordance_below_floor'], rate: 1, baseline: 0.5, floor: 0.5, elevated: true, decisionsToRestore: 100, pending: 5, overdue: 2 },
    ],
  reviewSlaDays: 7,
});
const PREVIEW_PACKS: TutorPackSummary[] = [
  { id: 'pack-preview-1', skill_key: 'kc:money.percent-intro', kc_key: 'money.percent-intro', tier: 3, locale: 'es-MX', status: 'review', pack_version: 1,
    risk_category: 'standard', source: 'hand_authored', demand_pattern: 'kc_without_catalog_content',
    pack: { segments: [{ id: 'a', type: 'number_input' }, { id: 'b', type: 'number_input' }, { id: 'c', type: 'quiz_mcq' }, { id: 'd', type: 'number_input' }] } },
  { id: 'pack-preview-2', skill_key: 'kc:biz.goods-vs-services', kc_key: 'biz.goods-vs-services', tier: 1, locale: 'pt-BR', status: 'review', pack_version: 2,
    risk_category: 'standard', source: 'hand_authored', demand_pattern: 'kc_without_catalog_content',
    pack: { segments: [{ id: 'a', type: 'quiz_mcq' }, { id: 'b', type: 'true_false' }, { id: 'c', type: 'sort_buckets' }, { id: 'd', type: 'quiz_mcq' }] } },
];
const PREVIEW_REVIEW_ITEM = {
  'en-US': 'A notebook costs 7 coins. How many coins do 3 notebooks cost?',
  'es-MX': 'Un cuaderno cuesta 7 monedas. ¿Cuántas monedas cuestan 3 cuadernos?',
  'pt-BR': 'Um caderno custa 7 moedas. Quantas moedas custam 3 cadernos?',
} as const;

/*
 * W2T.1 console screens on fixtures: ?state=ready|loading|error|refused|empty,
 * ?grants=a,b (an admin's named grants; default superadmin), ?write=failed|rejected.
 */
type ConsoleRender = (props: { api: ReturnType<typeof fixtureApi>; viewer: ReturnType<typeof staffViewer> }) => JSX.Element;
/** One fixture api per mount (a new api object per render would re-run every read). */
function ConsoleFixture({ id, params, render }: { id: string; params: URLSearchParams; render: ConsoleRender }) {
  const state = (params.get('state') ?? 'ready') as FixtureState;
  const write = (params.get('write') ?? 'ok') as 'ok' | 'failed' | 'rejected';
  const grants = params.get('grants');
  const api = useMemo(() => fixtureApi(state, write), [state, write]);
  const viewer = useMemo(() => (grants === null ? staffViewer(['superadmin'], []) : staffViewer(['admin'], grants.split(','))), [grants]);
  return <main className="lf-preview" data-surface="app" data-screen={`${id}-host`}>
    <div className="lf-preview-content">{render({ api, viewer })}</div>
  </main>;
}
function consoleScreen(id: string, render: ConsoleRender) {
  return framed(({ params }: PreviewContext) => <ConsoleFixture id={id} params={params} render={render} />);
}

export const staffPreviewScreens: PreviewRegistry = {
  learningquality: framed(({ locale, theme, params }) => <main className="lf-family-preview" data-surface="app" data-screen="learning-quality-host">
    <LearningQualityPanel key={`quality:${locale}:${params.get('quality')}`} fixture locale={locale} dark={theme === 'dark'}
      state={params.get('quality') === 'error' ? { status: 'error' } : params.get('quality') === 'loading' ? { status: 'loading' }
        : params.get('quality') === 'empty' ? { status: 'ready', report: { ...learningQualityFixture(), lessons: [], reviews: [], judgment: [],
          replayNotice: { below_best: 0, shown: 0, display_rate: null, target: 1, belowTarget: false } } }
        : { status: 'ready', report: learningQualityFixture() }}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />
  </main>),
  'staff-live-content': framed(({ t, locale, theme, params }) => <main className="lf-preview lf-preview--staff-live-content" data-surface="app"
    data-screen="staff-live-content"><div className="lf-preview-content">
    {/* C.5 / C.6 staff fixtures: ?state=ready|loading|failed, ?judge=uncalibrated, ?decide=failed|already, ?pack=refused|failed. */}
    <LiveContentStatusPanel copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'}
      phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
      status={PREVIEW_LIVE_STATUS(params.get('judge'))} />
    <LiveReviewDecision copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'}
      item={{ id: 'segment-preview', category: 'standard', prompt: PREVIEW_REVIEW_ITEM[locale] }}
      onDecide={async () => (params.get('decide') === 'failed' ? 'failed' : params.get('decide') === 'already' ? 'already' : 'recorded')} />
    <PackRelease copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'} packs={PREVIEW_PACKS}
      onStatus={async () => (params.get('pack') === 'refused'
        ? { ok: false, failures: ['segment pack-x-1: the key names an option that does not exist exactly once', 'tier 2 is below the knowledge component\'s tier_min 3'] }
        : params.get('pack') === 'failed' ? { ok: false } : { ok: true })} />
  </div></main>),
  'staff-mentor-quality': framed(({ t, locale, theme, params }) => <main className="lf-preview lf-preview--staff-mentor-quality" data-surface="app"
    data-screen="staff-mentor-quality"><div className="lf-preview-content">
    {/* C.24 staff fixtures: ?state=ready|loading|failed, ?fresh=stale|never, ?viewer=none, ?flags=empty, ?act=failed|not_owner|changed, ?review=already|failed. */}
    <MentorQualityDashboard copy={t.staffMentorQuality} locale={locale} dark={theme === 'dark'}
      phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
      data={previewMentorQuality({ fresh: params.get('fresh'), viewer: params.get('viewer'), empty: params.get('flags') === 'empty' })}
      onAcknowledge={async () => (params.get('act') === 'failed' ? 'failed' : params.get('act') === 'not_owner' ? 'not_owner' : params.get('act') === 'changed' ? 'changed' : 'done')}
      onResolve={async () => (params.get('act') === 'failed' ? 'failed' : params.get('act') === 'changed' ? 'changed' : 'done')}
      onReview={async () => (params.get('review') === 'already' ? 'already' : params.get('review') === 'failed' ? 'failed' : 'done')} />
  </div></main>),
  'staff-console-overview': consoleScreen('staff-console-overview', ({ api, viewer }) => <StaffOverview api={api} viewer={viewer} onNavigate={() => {}} />),
  'staff-console-users': consoleScreen('staff-console-users', ({ api, viewer }) => <StaffUsers api={api} viewer={viewer} />),
  'staff-console-roles': consoleScreen('staff-console-roles', ({ api }) => <StaffAccess api={api} />),
  'staff-console-audit': consoleScreen('staff-console-audit', ({ api }) => <StaffAudit api={api} />),
  'staff-console-reports': consoleScreen('staff-console-reports', ({ api }) => <StaffReports api={api} />),
  'staff-console-emails': consoleScreen('staff-console-emails', ({ api }) => <StaffEmails api={api} />),
  /* W2T.2: ?view=courses|review|live|quality (Content), ?view=live|history|trends|coach (Generation). The preview has no lesson player. */
  'staff-console-content': framed(({ params }: PreviewContext) => <ConsoleFixture id="staff-console-content" params={params}
    render={({ api }) => <StaffContent api={api} initialView={contentView(params.get('view'))} />} />),
  'staff-console-generation': framed(({ params }: PreviewContext) => <ConsoleFixture id="staff-console-generation" params={params}
    render={({ api }) => <StaffGeneration api={api} initialView={generationView(params.get('view'))} />} />),
  'staff-console-mentor-quality': consoleScreen('staff-console-mentor-quality', ({ api }) => <StaffMentorQuality api={api} />),
  /* W2T.3: ?view=audience|web|behavior|health|tools (Analytics & Health), ?view=overview|insights|retention|people|operations (Learning intel). */
  'staff-console-analytics': framed(({ params }: PreviewContext) => <ConsoleFixture id="staff-console-analytics" params={params}
    render={({ api, viewer }) => <StaffAnalytics api={api} viewer={viewer} initialView={analyticsView(params.get('view'))} />} />),
  'staff-console-intel': framed(({ params }: PreviewContext) => <ConsoleFixture id="staff-console-intel" params={params}
    render={({ api, viewer }) => <StaffIntel api={api} viewer={viewer} initialView={intelView(params.get('view'))} />} />),
};
