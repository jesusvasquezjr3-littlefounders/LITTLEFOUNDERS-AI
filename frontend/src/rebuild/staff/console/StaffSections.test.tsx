import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import enCore from '@/i18n/en-US/rebuild-core.json';
import sections from './staffSectionFixtures.json';
import type { StaffApi, StaffResult } from './staffConsoleApi';
import { releaseRefusal, RELEASE_REFUSALS } from './contentApi';
import { alertsFor, mapLiveRow, type LiveFeed, type LiveFeedStatus, type LiveRun } from './generationApi';
import { StaffContent, type LessonPreviewRequest } from './StaffContent';
import { StaffGeneration } from './StaffGeneration';
import { StaffMentorQuality } from './StaffMentorQuality';

/*
 * W2T.2: Content (S2 with B.3, G.2, C.5, C.6, G.3 and the S05.3d panel),
 * Generation (S7) and Mentor quality (C.24) at the component boundary. Every
 * read and write goes to the Core path the legacy page used (or the wave-1
 * route), each state (loading, empty, error, refused, offline) has its own
 * screen, and every release refusal is named with its next step. The
 * real-route matrix (scripts/verify-staff-console.mjs) repeats the population
 * and layout checks in Chrome.
 */

const c = en.staffConsole;
const live = en.staffLiveContent;
const nav = enCore.appShell.staff;
const COURSE_DRAFT = sections.content.courses[1]!;
const LESSON = sections.lessonDetail;

type Handler = (path: string, body?: unknown) => StaffResult<unknown> | undefined;
function fakeApi(handler: Handler = () => undefined) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return (handler(path) ?? answer(path) ?? { ok: false, code: 'NOT_IN_TEST' }) as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return (handler(path, body) ?? { ok: true, data: {} }) as StaffResult<T>; },
  };
  return { api, gets, posts };
}
const ok = <T,>(data: T): StaffResult<T> => ({ ok: true, data });
const fail = (code: string, failures?: string[]): StaffResult<never> => ({ ok: false, code, ...(failures ? { failures } : {}) });

/** The fixtures every screen reads by default (the same file the preview and the audit answer from). */
function answer(path: string): StaffResult<unknown> | undefined {
  const route = path.split('?')[0]!;
  const g = sections.generation;
  const table: Record<string, unknown> = {
    '/admin/content': sections.content, '/admin/moderation': sections.moderation, [`/admin/moderation/${LESSON.id}`]: LESSON,
    '/admin/tutor/review-queue': sections.liveQueue, '/admin/tutor/live-content/status': sections.liveStatus, '/admin/tutor/packs': sections.packs,
    '/admin/content/learning-quality': sections.learningQuality, '/admin/generation': g.overview, '/admin/generation/live': g.live,
    '/admin/generation/analytics': g.analytics, '/admin/generation/coach': g.coach, '/admin/generation/compare': g.compare, '/admin/mentor-quality': sections.mentorQuality,
    '/admin/content/lesson-versions': sections.lessonVersions, '/admin/content/bypass-checks': sections.bypassChecks,
  };
  if (route in table) return ok(table[route]);
  if (route.startsWith('/admin/generation/runs/')) return ok(g.runDetail);
  if (route.startsWith('/admin/generation/slots/')) return ok(g.slotDetail);
  if (route.startsWith('/admin/generation/snapshots/')) return ok(g.snapshots);
  return undefined;
}

