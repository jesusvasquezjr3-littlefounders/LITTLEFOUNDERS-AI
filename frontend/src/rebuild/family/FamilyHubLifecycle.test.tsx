import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoGuardians, GuardianRequests } from './CoGuardians';
import { WalletCorrections } from './WalletCorrections';
import { WalletActivity } from './WalletActivity';
import type { CoGuardian, GuardianAction, KidGoal, LedgerEntry } from './familyHubApi';
import en from '@/i18n/en-US/familyHub.json';

/*
 * S07.1 rebuilt surfaces: each lifecycle state is rendered from server truth,
 * decisions are offered only to the verified Tutor, destructive actions ask
 * first, reasons are required before any write, and the child sees every
 * Tutor reason on their own history. Every rendered text node declares its
 * copy role.
 */

const ME = { linkId: '11111111-1111-4111-8111-111111111111', displayName: 'Ana', status: 'verified', isMe: true, since: '2026-09-01T00:00:00Z', decidedAt: null, revokedAt: null } satisfies CoGuardian;
const PENDING = { linkId: '22222222-2222-4222-8222-222222222222', displayName: 'Luis', status: 'pending', isMe: false, since: '2026-09-20T00:00:00Z', decidedAt: null, revokedAt: null } satisfies CoGuardian;
const OTHER = { ...PENDING, linkId: '33333333-3333-4333-8333-333333333333', displayName: 'Rosa', status: 'verified' } satisfies CoGuardian;

type CoProps = Parameters<typeof CoGuardians>[0];
function renderCo(overrides: Partial<CoProps> = {}) {
  const props: CoProps = {
    copy: en.coGuardians, locale: 'en-US', dark: false, kidName: 'Nico', open: true, guardians: [ME, PENDING], loading: false, failed: false,
    busy: false, notice: null, noticeIsError: false, confirmingLeave: false, onToggle: vi.fn(), onRetry: vi.fn(), onDecision: vi.fn(),
    onLeaveStart: vi.fn(), onLeaveCancel: vi.fn(), onLeaveConfirm: vi.fn(), ...overrides,
  };
  return { props, view: render(<CoGuardians {...props} />) };
}

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

describe('CoGuardians (guardian-link lifecycle)', () => {
  it('stays closed and silent until opened', () => {
    const { props } = renderCo({ open: false });
    expect(screen.queryByRole('heading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it('shows every Tutor with its state and offers confirm/reject only on the pending link', () => {
    const { props, view } = renderCo();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Tutors of Nico');
    const pending = view.container.querySelector('[data-link-status="pending"]') as HTMLElement;
    expect(within(pending).getByText(en.coGuardians.pending)).toBeVisible();
    fireEvent.click(within(pending).getByRole('button', { name: en.coGuardians.confirm }));
    fireEvent.click(within(pending).getByRole('button', { name: en.coGuardians.reject }));
    expect(props.onDecision).toHaveBeenNthCalledWith(1, PENDING.linkId, 'confirm');
    expect(props.onDecision).toHaveBeenNthCalledWith(2, PENDING.linkId, 'reject');
    const mine = view.container.querySelector('[data-link-status="verified"]') as HTMLElement;
    expect(within(mine).queryByRole('button')).toBeNull();
    everyTextHasARole(view.container);
  });

  it('never offers a decision to someone who is not a verified Tutor here', () => {
    renderCo({ guardians: [{ ...ME, status: 'pending' }, OTHER] });
    expect(screen.queryByRole('button', { name: en.coGuardians.confirm })).toBeNull();
    expect(screen.queryByRole('button', { name: en.coGuardians.leave })).toBeNull();
  });

  it('explains instead of offering to leave when this is the only verified Tutor', () => {
    renderCo({ guardians: [ME, PENDING] });
    expect(screen.queryByRole('button', { name: en.coGuardians.leave })).toBeNull();
    expect(screen.getByText(en.coGuardians.leaveLast)).toBeVisible();
  });

  it('asks before stepping away and offers Stay first', () => {
    const first = renderCo({ guardians: [ME, OTHER] });
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.leave }));
    expect(first.props.onLeaveStart).toHaveBeenCalledOnce();
    expect(first.props.onLeaveConfirm).not.toHaveBeenCalled();
    first.view.unmount();
    const { props } = renderCo({ guardians: [ME, OTHER], confirmingLeave: true });
    const group = screen.getByRole('group', { name: en.coGuardians.leave });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([en.coGuardians.keep, en.coGuardians.leaveConfirm]);
    fireEvent.click(buttons[1]!);
    expect(props.onLeaveConfirm).toHaveBeenCalledOnce();
  });

  it('shows a failed read as an alert with retry, never as an empty list', () => {
    const { props } = renderCo({ failed: true, guardians: [] });
    expect(screen.getByRole('alert')).toHaveTextContent(en.coGuardians.failed);
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.retry }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows the rejected and stepped-away states', () => {
    const { view } = renderCo({ guardians: [ME, { ...PENDING, status: 'rejected', decidedAt: '2026-09-21T00:00:00Z' }, { ...OTHER, status: 'revoked', revokedAt: '2026-09-22T00:00:00Z' }] });
    expect(within(view.container.querySelector('[data-link-status="rejected"]') as HTMLElement).getByText(en.coGuardians.rejected)).toBeVisible();
    expect(within(view.container.querySelector('[data-link-status="revoked"]') as HTMLElement).getByText(en.coGuardians.revoked)).toBeVisible();
  });
});

