import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { ChildProgress } from './ChildProgress';
import { FAMILY, fakeTransport, KID_A, ok, refuse, territoryWire, type Answer } from './consoleFixtures';
import type { AchievementShareOutcome } from '../achievementImage';

/*
 * W2F.1 F2: a child's progress through the Tutor's eyes. The child's own
 * tree, never ranked; the OD-20 picture shares for a finished course, a
 * streak of 3+ days and a reached goal, each with its disclosure at the point
 * of action and no link language; the refusal, no-course, offline and
 * failure states; the parent report counted once per successful load.
 */

const family = rebuildNamespaceCopy['en-US'].family;
const copy = family.familyChildProgress;
const COURSES = { courses: [{ slug: 'money-basics', title: { 'en-US': 'Money Basics' } }] };

function setup(routes: Record<string, Answer>, onShare = vi.fn(async (): Promise<AchievementShareOutcome> => 'shared')) {
  const transport = fakeTransport({
    'GET /family/kids': ok({ kids: FAMILY }),
    'GET /learn/courses': ok(COURSES),
    [`GET /tasks/${KID_A}/goals`]: ok({ goals: [] }),
    [`GET /family/kids/${KID_A}/courses/money-basics/territory`]: ok(territoryWire()),
    ...routes,
  });
  const onViewed = vi.fn();
  const onNavigate = vi.fn();
  const view = render(<ChildProgress copy={copy} shareCopy={family.achievementShare} locale="en-US" dark={false} transport={transport} kidId={KID_A}
    backHref={`/family?child=${KID_A}`} onNavigate={onNavigate} onShare={onShare} onViewed={onViewed} />);
  return { transport, onViewed, onNavigate, onShare, view };
}

describe('ChildProgress (F2)', () => {
  it('shows the child\'s stats and a read-only map with each topic\'s state in words', async () => {
    const { onViewed, view } = setup({});
    await screen.findByRole('heading', { level: 1, name: "Sofía's progress" });
    await screen.findByText('Why save');
    expect(screen.getByText('420')).toBeInTheDocument();
    for (const word of [copy.done, copy.inProgress, copy.notStarted, copy.reviewDue]) expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.getAllByText('3 of 8 lessons').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'Saving' })).toHaveAttribute('aria-valuenow', '3');
    expect(onViewed).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).not.toMatch(/behind|failing|worse|ranked/i);
    expect(screen.getByRole('link', { name: copy.back })).toHaveAttribute('href', `/family?child=${KID_A}`);
  });

  it('offers a streak picture from 3 days, with its disclosure described at the point of action and no link', async () => {
    const onShare = vi.fn(async (): Promise<AchievementShareOutcome> => 'downloaded');
    setup({}, onShare);
    const button = await screen.findByRole('button', { name: copy.shareStreak });
    const described = button.getAttribute('aria-describedby')!;
    expect(document.getElementById(described)?.textContent).toContain(family.achievementShare.disclosure);
    expect(document.body.textContent).not.toMatch(/\blink\b(?! is made)/i);
    fireEvent.click(button);
    await screen.findByText(family.achievementShare.downloaded);
    expect(onShare).toHaveBeenCalledWith({ kind: 'streak', locale: 'en-US' });
  });

  it('hides the streak share under 3 days and offers the course badge once the course is finished', async () => {
    setup({ [`GET /family/kids/${KID_A}/courses/money-basics/territory`]: ok(territoryWire({ streakDays: 2, passed: 8, total: 8 })) });
    await screen.findByRole('button', { name: copy.shareBadge });
    expect(screen.queryByRole('button', { name: copy.shareStreak })).toBeNull();
    expect(screen.getByText('Finished Money Basics')).toBeInTheDocument();
  });

  it('shares a reached goal as a picture, and a dismissed share sheet goes back to idle', async () => {
    const onShare = vi.fn(async (): Promise<AchievementShareOutcome> => 'cancelled');
    setup({ [`GET /tasks/${KID_A}/goals`]: ok({ goals: [{ id: '66666666-6666-4666-8666-666666666666', title: 'Bike', status: 'reached' }] }) }, onShare);
    const button = await screen.findByRole('button', { name: family.achievementShare.shareGoal });
    expect(screen.getByText('Goal reached: Bike')).toBeInTheDocument();
    await act(async () => { fireEvent.click(button); });
    expect(onShare).toHaveBeenCalledWith({ kind: 'goal_reached', goalId: '66666666-6666-4666-8666-666666666666', locale: 'en-US' });
    expect(button).toBeEnabled();
    expect(screen.queryByText(family.achievementShare.failed)).toBeNull();
  });

  it('reports a failed picture honestly', async () => {
    setup({}, vi.fn(async (): Promise<AchievementShareOutcome> => 'failed'));
    fireEvent.click(await screen.findByRole('button', { name: copy.shareStreak }));
    expect(await screen.findByRole('alert')).toHaveTextContent(family.achievementShare.failed);
  });

  it('explains a refusal for a child who is not linked to this Tutor', async () => {
    setup({ [`GET /family/kids/${KID_A}/courses/money-basics/territory`]: refuse('FORBIDDEN') });
    expect(await screen.findByRole('heading', { name: copy.forbiddenTitle })).toBeInTheDocument();
  });

  it('says there is no course yet instead of an error', async () => {
    setup({ 'GET /learn/courses': ok({ courses: [] }) });
    expect(await screen.findByRole('heading', { name: copy.noCourseTitle })).toBeInTheDocument();
  });

  it('says offline when offline and retries the load', async () => {
    let calls = 0;
    const { onViewed } = setup({ [`GET /family/kids/${KID_A}/courses/money-basics/territory`]: () => (++calls === 1 ? refuse('NETWORK') : ok(territoryWire())) });
    expect(await screen.findByText(copy.offlineBody)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await screen.findByText('Why save');
    await waitFor(() => expect(onViewed).toHaveBeenCalledTimes(1));
  });

  it('lets the Tutor choose among several courses', async () => {
    const { transport } = setup({
      'GET /learn/courses': ok({ courses: [...COURSES.courses, { slug: 'enterprise', title: { 'en-US': 'Enterprise' } }] }),
      [`GET /family/kids/${KID_A}/courses/enterprise/territory`]: ok(territoryWire()),
    });
    fireEvent.change(await screen.findByLabelText(copy.course), { target: { value: 'enterprise' } });
    await waitFor(() => expect(transport.calls.some((call) => call.path.endsWith('/courses/enterprise/territory'))).toBe(true));
  });
});
