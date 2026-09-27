import { useId, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button, ButtonLink, EmptyState, InlineNotice, List, ListRow, ProgressBar, Skeleton, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './coursePath.css';
import { localizedText, type CoursePath, type CoursePathItem } from './coursePath';
import { CourseBadge } from './CourseBadge';
import { courseProgress, courseTitle, nextStep, type CourseAnswer, type CourseDetail, type CourseState, type CourseTree, type TreeAdventure } from './course';
import { fill, learnCopy, linkTo, plural, type LearnLinks, type LearnNavigate } from './learnCopy';

/*
 * W2L.1 — L2, one course screen at /learn/:courseSlug, inside the learner
 * shell. It reconciles the legacy course page (the linear engine's tree) and
 * the S05.3b course path (the B.6 pathway engine's frontier) into one rebuilt
 * screen; `/learn/:courseSlug/path` now redirects here.
 *
 * The first view carries the course, its progress and the one next step
 * (Bible 06 layering): the entry placement when Core says one is owed (B.15:
 * framed as finding a start, never as a test), the recommended lesson, or a
 * plainly stated finished path (not celebrated here: D7's milestones belong
 * to the lesson and badge moments). Under the pathway engine the other open
 * lessons follow as real choices (B.24), then the chapters with their access
 * (age-closed chapters are counted, never offered or listed, OD-16) and the
 * skills the path teaches. Under the linear engine the chapters open to their
 * lessons in Core's order, with each lesson's state as Core computed it.
 *
 * Every refusal Core can give has its own state with a way back: the age
 * safeguard, a prerequisite course not finished yet (B.2, rule P7 under the
 * pathway engine; the missing courses are offered by name), an unknown
 * course, no connection, not allowed, and a retryable failure.
 *
 * Presentation only: the host (routes/app/learn/CourseRoute.tsx, or the
 * preview) owns transport and navigation. Nothing here decides a lock and no
 * age or birth date ever reaches it. No lives, no celebration.
 */

export interface CourseViewProps {
  state: CourseState;
  slug: string;
  locale: Locale;
  dark: boolean;
  /** The learner's Copy Budget band, from Core's register (the youngest while unknown). */
  ageBand?: AgeBand;
  /** Course titles by slug (from the shelf), to name missing prerequisites; the slug otherwise. */
  courseTitles?: Readonly<Record<string, string>>;
  /** The shelf says this live course still misses narration or pictures (0048). */
  inProgress?: boolean;
  links: LearnLinks;
  onNavigate: LearnNavigate;
  onRetry?: () => void;
  retrying?: boolean;
  fixture?: boolean;
  /** OD-25: the learner confirms opening a chapter one stage early; the host refreshes the course after it. */
  onOpenEarly?: (chapterId: string) => Promise<CourseAnswer>;
  /** OD-25: the learner accepts counting a topic as done on what they showed with the Mentor. */
  onAcceptMastery?: (topicId: string) => Promise<CourseAnswer>;
}

type Copy = (typeof learnCopy)['en-US']['course'];

/*
 * Density follows the learner's stage by composition only (D8): a child sees
 * two further choices before "Show more", an older learner four.
 */
const firstItems = (stage: CoursePath['pathway']['learnerStage']) => (stage === 'child' ? 2 : 4);
const FIRST_SKILLS = 6;

export function CourseView(props: CourseViewProps) {
  const { state, slug, locale, dark, ageBand, links, onNavigate, fixture = false } = props;
  const t = learnCopy[locale].course;
  const ready = state.status === 'ready' ? state.detail : null;
  /*
   * The top row and the <h1> are the same elements in every state: the shell
   * moves focus to the page's <h1> on arrival (02 rule 13), which happens
   * while the course is still loading, and the heading that takes focus must
   * survive the answer instead of being replaced under it.
   */
  return <div className={`lf-rebuild lf-learner-page lf-course-path${ready ? '' : ' lf-course-path--state'}`} data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-surface="app" data-age-band={ageBand} data-engine={ready?.engine}
    data-screen={ready ? (fixture ? 'course-path-preview' : 'course-path') : `course-path-${state.status}`} aria-busy={state.status === 'loading'}>
    <div className={`lf-course-path-inner${ready ? '' : ' lf-course-path-state'}`}>
      <div className="lf-course-path-top">
        <ButtonLink {...linkTo(links.home, onNavigate)}>{t.allCourses}</ButtonLink>
        {ready ? <ButtonLink {...linkTo(links.territory(slug), onNavigate)}>{t.map}</ButtonLink> : null}
      </div>
      <h1 data-copy-role="heading">{ready ? localizedText(courseTitle(ready), locale) || slug : stateCopy(state, t).title}</h1>
      {ready ? <ReadyCourse {...props} detail={ready} t={t} /> : <RefusalState {...props} t={t} />}
    </div>
  </div>;
}

function stateCopy(state: CourseState, t: Copy): { title: string; body: string | null } {
  switch (state.status) {
    case 'loading': case 'ready': return { title: t.loading, body: null };
    case 'age-restricted': return { title: t.ageTitle, body: t.ageBody };
    case 'prerequisite': return { title: t.prereqTitle, body: t.prereqBody };
    case 'not-found': return { title: t.notFoundTitle, body: t.notFoundBody };
    case 'offline': return { title: t.offlineTitle, body: t.offlineBody };
    case 'refused': return { title: t.refusedTitle, body: t.refusedBody };
    default: return { title: t.errorTitle, body: t.errorBody };
  }
}

function RefusalState({ state, t, courseTitles, links, onNavigate, onRetry, retrying }: CourseViewProps & { t: Copy }) {
  const s = stateCopy(state, t);
  const missing = state.status === 'prerequisite' ? state.missing : [];
  const retryable = (state.status === 'error' || state.status === 'offline') && onRetry;
  return <>
    {s.body ? <p data-copy-role="body">{s.body}</p> : null}
    {/* B.2: each course still to finish, by name, one press away. */}
    {missing.length ? <div className="lf-course-path-missing"><List label={t.prereqTitle}>
      {missing.map((slug) => <ListRow key={slug} title={courseTitles?.[slug] ?? slug} titleRole="option" onPress={() => onNavigate(links.course(slug))} />)}
    </List></div> : null}
    {/* The heading already says it is loading (aria-busy on the page); the placeholder shimmers only as busy motion, still under reduced motion (OD-28 V-04). */}
    {state.status === 'loading' ? <Skeleton lines={4} /> : null}
    {retryable ? <div className="lf-actions"><Button variant="accent" pending={retrying} pendingLabel={t.retrying} onClick={onRetry}>{t.retry}</Button></div> : null}
  </>;
}

function ReadyCourse({ detail, slug, locale, t, inProgress, links, onNavigate, fixture, onOpenEarly, onAcceptMastery }: CourseViewProps & { detail: CourseDetail; t: Copy }) {
  const progress = courseProgress(detail);
  const title = localizedText(courseTitle(detail), locale) || slug;
  const step = nextStep(detail);
  const empty = detail.engine === 'pathway' ? detail.path.chapters.length === 0 : detail.tree.adventures.length === 0;
  const heroId = useId();
  const text = (value: Record<string, unknown>) => localizedText(value, locale);
  // The course badge: the pathway's stage credential, or under the linear engine the finished course itself (Core's badge rule).
  const earned = detail.engine === 'pathway'
    ? detail.path.pathway.badge.stage !== null && detail.path.pathway.badge.earnedStages.includes(detail.path.pathway.badge.stage)
    : progress.total > 0 && progress.passed >= progress.total;
  return <>
    <div className="lf-course-path-progress">
      <ProgressBar label={fill(t.progress, { passed: progress.passed, total: progress.total })} labelHidden tone="mint"
        value={progress.pct} max={100} valueText={`${progress.passed}/${progress.total}`} />
      <span data-copy-role="data">{progress.passed}/{progress.total}</span>
    </div>
    {inProgress ? <InlineNotice tone="info">{t.building}</InlineNotice> : null}
    {empty ? <EmptyState heading={t.emptyTitle} body={t.emptyBody} artAssetId="empty.fresh-start.art" /> : <>
      {step.kind === 'placement' ? <section className="lf-course-path-hero" aria-labelledby={heroId} data-step="placement">
        <h2 id={heroId} data-copy-role="heading">{t.placementTitle}</h2>
        <p data-copy-role="body">{t.placementBody}</p>
        <div className="lf-course-path-hero-action">
          <ButtonLink variant="accent" size="lg" {...linkTo(links.placement(slug), onNavigate)}>{t.placementAction}</ButtonLink>
        </div>
      </section> : step.kind === 'done' ? <section className="lf-course-path-done" aria-labelledby={heroId} data-step="done">
        <h2 id={heroId} data-copy-role="heading">{t.completeTitle}</h2>
        <p data-copy-role="body">{t.completeBody}</p>
        {earned ? <p className="lf-course-path-earned" data-copy-role="body"><CourseBadge slug={slug} />{t.badgeEarned}</p> : null}
      </section> : step.kind === 'lesson' ? <section className="lf-course-path-hero" aria-labelledby={heroId} data-step="lesson">
        <h2 id={heroId} data-copy-role="heading">{text(step.title) || title}</h2>
        <div className="lf-course-path-hero-action">
          <ButtonLink variant="accent" size="lg" {...linkTo(links.lesson(step.lessonId), onNavigate, { courseSlug: slug })}>{t.start}</ButtonLink>
          {step.minutes !== null ? <span data-copy-role="data">{fill(t.minutes, { n: step.minutes })}</span> : null}
        </div>
      </section> : null}
      {detail.engine === 'pathway'
        ? <PathwaySections path={detail.path} slug={slug} locale={locale} t={t} links={links} onNavigate={onNavigate} onOpenEarly={onOpenEarly} onAcceptMastery={onAcceptMastery} />
        : <LinearChapters tree={detail.tree} slug={slug} locale={locale} t={t} links={links} onNavigate={onNavigate} />}
    </>}
    {fixture ? <p className="lf-course-path-chip" data-copy-role="body">{t.preview}</p> : null}
  </>;
}

function PathwaySections({ path, slug, locale, t, links, onNavigate, onOpenEarly, onAcceptMastery }: { path: CoursePath; slug: string; locale: Locale; t: Copy; links: LearnLinks; onNavigate: LearnNavigate;
  onOpenEarly?: (chapterId: string) => Promise<CourseAnswer>; onAcceptMastery?: (topicId: string) => Promise<CourseAnswer> }) {
  const [allItems, setAllItems] = useState(false);
  const [allSkills, setAllSkills] = useState(false);
  const ids = useId();
  const text = (value: Record<string, unknown>) => localizedText(value, locale);
  const { pathway } = path;
  const recommended = path.items.find((item) => item.recommended) ?? null;
  const others = path.items.filter((item) => item !== recommended);
  const FIRST_ITEMS = firstItems(pathway.learnerStage);
  const visibleItems = allItems ? others : others.slice(0, FIRST_ITEMS);
  const visibleSkills = allSkills ? path.skills : path.skills.slice(0, FIRST_SKILLS);
  const openChapters = path.chapters.filter((chapter): chapter is typeof chapter & { access: 'pathway' | 'optional' } => chapter.access !== 'closed');
  const closedCount = path.chapters.length - openChapters.length;
  // A plain next step needs no tag; only a different reason is named (review, extra help, already known, extra chapter).
  const reasonLabel = (item: CoursePathItem) => item.access === 'optional' && item.reason === 'next' ? t.extra : item.reason === 'next' ? null : t.reasons[item.reason];
  const open = (lessonId: string) => onNavigate(links.lesson(lessonId), { courseSlug: slug });
  const eligibleEarly = path.earlyAccess.filter((entry) => entry.state === 'eligible');
  return <>
    {pathway.badge.contentGap && pathway.basis !== 'unavailable' ? <p className="lf-course-path-note" data-copy-role="body">{t.contentGap}</p> : null}
    {/* OD-25: each is a question the learner answers; nothing opens or counts until they say yes. */}
    {onAcceptMastery ? path.masteryOffers.map((offer) => <OfferCard key={`mastery:${offer.topicId}`} kind="mastery" t={t}
      question={fill(t.masteryAsk, { skill: text(offer.skills[0]!.title) || offer.skills[0]!.key })} detail={text(offer.topicTitle)}
      onYes={() => onAcceptMastery(offer.topicId)} />) : null}
    {onOpenEarly ? eligibleEarly.map((entry) => <OfferCard key={`early:${entry.chapterId}`} kind="early" t={t}
      question={fill(t.earlyAsk, { chapter: text(entry.chapterTitle) || t.chaptersTitle })} detail={null}
      onYes={() => onOpenEarly(entry.chapterId)} />) : null}
    {!pathway.placementRequired && others.length > 0 ? <section className="lf-course-path-section" aria-labelledby={`${ids}-more`}>
      <h2 id={`${ids}-more`} data-copy-role="heading">{t.moreTitle}</h2>
      <div className="lf-course-path-items"><List label={t.moreTitle}>
        {visibleItems.map((item) => <ListRow key={item.lessonId} title={text(item.topicTitle)} titleRole="option" onPress={() => open(item.lessonId)}
          supporting={reasonLabel(item) ? <span className={`lf-course-path-tag lf-course-path-tag--${item.access === 'optional' && item.reason === 'next' ? 'optional' : item.reason}`}>{reasonLabel(item)}</span> : undefined} />)}
      </List></div>
      {others.length > FIRST_ITEMS ? <Button aria-expanded={allItems} onClick={() => setAllItems(!allItems)}>{allItems ? t.showLess : t.showMore}</Button> : null}
    </section> : null}

    <section className="lf-course-path-section" aria-labelledby={`${ids}-chapters`}>
      <h2 id={`${ids}-chapters`} data-copy-role="heading">{t.chaptersTitle}</h2>
      <ol className="lf-course-path-chapters">
        {openChapters.map((chapter) => <li key={chapter.id} className={`lf-course-path-chapter lf-course-path-chapter--${chapter.access}`}>
          <span className="lf-course-path-chapter-title" data-copy-role="option">{text(chapter.title)}</span>
          <span className={`lf-course-path-tag lf-course-path-tag--${chapter.access}`} data-copy-role="body">{t.access[chapter.access]}</span>
          <span className="lf-course-path-chapter-count" data-copy-role="data">{chapter.progress.passed}/{chapter.progress.total}</span>
        </li>)}
      </ol>
      {/* Chapters the age safeguard closes are counted, never offered and never listed as lessons (OD-16). */}
      {closedCount > 0 ? <p className="lf-course-path-note" data-copy-role="body">{plural(locale, closedCount, t.closedOne, t.closedOther)}</p> : null}
      {!pathway.placementRequired && path.blocked.length > 0 ? <p className="lf-course-path-note" data-copy-role="body">{fill(t.waiting, { n: path.blocked.length })}</p> : null}
    </section>

    {path.skills.length > 0 ? <section className="lf-course-path-section" aria-labelledby={`${ids}-skills`}>
      <h2 id={`${ids}-skills`} data-copy-role="heading">{t.skillsTitle}</h2>
      <ul className="lf-course-path-skills">
        {visibleSkills.map((skill) => <li key={skill.key} className={`lf-course-path-skill lf-course-path-skill--${skill.shown}`}>
          <span data-copy-role="option">{text(skill.title) || skill.key}</span>
          <span className="lf-course-path-skill-state" data-copy-role="body">{skill.shown !== 'none' ? <StatusMark correct /> : null}{t.shown[skill.shown]}</span>
        </li>)}
      </ul>
      {path.skills.length > FIRST_SKILLS ? <Button aria-expanded={allSkills} onClick={() => setAllSkills(!allSkills)}>{allSkills ? t.showLess : t.showMore}</Button> : null}
    </section> : null}
  </>;
}

/**
 * OD-25: one offer the learner answers. "Yes" is the confirmation Core records
 * (the host refreshes the course after it); "Not now" only hides the question
 * here. A refused answer means the offer no longer stands: the refresh drops it.
 */
function OfferCard({ kind, t, question, detail, onYes }: { kind: 'early' | 'mastery'; t: Copy; question: string; detail: string | null; onYes: () => Promise<CourseAnswer> }) {
  const headingId = useId();
  const [state, setState] = useState<'asking' | 'busy' | 'done' | 'failed' | 'hidden'>('asking');
  if (state === 'hidden') return null;
  async function yes() {
    setState('busy');
    const answer = await onYes();
    setState(answer === 'done' ? 'done' : answer === 'refused' ? 'hidden' : 'failed');
  }
  return <section className={`lf-course-path-offer lf-course-path-offer--${kind}`} aria-labelledby={headingId} data-offer={kind}>
    <h2 id={headingId} data-copy-role="heading">{kind === 'early' ? t.earlyTitle : t.masteryTitle}</h2>
    {detail ? <span className="lf-course-path-offer-topic" data-copy-role="option">{detail}</span> : null}
    <p data-copy-role="body">{question}</p>
    {state === 'done' ? <InlineNotice tone="success" live>{kind === 'early' ? t.earlyDone : t.masteryDone}</InlineNotice> : <>
      {state === 'failed' ? <InlineNotice tone="error" live>{t.saveFailed}</InlineNotice> : null}
      <div className="lf-actions">
        <Button variant="accent" pending={state === 'busy'} pendingLabel={kind === 'early' ? t.earlyYes : t.masteryYes} onClick={() => void yes()}>
          {kind === 'early' ? t.earlyYes : t.masteryYes}</Button>
        <Button disabled={state === 'busy'} onClick={() => setState('hidden')}>{t.notNow}</Button>
      </div>
    </>}
  </section>;
}

function LinearChapters({ tree, slug, locale, t, links, onNavigate }: { tree: CourseTree; slug: string; locale: Locale; t: Copy; links: LearnLinks; onNavigate: LearnNavigate }) {
  // Every chapter starts closed: the next lesson is the hero's, and the first view stays within the Copy Budget (06 §3.1).
  const [open, setOpen] = useState<string | null>(null);
  const ids = useId();
  return <section className="lf-course-path-section" aria-labelledby={`${ids}-chapters`}>
    <h2 id={`${ids}-chapters`} data-copy-role="heading">{t.chaptersTitle}</h2>
    <ol className="lf-course-path-chapters">
      {tree.adventures.map((adventure) => <LinearChapter key={adventure.id} adventure={adventure} slug={slug} locale={locale} t={t} links={links} onNavigate={onNavigate}
        nextLessonId={tree.nextLessonId} expandable={!tree.course.placementRequired && adventure.state !== 'locked'} open={open === adventure.id}
        onToggle={() => setOpen(open === adventure.id ? null : adventure.id)} />)}
    </ol>
  </section>;
}

function LinearChapter({ adventure, slug, locale, t, links, onNavigate, nextLessonId, expandable, open, onToggle }: {
  adventure: TreeAdventure; slug: string; locale: Locale; t: Copy; links: LearnLinks; onNavigate: LearnNavigate;
  nextLessonId: string | null; expandable: boolean; open: boolean; onToggle: () => void;
}) {
  const id = useId();
  const panelId = `${id}-lessons`;
  const title = localizedText(adventure.title, locale) || adventure.slug;
  const lessons = adventure.sagas.flatMap((saga) => saga.topics.flatMap((topic) => topic.lessons));
  const tag = adventure.state === 'completed' ? 'known' : 'closed';
  return <li className={`lf-course-path-chapter lf-course-path-chapter--linear${adventure.state === 'locked' ? ' lf-course-path-chapter--closed' : ''}`}>
    <span id={`${id}-title`} className="lf-course-path-chapter-title" data-copy-role="option">{title}</span>
    {/* An open chapter needs no tag; only done and later are said. */}
    {adventure.state === 'available' ? null : <span className={`lf-course-path-tag lf-course-path-tag--${tag}`} data-copy-role="body">{t.state[adventure.state]}</span>}
    <span className="lf-course-path-chapter-count" data-copy-role="data">{adventure.progress.passed}/{adventure.progress.total}</span>
    {expandable ? <div className="lf-course-path-chapter-toggle">
      <Button aria-expanded={open} aria-controls={panelId} aria-describedby={`${id}-title`} onClick={onToggle}>{t.lessons}</Button>
    </div> : null}
    {expandable && open ? <div id={panelId} className="lf-course-path-lessons"><List label={title}>
      {lessons.map((lesson) => {
        const lessonTitle = localizedText(lesson.title, locale) || lesson.slug;
        const current = lesson.id === nextLessonId || lesson.state === 'current';
        const best = lesson.state === 'passed' && !lesson.placementCredited && (lesson.bestScore ?? 0) > 0 ? lesson.bestScore! : null;
        const supporting = lesson.state === 'passed' ? t.lesson.passed : current ? t.lesson.current : lesson.state === 'locked' ? t.lesson.locked : undefined;
        return <ListRow key={lesson.id} title={lessonTitle} titleRole="option"
          leading={lesson.state === 'passed' ? <span className="lf-course-path-mark"><StatusMark correct /></span> : undefined}
          supporting={supporting ? <span className={`lf-course-path-tag lf-course-path-tag--${lesson.state === 'passed' ? 'known' : current ? 'pathway' : 'closed'}`}>{supporting}</span> : undefined}
          trailing={best !== null ? <span data-copy-role="data">{fill(t.best, { n: best })}</span> : undefined}
          onPress={lesson.state === 'locked' ? undefined : () => onNavigate(links.lesson(lesson.id), { courseSlug: slug })} />;
      })}
    </List></div> : null}
  </li>;
}