function Frame({ children, locale = 'en-US' }: { children: ReactNode; locale?: Locale }) {
  return <RebuildRoot theme="light" locale={locale}><RebuildProvider environment={{ theme: 'light', locale }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ------------------------------------------------------------------------- */

describe('G.2 Live updates: a live lesson changes only on a staff release; skipped checks and their rates', () => {
  const VERSION = sections.lessonVersions.versions[0]!;
  const base = `/admin/content/lessons/${VERSION.lessonId}/versions/${VERSION.documentVersionId}`;

  async function openVersion() {
    const table = await screen.findByRole('table', { name: c.content.heading.updates });
    const row = within(table).getAllByRole('row').find((entry) => entry.textContent?.includes(VERSION.versionId))!;
    fireEvent.click(within(row).getByRole('button', { name: c.common.action.open }));
    return screen.findByRole('dialog', { name: c.content.heading.version });
  }

  it('lists the waiting versions and the skipped checks with both Appendix N rates and the overdue notice', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffContent api={api} initialView="updates" /></Frame>);
    const table = await screen.findByRole('table', { name: c.content.heading.updates });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(table).toHaveTextContent(VERSION.lessonTitle['en-US']);
    const checks = await screen.findByRole('region', { name: c.content.heading.checks });
    expect(checks).toHaveTextContent(c.content.body.bypassRate);
    expect(checks).toHaveTextContent('8.3%');
    expect(checks).toHaveTextContent('66.7%');
    expect(checks).toHaveTextContent(c.content.body.overdueNotice.replace('{n}', '1'));
    expect(within(checks).getByRole('table')).toHaveTextContent(c.content.option.overdue);
    expect(gets).toEqual(expect.arrayContaining(['/admin/content/lesson-versions', '/admin/content/bypass-checks']));
  });

  it('releases behind a keep-first confirmation, posts to the version route and says learners see it', async () => {
    const { api, posts } = fakeApi();
    render(<Frame><StaffContent api={api} initialView="updates" /></Frame>);
    const details = await openVersion();
    expect(details).toHaveTextContent(c.content.body.releaseCheckNote);
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.release }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(c.content.body.consequenceRelease);
    expect(within(confirm).getAllByRole('button')[0]).toHaveTextContent(c.content.action.keep);
    fireEvent.click(within(confirm).getByRole('button', { name: c.content.action.release }));
    await waitFor(() => expect(posts).toEqual([{ path: `${base}/release`, body: {} }]));
    expect(await screen.findByText(c.content.body.versionReleased)).toBeInTheDocument();
  });

  it('names the release refusals: a stale course check, and a version someone already decided', async () => {
    for (const [code, text] of [['RELEASE_VERIFICATION_REQUIRED', c.content.body.releaseVerificationRequired], ['VERSION_NOT_PENDING', c.content.body.versionNotPending]] as const) {
      const { api } = fakeApi((path, body) => (body ? fail(code) : undefined));
      render(<Frame><StaffContent api={api} initialView="updates" /></Frame>);
      const details = await openVersion();
      fireEvent.click(within(details).getByRole('button', { name: c.content.action.release }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: c.content.action.release }));
      expect(await within(details).findByText(text)).toBeInTheDocument();
      cleanup();
    }
  });

  it('a rejection needs a reason of at least 10 characters and posts it', async () => {
    const { api, posts } = fakeApi();
    render(<Frame><StaffContent api={api} initialView="updates" /></Frame>);
    const details = await openVersion();
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.reject }));
    const submit = within(details).getByRole('button', { name: c.content.action.rejectVersion });
    fireEvent.change(within(details).getByLabelText(c.content.body.reason), { target: { value: 'short' } });
    expect(submit).toBeDisabled();
    fireEvent.change(within(details).getByLabelText(c.content.body.reason), { target: { value: 'The example uses a foreign currency.' } });
    fireEvent.click(submit);
    await waitFor(() => expect(posts).toEqual([{ path: `${base}/reject`, body: { reason: 'The example uses a foreign currency.' } }]));
    expect(await screen.findByText(c.content.body.versionRejected)).toBeInTheDocument();
  });

  it('shows the empty states, and a failed read of the checks is an error, never a calm zero', async () => {
    const empty = fakeApi((path) => (path === '/admin/content/lesson-versions' ? ok({ versions: [], total: 0 })
      : path === '/admin/content/bypass-checks' ? fail('DATA_UNAVAILABLE') : undefined));
    render(<Frame><StaffContent api={empty.api} initialView="updates" /></Frame>);
    expect(await screen.findByText(c.content.body.updatesEmpty)).toBeInTheDocument();
    const checks = await screen.findByRole('region', { name: c.content.heading.checks });
    expect(await within(checks).findByText(c.common.heading.loadFailed)).toBeInTheDocument();
    expect(checks).not.toHaveTextContent(c.content.body.bypassRate);
  });
});

/* ------------------------------------------------------------------------- */