describe('GuardianRequests (invited adult)', () => {
  it('renders nothing when the adult has no pending/rejected/revoked link', () => {
    const view = render(<GuardianRequests copy={en.guardianRequests} locale="en-US" dark={false} links={[]} failed={false} onRetry={vi.fn()} />);
    expect(view.container).toBeEmptyDOMElement();
  });

  it('names each state with the child display name', () => {
    render(<GuardianRequests copy={en.guardianRequests} locale="en-US" dark={false} failed={false} onRetry={vi.fn()} links={[
      { linkId: PENDING.linkId, kidDisplayName: 'Nico', status: 'pending', updatedAt: '2026-09-20T00:00:00Z' },
      { linkId: OTHER.linkId, kidDisplayName: null, status: 'rejected', updatedAt: '2026-09-21T00:00:00Z' },
    ]} />);
    expect(screen.getByText('Nico: waiting for their Tutor to confirm you.')).toBeVisible();
    expect(screen.getByText('A child account: their Tutor did not confirm you.')).toBeVisible();
  });
});

const GOAL: KidGoal = { id: '44444444-4444-4444-8444-444444444444', title: 'Bike', target: 10, status: 'reached', saved: 10 };
const ACTION: GuardianAction = { id: '55555555-5555-4555-8555-555555555555', kind: 'manual_adjustment', bucket: 'spend', goalId: null, amount: -3, reason: 'Lost game fee', byMe: false, createdAt: '2026-09-22T00:00:00Z' };

type WcProps = Parameters<typeof WalletCorrections>[0];
function renderWc(overrides: Partial<WcProps> = {}) {
  const props: WcProps = {
    copy: en.walletCorrections, locale: 'en-US', dark: false, kidName: 'Nico', open: true, loading: false, failed: false,
    goals: [GOAL, { ...GOAL, id: '66666666-6666-4666-8666-666666666666', title: 'Empty', saved: 0 }], rewards: [{ id: '77777777-7777-4777-8777-777777777777', title: 'Movie night', approvedAt: '2026-09-21T00:00:00Z' }],
    history: [ACTION], busy: false, notice: null, onToggle: vi.fn(), onRetry: vi.fn(),
    onAdjust: vi.fn().mockResolvedValue(true), onWithdraw: vi.fn().mockResolvedValue(true), onDeliver: vi.fn(), ...overrides,
  };
  return { props, view: render(<WalletCorrections {...props} />) };
}

