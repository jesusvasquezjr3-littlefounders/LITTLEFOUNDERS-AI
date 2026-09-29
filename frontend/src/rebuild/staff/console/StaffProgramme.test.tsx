import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import pt from '@/i18n/pt-BR/rebuild-staff.json';
import programme from './staffProgrammeFixtures.json';
import consoleFixtures from './staffConsoleFixtures.json';
import sections from './staffSectionFixtures.json';
import { staffViewer, type StaffApi, type StaffResult } from './staffConsoleApi';
import { programmeAnswer } from './staffConsoleFixtures';
import { FAMILY_GROUPS, FAMILY_METRICS, lowerLevels, metricDays, metricGuard, onTarget, TRUST_METRICS, type MetricSpec } from './programmeApi';
import { StaffIntel } from './StaffIntel';
import { StaffAnalytics } from './StaffAnalytics';
import { StaffReports } from './StaffReports';
import { StaffMentorQuality } from './StaffMentorQuality';

/*
 * W2T.4 at the component boundary: the Appendix H family metrics (Learning
 * intel → Families), the Appendix J/L trust metrics (Analytics & Health →
 * Trust), the D.18 denial-reason scoring, the D.17 support rollback and the
 * Mentor retention sweep (Reports → Support tools) and the C.24 owner roster
 * (Mentor quality, manage_users only). Core's grants are pinned by the
 * backend route tests (familyAutonomy, mentorQualityRoutes, admin,
 * socialTiers, socialGovernance, accountDeletionMetrics,
 * achievementSharingMetrics); here each screen asks only for its own paths and
 * says every refusal in words.
 */

const p = en.staffConsole.programme;
const s = en.staffConsole.support;
const o = en.staffConsole.owners;
const ANALYST = staffViewer(['admin'], ['view_analytics']);
const ANALYST_USERS = staffViewer(['admin'], ['view_analytics', 'manage_users']);
const KID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';

type Handler = (path: string, body?: unknown) => StaffResult<unknown> | undefined;
function fakeApi(handler: Handler = () => undefined) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const answer = (path: string): StaffResult<unknown> | undefined => {
    const route = path.split('?')[0]!;
    if (route === '/admin/mentor-quality') return { ok: true, data: sections.mentorQuality };
    if (route === '/admin/users') return { ok: true, data: { users: consoleFixtures.users } };
    if (route === '/admin/intel/quality/staff-exclusion') return { ok: false, code: 'NOT_IN_TEST' };
    return programmeAnswer(route, false) ?? undefined;
  };
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return (handler(path) ?? answer(path) ?? { ok: false, code: 'NOT_IN_TEST' }) as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return (handler(path, body) ?? { ok: true, data: {} }) as StaffResult<T>; },
  };
  return { api, gets, posts };
}

function Frame({ children, locale = 'en-US' }: { children: ReactNode; locale?: Locale }) {
  return <RebuildRoot theme="light" locale={locale}><RebuildProvider environment={{ theme: 'light', locale }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}

beforeEach(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); });
afterEach(cleanup);

