import { useId, type ReactNode } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Art, Banner, ButtonLink, Card, DashboardLayout, EmptyState, ErrorState, LoadingState, Pill, ProgressBar, RewardChip, Button } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './learnHome.css';
import { localizedText } from './coursePath';
import { nextStep, type CourseState, type NextStep } from './course';
import { SelfBridgeList } from './DecisionJournalView';
import { learningRhythmCopy } from './LearningRhythmView';
import { fill, learnCopy, linkTo, plural, type LearnLinks, type LearnNavigate } from './learnCopy';
import { courseIdentity, featuredCourse, isClosedByAge, isDone, isStarted, shelfOrder, type ShelfCourse, type ShelfState } from './learnHome';
import type { RhythmState } from './motivation';
import type { BridgeAnswer, SelfBridge } from './narrative';

/*
 * W2L.1 — L1, the learner home at /learn, inside the learner shell.
 *
 * A dashboard of independent pieces (Bible 02 rule 15: a neutral page with
 * coloured cards; DashboardLayout's 7:5 split from an 840 px container):
 *
 *   primary    the next step of the featured course (B.6: the pathway
 *              frontier's recommended lesson when that engine is on, the
 *              tree's next lesson otherwise, the entry placement first when
 *              one is owed), then the course shelf, every course told apart
 *              by hue, icon and title (02 §4.3). A course the age safeguard
 *              closes is listed and never offered (OD-16). B.3: a featured
 *              course that could not load is said, never silently dropped.
 *   secondary  the habit streak with its rest days and the learner's own pace
 *              (B.21, B.24), then the learner's story (B.9: the decision
 *              journal; B.13: an independent teen's "try it for real" prompts).
 *
 * Presentation only: the host (routes/app/learn/LearnHomeRoute.tsx, or the
 * preview) owns transport and navigation. Nothing here decides a lock or sees
 * an age. No lives, no celebration (the milestones celebrate on the lesson
 * result, D7), no loss or guilt copy on the streak (02 §9.6), and no counter
 * of anything missed (B.25).
 */

export interface LearnHomeProps {
  locale: Locale;
  dark: boolean;
  /** The learner's Copy Budget band, from Core's register (the youngest while unknown). */
  ageBand: AgeBand;
  /** The learner's first name, when there is one. */
  name: string | null;
  shelf: ShelfState;
  /**
   * The featured course's own entry (its next step), keyed by the course it was
   * read for; an absent, stale or failed read falls back to opening the course.
   */
  featured: { slug: string; state: CourseState } | null;
  rhythm: RhythmState;
  bridges: SelfBridge[];
  /** The one-time register graduation card (B.23), when Core says one is owed. */
  graduation?: ReactNode;
  links: LearnLinks;
  onNavigate: LearnNavigate;
  onRetry: () => void;
  retrying?: boolean;
  onBridge: BridgeAnswer;
  /** W3L.1 (L-12): the teen's Wallet, after a goal was created there. */
  onOpenWallet?: () => void;
  fixture?: boolean;
}

export function LearnHomeView(props: LearnHomeProps) {
  const { locale, dark, ageBand, name, shelf, fixture = false } = props;
  const t = learnCopy[locale].home;
  const courses = shelf.status === 'ready' ? shelf.shelf.courses : [];
  const featured = featuredCourse(courses);
  return <div className="lf-rebuild lf-learner-page lf-learn-home" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-age-band={ageBand} data-screen={fixture ? 'learn-home-preview' : 'learn-home'} data-state={shelf.status} aria-busy={shelf.status === 'loading'}>
    <header className="lf-learn-home-top">
      <h1 data-copy-role="heading">{name ? fill(t.greeting, { name }) : t.greetingAnon}</h1>
      <StreakChip rhythm={props.rhythm} locale={locale} />
    </header>
    {props.graduation}
    {shelf.status === 'ready' && shelf.shelf.unavailableFeaturedCourse
      ? <Banner tone="info" action={<Button variant="inverse" size="sm" pending={props.retrying} pendingLabel={t.retrying} onClick={props.onRetry}>{t.retry}</Button>}>
        {fill(t.unavailable, { course: localizedText(shelf.shelf.unavailableFeaturedCourse.title, locale) || shelf.shelf.unavailableFeaturedCourse.slug })}
      </Banner>
      : null}
    <DashboardLayout
      primary={<Shelf {...props} courses={courses} lead={featured} />}
      secondary={<>
        <StreakCard {...props} />
        <SelfBridgeList bridges={props.bridges} locale={locale} onBridge={props.onBridge} onOpenWallet={props.onOpenWallet} />
        <StoryCard {...props} />
      </>} />
  </div>;
}

