import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import en from '@/i18n/en-US/rebuild-staff.json';
import enCore from '@/i18n/en-US/rebuild-core.json';
import type { StaffApi, StaffResult } from './staffConsoleApi';
import { correctionsPath, isCorrections, StaffAgeCorrections, type AgeCorrection } from './StaffAgeCorrections';
import { selectOption } from '../../test/selectOption';

/*
 * E.4 (OD-3): the staff-reviewed age correction queue at the component
 * boundary. It reads only Core's queue, asks for a reason that matches the
 * decision and confirms before sending; Core and the database decide who may
 * decide (never the requester) and apply and audit the decision.
 */

const c = en.staffConsole.ageCorrections;
const common = en.staffConsole.common;
const USER = '22222222-2222-4222-8222-222222222222';
const REQUEST: AgeCorrection = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: USER, status: 'pending', fromBand: 'adult', requestedBand: '13_to_17', requestedBirthMonth: '2011-05',
  reason: null, createdAt: '2026-09-27T10:00:00Z', decidedAt: null, decidedBy: null,
};

function Frame({ children }: { children: ReactNode }) {
  return <RebuildRoot theme="light" locale="en-US"><RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}

function fakeApi(requests: AgeCorrection[], decision: StaffResult<unknown> = { ok: true, data: { id: REQUEST.id, status: 'approved' } }) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return { ok: true, data: { requests } } as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return decision as StaffResult<T>; },
  };
  return { api, gets, posts };
}

beforeEach(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); });
afterEach(() => cleanup());

describe('E.4 age corrections (manage_users)', () => {
  it('guards the wire shape', () => {
    expect(isCorrections({ requests: [REQUEST] })).toBe(true);
    expect(isCorrections({ requests: [{ ...REQUEST, requestedBand: 'teen' }] })).toBe(false);
    expect(isCorrections({})).toBe(false);
  });

  it('reads the pending queue first, under the section name the staff menu uses', async () => {
    const { api, gets } = fakeApi([REQUEST]);
    render(<Frame><StaffAgeCorrections api={api} /></Frame>);
    await screen.findByText(c.option['13_to_17']);
    expect(gets[0]).toBe(correctionsPath('pending'));
    expect(screen.getByRole('heading', { level: 1, name: enCore.appShell.staff.ageCorrections })).toBeTruthy();
  });

  it('approves only with an approval reason and after confirmation, and says so', async () => {
    const { api, posts } = fakeApi([REQUEST]);
    render(<Frame><StaffAgeCorrections api={api} /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: common.action.open }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('2011-05')).toBeTruthy();
    const approve = within(sheet).getByRole('button', { name: c.action.approve });
    expect(approve).toHaveProperty('disabled', true);
    selectOption(within(sheet).getByLabelText(c.body.reason), c.option.not_credible);
    expect(approve).toHaveProperty('disabled', true);
    selectOption(within(sheet).getByLabelText(c.body.reason), c.option.evidence_verified);
    fireEvent.click(approve);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(c.body.approveConsequence)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: c.action.approve }));
    await screen.findByText(c.body.approved);
    expect(posts).toEqual([{ path: `/admin/age-corrections/${REQUEST.id}/decision`, body: { decision: 'approve', reason: 'evidence_verified' } }]);
  });

  it('explains Core refusing a staff member deciding their own request', async () => {
    const { api } = fakeApi([REQUEST], { ok: false, code: 'SELF_DECISION' });
    render(<Frame><StaffAgeCorrections api={api} /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: common.action.open }));
    const sheet = await screen.findByRole('dialog');
    selectOption(within(sheet).getByLabelText(c.body.reason), c.option.evidence_missing);
    fireEvent.click(within(sheet).getByRole('button', { name: c.action.reject }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: c.action.reject }));
    await screen.findByText(c.body.self);
  });

  it('offers no decision on a decided request', async () => {
    const { api } = fakeApi([{ ...REQUEST, status: 'rejected', reason: 'evidence_missing', decidedAt: '2026-09-27T12:00:00Z', decidedBy: USER }]);
    render(<Frame><StaffAgeCorrections api={api} /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: common.action.open }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: c.action.approve })).toBeNull();
    expect(within(sheet).getByText(c.option.evidence_missing)).toBeTruthy();
  });

  it('shows the empty state when nothing waits', async () => {
    const { api } = fakeApi([]);
    render(<Frame><StaffAgeCorrections api={api} /></Frame>);
    await screen.findByText(c.body.empty);
  });
});