describe('programme metric descriptions', () => {
  const all: MetricSpec[] = [...FAMILY_GROUPS.flatMap((group) => FAMILY_METRICS[group]), ...TRUST_METRICS];

  it('accept the fixture answer of every described metric, and each has its words in all three locales', () => {
    for (const spec of all) {
      const path = spec.path(30).split('?')[0]!;
      const data = (programme.routes as Record<string, unknown>)[path];
      expect(data, path).toBeDefined();
      expect(metricGuard(spec)(data), spec.id).toBe(true);
      for (const copy of [en, es, pt]) {
        const c = copy.staffConsole.programme;
        expect(c.heading[spec.id as keyof typeof c.heading], `${spec.id} heading`).toBeTruthy();
        expect(c.body[spec.id as keyof typeof c.body], `${spec.id} body`).toBeTruthy();
        for (const field of [...(spec.headline ? [spec.headline] : []), ...spec.facts, ...(spec.rows ?? []).flatMap((rows) => rows.columns)]) {
          expect(c.option[field.key as keyof typeof c.option], `${spec.id}.${field.key}`).toBeTruthy();
        }
        for (const rows of spec.rows ?? []) expect(c.heading[rows.caption as keyof typeof c.heading], rows.caption).toBeTruthy();
      }
    }
  });

  it('refuse a payload whose declared field has the wrong type, never reading it as 0', () => {
    const [integrity] = FAMILY_METRICS.integrity;
    expect(metricGuard(integrity!)({ ...programme.routes['/admin/family/state-integrity'], outsideService: '1' })).toBe(false);
    expect(metricGuard(integrity!)({ ...programme.routes['/admin/family/state-integrity'], tables: [{ table: 'x', transitions: null, outsideService: 0 }] })).toBe(false);
    expect(metricGuard(integrity!)(null)).toBe(false);
  });

  it('judge the target only when there is one and data to judge', () => {
    const [integrity, retention, uptime] = FAMILY_METRICS.integrity;
    expect(onTarget(integrity!, 0)).toBe(true);
    expect(onTarget(integrity!, 1)).toBe(false);
    expect(onTarget(retention!, true)).toBe(true);
    expect(onTarget(uptime!, null)).toBeNull();
    expect(onTarget(FAMILY_METRICS.money[0]!, 0.4)).toBeNull();
    expect(metricDays(900)).toBe(365);
    expect(metricDays(0)).toBe(1);
    expect(lowerLevels(3)).toEqual([1, 2]);
    expect(lowerLevels(1)).toEqual([]);
  });
});

describe('Learning intel → Families (view_analytics)', () => {
  it('reads one group at a time, with the window, and says a missing population as no data, never 0%', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="families" /></Frame>);
    expect(await screen.findByRole('heading', { name: p.heading.stateIntegrity })).toBeTruthy();
    expect(gets.some((path) => path === '/admin/family/state-integrity?days=30')).toBe(true);
    expect(gets.some((path) => path.startsWith('/admin/family/teen-wallet-adoption'))).toBe(false);
    // One change outside Core against a target of none.
    const card = screen.getByRole('heading', { name: p.heading.stateIntegrity }).closest('section')!;
    expect(within(card).getByText(p.option.offTarget)).toBeTruthy();
    // The staff request uptime has no checks: no data, not 0%.
    const uptime = screen.getByRole('heading', { name: p.heading.insightUptime }).closest('section')!;
    expect(within(uptime).getAllByText(p.body.noData).length).toBeGreaterThan(0);
    // No export of the intel files on this view.
    expect(screen.queryByRole('heading', { name: en.staffConsole.intel.heading.export })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: p.option.group_money }));
    expect(await screen.findByRole('heading', { name: p.heading.teenWallet })).toBeTruthy();
    expect(gets.some((path) => path === '/admin/family/teen-wallet-adoption?days=30')).toBe(true);
    expect(await screen.findByText(p.option.v_transition)).toBeTruthy();
  });

  it('a malformed metric is an error with a retry, the others still render', async () => {
    const { api } = fakeApi((path) => (path.startsWith('/admin/family/retention-compliance') ? { ok: true, data: { pass: 'yes' } } : undefined));
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="families" /></Frame>);
    const card = (await screen.findByRole('heading', { name: p.heading.retentionCompliance })).closest('section')!;
    await waitFor(() => expect(within(card).getByRole('button', { name: en.staffConsole.common.action.retry })).toBeTruthy());
    expect(await screen.findByText('public.family_chore_transitions_history')).toBeTruthy();
  });

  it('scores a denial reason (D.18, D-23) and says a refused or vanished one in words', async () => {
    const { api, posts } = fakeApi((path) => (path.includes('0c4e9b12') ? { ok: false, code: 'NOT_FOUND' } : undefined));
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="families" /></Frame>);
    await screen.findByRole('heading', { name: p.heading.stateIntegrity });
    fireEvent.click(screen.getByRole('radio', { name: p.option.group_decisions }));
    const sample = (await screen.findByRole('heading', { name: p.heading.denialSample })).closest('section')!;
    expect(await within(sample).findByText(/The dishes are still in the sink/)).toBeTruthy();
    expect(within(sample).getByText(p.body.denialPrivacy)).toBeTruthy();
    const items = within(sample).getAllByRole('listitem');
    fireEvent.click(within(items[0]!).getByRole('button', { name: p.action.actionable }));
    expect(await within(items[0]!).findByText(p.body.scoredYes)).toBeTruthy();
    expect(posts[0]).toEqual({ path: '/admin/family/denial-reasons/7d8a2c10-4b5e-4f61-9a3b-2c1d0e9f8a71/score', body: { actionable: true } });
    fireEvent.click(within(items[1]!).getByRole('button', { name: p.action.notActionable }));
    expect(await within(items[1]!).findByText(p.body.scoreGone)).toBeTruthy();
  });

  it('a refused family read is the console refused state', async () => {
    const { api } = fakeApi((path) => (path.startsWith('/admin/family/') ? { ok: false, code: 'FORBIDDEN' } : undefined));
    render(<Frame><StaffIntel api={api} viewer={ANALYST} initialView="families" /></Frame>);
    expect((await screen.findAllByText(en.staffConsole.common.heading.refused)).length).toBe(3);
  });
});