function Shelf({ locale, shelf, courses, lead, ...props }: LearnHomeProps & { courses: ShelfCourse[]; lead: ShelfCourse | null }) {
  const t = learnCopy[locale].home;
  const headingId = useId();
  if (shelf.status === 'loading') return <LoadingState label={t.loading} lines={4} />;
  if (shelf.status === 'offline' || shelf.status === 'error') {
    return <ErrorState heading={shelf.status === 'offline' ? t.offlineTitle : t.errorTitle} body={shelf.status === 'offline' ? t.offlineBody : t.errorBody}
      retryLabel={t.retry} retryingLabel={t.retrying} retrying={props.retrying} onRetry={props.onRetry} />;
  }
  if (shelf.status === 'refused') return <EmptyState heading={t.refusedTitle} body={t.refusedBody} />;
  if (courses.length === 0) return <EmptyState heading={t.emptyTitle} body={t.emptyBody} artAssetId="empty.fresh-start.art" />;
  return <>
    {lead ? <NextStepHero {...props} locale={locale} shelf={shelf} course={lead} /> : null}
    <section className="lf-learn-shelf" aria-labelledby={headingId}>
      <h2 id={headingId} data-copy-role="heading">{t.coursesTitle}</h2>
      <ul className="lf-learn-courses">
        {shelfOrder(courses, lead).map((course) => <li key={course.id}><CourseCard {...props} locale={locale} shelf={shelf} course={course} /></li>)}
      </ul>
    </section>
  </>;
}

/** The featured course's next step: the one call to action on the page (02 §9.1 breathing CTA). */
function NextStepHero({ locale, course, featured, links, onNavigate }: LearnHomeProps & { course: ShelfCourse }) {
  const t = learnCopy[locale].home;
  const headingId = useId();
  const title = localizedText(course.title, locale) || course.slug;
  const read = featured && featured.slug === course.slug && featured.state.status === 'ready' ? nextStep(featured.state.detail) : null;
  // Without the course's own read, the shelf's B.6 recommendation still opens the next lesson directly.
  const recommended = course.pathway?.recommendedLessonId ?? null;
  const step: NextStep | null = read ?? (recommended ? { kind: 'lesson', lessonId: recommended, title: {}, minutes: null } : null);
  const identity = courseIdentity(course.slug);
  const heading = step?.kind === 'lesson' ? localizedText(step.title, locale) || title
    : step?.kind === 'placement' ? t.placementTitle
      : step?.kind === 'done' ? t.doneTitle : title;
  const action = step?.kind === 'lesson'
    ? <ButtonLink variant="accent" size="lg" {...linkTo(links.lesson(step.lessonId), onNavigate, { courseSlug: course.slug })}>{isStarted(course) ? t.continue : t.start}</ButtonLink>
    : step?.kind === 'placement'
      ? <ButtonLink variant="accent" size="lg" {...linkTo(links.placement(course.slug), onNavigate)}>{t.findStart}</ButtonLink>
      : <ButtonLink variant="accent" size="lg" {...linkTo(links.course(course.slug), onNavigate)}>{step?.kind === 'done' ? t.review : t.openCourse}</ButtonLink>;
  return <section className="lf-learn-hero" aria-labelledby={headingId} data-step={step?.kind ?? 'course'}>
    <div className="lf-learn-hero-body">
      <Pill tone="inverse" role={heading === title ? 'body' : 'option'}>{heading === title ? t.nextStep : title}</Pill>
      <h2 id={headingId} data-copy-role="heading">{heading}</h2>
      <div className="lf-learn-progress">
        <ProgressBar label={fill(t.progress, { passed: course.progress.passed, total: course.progress.total })} labelHidden
          value={course.progress.passed} max={Math.max(course.progress.total, 1)} valueText={`${course.progress.passed}/${course.progress.total}`} />
        <span data-copy-role="data">{course.progress.passed}/{course.progress.total}</span>
      </div>
      <div className="lf-learn-hero-action">{action}</div>
    </div>
    {identity ? <span className="lf-learn-hero-art"><Art assetId={identity.iconAssetId} size="lg" /></span> : null}
  </section>;
}

