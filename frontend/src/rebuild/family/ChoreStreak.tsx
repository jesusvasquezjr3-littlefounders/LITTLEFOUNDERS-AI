import { Celebration, celebrationPart, Copy, ErrorState, LoadingState, StatusMark } from '../design/controls';
import { isMilestone } from '../design/milestones';
import type { ChoreStreak as Streak, StreakMilestone } from './familyMoneyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';

/*
 * S07.3 (D.2): the child's chore streak, lapse-tolerant (Frontend Bible 02
 * §9.6). Two rest days a week are free and automatic; a missed day beyond
 * them rests the streak, and "Streak resting" always shows the best streak
 * (never "you lost your streak"). The best streak and the total days are
 * permanent. A Tutor's holiday pause is shown as plain status. Only the 7,
 * 30 and 100-day milestones celebrate (OD-7, closed list), once, when the
 * completion that reached them happens; an ordinary day updates quietly.
 * The moment goes through the shared milestone `Celebration` (S03.7), which
 * plays once per moment and keeps its final frame under reduced motion.
 * Copy is checked against the youngest band (6-9).
 */

export interface ChoreStreakCopy {
  heading: string; days: string; oneDay: string; practised: string; alive: string; resting: string; best: string; restLeft: string;
  paused: string; total: string; none: string; milestone: string; loading: string; failed: string; retry: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function ChoreStreak({ copy, locale, dark, streak, loading, failed, milestone, onRetry }: {
  copy: ChoreStreakCopy;
  locale: string;
  dark: boolean;
  streak: Streak | null;
  loading: boolean;
  failed: boolean;
  milestone: StreakMilestone | null;
  onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const days = (count: number) => (count === 1 ? copy.oneDay : fill(copy.days, { count }));
  const celebrate = milestone !== null && isMilestone(milestone) && streak !== null && `streak-${streak.current}` === milestone;

  return <section className="lf-rebuild lf-family-hub" data-family-money="chore-streak" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={copy.heading} data-streak-status={streak?.status ?? 'unknown'}>
    <Copy role="heading" as="h2">{copy.heading}</Copy>
    {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
      : loading || !streak ? <LoadingState label={copy.loading} lines={2} /> : <>
      {celebrate && <Celebration milestone={milestone} momentId={`chore-streak:${streak.today}`}>
        {/* The streak mark the server named: announced once, drawn with the shared celebration's pop. */}
        <div className="lf-family-money-milestone" role="status">
          <span {...celebrationPart('pop')}><StatusMark correct /></span><Copy role="heading" as="span">{fill(copy.milestone, { count: streak.current })}</Copy>
        </div>
      </Celebration>}
      {streak.status === 'none' ? <Copy role="body">{copy.none}</Copy> : streak.status === 'resting' ? <>
        <Copy role="body">{copy.resting}</Copy>
        <span data-copy-role="data">{fill(copy.best, { count: streak.best })}</span>
      </> : <>
        <div className="lf-family-money-streak">
          <span className="lf-family-money-number" data-copy-role="data">{days(streak.current)}</span>
          <Copy role="body" as="span">{streak.status === 'practised_today' ? copy.practised : copy.alive}</Copy>
        </div>
        <ul className="lf-family-money-facts">
          <li data-copy-role="data">{fill(copy.best, { count: streak.best })}</li>
          {streak.pausedUntil
            ? <li data-copy-role="data">{fill(copy.paused, { date: date.format(new Date(`${streak.pausedUntil}T00:00:00Z`)) })}</li>
            : <li data-copy-role="data">{fill(copy.restLeft, { count: streak.restDaysLeftThisWeek })}</li>}
        </ul>
      </>}
      {streak.totalDays > 0 && <span data-copy-role="data" className="lf-family-hub-muted">{fill(copy.total, { count: streak.totalDays })}</span>}
    </>}
  </section>;
}