describe('WalletCorrections (manual adjustment, goal withdrawal, delivery)', () => {
  it('refuses to submit a correction without a reason or with an invalid amount', async () => {
    const { props } = renderWc();
    const form = screen.getByRole('form', { name: en.walletCorrections.adjustHeading });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(en.walletCorrections.amountInvalid);
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '5' } });
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.reason), { target: { value: '   ' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(en.walletCorrections.reasonRequired);
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '1001' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(en.walletCorrections.amountInvalid);
    expect(props.onAdjust).not.toHaveBeenCalled();
  });

  it('sends a signed amount, the chosen pocket and the trimmed reason', async () => {
    const { props } = renderWc();
    const form = screen.getByRole('form', { name: en.walletCorrections.adjustHeading });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.save }));
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.remove }));
    expect(within(form).getByRole('button', { name: en.walletCorrections.remove })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '4' } });
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.reason), { target: { value: '  Counted twice  ' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    await vi.waitFor(() => expect(props.onAdjust).toHaveBeenCalledWith({ bucket: 'save', amount: -4, reason: 'Counted twice' }));
  });

  it('offers to move coins only out of goals that hold coins, with a required reason and destination', async () => {
    const { props } = renderWc();
    expect(screen.queryByText('Empty')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.moveOut }));
    const form = screen.getByRole('form', { name: en.walletCorrections.moveOut });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.toSave }));
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '10' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.moveOut }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(en.walletCorrections.reasonRequired);
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.reason), { target: { value: 'Goal changed' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.moveOut }));
    await vi.waitFor(() => expect(props.onWithdraw).toHaveBeenCalledWith(GOAL.id, { amount: 10, destination: 'save', reason: 'Goal changed' }));
  });

  it('marks an approved reward delivered and lists past corrections with reason and attribution', () => {
    const { props, view } = renderWc();
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.deliver }));
    expect(props.onDeliver).toHaveBeenCalledWith('77777777-7777-4777-8777-777777777777');
    const row = view.container.querySelector('[data-action-kind="manual_adjustment"]') as HTMLElement;
    expect(within(row).getByText('Lost game fee')).toHaveAttribute('data-copy-role', 'data');
    expect(within(row).getByText(en.walletCorrections.byOther)).toBeVisible();
    expect(within(row).getByText('−3')).toBeVisible();
    everyTextHasARole(view.container);
  });

  it('reports a failed load with retry and hides every form', () => {
    const { props } = renderWc({ failed: true });
    expect(screen.getByRole('alert')).toHaveTextContent(en.walletCorrections.failed);
    expect(screen.queryByRole('form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.retry }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('announces a server refusal as an alert', () => {
    renderWc({ notice: { text: en.walletCorrections.insufficient, error: true } });
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(en.walletCorrections.insufficient);
  });
});

describe('WalletActivity (the child sees every Tutor reason)', () => {
  const entries: LedgerEntry[] = [
    { id: 3, bucket: 'spend', amount: 4, reason: 'goal_withdrawal', note: 'Bought the bike', createdAt: '2026-09-22T00:00:00Z' },
    { id: 2, bucket: 'spend', amount: -3, reason: 'manual_adjustment', note: 'Lost game fee', createdAt: '2026-09-21T00:00:00Z' },
    { id: 1, bucket: 'save', amount: 5, reason: 'task_approved', note: null, createdAt: '2026-09-20T00:00:00Z' },
  ];

  it('labels each movement and shows the reason for guardian movements', () => {
    const view = render(<WalletActivity copy={en.walletActivity} locale="en-US" dark={false} open loading={false} failed={false} entries={entries}
      rewards={[{ id: 'r1', title: 'Movie night', status: 'fulfilled', at: '2026-09-22T00:00:00Z' }, { id: 'r2', title: null, status: 'approved', at: '2026-09-21T00:00:00Z' }]}
      onToggle={vi.fn()} onRetry={vi.fn()} />);
    const correction = view.container.querySelector('[data-ledger-reason="manual_adjustment"]') as HTMLElement;
    expect(within(correction).getByText(en.walletActivity.correction)).toBeVisible();
    expect(within(correction).getByText('Why: Lost game fee')).toBeVisible();
    expect(within(view.container.querySelector('[data-ledger-reason="goal_withdrawal"]') as HTMLElement).getByText('Why: Bought the bike')).toBeVisible();
    expect(within(view.container.querySelector('[data-ledger-reason="task_approved"]') as HTMLElement).queryByText(/Why:/)).toBeNull();
    expect(within(view.container.querySelector('[data-redemption-status="fulfilled"]') as HTMLElement).getByText(en.walletActivity.fulfilled)).toBeVisible();
    expect(within(view.container.querySelector('[data-redemption-status="approved"]') as HTMLElement).getByText(en.walletActivity.rewardUntitled)).toBeVisible();
    everyTextHasARole(view.container);
  });

  it('never celebrates: no animation classes or confetti markup', () => {
    const view = render(<WalletActivity copy={en.walletActivity} locale="en-US" dark open loading={false} failed={false} entries={entries} rewards={[]} onToggle={vi.fn()} onRetry={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/confetti|celebrat|spring/i);
    expect(view.container.querySelector('section')).toHaveAttribute('data-theme', 'dark');
  });

  it('shows a failed read with retry', () => {
    const onRetry = vi.fn();
    render(<WalletActivity copy={en.walletActivity} locale="en-US" dark={false} open loading={false} failed entries={[]} rewards={[]} onToggle={vi.fn()} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(en.walletActivity.failed);
    fireEvent.click(screen.getByRole('button', { name: en.walletActivity.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
