import { useId, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Art, Button, ButtonLink, List, ListRow, Pill, ProgressBar, Skeleton, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './coursePath.css';
import './territory.css';
import { localizedText } from './coursePath';
import { fill, learnCopy, linkTo, plural, type LearnLinks, type LearnNavigate } from './learnCopy';
import { currentWorldId, reviewsDue, sceneAssetId, topicLesson, worldAccess, type Territory, type TerritoryState, type TerritoryTopic, type TerritoryWorld } from './territory';

/*
 * W2L.2 — L3, the course world at /learn/:courseSlug/territory, inside the
 * learner shell.
 *
 * The whole course at a glance with "you are here" (the legacy territory
 * map's orientation idea, kept): every chapter of the course is a world with
 * its own scene (B.8: the adventure's theme, `adventures.theme`, drawn as our
 * own scene art registered in the manifest, 07 §3; never stock art, never a
 * 3D stand-in: the Diorama belongs to the Mentor stage, 02 rule 10, 08), its
 * progress, and its topics grouped as Core groups them. Topic states are
 * Core's, from graded passes and the spaced-review layer (`review-due`); each
 * is said with a word, never by colour alone (02 rule 6).
 *
 * Layering (06 §4): the first view is the map itself, the worlds and where
 * the learner is; a world opens to its topics on request. A world not reached
 * yet shows its name and "Later" only (the legacy fog of war); under the B.6
 * pathway engine a chapter the age safeguard closes is counted, never listed
 * or offered (OD-16), and a younger chapter is an extra. When the entry
 * placement is owed, the map offers it and no topic opens a lesson (Core
 * refuses every lesson until it is taken).
 *
 * Presentation only: the host (routes/app/learn/TerritoryRoute.tsx, or the
 * preview) owns transport and navigation. No lives, no celebration.
 */

export interface TerritoryMapViewProps {
  state: TerritoryState;
  slug: string;
  locale: Locale;
  dark: boolean;
  /** The learner's Copy Budget band, from Core's register (the youngest while unknown). */
  ageBand?: AgeBand;
  /** Course titles by slug (from the shelf), to name missing prerequisites; the slug otherwise. */
  courseTitles?: Readonly<Record<string, string>>;
  links: LearnLinks;
  onNavigate: LearnNavigate;
  onRetry?: () => void;
  retrying?: boolean;
  fixture?: boolean;
}

type Copy = (typeof learnCopy)['en-US']['territory'];
type CourseCopy = (typeof learnCopy)['en-US']['course'];

export function TerritoryMapView(props: TerritoryMapViewProps) {
  const { state, slug, locale, dark, ageBand, links, onNavigate, fixture = false } = props;
  const t = learnCopy[locale].territory;
  const c = learnCopy[locale].course;
  const map = state.status === 'ready' ? state.map : null;
  // The top row and the <h1> are the same elements in every state: the shell focuses the heading on arrival, while the map still loads.
  return <div className={`lf-rebuild lf-learner-page lf-territory${map ? '' : ' lf-territory--state'}`} data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-surface="app" data-age-band={ageBand} data-screen={map ? (fixture ? 'territory-preview' : 'territory') : `territory-${state.status}`}
    aria-busy={state.status === 'loading'}>
    <div className="lf-territory-inner">
      <div className="lf-territory-top">
        <ButtonLink {...linkTo(links.course(slug), onNavigate)}>{t.course}</ButtonLink>
      </div>
      <h1 data-copy-role="heading">{map ? t.title : stateTitle(state, t, c)}</h1>
      {map ? <ReadyMap map={map} {...props} t={t} /> : <MapState {...props} t={t} c={c} />}
      {fixture ? <p className="lf-course-path-chip" data-copy-role="body">{t.preview}</p> : null}
    </div>
  </div>;
}

function stateTitle(state: TerritoryState, t: Copy, c: CourseCopy): string {
  switch (state.status) {
    case 'loading': case 'ready': return t.loading;
    case 'age-restricted': return c.ageTitle;
    case 'prerequisite': return c.prereqTitle;
    case 'not-found': return c.notFoundTitle;
    case 'offline': return c.offlineTitle;
    case 'refused': return c.refusedTitle;
    default: return t.errorTitle;
  }
}

function stateBody(state: TerritoryState, t: Copy, c: CourseCopy): string | null {
  switch (state.status) {
    case 'age-restricted': return c.ageBody;
    case 'prerequisite': return c.prereqBody;
    case 'not-found': return c.notFoundBody;
    case 'offline': return t.offlineBody;
    case 'refused': return c.refusedBody;
    case 'error': return c.errorBody;
    default: return null;
  }
}

function MapState({ state, t, c, courseTitles, links, onNavigate, onRetry, retrying }: TerritoryMapViewProps & { t: Copy; c: CourseCopy }) {
  const body = stateBody(state, t, c);
  const missing = state.status === 'prerequisite' ? state.missing : [];
  const retryable = (state.status === 'error' || state.status === 'offline') && onRetry;
  return <>
    {body ? <p data-copy-role="body">{body}</p> : null}
    {/* B.2: each course still to finish, by name, one press away (as on the course screen). */}
    {missing.length ? <div className="lf-course-path-missing"><List label={c.prereqTitle}>
      {missing.map((course) => <ListRow key={course} title={courseTitles?.[course] ?? course} titleRole="option" onPress={() => onNavigate(links.course(course))} />)}
    </List></div> : null}
    {state.status === 'loading' ? <Skeleton lines={4} /> : null}
    {retryable ? <div className="lf-actions"><Button variant="accent" pending={retrying} pendingLabel={c.retrying} onClick={onRetry}>{c.retry}</Button></div> : null}
    {state.status === 'not-found' || state.status === 'age-restricted' ? <div className="lf-actions"><ButtonLink {...linkTo(links.home, onNavigate)}>{c.allCourses}</ButtonLink></div> : null}
  </>;
}

function ReadyMap({ map, slug, locale, t, links, onNavigate }: TerritoryMapViewProps & { map: Territory; t: Copy }) {
  const { progress, placementRequired } = map.course;
  const due = reviewsDue(map);
  const here = currentWorldId(map);
  const listed = map.adventures.filter((world) => worldAccess(world) !== 'closed');
  const closed = map.adventures.length - listed.length;
  const placementId = useId();
  return <>
    <div className="lf-territory-summary">
      <div className="lf-course-path-progress">
        <ProgressBar label={fill(t.progress, { passed: progress.passed, total: progress.total })} labelHidden tone="mint"
          value={progress.pct} max={100} valueText={`${progress.passed}/${progress.total}`} />
        <span data-copy-role="data">{progress.passed}/{progress.total}</span>
      </div>
      {due > 0 && !placementRequired ? <Pill tone="sky">{plural(locale, due, t.reviewsOne, t.reviewsOther)}</Pill> : null}
    </div>
    {/* The entry placement first (B.15: finding a start, not a test); lessons stay closed by Core until it is taken. */}
    {placementRequired ? <section className="lf-course-path-hero" aria-labelledby={placementId} data-step="placement">
      <h2 id={placementId} data-copy-role="heading">{t.placementTitle}</h2>
      <div className="lf-course-path-hero-action">
        <ButtonLink variant="accent" size="lg" {...linkTo(links.placement(slug), onNavigate)}>{t.placementAction}</ButtonLink>
      </div>
    </section> : null}
    <ol className="lf-territory-worlds">
      {listed.map((world) => <World key={world.id} world={world} here={world.id === here} map={map} slug={slug} locale={locale} t={t} links={links} onNavigate={onNavigate} />)}
    </ol>
    {closed > 0 ? <p className="lf-course-path-note" data-copy-role="body">{plural(locale, closed, t.closedOne, t.closedOther)}</p> : null}
  </>;
}

function World({ world, here, map, slug, locale, t, links, onNavigate }: {
  world: TerritoryWorld; here: boolean; map: Territory; slug: string; locale: Locale; t: Copy; links: LearnLinks; onNavigate: LearnNavigate;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const access = worldAccess(world);
  const title = localizedText(world.title, locale) || world.slug;
  const scene = access === 'later' ? null : sceneAssetId(world.theme);
  const tag = here ? { text: t.here, tone: 'pathway' } : world.state === 'completed' ? { text: t.done, tone: 'known' }
    : access === 'later' ? { text: t.later, tone: 'closed' } : access === 'extra' ? { text: t.extra, tone: 'optional' } : null;
  const explorable = access !== 'later' && world.sagas.some((saga) => saga.topics.length > 0);
  return <li className={`lf-territory-world lf-territory-world--${access}${here ? ' lf-territory-world--here' : ''}`} data-world={world.slug} data-scene={scene ? world.theme : undefined}>
    <article aria-labelledby={`${id}-title`}>
      {/* The chapter's own scene (B.8), decorative: its name is the heading beside it (07 §8). */}
      {scene ? <div className="lf-territory-scene"><Art assetId={scene} /></div> : null}
      <div className="lf-territory-world-head">
        <h2 id={`${id}-title`} data-copy-role="heading">{title}</h2>
        <span className="lf-territory-count" data-copy-role="data">{world.progress.passed}/{world.progress.total}</span>
        {tag ? <span className={`lf-course-path-tag lf-course-path-tag--${tag.tone}`} data-copy-role="body">{tag.text}</span> : null}
      </div>
      {explorable ? <div className="lf-territory-toggle">
        <Button aria-expanded={open} aria-controls={`${id}-topics`} aria-describedby={`${id}-title`} onClick={() => setOpen(!open)}>{t.topics}</Button>
      </div> : null}
      {explorable && open ? <div id={`${id}-topics`} className="lf-territory-topics">
        {world.sagas.filter((saga) => saga.topics.length > 0).map((saga) => <section key={saga.id} className="lf-territory-saga" aria-labelledby={`${id}-${saga.id}`}>
          <h3 id={`${id}-${saga.id}`} data-copy-role="heading">{localizedText(saga.title, locale) || saga.slug}</h3>
          <List label={localizedText(saga.title, locale) || saga.slug}>
            {saga.topics.map((topic) => <TopicRow key={topic.id} topic={topic} map={map} slug={slug} locale={locale} t={t} links={links} onNavigate={onNavigate} />)}
          </List>
        </section>)}
      </div> : null}
    </article>
  </li>;
}

function TopicRow({ topic, map, slug, locale, t, links, onNavigate }: {
  topic: TerritoryTopic; map: Territory; slug: string; locale: Locale; t: Copy; links: LearnLinks; onNavigate: LearnNavigate;
}) {
  const lessonId = topicLesson(topic, map.course.placementRequired);
  const next = map.nextLessonId !== null && topic.lessons.some((lesson) => lesson.id === map.nextLessonId);
  const passed = topic.lessons.filter((lesson) => lesson.state === 'passed').length;
  // The topic's state in a word (never colour alone): next, review due, done, started; a closed topic says when it opens.
  const label = !map.course.placementRequired && next ? { text: t.topic.next, tone: 'pathway' }
    : topic.state === 'review-due' ? { text: t.topic['review-due'], tone: 'review-due' }
      : topic.state === 'completed' ? { text: t.topic.completed, tone: 'known' }
        : lessonId === null && !map.course.placementRequired ? { text: t.topic.locked, tone: 'closed' }
          : topic.state === 'in-progress' ? { text: t.topic['in-progress'], tone: 'pathway' } : null;
  return <ListRow title={localizedText(topic.title, locale) || topic.slug} titleRole="option"
    leading={topic.state === 'completed' ? <span className="lf-course-path-mark"><StatusMark correct /></span> : undefined}
    supporting={label ? <span className={`lf-course-path-tag lf-course-path-tag--${label.tone}`}>{label.text}</span> : undefined}
    trailing={topic.lessons.length ? <span data-copy-role="data">{passed}/{topic.lessons.length}</span> : undefined}
    onPress={lessonId ? () => onNavigate(links.lesson(lessonId), { courseSlug: slug }) : undefined} />;
}
