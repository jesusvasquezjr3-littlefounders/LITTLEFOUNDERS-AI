import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import enCore from '@/i18n/en-US/rebuild-core.json';
import insight from './staffInsightFixtures.json';
import consoleFixtures from './staffConsoleFixtures.json';
import { staffViewer, type StaffApi, type StaffDownload, type StaffResult } from './staffConsoleApi';
import { insightAnswer } from './staffConsoleFixtures';
import { change, coverage, daysForSelection, filtersToQuery, movingAverage, periodQuery } from './analyticsApi';
import { churnBuckets, cohortGrid, customWindow, rawExportPath } from './intelApi';
import { StaffAnalytics, type DeviceOptOut } from './StaffAnalytics';
import { StaffIntel } from './StaffIntel';

/*
 * W2T.3: Analytics & Health (S5) and Learning intel with its Insights view
 * (S6, S8) at the component boundary. Every read goes to the Core path the
 * legacy pages used; a view reads only its own data; the grants decide what is
 * asked for (exclusions with manage_support, learner names with manage_users);
 * H.1 / D.6 rates are the whole population's; each state has its own screen.
 */

const a = en.staffConsole.analytics;
const n = en.staffConsole.intel;
const common = en.staffConsole.common;
const nav = enCore.appShell.staff;
const SUPER = staffViewer(['superadmin'], []);
const ANALYST = staffViewer(['admin'], ['view_analytics']);
const SUPPORT_ANALYST = staffViewer(['admin'], ['view_analytics', 'manage_support']);

type Handler = (path: string, body?: unknown) => StaffResult<unknown> | undefined;
function fakeApi(handler: Handler = () => undefined, file: StaffResult<StaffDownload> = { ok: true, data: { blob: new Blob(['x']), headers: {} } }) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const removes: string[] = [];
  const downloads: string[] = [];
  const answer = (path: string): StaffResult<unknown> | undefined => {
    const [route, search = ''] = path.split('?');
    if (route === '/admin/health/services') return { ok: true, data: consoleFixtures.health };
    if (route === '/admin/insights/acquisition') return { ok: true, data: consoleFixtures.acquisition };
    if (route === '/admin/insights/funnel-integrity') return { ok: true, data: consoleFixtures.funnelIntegrity };
    if (route === '/admin/users') return { ok: true, data: { users: [{ userId: insight.intel.learning.learners[0]!.userId, displayName: 'Valentina Ortiz' }] } };
    return insightAnswer(route!, new URLSearchParams(search), false) ?? undefined;
  };
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return (handler(path) ?? answer(path) ?? { ok: false, code: 'NOT_IN_TEST' }) as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return (handler(path, body) ?? { ok: true, data: {} }) as StaffResult<T>; },
    remove: async <T,>(path: string) => { removes.push(path); return (handler(path) ?? { ok: true, data: {} }) as StaffResult<T>; },
    download: async (path: string) => { downloads.push(path); return file; },
  };
  return { api, gets, posts, removes, downloads };
}
const fail = (code: string): StaffResult<never> => ({ ok: false, code });