function CourseCard({ locale, course, links, onNavigate }: LearnHomeProps & { course: ShelfCourse }) {
  const t = learnCopy[locale].home;
  const title = localizedText(course.title, locale) || course.slug;
  const identity = courseIdentity(course.slug);
  const closed = isClosedByAge(course);
  const count = plural(locale, course.lessonCount, t.lessonsOne, t.lessonsOther);
  const label = isDone(course) ? t.review : isStarted(course) ? t.continue : t.explore;
  const body = <>
    {identity ? <span className="lf-learn-course-art"><Art assetId={identity.iconAssetId} /></span> : null}
    {closed ? <p data-copy-role="body">{t.older}</p> : <>
      {isStarted(course)
        ? <div className="lf-learn-progress">
          <ProgressBar label={fill(t.progress, { passed: course.progress.passed, total: course.progress.total })} labelHidden
            value={course.progress.passed} max={Math.max(course.progress.total, 1)} valueText={`${course.progress.passed}/${course.progress.total}`} />
          <span data-copy-role="data">{course.progress.passed}/{course.progress.total}</span>
        </div>
        : <p data-copy-role="body">{count}</p>}
      {course.inProgress ? <Pill tone="inverse">{t.building}</Pill> : null}
      <div className="lf-learn-course-action">
        <ButtonLink variant={identity ? 'inverse' : 'secondary'} {...linkTo(links.course(course.slug), onNavigate)}>{label}</ButtonLink>
      </div>
    </>}
  </>;
  // A closed course keeps no identity hue: it is listed, never offered.
  return <div className="lf-learn-course" data-course={course.slug} data-closed={closed ? 'true' : undefined}>
    {identity && !closed
      ? <Card tone={identity.hue} heading={title} headingLevel={3} as="article">{body}</Card>
      : <Card heading={title} headingLevel={3} as="article">{body}</Card>}
  </div>;
}

/** The streak in the page header, as a reward chip: the run's length only (02 §4.2 reward gold is the streak). */
function StreakChip({ rhythm, locale }: { rhythm: RhythmState; locale: Locale }) {
  if (rhythm.status !== 'ready') return null;
  const { streak } = rhythm.rhythm;
  if (streak.status === 'none' || streak.status === 'resting') return null;
  const t = learnCopy[locale].home;
  return <RewardChip><span className="lf-learn-flame-chip"><Art assetId="lesson.result.streakFlame" /></span>
    {plural(locale, streak.current, `{n} ${t.daysOne}`, `{n} ${t.daysOther}`)}</RewardChip>;
}

/**
 * B.21: the habit streak with its rest days; the learner's own pace (B.24) is
 * one press away on the rhythm, which keeps the first view within the Copy
 * Budget (06 §3.1). Never a loss, never a guilt line.
 */
function StreakCard({ locale, rhythm, links, onNavigate }: LearnHomeProps) {
  const t = learnCopy[locale].home;
  const r = learningRhythmCopy[locale];
  const headingId = useId();
  const streak = rhythm.status === 'ready' ? rhythm.rhythm.streak : null;
  const status = !streak ? null
    : streak.status === 'resting' ? r.restingBody
      : streak.status === 'none' ? r.none
        : streak.status === 'practiced_today' ? r.today
          : streak.status === 'paused' && streak.pause ? r.paused(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
            .format(new Date(`${streak.pause.endsOn}T00:00:00Z`))) : null;
  return <section className="lf-learn-streak" aria-labelledby={headingId} data-status={streak?.status ?? rhythm.status}>
    <h2 id={headingId} data-copy-role="heading">{streak?.status === 'resting' ? r.resting : t.streakTitle}</h2>
    {streak && streak.status !== 'resting' && streak.status !== 'none'
      ? <p className="lf-learn-streak-count"><span className="lf-learn-flame"><Art assetId="lesson.result.streakFlame" /></span>
        <strong data-copy-role="data">{new Intl.NumberFormat(locale).format(streak.current)}</strong>
        <span data-copy-role="body">{plural(locale, streak.current, t.daysOne, t.daysOther)}</span></p>
      : null}
    {status ? <p data-copy-role="body">{status}</p> : null}
    {/* 02 §9.6 rule 2 and 4: the best streak is permanent and stays in view while the streak rests. */}
    {streak?.status === 'resting' ? <p className="lf-learn-streak-count"><span data-copy-role="body">{t.best}</span>
      <strong data-copy-role="data">{new Intl.NumberFormat(locale).format(streak.best)}</strong>
      <span data-copy-role="body">{plural(locale, streak.best, t.daysOne, t.daysOther)}</span></p> : null}
    {streak ? <p data-copy-role="body">{fill(t.restLeft, { n: new Intl.NumberFormat(locale).format(streak.restDaysLeft) })}</p> : null}
    <div className="lf-learn-card-action"><ButtonLink {...linkTo(links.rhythm, onNavigate)}>{t.rhythm}</ButtonLink></div>
  </section>;
}

/** B.9: the learner's own story, private to them. */
function StoryCard({ locale, links, onNavigate }: LearnHomeProps) {
  const t = learnCopy[locale].home;
  const headingId = useId();
  return <section className="lf-learn-story" aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{t.storyTitle}</h2>
    <div className="lf-learn-card-action"><ButtonLink {...linkTo(links.journal, onNavigate)}>{t.journal}</ButtonLink></div>
  </section>;
}