describe('Analytics & Health → Trust (view_analytics)', () => {
  it('shows the Appendix J/L metrics with their targets', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="trust" /></Frame>);
    const sharing = (await screen.findByRole('heading', { name: p.heading.achievementSharing })).closest('section')!;
    await waitFor(() => expect(within(sharing).getByText(p.option.onTarget)).toBeTruthy());
    expect(gets).toContain('/admin/analytics/account-deletions?days=30');
    expect(gets).toContain('/admin/analytics/social-governance');
    const safety = screen.getByRole('heading', { name: p.heading.socialSafety }).closest('section')!;
    await waitFor(() => expect(within(safety).getByText(p.option.offTarget)).toBeTruthy());
  });

  it('shows the Appendix M identity metrics, release gates apart from diagnostics', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffAnalytics api={api} viewer={ANALYST} initialView="trust" /></Frame>);
    const card = (await screen.findByRole('heading', { name: en.staffConsole.identity.heading.title })).closest('section')!;
    const i = en.staffConsole.identity;
    await within(card).findByText(i.body.gatesMissed.replace('{n}', '3'));
    expect(gets).toContain('/admin/analytics/identity?days=30');
    const row = within(card).getByText(i.option.undated_account_backlog).closest('tr')!;
    expect(within(row).getAllByText(i.option.diagnostic).length).toBeGreaterThan(0);
    const gate = within(card).getByText(i.option.post_callback_age_screen_completion).closest('tr')!;
    expect(within(gate).getByText(i.option.release_gate)).toBeTruthy();
    expect(within(gate).getByText(i.option.missed)).toBeTruthy();
    expect(within(card).getByText(i.option.adv_age_screen_bypass)).toBeTruthy();
  });

  it('renders in es-MX', async () => {
    const { api } = fakeApi();
    render(<Frame locale="es-MX"><StaffAnalytics api={api} viewer={ANALYST} initialView="trust" /></Frame>);
    expect(await screen.findByRole('heading', { name: es.staffConsole.programme.heading.accountDeletions })).toBeTruthy();
  });
});