describe('S2 Content: courses, the B.3 incident counter and the G.2 release preflight', () => {
  it('shows the page, the six counts and every course learners could not open (B.3), and asks for nothing else first', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffContent api={api} /></Frame>);
    expect(await screen.findByRole('heading', { level: 1, name: nav.content })).toBeInTheDocument();
    const incidents = await screen.findByRole('region', { name: c.content.heading.incidents });
    expect(incidents).toHaveTextContent(c.content.body.incidents);
    expect(incidents).toHaveTextContent(COURSE_DRAFT.title);
    expect(incidents).toHaveTextContent(/14 times, last on/);
    for (const label of [c.content.body.courses, c.content.body.coursesLive, c.content.body.inReview, c.content.body.drafts]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(gets).toEqual(['/admin/content']);
  });

  it('an older Core without the incident list reads as none recorded; a malformed one is an error, never a calm page', async () => {
    const { api } = fakeApi((path) => (path === '/admin/content' ? ok({ ...sections.content, courseAssemblyIncidents: undefined }) : undefined));
    render(<Frame><StaffContent api={api} /></Frame>);
    await screen.findByRole('table', { name: c.content.heading.courses });
    expect(screen.queryByRole('region', { name: c.content.heading.incidents })).toBeNull();
    cleanup();
    const bad = fakeApi((path) => (path === '/admin/content' ? ok({ ...sections.content, courseAssemblyIncidents: [{ courseId: 1 }] }) : undefined));
    render(<Frame><StaffContent api={bad.api} /></Frame>);
    expect(await screen.findByText(c.common.heading.loadFailed)).toBeInTheDocument();
  });

  it('filters courses by text and status on the loaded list', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffContent api={api} /></Frame>);
    const table = await screen.findByRole('table', { name: c.content.heading.courses });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText(c.content.body.status), { target: { value: 'archived' } });
    expect(within(screen.getByRole('table', { name: c.content.heading.courses })).getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: c.common.action.clearFilters }));
    fireEvent.change(screen.getByLabelText(c.content.body.search), { target: { value: 'lemonade' } });
    expect(within(screen.getByRole('table', { name: c.content.heading.courses })).getAllByRole('row')).toHaveLength(2);
  });

  async function openDraftCourse() {
    const table = await screen.findByRole('table', { name: c.content.heading.courses });
    const row = within(table).getAllByRole('row').find((entry) => entry.textContent?.includes(COURSE_DRAFT.title))!;
    fireEvent.click(within(row).getByRole('button', { name: c.common.action.open }));
    return screen.findByRole('dialog', { name: c.content.heading.course });
  }

  it('publishing is a release behind a keep-first confirmation; a success says so and re-reads the list', async () => {
    const { api, gets, posts } = fakeApi();
    render(<Frame><StaffContent api={api} /></Frame>);
    const details = await openDraftCourse();
    expect(details).toHaveTextContent(c.content.body.releaseNote);
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.publish }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(c.content.body.consequencePublish);
    expect(within(confirm).getAllByRole('button')[0]).toHaveTextContent(c.content.action.keep);
    fireEvent.click(within(confirm).getByRole('button', { name: c.content.action.publish }));
    await waitFor(() => expect(posts).toEqual([{ path: `/admin/content/${COURSE_DRAFT.id}/status`, body: { status: 'published' } }]));
    expect(await screen.findByText(c.content.body.published)).toBeInTheDocument();
    expect(gets.filter((path) => path === '/admin/content')).toHaveLength(2);
  });

  it('names each release refusal with its next step (G.2), and an unknown one as blocked', async () => {
    for (const [code, key] of [['RELEASE_VERIFICATION_REQUIRED', 'releaseVerificationRequired'], ['RELEASE_VERIFICATION_INCOMPLETE', 'releaseVerificationIncomplete'],
      ['RELEASE_INCOMPLETE_LOCALES', 'releaseLocales'], ['RELEASE_SOMETHING_NEW', 'releaseBlocked']] as const) {
      const { api } = fakeApi((path, body) => (body ? fail(code) : undefined));
      render(<Frame><StaffContent api={api} /></Frame>);
      const details = await openDraftCourse();
      fireEvent.click(within(details).getByRole('button', { name: c.content.action.publish }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: c.content.action.publish }));
      const refusal = await within(details).findByRole('heading', { name: c.content.heading.refused });
      expect(refusal.parentElement).toHaveTextContent(c.content.body[key]);
      expect(refusal.parentElement).toHaveAttribute('data-refusal', code);
      cleanup();
    }
    expect(releaseRefusal('FORBIDDEN')).toBeNull();
    expect(Object.keys(RELEASE_REFUSALS)).toHaveLength(9);
  });

  it('a write that fails for another reason says it did not save; archiving is a destructive confirmation', async () => {
    const { api } = fakeApi((path, body) => (body ? fail('DATA_UNAVAILABLE') : undefined));
    render(<Frame><StaffContent api={api} /></Frame>);
    const details = await openDraftCourse();
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.archive }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(c.content.body.consequenceArchive);
    fireEvent.click(within(confirm).getByRole('button', { name: c.content.action.archive }));
    expect(await within(details).findByText(c.common.body.actionFailed)).toBeInTheDocument();
  });

  it('a refused read (the grant withdrawn) and an offline browser each have their own state', async () => {
    const { api } = fakeApi((path) => (path === '/admin/content' ? fail('FORBIDDEN') : undefined));
    render(<Frame><StaffContent api={api} /></Frame>);
    expect(await screen.findByText(c.common.heading.refused)).toBeInTheDocument();
    cleanup();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const offline = fakeApi((path) => (path === '/admin/content' ? fail('OFFLINE') : undefined));
    render(<Frame><StaffContent api={offline.api} /></Frame>);
    expect(await screen.findByText(c.common.heading.offline)).toBeInTheDocument();
    expect(screen.getByText(c.common.body.offlineNotice)).toBeInTheDocument();
  });
});

