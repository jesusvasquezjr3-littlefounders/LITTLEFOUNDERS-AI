import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import {
  announceSessionStart,
  classifyRoute,
  configureInsights,
  flushInsights,
  rebaseSessionStart,
  resetInsights,
  startAnonymousTracking,
  trackInsight,
} from './insights';

vi.mock('./api', () => ({
  BASE_URL: 'http://test-backend',
  api: vi.fn().mockResolvedValue({ data: { accepted: 1 }, error: null }),
}));

const apiMock = vi.mocked(api);
const getToken = vi.fn().mockResolvedValue('token-abc');

beforeEach(() => {
  resetInsights();
  apiMock.mockClear();
  getToken.mockClear();
});

/*
 * The beacon's outermost privacy layer (/INSIGHTS.md): when it is not
 * enabled — a kid without guardian consent, or no session yet — it must not
 * merely fail to flush, it must never QUEUE, so nothing sits in memory
 * waiting to leak out of a later re-configure.
 */
describe('insights beacon', () => {
  it('disabled: track is a no-op and flush sends nothing', async () => {
    configureInsights({ enabled: false, getToken });
    trackInsight('session_start');
    trackInsight('nav_view', { routeClass: 'learn' });
    await flushInsights();
    expect(apiMock).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('disabling mid-session clears anything already queued', async () => {
    configureInsights({ enabled: true, getToken });
    trackInsight('session_start');
    configureInsights({ enabled: false, getToken });
    configureInsights({ enabled: true, getToken });
    await flushInsights();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('enabled: batches queued events into one authorized POST', async () => {
    configureInsights({ enabled: true, getToken });
    trackInsight('session_start');
    trackInsight('lesson_start', { lessonId: '44444444-4444-4444-8444-444444444444', routeClass: 'learn' });
    await flushInsights();
    expect(apiMock).toHaveBeenCalledTimes(1);
    const [path, opts] = apiMock.mock.calls[0]!;
    expect(path).toBe('/events');
    expect(opts).toMatchObject({ method: 'POST', token: 'token-abc' });
    expect((opts!.body as { events: unknown[] }).events).toHaveLength(2);
  });

  it('auto-flushes when the batch limit is reached', async () => {
    configureInsights({ enabled: true, getToken });
    for (let i = 0; i < 25; i += 1) trackInsight('session_heartbeat', { value: 60 });
    // Let the fired-and-forgotten flush settle.
    await vi.waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
  });

  it('sends nothing when there is no token', async () => {
    configureInsights({ enabled: true, getToken: vi.fn().mockResolvedValue(null) });
    trackInsight('session_start');
    await flushInsights();
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe('pre-configuration buffer (fail-closed)', () => {
  it('holds events fired before configure, then promotes them when allowed', async () => {
    // A bookmarked lesson mounts before /auth/me answers.
    trackInsight('lesson_start', { lessonId: '44444444-4444-4444-8444-444444444444' });
    expect(apiMock).not.toHaveBeenCalled(); // nothing leaves before consent is known

    configureInsights({ enabled: true, getToken });
    await flushInsights();
    const events = (apiMock.mock.calls[0]![1]!.body as { events: { event: string }[] }).events;
    expect(events.some((e) => e.event === 'lesson_start')).toBe(true);
  });

  it('DISCARDS pre-configure events when the answer turns out to be no', async () => {
    trackInsight('lesson_start', { lessonId: '44444444-4444-4444-8444-444444444444' });
    configureInsights({ enabled: false, getToken });
    await flushInsights();
    expect(apiMock).not.toHaveBeenCalled();

    // And they must not resurface if the beacon is later enabled.
    configureInsights({ enabled: true, getToken });
    await flushInsights();
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe('session dedup', () => {
  it('announceSessionStart emits exactly once per session, across re-renders', async () => {
    configureInsights({ enabled: true, getToken });
    announceSessionStart();
    announceSessionStart(); // StrictMode probe / effect re-run
    announceSessionStart(); // token-refresh re-run
    await flushInsights();
    expect(apiMock).toHaveBeenCalledTimes(1);
    const events = (apiMock.mock.calls[0]![1]!.body as { events: { event: string }[] }).events;
    expect(events.filter((e) => e.event === 'session_start')).toHaveLength(1);
  });

  it('rebaseSessionStart (bfcache restore) opens a fresh session', async () => {
    configureInsights({ enabled: true, getToken });
    announceSessionStart();
    rebaseSessionStart();
    announceSessionStart();
    await flushInsights();
    const events = (apiMock.mock.calls[0]![1]!.body as { events: { event: string }[] }).events;
    expect(events.filter((e) => e.event === 'session_start')).toHaveLength(2);
  });

  it('clamps out-of-range values and drops a non-UUID lessonId at the source', async () => {
    configureInsights({ enabled: true, getToken });
    trackInsight('session_end', { value: 999_999 });
    trackInsight('lesson_start', { lessonId: 'not-a-uuid' });
    await flushInsights();
    const events = (apiMock.mock.calls[0]![1]!.body as { events: { value?: number; lessonId?: string }[] }).events;
    expect(events[0]!.value).toBe(86_400);
    expect(events[1]!.lessonId).toBeUndefined();
  });
});

describe('classifyRoute', () => {
  it.each([
    ['/learn/course-1/territory', 'learn'],
    ['/tasks/123', 'tasks'],
    ['/profile/settings', 'profile'],
    ['/tutor', 'tutor'],
    ['/family/abc/territory', 'family'],
    ['/admin/insights', 'admin'],
    ['/', 'marketing'],
    ['/dev/lesson-lab', 'other'],
  ])('%s → %s', (path, expected) => {
    expect(classifyRoute(path)).toBe(expected);
  });
});

/*
 * Regressions from the third adversarial review. Every one of these produced
 * plausible-looking telemetry that was quietly wrong — the failure mode this
 * whole layer exists to avoid, since a wrong number is worse than no number.
 */
describe('insights: review regressions', () => {
  function sentEvents(call = 0): Array<Record<string, unknown>> {
    const body = apiMock.mock.calls[call]?.[1]?.body as { events?: Array<Record<string, unknown>> };
    return body?.events ?? [];
  }

  it('signing in opens a NEW session instead of continuing the anonymous one', async () => {
    // Anonymous half of the visit. The anonymous flush path needs a real
    // consented visitor id, or it correctly sends nothing at all.
    document.cookie = 'lf_cc=granted; path=/';
    configureInsights({ enabled: true, getToken, anonymous: true });
    announceSessionStart('marketing');
    trackInsight('page_view', { routeClass: 'marketing' });
    await flushInsights();
    const anonEvents = sentEvents(0);
    const anonSession = anonEvents[0]!.sessionId;
    expect(anonSession).toBeTruthy();
    expect(anonEvents[1]!.ordinal).toBe(2);

    apiMock.mockClear();

    // …then they log in. Same tab, same page, different identity.
    configureInsights({ enabled: true, getToken });
    announceSessionStart();
    trackInsight('nav_view', { routeClass: 'learn' });
    await flushInsights();
    const authEvents = sentEvents(0);

    // A different session, restarted ordinals, and exactly one session_start
    // in each — not two under one id with continuing positions.
    expect(authEvents[0]!.sessionId).not.toBe(anonSession);
    expect(authEvents[0]!.event).toBe('session_start');
    expect(authEvents[0]!.ordinal).toBe(1);
    expect(authEvents.filter((e) => e.event === 'session_start')).toHaveLength(1);
  });

  it('re-configuring with the SAME identity keeps one continuous session', async () => {
    configureInsights({ enabled: true, getToken });
    announceSessionStart();
    await flushInsights();
    const first = sentEvents(0)[0]!.sessionId;
    apiMock.mockClear();

    // A token refresh re-runs the beacon effect; that is not a new session.
    configureInsights({ enabled: true, getToken });
    announceSessionStart();
    trackInsight('nav_view', { routeClass: 'learn' });
    await flushInsights();
    const after = sentEvents(0);
    expect(after[0]!.sessionId).toBe(first);
    expect(after.some((e) => e.event === 'session_start')).toBe(false);
  });

  it('events buffered before configuration are stamped, not sent bare', async () => {
    // A bookmarked lesson: the player mounts before /auth/me answers.
    resetInsights();
    trackInsight('lesson_start', { routeClass: 'learn' });
    trackInsight('segment_view', { routeClass: 'learn' });

    configureInsights({ enabled: true, getToken });
    await flushInsights();
    const events = sentEvents(0);
    expect(events).toHaveLength(2);
    for (const e of events) {
      // Without a session id and position these rows are invisible to every
      // session-grained view — which is exactly the analysis they are for.
      expect(e.sessionId).toBeTruthy();
      expect(typeof e.ordinal).toBe('number');
    }
    expect(events[0]!.ordinal).toBe(1);
    expect(events[1]!.ordinal).toBe(2);
    expect(events[0]!.event).toBe('lesson_start');
  });

  it('a failed first flush does not throw away campaign attribution', async () => {
    // Real consent cookie, real visitor id — this path is only meaningful
    // with the actual cookie logic, not a stub of it.
    document.cookie = 'lf_cc=granted; path=/';
    expect(startAnonymousTracking('es-MX')).toBe(true);

    apiMock.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'offline' } });
    trackInsight('page_view', { routeClass: 'marketing' });
    await flushInsights();
    const firstBody = apiMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(firstBody.visitor).toBeTruthy();

    // The retry must carry it again: marking it sent before the request landed
    // meant one offline moment on the landing page lost the channel forever.
    apiMock.mockClear();
    apiMock.mockResolvedValue({ data: { accepted: 1 }, error: null });
    trackInsight('cta_click', { routeClass: 'marketing', segmentId: 'hero' });
    await flushInsights();
    const retryBody = apiMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(retryBody.visitor).toBeTruthy();

    // Once it lands, it stops travelling.
    apiMock.mockClear();
    trackInsight('scroll_depth', { routeClass: 'marketing', value: 50 });
    await flushInsights();
    const thirdBody = apiMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(thirdBody.visitor).toBeUndefined();
  });
});
