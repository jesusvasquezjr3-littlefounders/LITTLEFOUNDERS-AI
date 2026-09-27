import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { trackInsight } from '@/lib/insights';
import { acceptMasteryCredit, declineMasteryCredit, fetchCourse, openChapterEarly, type CourseState } from '@/rebuild/learning/course';
import { localizedText } from '@/rebuild/learning/coursePath';
import { CourseView } from '@/rebuild/learning/CourseView';
import { fetchShelf, type ShelfCourse } from '@/rebuild/learning/learnHome';
import { readCoursesCache } from './coursesCache';
import { bandOf, useLearnerRegister, useLearnHost } from './learnHost';
import { coursePath } from './paths';

/*
 * /learn/:courseSlug — the host of the one rebuilt course screen (W2L.1, L2),
 * inside the learner shell. It reads the course the way Core serves it now
 * (the B.6 path when that engine is on, the tree otherwise; see
 * rebuild/learning/course.ts) and owns navigation. The placement quiz is
 * offered, not forced: the page shows "Find your start" where the legacy page
 * redirected into the quiz (every lesson endpoint still refuses with
 * PLACEMENT_REQUIRED until it is taken, backend/src/routes/learn.ts).
 */
export function CourseRoute() {
  const { courseSlug = '' } = useParams();
  const { session } = useAuth();
  const { locale, dark, transport, links, onNavigate } = useLearnHost();
  const [register] = useLearnerRegister(transport);
  // Keyed by the course it was read for: another course's answer is never shown under this address.
  const [read, setRead] = useState<{ slug: string; state: CourseState } | null>(null);
  const state: CourseState = read && read.slug === courseSlug ? read.state : { status: 'loading' };
  const [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [shelf, setShelf] = useState<ShelfCourse[] | null>(() => readCoursesCache(session?.user.id ?? null));

  useEffect(() => {
    let active = true;
    void fetchCourse(courseSlug, transport).then((next) => {
      if (!active) return;
      setRetrying(false);
      setRead({ slug: courseSlug, state: next });
    });
    return () => { active = false; };
  }, [courseSlug, transport, revision]);

  // B.2: the missing prerequisites are named by their titles, from the shelf the learner already has (or one read).
  const needsTitles = state.status === 'prerequisite' && !shelf;
  useEffect(() => {
    if (!needsTitles) return undefined;
    let active = true;
    void fetchShelf(transport).then((next) => { if (active && next.status === 'ready') setShelf(next.shelf.courses); });
    return () => { active = false; };
  }, [needsTitles, transport]);

  const fromShelf = shelf?.find((course) => course.slug === courseSlug) ?? null;
  const courseId = state.status === 'ready' && state.detail.engine === 'linear' ? state.detail.tree.course.id : fromShelf?.id ?? null;
  useEffect(() => {
    // Course identity makes funnel and content-friction analysis actionable. The beacon is consent-gated.
    if (courseId) trackInsight('course_open', { routeClass: 'learn', courseId });
  }, [courseId]);

  const titles = useMemo(() => Object.fromEntries((shelf ?? []).map((course) => [course.slug, localizedText(course.title, locale) || course.slug])), [shelf, locale]);
  const inProgress = (state.status === 'ready' && state.detail.engine === 'linear' ? state.detail.tree.course.inProgress : fromShelf?.inProgress) ?? false;
  return <CourseView key={courseSlug} state={state} slug={courseSlug} locale={locale} dark={dark} ageBand={bandOf(register)}
    courseTitles={titles} inProgress={inProgress} links={links} onNavigate={onNavigate} retrying={retrying}
    onRetry={() => { setRetrying(true); setRevision((n) => n + 1); }}
    // OD-25: each confirmation is re-derived by Core; the course is read again after it, so what opened shows at once.
    onOpenEarly={async (chapterId) => { const answer = await openChapterEarly(transport, courseSlug, chapterId); if (answer === 'done' || answer === 'refused') setRevision((n) => n + 1); return answer; }}
    onAcceptMastery={async (topicId) => { const answer = await acceptMasteryCredit(transport, courseSlug, topicId); if (answer === 'done' || answer === 'refused') setRevision((n) => n + 1); return answer; }}
    onDeclineMastery={async (topicId) => { const answer = await declineMasteryCredit(transport, courseSlug, topicId); if (answer === 'done' || answer === 'refused') setRevision((n) => n + 1); return answer; }} />;
}

/** B.6's course path moved into the one course screen: the old address keeps working. */
export function CoursePathRedirect() {
  const { courseSlug = '' } = useParams();
  return <Navigate to={coursePath(courseSlug)} replace />;
}

export default CourseRoute;