describe('Reports → Support tools (manage_support)', () => {
  it('does not read the queue in the support view, checks the id before asking Core', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    expect(await screen.findByRole('heading', { name: s.heading.sweep })).toBeTruthy();
    expect(gets.some((path) => path.startsWith('/admin/reports'))).toBe(false);
    fireEvent.change(screen.getByLabelText(s.body.childId), { target: { value: 'not-an-id' } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lookUp }));
    expect(await screen.findByText(s.body.idInvalid)).toBeTruthy();
    expect(gets.some((path) => path.startsWith('/admin/family-autonomy'))).toBe(false);
    const sweep = document.querySelector<HTMLElement>('[data-tool="retention-sweep"]')!;
    expect(await within(sweep).findByText(s.option.fresh)).toBeTruthy();
  });

  it('shows the backups and the drift probe beside the sweep, a quiet job in words (H.4)', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    expect(await screen.findByRole('heading', { name: s.heading.jobs })).toBeTruthy();
    const jobs = document.querySelector<HTMLElement>('[data-tool="ops-jobs"]')!;
    await within(jobs).findByText(s.option.job_pulse_backup);
    expect(jobs.querySelector('[data-job="pulse_backup"]')!.getAttribute('data-stale')).toBe('true');
    expect(jobs.querySelector('[data-job="vault_backup"]')!.getAttribute('data-stale')).toBe('false');
    expect(within(jobs).getByText(s.body.jobStaleHelp.replace('{job}', s.option.job_pulse_backup).replace('{n}', '36'))).toBeTruthy();
    expect(within(jobs).getByText(s.body.lastAttemptFailed)).toBeTruthy();
    expect(gets).toContain('/admin/ops/job-status');
  });

  it('H.3 (GAP-FIX-R6): the warehouse alerts that notified nobody sit on the same watchdog card; an unread count is never "all delivered"', async () => {
    const { api } = fakeApi();
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    const jobs = await waitFor(() => { const el = document.querySelector<HTMLElement>('[data-tool="ops-jobs"] [data-job="alerts"]'); if (!el) throw new Error('no alerts item'); return el; });
    expect(jobs.getAttribute('data-stale')).toBe('true');
    expect(jobs).toHaveTextContent(s.option.job_alerts);
    expect(jobs).toHaveTextContent(s.body.alertsUndelivered.replace('{n}', '1'));
    cleanup();
    const status = programme.routes['/admin/ops/job-status'];
    const unread = fakeApi((path) => (path === '/admin/ops/job-status' ? { ok: true, data: { ...status, alerts: { undelivered: null, windowHours: 36, alerts: [] } } } : undefined));
    render(<Frame><StaffReports api={unread.api} initialView="support" /></Frame>);
    const item = await waitFor(() => { const el = document.querySelector<HTMLElement>('[data-tool="ops-jobs"] [data-job="alerts"]'); if (!el) throw new Error('no alerts item'); return el; });
    expect(item).toHaveTextContent(s.body.alertsUnread);
    expect(item).not.toHaveTextContent(s.option.alertsDelivered);
    cleanup();
    const clear = fakeApi((path) => (path === '/admin/ops/job-status' ? { ok: true, data: { ...status, alerts: { undelivered: 0, windowHours: 36, alerts: [] } } } : undefined));
    render(<Frame><StaffReports api={clear.api} initialView="support" /></Frame>);
    const ok = await waitFor(() => { const el = document.querySelector<HTMLElement>('[data-tool="ops-jobs"] [data-job="alerts"]'); if (!el) throw new Error('no alerts item'); return el; });
    expect(ok.getAttribute('data-stale')).toBe('false');
    expect(ok).toHaveTextContent(s.option.alertsDelivered);
  });

  it('a reply missing a job is an error state, never a healthy list (H.4)', async () => {
    const { api } = fakeApi((path) => (path === '/admin/ops/job-status' ? { ok: true, data: { jobs: [], anyStale: false } } : undefined));
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    const jobs = await waitFor(() => { const el = document.querySelector<HTMLElement>('[data-tool="ops-jobs"]'); if (!el) throw new Error('no card'); return el; });
    expect(await within(jobs).findByRole('button')).toBeTruthy();
    expect(jobs.querySelector('[data-job]')).toBeNull();
  });

  it('lowers a level only below the current one, with an actionable reason and a keep-first confirmation', async () => {
    const { api, posts, gets } = fakeApi();
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    fireEvent.change(await screen.findByLabelText(s.body.childId), { target: { value: KID } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lookUp }));
    expect(await screen.findByText(s.body.levelN.replace('{n}', '3'))).toBeTruthy();
    const select = screen.getByLabelText(s.body.newLevel) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['1', '2']);
    fireEvent.change(screen.getByLabelText(s.body.reason), { target: { value: 'not now' } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lower }));
    expect(await screen.findByText(s.body.reasonWeak)).toBeTruthy();
    expect(posts).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(s.body.reason), { target: { value: 'Practice two weeks of self-logged chores with a parent first' } });
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lower }));
    const dialog = await screen.findByRole('alertdialog');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: s.action.keep }));
    fireEvent.click(within(dialog).getByRole('button', { name: s.action.lower }));
    expect(await screen.findByText(s.body.lowered)).toBeTruthy();
    expect(posts).toEqual([{ path: `/admin/family-autonomy/${KID}/lower`, body: { level: 1, reason: 'Practice two weeks of self-logged chores with a parent first' } }]);
    expect(gets.filter((path) => path === `/admin/family-autonomy/${KID}`).length).toBe(2);
  });

  it('says Core refusals in words', async () => {
    const { api } = fakeApi((path) => (path.endsWith('/lower') ? { ok: false, code: 'AUTONOMY_STAFF_FORBIDDEN' } : path.startsWith('/admin/tutor/') ? { ok: true, data: programme.empty['/admin/tutor/retention-status'] } : undefined));
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    await screen.findByText(s.body.staleHelp);
    const sweep = document.querySelector<HTMLElement>('[data-tool="retention-sweep"]')!;
    expect(within(sweep).getByText(s.option.stale)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(s.body.childId), { target: { value: KID } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lookUp }));
    await screen.findByText(s.body.levelN.replace('{n}', '3'));
    fireEvent.change(screen.getByLabelText(s.body.reason), { target: { value: 'Practice two weeks of self-logged chores with a parent first' } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lower }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: s.action.lower }));
    expect(await screen.findByText(s.body.lowerRefused)).toBeTruthy();
  });

  it('a child outside a family is said, not an error page', async () => {
    const { api } = fakeApi((path) => (path.startsWith('/admin/family-autonomy/') ? { ok: false, code: 'NOT_FOUND' } : undefined));
    render(<Frame><StaffReports api={api} initialView="support" /></Frame>);
    fireEvent.change(await screen.findByLabelText(s.body.childId), { target: { value: KID } });
    fireEvent.click(screen.getByRole('button', { name: s.action.lookUp }));
    expect(await screen.findByText(s.body.notInFamily)).toBeTruthy();
  });
});