function Frame({ children, locale = 'en-US' }: { children: ReactNode; locale?: Locale }) {
  return <RebuildRoot theme="light" locale={locale}><RebuildProvider environment={{ theme: 'light', locale }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}
const route = (path: string) => path.split('?')[0]!;
const params = (path: string) => new URLSearchParams(path.split('?')[1] ?? '');

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  // jsdom cannot follow a download link; the save itself is the browser's.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('analytics and intel helpers (W2T.3)', () => {
  it('serializes one window for every read and never sends a half-typed range', () => {
    expect(periodQuery({ period: '7d' })).toBe('period=7d');
    expect(periodQuery({ period: 'custom', from: '2026-09-01' })).toBe('period=30d');
    expect(periodQuery({ period: 'custom', from: '2026-09-01', to: '2026-09-10' })).toBe('period=custom&from=2026-09-01&to=2026-09-10');
    expect(daysForSelection({ period: 'custom', from: '2026-09-01', to: '2026-09-10' })).toBe(10);
    expect(daysForSelection({ period: 'all' })).toBe(365);
    expect(daysForSelection({ period: 'month' }, new Date('2026-09-26T12:00:00Z'))).toBe(26);
  });

  it('merges filters of one dimension (OR) and ANDs dimensions, as Core expects', () => {
    const query = filtersToQuery([{ dimension: 'country', value: 'MX' }, { dimension: 'country', value: 'BR' }, { dimension: 'device', value: 'Mobile' }]);
    expect(JSON.parse(decodeURIComponent(query.replace('&filters=', '')))).toEqual([['is', 'visit:country', ['MX', 'BR']], ['is', 'visit:device', ['Mobile']]]);
    expect(filtersToQuery([])).toBe('');
  });

  it('never fabricates a 0% change, averages over full windows only, and says how far an exclusion reaches', () => {
    expect(change(10, 0)).toBeNull();
    expect(change(12, 10)).toBeCloseTo(0.2);
    expect(movingAverage([1, 2, 3, 4, 5, 6, 7, 8], 7)).toEqual([null, null, null, null, null, null, 4, 5]);
    const active = [{ id: '1', network: 'x', label: 'x', created_at: '2026-09-10T00:00:00Z' }];
    expect(coverage([], '2026-09-01')).toEqual({ state: 'none', since: null });
    expect(coverage(active, '2026-09-01').state).toBe('partial');
    expect(coverage(active, '2026-09-11').state).toBe('covered');
  });

  it('orders churn worst first, lays cohorts newest first, clamps a custom window and pages the raw export', () => {
    expect(churnBuckets(insight.intel.churn).map((bucket) => bucket.level)).toEqual(['high', 'medium', 'at_risk', 'active']);
    const grid = cohortGrid(insight.intel.cohorts);
    expect(grid.rows[0]!.cohort).toBe('2026-08-24');
    expect(grid.rows[0]!.shares.slice(1).every((share) => share === null)).toBe(true);
    expect(customWindow('2026-09-10', '2026-09-01')).toEqual({ days: 10, from: '2026-09-01', to: '2026-09-10' });
    expect(rawExportPath({ days: 900, format: 'json', role: 'kid', event: 'lesson_start', offset: 10000, token: 'a'.repeat(64) }))
      .toBe(`/admin/insights/export?days=365&format=json&role=kid&event=lesson_start&offset=10000&exportToken=${'a'.repeat(64)}`);
  });
});

