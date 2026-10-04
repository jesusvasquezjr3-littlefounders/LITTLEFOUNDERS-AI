import { ApplicationArt } from '../../design/ApplicationArt';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Card, Chip, Copy, EmptyState, ProgressBar, SelectField, type GlyphName, type StatusTone } from '../../design/controls';
import { AchievementShare, type AchievementShareCopy, type AchievementShareStatus } from '../AchievementShare';
import type { AchievementImageRequest, AchievementShareOutcome } from '../achievementImage';
import {
  childName, fetchChildren, fetchCourses, fetchReachedGoal, fetchTerritory, MIN_SHAREABLE_STREAK_DAYS,
  type ConsoleTransport, type CourseSummary, type LocalizedText, type ReachedGoal, type Territory, type TopicState,
} from './consoleApi';
import { BackLink, FailureState, fill, isRefusal, PageLoading, type ChildProgressCopy, type ConsoleLocale, type PageFailure } from './consoleParts';
import '../../design/tokens.css';
import '../../design/system.css';
import './console.css';

/*
 * F2, a child's progress through the Tutor's eyes (W2F.1), rebuilt from the
 * design system. It replaces the legacy page that borrowed the learner's own
 * territory renderer (a legacy component, 02 rule 23).
 *
 * What it shows is the child's own tree, as Core computes it for THIS child
 * behind the verified-guardian check (placement credits and the pathway
 * included): the stats, then a read-only map of the course, unit by unit,
 * with each topic's state in a word and a glyph. Wording discipline: what is
 * left is territory still to explore, never a deficiency; one child per page,
 * never ranked.
 *
 * OD-20 sharing (F.1, F.3): a finished course's badge, a streak of at least
 * three days and a reached savings goal can each be shared as a PICTURE made
 * for this Tutor and handed to their device (share sheet or download); no
 * link is made. The point-of-action disclosure sits under each button. Core
 * re-verifies the guardian link and the achievement; this screen authorizes
 * nothing, and the hides below are conveniences Core repeats.
 */

type TerritoryLoad = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; territory: Territory };
type CoursesLoad = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; courses: CourseSummary[] };
type ShareKind = 'streak' | 'badge' | 'goal';

export function localized(value: LocalizedText, locale: string): string {
  const direct = value[locale];
  if (typeof direct === 'string') return direct;
  const english = value['en-US'];
  if (typeof english === 'string') return english;
  return Object.values(value).find((entry): entry is string => typeof entry === 'string') ?? '';
}

const TOPIC: Record<TopicState, { tone: StatusTone; glyph: GlyphName; key: 'done' | 'inProgress' | 'notStarted' | 'reviewDue' }> = {
  completed: { tone: 'success', glyph: 'check', key: 'done' },
  'in-progress': { tone: 'primary', glyph: 'play', key: 'inProgress' },
  'not-started': { tone: 'sky', glyph: 'plus', key: 'notStarted' },
  'review-due': { tone: 'warning', glyph: 'refresh', key: 'reviewDue' },
};

