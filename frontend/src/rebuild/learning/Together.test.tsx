import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/rebuild-profile.json';
import { learnCopy } from './learnCopy';
import { TogetherView, type TogetherViewProps } from './TogetherView';
import { fetchTogether, reportFromGoal, startGoal, type Together, type TogetherTransport } from './together';

/*
 * L-04 (OD-27 (1)): goals together. The page shows the group total and the
 * people, and nothing that ranks, pays or lets anyone send words; every
 * action goes to Core with the session's own choice.
 */

const t = learnCopy['en-US'].together;
const person = (username: string, isSelf = false) => ({ username, displayName: username[0]!.toUpperCase() + username.slice(1), avatarOptions: {}, isSelf });
const GOAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const value: Together = {
  eligible: true,
  options: { targets: [5, 10, 15, 20, 30, 40], days: [7, 14, 28], maxPeople: 5 },
  goals: [{ id: GOAL, kind: 'lessons', target: 10, startsAt: '2026-09-20T00:00:00Z', endsAt: '2026-10-04T00:00:00Z', createdByMe: true, done: 4, reached: false,
    members: [person('rio', true), person('luz')], invited: [{ ...person('sol'), mine: true }], canInvite: true }],
  invitations: [{ goalId: OTHER, kind: 'lessons', target: 5, endsAt: '2026-10-04T00:00:00Z', invitedBy: person('mar'), members: [person('mar')] }],
  finished: [],
};

function view(overrides: Partial<TogetherViewProps> = {}) {
  const props: TogetherViewProps = {
    locale: 'en-US', dark: false, state: { status: 'ready', value }, candidates: [person('luz'), person('mar')], reportCopy: en.report,
    onBack: vi.fn(), onRetry: vi.fn(), onLoadCandidates: vi.fn(),
    onStart: vi.fn(async () => 'done' as const), onAsk: vi.fn(async () => 'done' as const), onAnswer: vi.fn(async () => 'done' as const),
    onLeave: vi.fn(async () => 'done' as const), onRemove: vi.fn(async () => 'done' as const), onReport: vi.fn(async () => 'done' as const),
    ...overrides,
  };
  render(<TogetherView {...props} />);
  return props;
}

describe('TogetherView (L-04)', () => {
  it('shows the group total and the people, and nothing that ranks, pays or sends words', () => {
    view();
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: t.progressLabel })).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByText('4 of 10')).toBeInTheDocument();
    const page = document.querySelector('[data-screen="together"]')!;
    expect(page.textContent).not.toMatch(/\b(rank|leader|winner|coins?|xp|streak)\b/i);
    expect(page.querySelector('textarea, input[type="text"]')).toBeNull();
    for (const element of page.querySelectorAll('h1, h2, h3, h4, p')) expect(element.closest('[data-copy-role]') ?? element.querySelector('[data-copy-role]'), element.outerHTML).not.toBeNull();
  });

  it('an ineligible learner sees why it is not open, and no goal controls', () => {
    view({ state: { status: 'ready', value: { ...value, eligible: false, goals: [], invitations: [] } } });
    expect(screen.getByText(t.closedTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.newTitle })).toBeNull();
  });

  it('answers an invitation with the session\'s own choice', async () => {
    const props = view();
    fireEvent.click(screen.getByRole('button', { name: t.join }));
    await waitFor(() => expect(props.onAnswer).toHaveBeenCalledWith(OTHER, true));
    expect(await screen.findByText(t.joined)).toBeInTheDocument();
  });

  it('starts a goal only with a preset and at least one person picked', async () => {
    const props = view({ state: { status: 'ready', value: { ...value, goals: [] } } });
    fireEvent.click(screen.getByRole('button', { name: t.newTitle }));
    expect(props.onLoadCandidates).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t.start }));
    expect(await screen.findByText(t.pickPeople)).toBeInTheDocument();
    expect(props.onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Luz' }));
    fireEvent.click(screen.getByRole('button', { name: t.start }));
    await waitFor(() => expect(props.onStart).toHaveBeenCalledWith(10, 14, ['luz']));
  });

  it('keeps asking, removing, reporting and leaving one press away (06 §3.1 layering)', () => {
    view();
    for (const name of [t.leave, t.report, t.invite, t.remove, t.withdraw]) expect(screen.queryByRole('button', { name })).toBeNull();
    const manage = screen.getByRole('button', { name: t.manage });
    expect(manage).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(manage);
    expect(manage).toHaveAttribute('aria-expanded', 'true');
    for (const name of [t.leave, t.report, t.invite, t.remove, t.withdraw]) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(manage);
    expect(screen.queryByRole('button', { name: t.leave })).toBeNull();
  });

  it('an ineligible learner is told the way in on its own line', () => {
    view({ state: { status: 'ready', value: { ...value, eligible: false, goals: [], invitations: [] } } });
    const hint = screen.getByText(t.closedHint);
    expect(hint).toHaveAttribute('data-copy-role', 'body');
    expect(screen.getByText(t.closedBody)).not.toBe(hint);
  });

  it('leaving asks first, and says what happens', async () => {
    const props = view();
    fireEvent.click(screen.getByRole('button', { name: t.manage }));
    fireEvent.click(screen.getByRole('button', { name: t.leave }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(t.leaveBody)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: t.leaveYes }));
    await waitFor(() => expect(props.onLeave).toHaveBeenCalledWith(GOAL));
  });

  it('reports someone in the goal with a category, and can leave in the same step', async () => {
    const props = view();
    fireEvent.click(screen.getByRole('button', { name: t.manage }));
    fireEvent.click(screen.getByRole('button', { name: t.report }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: en.report.categories.harassment }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: t.reportLeave }));
    fireEvent.click(within(dialog).getByRole('button', { name: en.report.send }));
    await waitFor(() => expect(props.onReport).toHaveBeenCalledWith(GOAL, 'luz', 'harassment', null, true));
  });
});

describe('together client (L-04)', () => {
  it('a malformed answer is unavailable, never partly shown', async () => {
    const bad: TogetherTransport = async () => ({ data: { ...value, goals: [{ id: 'x' }] }, error: null });
    expect(await fetchTogether(bad)).toEqual({ status: 'error' });
    const refused: TogetherTransport = async () => ({ data: null, error: { code: 'UNAUTHORIZED' } });
    expect(await fetchTogether(refused)).toEqual({ status: 'refused' });
  });

  it('sends presets and usernames only, and names each refusal', async () => {
    const calls: unknown[] = [];
    const transport: TogetherTransport = async (path, init) => { calls.push([path, init]); return { data: null, error: { code: 'COOP_MEMBER_UNAVAILABLE' } }; };
    expect(await startGoal(transport, 10, 14, ['luz'])).toBe('member-unavailable');
    expect(calls[0]).toEqual(['/coop-goals', { method: 'POST', body: { target: 10, days: 14, invite: ['luz'] } }]);
    const ok: TogetherTransport = async (path, init) => { calls.push([path, init]); return { data: { reported: true }, error: null }; };
    expect(await reportFromGoal(ok, GOAL, 'luz', 'other', null, false)).toBe('done');
    expect(calls[1]).toEqual([`/coop-goals/${GOAL}/report`, { method: 'POST', body: { username: 'luz', category: 'other', leave: false } }]);
  });
});