describe('Analytics & Health S5 (W2T.3)', () => {
  it('opens on Audience: one h1, our own stream only, the integrity gap and the events that never fired', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} /></Frame>);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([nav.analytics]);
    await screen.findByText(a.body.band_registered, { selector: 'dt' });
    await waitFor(() => expect(gets.map(route).sort()).toEqual(['/admin/insights/acquisition', '/admin/insights/activity', '/admin/insights/adoption',
      '/admin/insights/audience', '/admin/insights/funnel-integrity', '/admin/insights/sessions']));
    expect(gets.filter((path) => path.includes('days=')).every((path) => params(path).get('days') === '30')).toBe(true);
    expect(screen.getByText('37 signups never reached the event stream. Trust the account count.')).toBeInTheDocument();
    const silent = screen.getByRole('list', { name: a.body.silent });
    expect(within(silent).getByText('signup_complete')).toBeInTheDocument();
    expect(within(silent).queryByText('lesson_start')).toBeNull();
    // A heartbeat has no surface: it never becomes the biggest bar.
    const usage = screen.getByRole('list', { name: a.heading.usage });
    expect(within(usage).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      `${a.option.surface_learn}2,300 events · 1,160 sessions`, `${a.option.surface_marketing}2,210 events · 1,400 sessions`,
      `${a.option.surface_tasks}410 events · 200 sessions`, `${a.option.surface_tutor}260 events · 150 sessions`]);
  });

  it('keeps staff in the audience chart by default and hides them from the chart only on request', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} /></Frame>);
    const legend = await screen.findByRole('list', { name: a.body.audienceChart });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([a.body.band_anonymous, a.body.band_registered, a.body.band_staff]);
    fireEvent.click(screen.getByRole('switch', { name: a.body.includeStaff }));
    expect(within(screen.getByRole('list', { name: a.body.audienceChart })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(a.body.staffHidden)).toBeInTheDocument();
    expect(screen.getByText(new Intl.NumberFormat('en-US').format(insight.analytics.audience.totals.staff), { selector: 'dd' })).toBeInTheDocument();
  });

  it('one period drives the whole page: 7 days reaches the first-party reads as days=7', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} /></Frame>);
    await screen.findByText(a.body.band_registered, { selector: 'dt' });
    gets.length = 0;
    fireEvent.change(screen.getByLabelText(a.body.period), { target: { value: '7d' } });
    await waitFor(() => expect(gets.some((path) => path.startsWith('/admin/insights/audience?days=7'))).toBe(true));
    fireEvent.click(screen.getByRole('radio', { name: a.option.view_web }));
    await waitFor(() => expect(gets.some((path) => path.startsWith('/admin/analytics/overview?period=7d'))).toBe(true));
  });

  it('a custom range is applied only with both ends, in order, and not in the future', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="web" /></Frame>);
    await screen.findAllByText(a.body.visitTime, { selector: 'dt' });
    fireEvent.change(screen.getByLabelText(a.body.period), { target: { value: 'custom' } });
    const sheet = await screen.findByRole('dialog', { name: common.heading.range });
    fireEvent.change(within(sheet).getByLabelText(common.body.rangeFrom), { target: { value: '2026-09-10' } });
    fireEvent.change(within(sheet).getByLabelText(common.body.rangeTo), { target: { value: '2026-09-01' } });
    fireEvent.click(within(sheet).getByRole('button', { name: common.action.apply }));
    expect(await within(sheet).findByText(common.body.rangeReversed)).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText(common.body.rangeTo), { target: { value: '2026-09-12' } });
    fireEvent.click(within(sheet).getByRole('button', { name: common.action.apply }));
    await waitFor(() => expect(gets.some((path) => path.startsWith('/admin/analytics/overview?period=custom&from=2026-09-10&to=2026-09-12'))).toBe(true));
  });

  it('Web: the four figures with their change in words (a lower bounce rate is better), the native-only note, no comparison as words', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="web" /></Frame>);
    const compared = await screen.findByRole('region', { name: a.heading.compared });
    expect(within(compared).getByText('Compared with Jul 27, 2026 to Aug 25, 2026.')).toBeInTheDocument();
    expect(within(compared).getByText('+16.1% · better')).toBeInTheDocument();
    expect(within(compared).getByText('-7.5% · better')).toBeInTheDocument();
    expect(within(compared).getByText(a.body.nativeOnly)).toBeInTheDocument();
    cleanup();
    const noPrior = fakeApi((path) => (route(path) === '/admin/analytics/overview' ? { ok: true, data: { ...insight.analytics.webOverview, previous: null } } : undefined));
    render(<Frame><StaffAnalytics api={noPrior.api} viewer={ANALYST} initialView="web" /></Frame>);
    expect(await screen.findByText(a.body.noComparisonBody)).toBeInTheDocument();
  });

  it('Web: a range Plausible answered for instead is an error above the figures, and an unconfigured Plausible is said', async () => {
    const drift = fakeApi((path) => (route(path) === '/admin/analytics/overview'
      ? { ok: true, data: { ...insight.analytics.webOverview, rangeDrift: { askedFor: ['2026-03-01', '2026-08-27'], answeredFor: ['2026-02-01', '2026-07-31'] } } } : undefined));
    render(<Frame><StaffAnalytics api={drift.api} viewer={ANALYST} initialView="web" /></Frame>);
    expect(await screen.findByText('Plausible answered for Feb 1, 2026 to Jul 31, 2026 instead.')).toBeInTheDocument();
    cleanup();
    const off = fakeApi((path) => (route(path).startsWith('/admin/analytics/') ? fail('PULSE_UNCONFIGURED') : undefined));
    render(<Frame><StaffAnalytics api={off.api} viewer={ANALYST} initialView="web" /></Frame>);
    expect(await screen.findAllByText(a.body.webUnconfigured)).not.toHaveLength(0);
  });

  it('Web: a filter from the form or a breakdown row focuses every read, and one list removes it', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="web" /></Frame>);
    await screen.findAllByText(a.body.visitTime, { selector: 'dt' });
    fireEvent.change(screen.getByLabelText(a.body.filterBy), { target: { value: 'device' } });
    fireEvent.change(screen.getByLabelText(a.body.filterValue), { target: { value: 'Mobile' } });
    fireEvent.click(screen.getByRole('button', { name: a.action.addFilter }));
    await waitFor(() => expect(gets.filter((path) => route(path) === '/admin/analytics/overview').at(-1)).toContain(filtersToQuery([{ dimension: 'device', value: 'Mobile' }])));
    fireEvent.click(await screen.findByRole('button', { name: 'Focus on /pricing' }));
    await waitFor(() => expect(gets.filter((path) => route(path) === '/admin/analytics/breakdown').at(-1))
      .toContain(filtersToQuery([{ dimension: 'device', value: 'Mobile' }, { dimension: 'page', value: '/pricing' }])));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Device: Mobile' }));
    fireEvent.click(screen.getByRole('button', { name: common.action.clearFilters }));
    await waitFor(() => expect(gets.filter((path) => route(path) === '/admin/analytics/overview').at(-1)).toBe('/admin/analytics/overview?period=30d'));
    expect(screen.getByText(a.body.noFilters)).toBeInTheDocument();
  });

  it('Web map: a country focuses the console, opens its regions, names what cannot be placed, and Whole world undoes all of it', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="web" /></Frame>);
    const places = await screen.findByRole('heading', { name: a.heading.topCountries });
    const list = places.parentElement!;
    expect(within(list).getAllByRole('button').map((button) => button.textContent)).toContain('1Mexico2,710 · 54%');
    expect(await screen.findByText('Not on the map: Caribbean Netherlands.')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: /Mexico/ }));
    await waitFor(() => expect(gets.filter((path) => route(path) === '/admin/analytics/overview').at(-1)).toContain(filtersToQuery([{ dimension: 'country', value: 'MX' }])));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Mexico' }));
    await screen.findByRole('heading', { name: 'Top regions in Mexico' });
    expect(gets.some((path) => path.includes('dimension=region') && path.includes(encodeURIComponent(JSON.stringify([['is', 'visit:country', ['MX']]]))))).toBe(true);
    expect(await screen.findByText('Not matched to a region: Atlantis.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: a.action.wholeWorld }));
    await waitFor(() => expect(gets.filter((path) => route(path) === '/admin/analytics/overview').at(-1)).toBe('/admin/analytics/overview?period=30d'));
    expect(screen.getByRole('heading', { name: a.heading.topCountries })).toBeInTheDocument();
  });

  it('Web: the exclusion coverage is read only with the support grant', async () => {
    const analyst = fakeApi();
    render(<Frame><StaffAnalytics api={analyst.api} viewer={ANALYST} initialView="web" /></Frame>);
    await screen.findAllByText(a.body.visitTime, { selector: 'dt' });
    expect(analyst.gets.some((path) => path.startsWith('/admin/analytics/exclusions'))).toBe(false);
    cleanup();
    const support = fakeApi();
    render(<Frame><StaffAnalytics api={support.api} viewer={SUPPORT_ANALYST} initialView="web" /></Frame>);
    expect(await screen.findByText('Staff visits before Sep 10, 2026 are counted. Exclusions started then.')).toBeInTheDocument();
  });

  it('Behavior: the adult-pages scope, the boundary note, and a breakdown per dimension', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="behavior" /></Frame>);
    expect(await screen.findByText(a.body.behaviorScope)).toBeInTheDocument();
    expect(await screen.findByText('36 views of staff pages from before a tracker fix are included.')).toBeInTheDocument();
    expect(await screen.findByText(a.body.notRecorded)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(a.body.breakdownBy), { target: { value: 'city' } });
    await waitFor(() => expect(gets.some((path) => path.includes('behavior/breakdown') && params(path).get('dimension') === 'city')).toBe(true));
  });

  it('Health: services not answering first, averages in words, and an unconfigured monitor is said', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="health" /></Frame>);
    const table = await screen.findByRole('table', { name: a.heading.health });
    expect(within(table).getAllByRole('row')[1]!.textContent).toContain('Courier email');
    expect(screen.getByText('114 ms', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByLabelText(a.body.period)).toBeNull();
    cleanup();
    const off = fakeApi((path) => (route(path) === '/admin/health/services' ? fail('PULSE_UNCONFIGURED') : undefined));
    render(<Frame><StaffAnalytics api={off.api} viewer={ANALYST} initialView="health" /></Frame>);
    expect(await screen.findByText(en.staffConsole.overview.body.healthUnconfigured)).toBeInTheDocument();
  });

  it('Tools: a report file asks Core with the window, filters, audience, rows and language; a refusal is said', async () => {
    const { api, downloads } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="tools" /></Frame>);
    fireEvent.click(await screen.findByRole('radio', { name: a.option.format_xlsx }));
    fireEvent.change(screen.getByLabelText(a.body.reportAudience), { target: { value: 'sales' } });
    fireEvent.change(screen.getByLabelText(a.body.reportRows), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: a.action.download }));
    expect(await screen.findByText(a.body.downloaded)).toBeInTheDocument();
    expect(downloads).toEqual(['/admin/analytics/report.xlsx?period=30d&audience=sales&rows=50&locale=en-US']);
    cleanup();
    const refused = fakeApi(undefined, fail('FORBIDDEN'));
    render(<Frame><StaffAnalytics api={refused.api} viewer={ANALYST} initialView="tools" /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: a.action.download }));
    expect(await screen.findByText(common.body.refused)).toBeInTheDocument();
  });

  it('Tools: exclusions need the support grant; without it nothing is read', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="tools" /></Frame>);
    expect(await screen.findByText(a.body.exclusionsNeedSupport)).toBeInTheDocument();
    expect(gets).toEqual([]);
  });

  it('Tools: exclude this address, a detected address with a shared-network warning, revoke, a manual range, and a duplicate said in words', async () => {
    const device: DeviceOptOut = { optedOut: vi.fn(() => false), set: vi.fn() };
    const { api, posts, removes } = fakeApi((path, body) => ((body as { network?: string } | undefined)?.network === '10.0.0.0/24' ? fail('CONFLICT') : undefined));
    render(<Frame><StaffAnalytics api={api} viewer={SUPPORT_ANALYST} device={device} initialView="tools" /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: a.action.excludeSelf }));
    await screen.findByText(a.body.excluded);
    expect(posts[0]).toEqual({ path: '/admin/analytics/exclusions/self', body: { label: a.body.selfLabel } });
    expect(screen.getByText('3 staff accounts used this address. It may be a shared network.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: a.action.exclude }));
    await waitFor(() => expect(posts[1]).toEqual({ path: '/admin/analytics/exclusions', body: { network: '198.51.100.23', label: 'María Fernanda de los Ángeles Rodríguez' } }));
    fireEvent.click(await screen.findByRole('button', { name: a.action.revoke }));
    await waitFor(() => expect(removes).toEqual(['/admin/analytics/exclusions/5f0c2b1e-8a4d-4e7b-9d2a-1c3b4a5d6e7f']));
    fireEvent.click(screen.getByRole('button', { name: a.action.add }));
    expect(await screen.findByText(a.body.networkInvalid)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(a.body.network), { target: { value: '10.0.0.0/24' } });
    fireEvent.change(screen.getByLabelText(a.body.networkName), { target: { value: 'Office' } });
    fireEvent.click(screen.getByRole('button', { name: a.action.add }));
    expect(await screen.findByText(a.body.alreadyExcluded)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: a.body.deviceOptOut }));
    expect(device.set).toHaveBeenCalledWith(true);
  });

  it('a read refused by Core (403) is the console refused state, and Spanish copy is used in es-MX', async () => {
    const { api } = fakeApi((path) => (route(path) === '/admin/insights/audience' ? fail('FORBIDDEN') : undefined));
    const { container } = render(<Frame><StaffAnalytics api={api} viewer={ANALYST} /></Frame>);
    await waitFor(() => expect(container.querySelector('[data-failure="refused"]')).not.toBeNull());
    cleanup();
    render(<Frame locale="es-MX"><StaffAnalytics api={fakeApi().api} viewer={ANALYST} /></Frame>);
    expect(await screen.findByText(es.staffConsole.analytics.body.audienceSource)).toBeInTheDocument();
  });
});