export function ChildProgress({ copy, shareCopy, locale, dark, transport, kidId, backHref, onNavigate, onShare, onViewed }: {
  copy: ChildProgressCopy;
  shareCopy: AchievementShareCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  kidId: string;
  backHref: string;
  onNavigate: (href: string) => void;
  /** Hands the picture to the device; the caller owns Core, the share sheet and the counting. */
  onShare: (request: AchievementImageRequest) => Promise<AchievementShareOutcome>;
  /** Once per successful load: the Tutor looked at the report (0072's parent_report_viewed). */
  onViewed: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [courses, setCourses] = useState<CoursesLoad>({ status: 'loading' });
  const [slug, setSlug] = useState<string | null>(null);
  const [load, setLoad] = useState<TerritoryLoad>({ status: 'loading' });
  const [goal, setGoal] = useState<ReachedGoal | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [shares, setShares] = useState<Record<ShareKind, AchievementShareStatus>>({ streak: 'idle', badge: 'idle', goal: 'idle' });
  const generation = useRef(0);

  const readCourses = useCallback(async () => {
    const current = ++generation.current;
    const [family, list, reached] = await Promise.all([fetchChildren(transport), fetchCourses(transport), fetchReachedGoal(transport, kidId)]);
    if (current !== generation.current) return;
    setRetrying(false);
    // The name and the goal are conveniences: without them the page still shows the progress.
    const self = family.ok ? family.data.find((child) => child.userId === kidId) : undefined;
    if (self) setName(childName(self));
    if (reached.ok) setGoal(reached.data);
    if (!list.ok) { setCourses({ status: 'failed', failure: { code: list.code } }); return; }
    setCourses({ status: 'ready', courses: list.data.courses });
    setSlug((previous) => previous && list.data.courses.some((course) => course.slug === previous) ? previous : list.data.courses[0]?.slug ?? null);
  }, [transport, kidId]);

  useEffect(() => {
    setCourses({ status: 'loading' }); setLoad({ status: 'loading' }); setName(null); setGoal(null);
    void readCourses();
    return () => { generation.current++; };
  }, [readCourses]);

  const readTerritory = useCallback(async (course: string) => {
    const current = ++generation.current;
    setLoad({ status: 'loading' });
    const result = await fetchTerritory(transport, kidId, course);
    if (current !== generation.current) return;
    setRetrying(false);
    if (!result.ok) { setLoad({ status: 'failed', failure: { code: result.code } }); return; }
    setLoad({ status: 'ready', territory: result.data });
    onViewed();
    // onViewed is an event, not an input.
  }, [transport, kidId]);

  useEffect(() => {
    if (courses.status === 'ready' && slug) void readTerritory(slug);
  }, [courses.status, slug, readTerritory]);

  async function share(kind: ShareKind, request: AchievementImageRequest) {
    setShares((previous) => ({ ...previous, [kind]: 'preparing' }));
    const outcome = await onShare(request);
    setShares((previous) => ({ ...previous, [kind]: outcome === 'cancelled' ? 'idle' : outcome }));
  }

  const title = name ? fill(copy.title, { name }) : copy.titleFallback;
  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console" data-screen="child-progress" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <header className="lf-console-header lf-illustrated-header"><div className="lf-illustrated-heading">
      <BackLink href={backHref} label={copy.back} onNavigate={onNavigate} />
      <h1 className="ugc" data-copy-role="heading">{title}</h1>
    </div><ApplicationArt scene="learning" /></header>
    {body}
  </div>;
  const retry = () => { setRetrying(true); if (courses.status !== 'ready') void readCourses(); else if (slug) void readTerritory(slug); };

  const failure = courses.status === 'failed' ? courses.failure : load.status === 'failed' ? load.failure : null;
  if (failure && isRefusal(failure.code)) return root(<EmptyState heading={copy.forbiddenTitle} body={copy.forbiddenBody} />);
  if (failure && failure.code === 'NOT_FOUND') return root(<EmptyState heading={copy.noCourseTitle} body={copy.noCourseBody} />);
  if (failure) return root(<FailureState failure={failure} copy={copy} retrying={retrying} onRetry={retry} />);
  if (courses.status === 'ready' && courses.courses.length === 0) return root(<EmptyState heading={copy.noCourseTitle} body={copy.noCourseBody} />);
  if (courses.status !== 'ready' || load.status !== 'ready') return root(<PageLoading label={copy.loading} />);

  const { territory } = load;
  const { stats, course } = territory;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const courseTitle = localized(course.title, locale);
  const finished = course.progress.total > 0 && course.progress.passed >= course.progress.total;
  const streakShareable = stats !== null && stats.streakDays >= MIN_SHAREABLE_STREAK_DAYS;
  const withLabel = (label: string): AchievementShareCopy => ({ ...shareCopy, share: label });

  return root(<>
    {courses.courses.length > 1 ? <SelectField label={copy.course} value={course.slug}
      options={courses.courses.map((entry) => ({ value: entry.slug, label: localized(entry.title, locale), role: 'data' }))}
      onChange={(event) => setSlug(event.target.value)} /> : null}

    {stats ? <Card as="div">
      <section aria-labelledby="child-progress-glance" className="lf-console-shares">
        <h2 id="child-progress-glance" data-copy-role="heading">{copy.glance}</h2>
        <dl className="lf-console-stats">
          <Stat label={copy.xp} value={stats.xpPoints} locale={locale} />
          <Stat label={copy.lessons} value={stats.lessonsCompleted} locale={locale} />
          <Stat label={copy.streak} value={stats.streakDays} locale={locale} />
          <Stat label={copy.best} value={stats.longestStreak} locale={locale} />
        </dl>
        {stats.lastActiveDate ? <Copy role="body">{fill(copy.lastActive, { date: date.format(new Date(`${stats.lastActiveDate.slice(0, 10)}T12:00:00`)) })}</Copy> : null}
      </section>
    </Card> : null}

    <section className="lf-console-group" aria-labelledby="child-progress-map" data-console-part="map">
      <h2 id="child-progress-map" data-copy-role="heading">{copy.mapTitle}</h2>
      <span className="ugc" data-copy-role="data">{courseTitle}</span>
      {course.inProgress ? <Copy role="body">{copy.building}</Copy> : null}
      {course.placementRequired ? <Copy role="body">{copy.placement}</Copy> : null}
      <ul className="lf-console-units">
        {territory.units.map((unit) => <Unit key={unit.id} unit={unit} copy={copy} locale={locale} />)}
      </ul>
    </section>
    {finished || streakShareable || goal ? <Card as="div">
      <section className="lf-console-shares" aria-labelledby="child-progress-share" data-console-part="shares">
        <h2 id="child-progress-share" data-copy-role="heading">{copy.shareTitle}</h2>
        {finished ? <div className="lf-console-share" data-share-kind="course_badge">
          <span className="ugc" data-copy-role="data">{fill(copy.badgeLabel, { course: courseTitle })}</span>
          <AchievementShare copy={withLabel(copy.shareBadge)} locale={locale} dark={dark} status={shares.badge}
            onShare={() => void share('badge', { kind: 'course_badge', courseSlug: course.slug, locale })} />
        </div> : null}
        {streakShareable ? <div className="lf-console-share" data-share-kind="streak">
          <span data-copy-role="data">{fill(copy.streakLabel, { count: stats!.streakDays })}</span>
          <AchievementShare copy={withLabel(copy.shareStreak)} locale={locale} dark={dark} status={shares.streak}
            onShare={() => void share('streak', { kind: 'streak', locale })} />
        </div> : null}
        {goal ? <div className="lf-console-share" data-share-kind="goal_reached">
          <span className="ugc" data-copy-role="data">{fill(copy.goalLabel, { goal: goal.title })}</span>
          <AchievementShare copy={shareCopy} locale={locale} dark={dark} variant="goal" status={shares.goal}
            onShare={() => void share('goal', { kind: 'goal_reached', goalId: goal.id, locale })} />
        </div> : null}
      </section>
    </Card> : null}

  </>);
}

function Stat({ label, value, locale }: { label: string; value: number; locale: string }) {
  return <div className="lf-console-stat">
    <dt data-copy-role="body">{label}</dt>
    <dd data-copy-role="data">{new Intl.NumberFormat(locale).format(value)}</dd>
  </div>;
}

function Unit({ unit, copy, locale }: { unit: Territory['units'][number]; copy: ChildProgressCopy; locale: string }) {
  const heading = useId();
  const title = localized(unit.title, locale);
  const lessons = fill(copy.lessonsOf, { passed: unit.progress.passed, total: unit.progress.total });
  return <li>
    <Card as="div">
      <section className="lf-console-shares" aria-labelledby={heading}>
        <h3 id={heading} className="ugc" data-copy-role="data">{title}</h3>
        <span data-copy-role="data">{lessons}</span>
        <ProgressBar label={title} value={unit.progress.passed} max={Math.max(1, unit.progress.total)} valueText={lessons} labelHidden tone="mint" />
        <ul className="lf-console-topics">
          {unit.topics.map((topic) => {
            const state = TOPIC[topic.state];
            return <li key={topic.id} className="lf-console-topic" data-topic-state={topic.state}>
              <span className="lf-console-topic-name ugc" data-copy-role="data">{localized(topic.title, locale)}</span>
              <Chip tone={state.tone} glyph={state.glyph} role="option">{copy[state.key]}</Chip>
            </li>;
          })}
        </ul>
      </section>
    </Card>
  </li>;
}