describe('S2 Content: the lesson review queue', () => {
  async function openLesson(renderLessonPreview?: (request: LessonPreviewRequest) => ReactNode, handler?: Handler) {
    const fake = fakeApi(handler);
    render(<Frame><StaffContent api={fake.api} initialView="review" renderLessonPreview={renderLessonPreview} /></Frame>);
    const table = await screen.findByRole('table', { name: c.content.heading.review });
    fireEvent.click(within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: c.common.action.open }));
    const details = await screen.findByRole('dialog', { name: c.content.heading.lesson });
    await within(details).findByText(LESSON.title);
    return { ...fake, details };
  }

  it('opens straight on the queue from ?view=review and reads only the queue and the content summary', async () => {
    const { gets } = await openLesson();
    expect(gets.sort()).toEqual(['/admin/content', '/admin/moderation', `/admin/moderation/${LESSON.id}`]);
  });

  it('previews in the learner\'s own player, in the chosen language, and comes back to the review', async () => {
    const preview = vi.fn((request: LessonPreviewRequest) => <div data-testid="player"><button type="button" onClick={request.onExit}>exit</button></div>);
    const { details } = await openLesson(preview);
    fireEvent.click(within(details).getByRole('radio', { name: 'es-MX' }));
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.openPlayer }));
    expect(await screen.findByTestId('player')).toBeInTheDocument();
    const request = preview.mock.calls.at(-1)![0];
    expect(request.locale).toBe('es-MX');
    expect(request.document).toEqual(LESSON.documents[1]!.document);
    expect(request.labels).toEqual({ start: c.content.action.startPreview, next: c.content.action.nextPreview, loading: c.content.body.previewLoading });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    expect(await screen.findByRole('dialog', { name: c.content.heading.lesson })).toBeInTheDocument();
  });

  it('without a player (the preview entry) says so instead of offering a dead button', async () => {
    const { details } = await openLesson();
    expect(details).toHaveTextContent(c.content.body.previewUnavailable);
    expect(within(details).queryByRole('button', { name: c.content.action.openPlayer })).toBeNull();
  });

  it('inspects parts (with their linked audio), media and the client-safe document, read-only', async () => {
    const { details } = await openLesson();
    fireEvent.click(within(details).getByRole('radio', { name: c.content.option.parts }));
    expect(details).toHaveTextContent('1. Think about the things you need each day.');
    const show = within(details).getAllByRole('button', { name: c.content.action.showPart })[0]!;
    fireEvent.click(show);
    expect(show).toHaveAttribute('aria-expanded', 'true');
    expect(details.querySelector('.lf-staff-part audio')?.getAttribute('src')).toContain('/en-US/story-1.mp3');
    fireEvent.click(within(details).getByRole('radio', { name: c.content.option.media }));
    expect(details.querySelectorAll('.lf-staff-media audio')).toHaveLength(1);
    expect(within(details).getByRole('img')).toHaveAttribute('src', '/course-badges/financial-education.png');
    fireEvent.click(within(details).getByRole('radio', { name: c.content.option.data }));
    expect(details).toHaveTextContent(c.content.body.documentNote);
    expect(details.querySelector('.lf-staff-code')?.textContent).toContain('"segments"');
  });

  it('approving is a release (G.2): a refusal names the reason; sending back returns the lesson to draft; the queue re-reads on close', async () => {
    const { details, posts, gets } = await openLesson(undefined, (path, body) => (body && (body as { status: string }).status === 'published' ? fail('RELEASE_COURSE_RELEASE_REQUIRED') : undefined));
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.approve }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: c.content.action.approve }));
    expect(await within(details).findByText(c.content.body.releaseCourseRequired)).toBeInTheDocument();
    fireEvent.click(within(details).getByRole('button', { name: c.content.action.sendBack }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(c.content.body.consequenceReturn);
    fireEvent.click(within(confirm).getByRole('button', { name: c.content.action.sendBack }));
    expect(await within(details).findByText(c.content.body.returned)).toBeInTheDocument();
    expect(posts.map((post) => post.body)).toEqual([{ status: 'published' }, { status: 'draft' }]);
    expect(within(details).queryByRole('button', { name: c.content.action.approve })).toBeNull();
    const before = gets.filter((path) => path === '/admin/moderation').length;
    fireEvent.click(within(details).getByRole('button', { name: c.common.action.close }));
    await waitFor(() => expect(gets.filter((path) => path === '/admin/moderation').length).toBe(before + 1));
  });

  it('an empty queue says so', async () => {
    const { api } = fakeApi((path) => (path === '/admin/moderation' ? ok({ lessons: [], total: 0 }) : undefined));
    render(<Frame><StaffContent api={api} initialView="review" /></Frame>);
    expect(await screen.findByText(c.content.body.reviewEmpty)).toBeInTheDocument();
  });
});

