import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { fetchCourse, type CourseState } from '@/rebuild/learning/course';
import { featuredCourse, fetchShelf, type ShelfState } from '@/rebuild/learning/learnHome';
import { LearnHomeView } from '@/rebuild/learning/LearnHomeView';
import { acknowledgeGraduation } from '@/rebuild/learning/learnerRegister';
import { fetchRhythm, type RhythmState } from '@/rebuild/learning/motivation';
import { answerSelfBridge, fetchSelfBridges, type SelfBridge } from '@/rebuild/learning/narrative';
import { RegisterGraduationView } from '@/rebuild/learning/RegisterGraduationView';
import { fetchTogetherTeaser } from '@/rebuild/learning/together';
import { readCoursesCache, writeCoursesCache } from './coursesCache';
import { bandOf, useLearnerRegister, useLearnHost } from './learnHost';

/*
 * /learn — the host of the rebuilt learner home (W2L.1, L1), inside the
 * learner shell. It reads, each on its own so one failure never blanks the
 * rest: the shelf (GET /learn/courses), the featured course's own entry (its
 * next step: the B.6 path or the tree), the learner's rhythm (B.21/B.24), an
 * independent teen's self prompts (B.13; Core sends none to anyone else), whether
 * goals together are open to this learner (L-04, OD-27 (1)) and
 * the register (B.23: the Copy Budget band and a graduation owed).
 *
 * STALE-WHILE-REVALIDATE, kept from the legacy home: the shelf a learner
 * already saw paints at once and a fresh read always goes out behind it, so
 * the /learn -> lesson -> back loop shows no spinner for data that has not
 * changed. The cache is dropped when a lesson completes (LessonRoute), the
 * one moment progress did change. A failed revalidation never blanks a shelf
 * the learner is reading.
 */
export function LearnHomeRoute() {
  const { profile, session } = useAuth();
  const { locale, dark, transport, links, onNavigate } = useLearnHost();
  const userId = session?.user.id ?? null;
  const [shelf, setShelf] = useState<ShelfState>(() => {
    const cached = readCoursesCache(userId);
    return cached ? { status: 'ready', shelf: { courses: cached } } : { status: 'loading' };
  });
  const [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [featured, setFeatured] = useState<{ slug: string; state: CourseState } | null>(null);
  const [rhythm, setRhythm] = useState<RhythmState>({ status: 'loading' });
  const [bridges, setBridges] = useState<SelfBridge[]>([]);
  const [together, setTogether] = useState<{ eligible: boolean; asked: boolean } | null>(null);
  const [register, setRegister] = useLearnerRegister(transport);

  useEffect(() => {
    let active = true;
    const cached = readCoursesCache(userId);
    if (!cached && revision === 0) setShelf({ status: 'loading' });
    void fetchShelf(transport).then((next) => {
      if (!active) return;
      setRetrying(false);
      if (next.status !== 'ready') {
        // A failed revalidation must not blank a shelf the learner is reading.
        if (!cached) setShelf(next);
        return;
      }
      writeCoursesCache(userId, next.shelf.courses);
      setShelf(next);
    });
    return () => { active = false; };
  }, [transport, userId, revision]);

  // The featured course's own entry is optional and fails quietly: the hero then opens the course instead.
  const featuredSlug = shelf.status === 'ready' ? featuredCourse(shelf.shelf.courses)?.slug ?? null : null;
  useEffect(() => {
    if (!featuredSlug) return undefined;
    let active = true;
    setFeatured({ slug: featuredSlug, state: { status: 'loading' } });
    void fetchCourse(featuredSlug, transport).then((state) => { if (active) setFeatured({ slug: featuredSlug, state }); });
    return () => { active = false; };
  }, [featuredSlug, transport, revision]);

  useEffect(() => {
    let active = true;
    void fetchRhythm(transport).then((next) => { if (active) setRhythm(next); });
    void fetchSelfBridges(transport).then((next) => { if (active) setBridges(next); });
    // L-04: quiet; a failure hides the card.
    void fetchTogetherTeaser(transport).then((next) => { if (active) setTogether(next); });
    return () => { active = false; };
  }, [transport]);

  const firstName = (profile?.display_name ?? '').trim().split(/\s+/)[0] || null;
  const graduation = register.status === 'ready' ? register.value.graduation : null;
  return <LearnHomeView locale={locale} dark={dark} ageBand={bandOf(register)} name={firstName} shelf={shelf} featured={featured}
    rhythm={rhythm} bridges={bridges} together={together} links={links} onNavigate={onNavigate} retrying={retrying}
    onRetry={() => { setRetrying(true); setRevision((n) => n + 1); }}
    onBridge={(id, answer, goal) => answerSelfBridge(transport, id, answer, goal)}
    // W3L.1 (L-12): after a goal is created, the teen's own Wallet is one press away.
    onOpenWallet={() => onNavigate('/wallet')}
    graduation={graduation && register.status === 'ready' ? <RegisterGraduationView into={graduation.to} locale={locale} dark={dark}
      onAcknowledge={async () => {
        const saved = await acknowledgeGraduation(transport, graduation.to);
        if (saved) setRegister({ status: 'ready', value: { ...register.value, graduation: null } });
        return saved;
      }} /> : null} />;
}

export default LearnHomeRoute;
