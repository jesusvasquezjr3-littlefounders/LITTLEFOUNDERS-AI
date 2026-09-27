import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { localizedText } from '@/rebuild/learning/coursePath';
import { fetchShelf, type ShelfCourse } from '@/rebuild/learning/learnHome';
import { fetchTerritory, type TerritoryState } from '@/rebuild/learning/territory';
import { TerritoryMapView } from '@/rebuild/learning/TerritoryMapView';
import { readCoursesCache } from './coursesCache';
import { bandOf, useLearnerRegister, useLearnHost } from './learnHost';

/*
 * /learn/:courseSlug/territory — the host of the rebuilt course world (W2L.2,
 * L3), inside the learner shell. It reads the course tree Core serves under
 * either course engine (rebuild/learning/territory.ts) and owns navigation;
 * the map itself is presentation only.
 */
export function TerritoryRoute() {
  const { courseSlug = '' } = useParams();
  const { session } = useAuth();
  const { locale, dark, transport, links, onNavigate } = useLearnHost();
  const [register] = useLearnerRegister(transport);
  // Keyed by the course it was read for: another course's map is never shown under this address.
  const [read, setRead] = useState<{ slug: string; state: TerritoryState } | null>(null);
  const state: TerritoryState = read && read.slug === courseSlug ? read.state : { status: 'loading' };
  const [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [shelf, setShelf] = useState<ShelfCourse[] | null>(() => readCoursesCache(session?.user.id ?? null));

  useEffect(() => {
    let active = true;
    void fetchTerritory(courseSlug, transport).then((next) => {
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

  const titles = useMemo(() => Object.fromEntries((shelf ?? []).map((course) => [course.slug, localizedText(course.title, locale) || course.slug])), [shelf, locale]);
  return <TerritoryMapView key={courseSlug} state={state} slug={courseSlug} locale={locale} dark={dark} ageBand={bandOf(register)}
    courseTitles={titles} links={links} onNavigate={onNavigate} retrying={retrying}
    onRetry={() => { setRetrying(true); setRevision((n) => n + 1); }} />;
}

export default TerritoryRoute;