describe('S2 Content: live Mentor activities (C.5, G.3) and activity packs (C.6)', () => {
  it('shows the C.5 status, the sampled queue with each topic type (or that none was recorded), and the packs', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffContent api={api} initialView="live" /></Frame>);
    expect(await screen.findByRole('heading', { name: live.title })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: c.content.heading.queue });
    expect(table).toHaveTextContent(live.category.standard);
    expect(table).toHaveTextContent(live.category.sensitive);
    expect(table).toHaveTextContent(c.content.body.notRecorded);
    expect(await screen.findByRole('heading', { name: live.packsTitle })).toBeInTheDocument();
    expect(gets).toEqual(expect.arrayContaining(['/admin/tutor/live-content/status', '/admin/tutor/review-queue', '/admin/tutor/packs?status=review']));
  });

  it('three equal verdicts, the answer key visible, the decision audited; the queue and status re-read on close', async () => {
    const { api, posts, gets } = fakeApi();
    render(<Frame><StaffContent api={api} initialView="live" /></Frame>);
    const table = await screen.findByRole('table', { name: c.content.heading.queue });
    fireEvent.click(within(within(table).getAllByRole('row')[2]!).getByRole('button', { name: c.common.action.open }));
    const details = await screen.findByRole('dialog', { name: c.content.heading.activity });
    expect(details).toHaveTextContent('Your family is moving');
    expect(details.querySelector('.lf-staff-code')?.textContent).toContain('"correct": "Wait"');
    expect(details).toHaveTextContent(c.content.body.auditNote);
    const verdicts = within(within(details).getByRole('group', { name: live.reviewLabel })).getAllByRole('button');
    expect(verdicts.map((button) => button.textContent)).toEqual([live.approve, live.quality, live.safety]);
    expect(new Set(verdicts.map((button) => button.className)).size).toBe(1);
    fireEvent.click(verdicts[2]!);
    expect(await within(details).findByText(live.decided)).toBeInTheDocument();
    expect(posts).toEqual([{ path: `/admin/tutor/review-queue/${sections.liveQueue.segments[1]!.id}/status`, body: { status: 'rejected', issue: 'safety' } }]);
    const [queueBefore, statusBefore] = [gets.filter((p) => p === '/admin/tutor/review-queue').length, gets.filter((p) => p === '/admin/tutor/live-content/status').length];
    fireEvent.click(within(details).getByRole('button', { name: c.common.action.close }));
    await waitFor(() => expect(gets.filter((p) => p === '/admin/tutor/review-queue').length).toBe(queueBefore + 1));
    expect(gets.filter((p) => p === '/admin/tutor/live-content/status').length).toBe(statusBefore + 1);
  });

  it('a verdict someone else already gave says so; a failed one can be tried again', async () => {
    let answer: StaffResult<never> = fail('ALREADY_DECIDED');
    const { api } = fakeApi((path, body) => (body ? answer : undefined));
    render(<Frame><StaffContent api={api} initialView="live" /></Frame>);
    const table = await screen.findByRole('table', { name: c.content.heading.queue });
    fireEvent.click(within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: c.common.action.open }));
    const details = await screen.findByRole('dialog', { name: c.content.heading.activity });
    fireEvent.click(within(details).getByRole('button', { name: live.approve }));
    expect(await within(details).findByText(live.alreadyDecided)).toBeInTheDocument();
    fireEvent.click(within(details).getByRole('button', { name: c.common.action.close }));
    answer = fail('DATA_UNAVAILABLE');
    fireEvent.click(within(within(await screen.findByRole('table', { name: c.content.heading.queue })).getAllByRole('row')[1]!).getByRole('button', { name: c.common.action.open }));
    const again = await screen.findByRole('dialog', { name: c.content.heading.activity });
    fireEvent.click(within(again).getByRole('button', { name: live.quality }));
    expect(await within(again).findByText(live.decideFailed)).toBeInTheDocument();
    expect(within(again).getByRole('button', { name: live.quality })).toBeEnabled();
  });

  it('a pack refused by the tutor-pack.v1 contract lists every reason Core gave', async () => {
    const { api, posts } = fakeApi((path, body) => (body ? fail('PACK_CONTRACT_FAILED', ['segment a: the key names no option', 'tier 1 is below tier_min 2']) : undefined));
    render(<Frame><StaffContent api={api} initialView="live" /></Frame>);
    await screen.findByRole('heading', { name: live.packsTitle });
    fireEvent.click(screen.getAllByRole('button', { name: live.publish })[0]!);
    expect(await screen.findByText('segment a: the key names no option')).toBeInTheDocument();
    expect(screen.getByText('tier 1 is below tier_min 2')).toBeInTheDocument();
    expect(posts[0]).toEqual({ path: `/admin/tutor/packs/${sections.packs.packs[0]!.id}/status`, body: { status: 'published' } });
  });

  it('a live-status read that fails offers a retry; an empty queue says nothing is sampled', async () => {
    const { api, gets } = fakeApi((path) => (path === '/admin/tutor/live-content/status' ? fail('DATA_UNAVAILABLE')
      : path === '/admin/tutor/review-queue' ? ok({ segments: [], total: 0 }) : undefined));
    render(<Frame><StaffContent api={api} initialView="live" /></Frame>);
    expect(await screen.findByText(live.loadFailed)).toBeInTheDocument();
    expect(await screen.findByText(c.content.body.queueEmpty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: c.common.action.retry }));
    await waitFor(() => expect(gets.filter((path) => path === '/admin/tutor/live-content/status')).toHaveLength(2));
  });
});