describe('Mentor quality → named owners (C.24, manage_users)', () => {
  it('an analyst without manage_users sees no roster form and never reads the people directory', async () => {
    const { api, gets } = fakeApi();
    render(<Frame><StaffMentorQuality api={api} viewer={ANALYST} /></Frame>);
    await waitFor(() => expect(gets).toContain('/admin/mentor-quality'));
    expect(await screen.findByRole('heading', { name: en.staffMentorQuality.flagsTitle })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: o.heading.owners })).toBeNull();
    expect(gets).not.toContain('/admin/users');
  });

  it('names an owner from the staff list and removes one behind a confirmation', async () => {
    const { api, posts, gets } = fakeApi();
    render(<Frame><StaffMentorQuality api={api} viewer={ANALYST_USERS} /></Frame>);
    const card = (await screen.findByRole('heading', { name: o.heading.owners })).closest('section')!;
    const person = await within(card).findByLabelText(o.body.person) as HTMLSelectElement;
    // Only staff accounts are offered (Core refuses anyone else).
    expect([...person.options].map((option) => option.text)).toEqual([o.option.choose, 'Staff Lima']);
    fireEvent.change(within(card).getByLabelText(o.body.role), { target: { value: 'engineering_lead' } });
    fireEvent.change(person, { target: { value: '66666666-6666-4666-8666-666666666666' } });
    fireEvent.click(within(card).getByRole('button', { name: o.action.add }));
    expect(await within(card).findByText(o.body.added)).toBeTruthy();
    expect(posts[0]).toEqual({ path: '/admin/mentor-quality/owners', body: { role: 'engineering_lead', userId: '66666666-6666-4666-8666-666666666666', action: 'add' } });
    expect(gets.filter((path) => path === '/admin/mentor-quality').length).toBe(2);
    fireEvent.click(within(card).getAllByRole('button', { name: o.action.remove })[0]!);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: o.action.remove }));
    await waitFor(() => expect(posts[1]).toEqual({ path: '/admin/mentor-quality/owners', body: { role: 'pedagogical_lead', userId: 'u-ped', action: 'remove' } }));
  });

  it('says NOT_ELIGIBLE_OWNER in words', async () => {
    const { api } = fakeApi((path) => (path === '/admin/mentor-quality/owners' ? { ok: false, code: 'NOT_ELIGIBLE_OWNER' } : undefined));
    render(<Frame><StaffMentorQuality api={api} viewer={ANALYST_USERS} /></Frame>);
    const card = (await screen.findByRole('heading', { name: o.heading.owners })).closest('section')!;
    fireEvent.change(await within(card).findByLabelText(o.body.person), { target: { value: '66666666-6666-4666-8666-666666666666' } });
    fireEvent.click(within(card).getByRole('button', { name: o.action.add }));
    expect(await within(card).findByText(o.body.notEligible)).toBeTruthy();
  });
});