describe('Learning intel S6 with Insights S8 (W2T.3)', () => {
  it('Overview: the headline figures, consent coverage, the staff share said, and only unresolved anomalies', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} /></Frame>);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([nav.intel]);
    expect(await screen.findByText('219 of 341')).toBeInTheDocument();
    expect(await screen.findByText('Staff activity left out: 61,230 events (56%) from 9 accounts.')).toBeInTheDocument();
    const anomalies = await screen.findByRole('table', { name: n.heading.anomalies });
    expect(within(anomalies).getAllByRole('row')).toHaveLength(2);
    expect(within(anomalies).getByText('+3.2 standard deviations')).toBeInTheDocument();
    const funnel = screen.getByRole('list', { name: n.heading.funnel });
    expect(within(funnel).getAllByRole('listitem')[2]!.textContent).toBe(`${n.option.step_completed_signup}212 · 33% of the step before`);
    expect(gets.some((path) => route(path) === '/admin/users')).toBe(false);
  });

  it('Overview: the trend metric and grain really change the read (the legacy selectors changed nothing)', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} /></Frame>);
    await screen.findByText('219 of 341');
    fireEvent.click(screen.getByRole('radio', { name: n.option.metric_events }));
    fireEvent.click(screen.getByRole('radio', { name: n.option.grain_week }));
    await waitFor(() => expect(gets).toContain('/admin/intel/metrics/trends?metric=events&granularity=week&days=30'));
  });

  it('the window reaches every warehouse read and the file export, and a year never exceeds what the day reads accept', async () => {
    const { api, gets, downloads } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} /></Frame>);
    await screen.findByText('219 of 341');
    fireEvent.change(screen.getByLabelText(n.body.period), { target: { value: '365' } });
    await waitFor(() => expect(gets).toContain('/admin/intel/funnels/activation?days=365'));
    expect(gets).toContain('/admin/intel/metrics/summary?days=365');
    fireEvent.click(screen.getByRole('button', { name: n.action.export_csv }));
    await waitFor(() => expect(downloads).toEqual(['/admin/intel-export.csv?days=365']));
  });

  it('Insights: evidence by course with a details sheet; learners by short id for an analyst, who never reads the people directory', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="insights" /></Frame>);
    const table = await screen.findByRole('table', { name: n.option.directory_courses });
    fireEvent.click(within(table).getByRole('button', { name: 'Open Earning coins' }));
    const sheet = await screen.findByRole('dialog', { name: 'Earning coins' });
    expect(within(sheet).getByText('21%')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: common.action.close }));
    fireEvent.click(screen.getByRole('radio', { name: n.option.directory_learners }));
    expect(await screen.findByText('Learner c3f1a2b4')).toBeInTheDocument();
    expect(screen.getByText(n.body.namesNeedGrant)).toBeInTheDocument();
    expect(gets.some((path) => route(path) === '/admin/users')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Open Learner c3f1a2b4' }));
    const learner = await screen.findByRole('dialog', { name: 'Learner c3f1a2b4' });
    expect(await within(learner).findByText('kc:money.percent-of-a-whole-with-very-long-name')).toBeInTheDocument();
    expect(gets.some((path) => path.startsWith('/admin/intel/learning/learners/c3f1a2b4-5d6e-4f70-8a9b-0c1d2e3f4a51?days=30'))).toBe(true);
  });

  it('Insights: a superadmin (who holds manage_users) sees the learner name', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={SUPER} initialView="insights" /></Frame>);
    fireEvent.click(await screen.findByRole('radio', { name: n.option.directory_learners }));
    expect(await screen.findByText('Valentina Ortiz')).toBeInTheDocument();
    expect(gets).toContain('/admin/users');
  });

  it('Insights: the raw export asks for its filters, and a truncated file offers the next part with Core\'s token', async () => {
    const token = 'b'.repeat(64);
    const { api, downloads } = fakeApi(undefined, { ok: true, data: { blob: new Blob(['x']), headers: { truncated: 'true', 'next-offset': '10000', token } } });
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="insights" /></Frame>);
    const card = (await screen.findByRole('heading', { name: n.heading.rawExport })).closest('section')!;
    fireEvent.change(within(card).getByLabelText(n.body.role), { target: { value: 'kid' } });
    fireEvent.change(within(card).getByLabelText(n.body.event), { target: { value: 'lesson_start' } });
    fireEvent.click(within(card).getByRole('button', { name: en.staffConsole.analytics.action.download }));
    expect(await within(card).findByText('This file stops early. Download part 2 next.')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: n.action.nextPart }));
    await waitFor(() => expect(downloads).toEqual([
      '/admin/insights/export?days=30&format=csv&role=kid&event=lesson_start',
      `/admin/insights/export?days=30&format=csv&role=kid&event=lesson_start&offset=10000&exportToken=${token}`,
    ]));
  });

  it('Retention: the family approval rate is the whole population\'s, and the listed rows are only consented children with no names', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="retention" /></Frame>);
    expect(await screen.findByText('76.6%', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Rows show 3 children whose Tutors allowed analytics. They carry no names.')).toBeInTheDocument();
    const rows = screen.getByRole('table', { name: n.heading.familyRows });
    expect(within(rows).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('table', { name: n.heading.cohortTable })).toBeInTheDocument();
  });

  it('People: churn worst first, no ranking of learners (DP-05) and no names or ids anywhere', async () => {
    const { api, gets } = fakeApi();
    const { container } = render(<Frame><StaffIntel api={api} viewer={SUPER} initialView="people" /></Frame>);
    const churn = await screen.findByRole('list', { name: n.heading.churn });
    expect(within(churn).getAllByRole('listitem').map((item) => item.textContent?.split(/\d/)[0])).toEqual(['High risk', 'Medium risk', 'At risk', 'Active']);
    const table = screen.getByRole('table', { name: n.heading.churnRows });
    expect(within(table).getAllByRole('row')[1]!.textContent).toContain('High risk');
    expect(container.textContent).not.toMatch(/10000000-/);
    expect(gets.some((path) => path.includes('engagement'))).toBe(false);
  });

  it('Experiments and alerts: read-only, with each rule in words; empty and failed reads have their own states', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="operations" /></Frame>);
    expect(await screen.findByText(n.body.readOnly)).toBeInTheDocument();
    expect(await screen.findByText('Daily users below 50')).toBeInTheDocument();
    expect(screen.getByText('Events changes by 40%')).toBeInTheDocument();
    expect(screen.queryByLabelText(n.body.period)).toBeNull();
    cleanup();
    const empty = fakeApi((path) => (route(path) === '/admin/intel/experiments' ? { ok: true, data: [] } : route(path) === '/admin/intel/alerts' ? fail('DATA_UNAVAILABLE') : undefined));
    const { container } = render(<Frame><StaffIntel api={empty.api} viewer={ANALYST} initialView="operations" /></Frame>);
    expect(await screen.findByText(n.body.noExperiments)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-failure="loadFailed"]')).not.toBeNull());
  });

  it('a malformed warehouse answer is an error state, never a guessed zero', async () => {
    const { api } = fakeApi((path) => (route(path) === '/admin/intel/metrics/summary' ? { ok: true, data: { dau: 'many' } } : undefined));
    const { container } = render(<Frame><StaffIntel api={api} viewer={ANALYST} /></Frame>);
    await waitFor(() => expect(container.querySelector('[data-failure="loadFailed"]')).not.toBeNull());
    await act(async () => { await Promise.resolve(); });
  });
});