describe('S2 Content: learning quality (S05.3d)', () => {
  it('reads Core\'s report and records a decision; a review already decided is a conflict', async () => {
    const { api, posts } = fakeApi((path, body) => (body && path.endsWith('/resolve') ? fail('REVIEW_RESOLVED') : undefined));
    render(<Frame><StaffContent api={api} initialView="quality" /></Frame>);
    const review = await screen.findByRole('form');
    fireEvent.click(within(review).getByRole('radio', { name: 'Keep as is' }));
    fireEvent.change(within(review).getByLabelText('Decision note'), { target: { value: 'Still watching this one.' } });
    fireEvent.click(within(review).getByRole('button', { name: 'Record decision' }));
    expect(await within(review).findByRole('alert')).toHaveTextContent('Someone already decided this review.');
    expect(posts[0]!.path).toBe('/admin/content/learning-quality/reviews/bbbbbbbb-0000-4000-8000-000000000001/resolve');
  });
});

/* ------------------------------------------------------------------------- */

const LIVE_RUN = sections.generation.live.activeRuns[0]! as LiveRun;

describe('S7 Generation: the live monitor', () => {
  it('polls Core, names the transport, and shows the run, its stages in words and the alerts it trips', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffGeneration api={api} pollMs={60_000} /></Frame>);
    expect(await screen.findByRole('heading', { level: 1, name: nav.generation })).toBeInTheDocument();
    await screen.findByRole('heading', { name: c.generation.heading.run });
    expect(document.querySelector('.lf-staff-transport')).toHaveTextContent(c.generation.body.polling);
    const alerts = screen.getByRole('region', { name: c.generation.heading.alerts });
    expect(alerts.querySelectorAll('[data-alert]')).toHaveLength(3);
    expect(alerts).toHaveTextContent(/Projected cost:/);
    const stages = document.querySelector('.lf-staff-stages')!;
    expect(stages.querySelector('[data-stage="writing"]')).toHaveTextContent(c.generation.body.working);
    expect(stages.querySelector('[data-stage="published"]')).toHaveTextContent(c.generation.body.done);
    expect(stages.querySelector('[data-stage="pending"]')).toHaveTextContent(c.generation.body.waiting);
    expect(gets).toEqual(['/admin/generation/live']);
  });

  it('with no active run says so; a failed poll says it keeps trying', async () => {
    const { api } = fakeApi((path) => (path === '/admin/generation/live' ? ok({ activeRuns: [] }) : undefined));
    render(<Frame><StaffGeneration api={api} pollMs={60_000} /></Frame>);
    expect(await screen.findByText(c.generation.body.idle)).toBeInTheDocument();
    cleanup();
    const down = fakeApi((path) => (path === '/admin/generation/live' ? fail('DATA_UNAVAILABLE') : undefined));
    render(<Frame><StaffGeneration api={down.api} pollMs={60_000} /></Frame>);
    expect((await screen.findAllByText(c.generation.body.liveFailed)).length).toBeGreaterThan(0);
  });

  it('a push feed accelerates (a pushed run appears), and a failed push is reported, not passed off as polling', async () => {
    let handlers: Parameters<LiveFeed['subscribe']>[0] | null = null;
    const stop = vi.fn();
    const feed: LiveFeed = { subscribe: (h) => { handlers = h; return stop; } };
    const { api } = fakeApi((path) => (path === '/admin/generation/live' ? ok({ activeRuns: [] }) : undefined));
    const { unmount } = render(<Frame><StaffGeneration api={api} liveFeed={feed} pollMs={60_000} /></Frame>);
    await screen.findByText(c.generation.body.idle);
    act(() => { handlers!.onStatus('connected' as LiveFeedStatus); handlers!.onRun({ ...LIVE_RUN, runId: 'pushed-run' }); });
    expect(await screen.findByText('pushed-run')).toBeInTheDocument();
    expect(document.querySelector('.lf-staff-transport')).toHaveTextContent(c.generation.body.realtime);
    act(() => handlers!.onStatus('failed'));
    expect(document.querySelector('.lf-staff-transport')).toHaveTextContent(c.generation.body.realtimeFailed);
    act(() => handlers!.onRemove('pushed-run'));
    expect(await screen.findByText(c.generation.body.idle)).toBeInTheDocument();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('maps an untrusted push row and never lets a bad number through', () => {
    const run = mapLiveRow({ run_id: 'r', course_slug: 'c', total_slots: '8', failed_slots: -3, usd_used: 'x', stage_breakdown: { writing: '2', bad: 'no', neg: -1 }, updated_at: '2026-09-26T00:00:00Z' });
    expect(run).toMatchObject({ runId: 'r', totalSlots: 8, failedSlots: 0, usdUsed: 0, stageBreakdown: { writing: 2 } });
  });
});

