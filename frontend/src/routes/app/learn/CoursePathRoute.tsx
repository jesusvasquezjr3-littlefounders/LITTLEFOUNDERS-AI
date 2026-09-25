import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { fetchCoursePath, type CoursePathState } from '@/rebuild/learning/coursePath';
import { CoursePathView } from '@/rebuild/learning/CoursePathView';
import { coursePath, lessonPath, placementPath } from './paths';

/*
 * /learn/:courseSlug/path — the thin transport wrapper around the rebuilt
 * course path (B.6, S05.3b). Core computes the pathway; this route only
 * fetches it with the learner's own session and navigates. The rebuilt
 * surface imports nothing from the legacy app (Bible 02 rule 23); its final
 * composition on the finished design system is wave-2 work. While Core runs
 * the linear engine (COURSE_PATHWAY_ENGINE=linear, the default until the owner
 * accepts the B.6 policy) the path answers PATHWAY_ENGINE_DISABLED and this
 * route sends the learner to the existing course page instead.
 */
export function CoursePathRoute() {
  const { courseSlug = '' } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  const [state, setState] = useState<CoursePathState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const locale: Locale = i18n.language === 'es-MX' || i18n.language === 'pt-BR' ? i18n.language : 'en-US';

  const load = useCallback(async () => {
    const token = await getToken();
    return fetchCoursePath(courseSlug, (path) => api<unknown>(path, { token }));
  }, [courseSlug, getToken]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void load().then((next) => {
      if (!active) return;
      if (next.status === 'disabled') navigate(coursePath(courseSlug), { replace: true });
      else setState(next);
    });
    return () => { active = false; };
  }, [load, revision, courseSlug, navigate]);

  return <CoursePathView state={state} locale={locale} dark={isDark}
    onOpenLesson={(lessonId) => navigate(lessonPath(lessonId), { state: { courseSlug } })}
    onPlacement={() => navigate(placementPath(courseSlug))}
    onBack={() => navigate('/learn')}
    onRetry={() => setRevision((n) => n + 1)} />;
}

export default CoursePathRoute;
