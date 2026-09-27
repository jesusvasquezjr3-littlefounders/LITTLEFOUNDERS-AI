import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useMentorCharacter } from '@/app-shell/useMentorCharacter';
import { learnCopy } from '@/rebuild/learning/learnCopy';
import { usePlacementFlow } from '@/rebuild/learning/placementFlow';
import { PlacementFlowView } from '@/rebuild/learning/PlacementFlowView';
import { clearCoursesCache } from './coursesCache';
import { bandOf, useLearnerRegister, useLearnHost } from './learnHost';
import { coursePath, lessonPath } from './paths';

/*
 * /learn/:courseSlug/placement — the host of the rebuilt placement flow
 * (W2L.2, L4): a full-screen layer of its own (no app navigation, like the
 * lesson player), on the shared single-state screen in the sky hue. It owns
 * Core's transport, the learner's register (the Copy Budget band), the chosen
 * Mentor and navigation; the flow and the screens are rebuilt code with no
 * legacy import (Bible 02 rule 23).
 *
 * Once Core has stored the start, the learner lands on the lesson it chose
 * (with the course to return to) or, when there is none, on the course. The
 * shelf cache is dropped: placement credits changed the progress it shows.
 */
export function PlacementRoute() {
  const { courseSlug = '' } = useParams();
  // One flow per course: its answers never carry over to another course's questions.
  return <CoursePlacement key={courseSlug} courseSlug={courseSlug} />;
}

function CoursePlacement({ courseSlug }: { courseSlug: string }) {
  const navigate = useNavigate();
  const { locale, dark, transport, links, onNavigate } = useLearnHost();
  const [register] = useLearnerRegister(transport);
  const mentor = useMentorCharacter(true);
  const onPlaced = useCallback((startLessonId: string | null) => {
    clearCoursesCache();
    if (startLessonId) navigate(lessonPath(startLessonId), { replace: true, state: { courseSlug } });
    else navigate(coursePath(courseSlug), { replace: true });
  }, [navigate, courseSlug]);
  const flow = usePlacementFlow({ slug: courseSlug, transport, neutralReflection: learnCopy[locale].placement.neutral, onPlaced });
  return <StandaloneState pageTitle={learnCopy[locale].course.placementTitle} hue="sky">
    <PlacementFlowView flow={flow} slug={courseSlug} locale={locale} dark={dark} ageBand={bandOf(register)} mentor={mentor}
      links={links} onNavigate={onNavigate} />
  </StandaloneState>;
}

export default PlacementRoute;