describe('S7 Generation: run history, trends and the coach', () => {
  it('lists tracks (a halted one with its reason), a run\'s lessons and failure stages, one lesson\'s details and its timeline', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffGeneration api={api} initialView="history" pollMs={60_000} /></Frame>);
    const tracks = await screen.findByRole('region', { name: c.generation.heading.tracks });
    expect(tracks).toHaveTextContent(c.generation.body.halted);
    expect(tracks).toHaveTextContent('budget ceiling reached');
    const table = await screen.findByRole('table', { name: c.generation.heading.slots });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(table).toHaveTextContent(c.generation.option.stage_reviewing);
    expect(table).toHaveTextContent(c.generation.body.salvaged);
    expect(await screen.findByRole('heading', { name: c.generation.heading.timeline })).toBeInTheDocument();
    // The series are the design-system TrendChart (named figure, written summary, Show as table); a stage's small multiple is a sparkline named in words.
    const timeline = screen.getByRole('figure', { name: c.generation.heading.timeline });
    expect(timeline).toHaveTextContent(/Latest .+, highest /);
    expect(within(timeline).getByRole('button', { name: c.chart.action.table })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Latest .+, highest / }).length).toBeGreaterThan(0);
    fireEvent.click(within(within(table).getAllByRole('row')[3]!).getByRole('button', { name: c.common.action.open }));
    const details = await screen.findByRole('dialog', { name: c.generation.heading.slot });
    expect(await within(details).findByText(/kid_safety 2.1 below floor/)).toBeInTheDocument();
    expect(gets).toEqual(expect.arrayContaining(['/admin/generation', `/admin/generation/runs/${encodeURIComponent(sections.generation.overview.runs[0]!.runId)}`]));
  });

  it('compares two different runs only when two are chosen', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffGeneration api={api} initialView="history" pollMs={60_000} /></Frame>);
    const compare = await screen.findByRole('region', { name: c.generation.heading.compare });
    const [a, b] = sections.generation.overview.runs.map((run) => run.runId);
    fireEvent.change(within(compare).getByLabelText(c.generation.body.runA), { target: { value: b } });
    fireEvent.change(within(compare).getByLabelText(c.generation.body.runB), { target: { value: b } });
    expect(within(compare).getByText(c.generation.body.chooseTwo, { selector: '.lf-notice *, .lf-notice' })).toBeInTheDocument();
    expect(gets.some((path) => path.startsWith('/admin/generation/compare'))).toBe(false);
    fireEvent.change(within(compare).getByLabelText(c.generation.body.runB), { target: { value: a } });
    expect(await within(compare).findByRole('table', { name: c.generation.heading.judgeCompare })).toBeInTheDocument();
    expect(gets).toContain(`/admin/generation/compare?runA=${encodeURIComponent(b!)}&runB=${encodeURIComponent(a!)}`);
  });

  it('reads trends newest first: the latest run is the first entry (the legacy banner compared the two oldest)', () => {
    const alerts = alertsFor(null, sections.generation.analytics as never);
    expect(alerts).toEqual([{ id: 'qualityDrop', severity: 'warning', dimension: 'kid_safety', from: 4.7, to: 3.7 }]);
    const spike = alertsFor(null, { ...sections.generation.analytics, costTrend: [{ runId: 'n', updatedAt: '', usdPerPublished: 2 }, ...sections.generation.analytics.costTrend.slice(1)] } as never);
    expect(spike.map((alert) => alert.id)).toContain('costSpike');
  });

  it('trends show the averages, the success rate, the forecast and the latest run\'s judge scores; no data is its own state', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffGeneration api={api} initialView="trends" pollMs={60_000} /></Frame>);
    expect(await screen.findByRole('heading', { name: c.generation.heading.quality })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: c.generation.heading.alerts })).toHaveTextContent(/Kid safety fell from 4.70 to 3.70/);
    expect(screen.getByText(/A 500-lesson course: about/)).toBeInTheDocument();
    cleanup();
    const none = fakeApi((path) => (path === '/admin/generation/analytics' ? fail('DATA_UNAVAILABLE') : undefined));
    render(<Frame><StaffGeneration api={none.api} initialView="trends" pollMs={60_000} /></Frame>);
    expect(await screen.findByText(c.generation.body.trendsEmpty)).toBeInTheDocument();
  });

  it('the coach lists its evidence-backed proposals and says it costs nothing to run', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffGeneration api={api} initialView="coach" pollMs={60_000} /></Frame>);
    expect(await screen.findByText(c.generation.body.deterministic)).toBeInTheDocument();
    const proposals = screen.getByRole('region', { name: c.generation.heading.actions });
    expect(proposals.querySelectorAll('[data-tag]')).toHaveLength(2);
    expect(proposals).toHaveTextContent('6 of 9 judging failures cite it');
  });
});

/* ------------------------------------------------------------------------- */

describe('C.24 Mentor quality on its real route', () => {
  it('one h1 (the navigation label), the status panel as "Data status", flags and signals', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffMentorQuality api={api} /></Frame>);
    expect(await screen.findByRole('heading', { level: 1, name: nav.mentorQuality })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: c.mentorQuality.heading.status })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: en.staffMentorQuality.flagsTitle })).toBeInTheDocument();
    expect(gets).toEqual(['/admin/mentor-quality']);
  });

  it('a named owner acknowledges through Core; Core\'s NOT_NAMED_OWNER refusal is said in words', async () => {
    const { api, posts } = fakeApi((path, body) => (body !== undefined && path.endsWith('/acknowledge') ? fail('NOT_NAMED_OWNER') : undefined));
    render(<Frame><StaffMentorQuality api={api} /></Frame>);
    const acknowledge = (await screen.findAllByRole('button', { name: en.staffMentorQuality.acknowledge }))[0]!;
    fireEvent.click(acknowledge);
    expect(await screen.findByText(en.staffMentorQuality.notOwner)).toBeInTheDocument();
    expect(posts[0]!.path).toMatch(/^\/admin\/mentor-quality\/flags\/.+\/acknowledge$/);
    expect(posts[0]!.body).toEqual({});
  });

  it('GAP-FIX-R2: lists the latest release audit of each kind, and a named owner records only the kinds of their roles', async () => {
    const { api, posts } = fakeApi();
    render(<Frame><StaffMentorQuality api={api} /></Frame>);
    const card = (await screen.findByRole('heading', { level: 2, name: c.mentorQuality.heading.audits })).closest('section, div[class*="card"], article') as HTMLElement ?? document.body;
    const list = await screen.findByRole('list', { name: c.mentorQuality.heading.audits });
    expect(list).toHaveTextContent(c.mentorQuality.option.dark_pattern);
    expect(list).toHaveTextContent(c.mentorQuality.body.notRecorded);
    expect(list).toHaveTextContent(c.mentorQuality.body.findingsValue.replace('{n}', '2'));
    const kinds = within(card).getByLabelText(c.mentorQuality.body.auditKind) as HTMLSelectElement;
    expect([...kinds.options].map((o) => o.value)).toEqual(['dark_pattern', 'variable_ratio', 'reward_framing']);
    fireEvent.change(within(card).getByLabelText(c.mentorQuality.body.release), { target: { value: 'release-2026.10' } });
    fireEvent.click(within(card).getByRole('radio', { name: c.mentorQuality.option.fail }));
    fireEvent.change(within(card).getByLabelText(c.mentorQuality.body.findings), { target: { value: '3' } });
    fireEvent.click(within(card).getByRole('button', { name: c.mentorQuality.action.recordAudit }));
    await waitFor(() => expect(posts).toEqual([{ path: '/admin/mentor-quality/audits', body: { kind: 'dark_pattern', releaseId: 'release-2026.10', result: 'fail', findingCount: 3 } }]));
    expect(await screen.findByText(c.mentorQuality.body.auditRecorded)).toBeInTheDocument();
  });

  it('GAP-FIX-R2: a viewer named for no role sees no form; Core\'s refusals are said in words', async () => {
    const plain = fakeApi((path) => (path === '/admin/mentor-quality' ? ok({ ...sections.mentorQuality, viewerOwnerRoles: [] }) : undefined));
    render(<Frame><StaffMentorQuality api={plain.api} /></Frame>);
    expect(await screen.findByText(c.mentorQuality.body.ownersRecord)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: c.mentorQuality.action.recordAudit })).toBeNull();
    cleanup();
    const refused = fakeApi((path, body) => (body !== undefined && path === '/admin/mentor-quality/audits' ? fail('ALREADY_RECORDED') : undefined));
    render(<Frame><StaffMentorQuality api={refused.api} /></Frame>);
    fireEvent.change(await screen.findByLabelText(c.mentorQuality.body.release), { target: { value: 'release-2026.09' } });
    fireEvent.click(screen.getByRole('button', { name: c.mentorQuality.action.recordAudit }));
    expect(await screen.findByText(c.mentorQuality.body.auditDuplicate)).toBeInTheDocument();
  });

  it('a refused read (view_analytics withdrawn) is the console\'s refused state with a retry', async () => {
    const { api } = fakeApi((path) => (path === '/admin/mentor-quality' ? fail('FORBIDDEN') : undefined));
    render(<Frame><StaffMentorQuality api={api} /></Frame>);
    expect(await screen.findByText(c.common.heading.refused)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.common.action.retry })).toBeInTheDocument();
  });
});

describe('W2T.2 copy in Spanish', () => {
  it('renders the Content page in es-MX from the same keys', async () => {
    const { api } = fakeApi();
    render(<Frame locale="es-MX"><StaffContent api={api} /></Frame>);
    expect(await screen.findByRole('region', { name: es.staffConsole.content.heading.incidents })).toBeInTheDocument();
    expect(screen.getByText(es.staffConsole.content.body.incidents)).toBeInTheDocument();
  });
});
