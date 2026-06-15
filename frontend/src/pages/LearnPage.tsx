/**
 * LearnPage — /learn
 * Zero-click unified learning experience.
 * • Wallpapers reused as adventure section dividers
 * • LessonPath (Duolingo caminito) embedded per saga — no extra navigation clicks
 * • Auto-scrolls to the user's current lesson on first load
 * • Full i18n, mobile-first, light/dark compatible, Liquid Glass aesthetic
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdventureCard } from '@/components/lessons/AdventureCard';
import { LessonPath } from '@/components/lessons/LessonPath';
import { useAdventuresAPI, type Adventure } from '@/components/lessons/hooks/useAdventures';
import { useLessonsList } from '@/components/lessons/hooks/useLessonsList';
import { useResumeLesson } from '@/components/lessons/hooks/useResumeLesson';
import { useSagaData, type SagaData } from '@/components/lessons/hooks/useSagaData';
import { useTranslation } from 'react-i18next';
import { LessonsLoadingScreen } from '@/components/ui/LoadingScreen';
import { ChevronDown, ChevronUp, Lock, Sparkles, BookOpen, Zap, LocateFixed } from 'lucide-react';
import { getGuestProfile } from '@/lib/guestProfile';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SagaSection {
  sagaId: number;
  sagaTitle: string;
  isOpen: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single saga accordion section — header + LessonPath embedded
 */
const SagaSectionItem: React.FC<{
  saga: SagaData;
  adventureId: number;
  userId?: string;
  isOpen: boolean;
  onToggle: () => void;
  nextLessonCode: string | null;
}> = ({ saga, adventureId, userId, isOpen, onToggle, nextLessonCode }) => {
  const { t } = useTranslation(['lessons', 'adventures']);

  const { lessons, isLoading } = useLessonsList(
    isOpen ? adventureId : 0,
    saga.id,
    undefined,
    userId
  );

  const isCurrentSaga = nextLessonCode
    ? nextLessonCode.startsWith(`${adventureId}-${saga.id}-`)
    : false;

  const themeMap: Record<number, string> = {
    1: 'archipelago', 2: 'forest', 3: 'city',
    4: 'valley', 5: 'kingdom', 6: 'cosmos',
  };
  const themeColor = themeMap[adventureId] || 'archipelago';

  const completedCount = lessons.filter(l => l.completed).length;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden transition-all duration-300',
        'border border-white/10 dark:border-white/5',
        'liquid-glass-subtle',
        isCurrentSaga && 'ring-2 ring-indigo-400/40 dark:ring-indigo-500/30'
      )}
    >
      {/* Saga Header — always visible, click to toggle */}
      <button
        id={`saga-header-${adventureId}-${saga.id}`}
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between gap-4 px-5 py-4 text-left',
          'transition-all duration-200 hover:bg-white/10 dark:hover:bg-white/5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded-2xl'
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Saga color dot */}
          <div className={cn(
            'shrink-0 w-3 h-3 rounded-full shadow-sm',
            isCurrentSaga ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-600'
          )} />
          <div className="min-w-0">
            <p className="text-base font-black text-slate-800 dark:text-white truncate leading-tight">
              {saga.title}
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {lessons.length > 0
                ? t('lessons:learn.adventure.progress', { completed: completedCount, total: lessons.length })
                : `${t('lessons:learn.saga.lessons_count', { count: '…' as any })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCurrentSaga && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wide border border-indigo-400/20">
              <Sparkles className="w-3 h-3" />
              {t('lessons:learn.continue_button')}
            </span>
          )}
          {isOpen
            ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
        </div>
      </button>

      {/* Saga Body — LessonPath when open */}
      {isOpen && (
        <div className="px-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div>
              <LessonPath
                lessons={lessons}
                isLoading={isLoading}
                themeColor={themeColor}
                currentLessonCode={nextLessonCode}
                isCurrentSaga={isCurrentSaga}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Adventure Banner ─────────────────────────────────────────────────────────

/**
 * Wallpaper card repurposed as a section divider banner for each adventure.
 */
const AdventureBanner: React.FC<{
  adventure: Adventure;
  isExpanded: boolean;
  onToggle: () => void;
  isLocked: boolean;
  isSelected?: boolean;
}> = ({ adventure, isExpanded, onToggle, isLocked, isSelected }) => {
  const { t } = useTranslation('lessons');

  return (
    <div
      className={cn(
        'relative w-full max-w-2xl mx-auto rounded-[28px] overflow-hidden',
        'shadow-[0_12px_0_rgba(0,0,0,0.07)] dark:shadow-[0_12px_0_rgba(0,0,0,0.3)]',
        'border-4 transition-all duration-300',
        isSelected ? 'border-indigo-500/60 dark:border-indigo-400/50 shadow-2xl' : 'border-black/5 dark:border-white/5',
        'cursor-pointer',
        isLocked && 'saturate-50 cursor-default'
      )}
      style={{ height: '280px' }}
      onClick={isLocked ? undefined : onToggle}
      role={isLocked ? undefined : 'button'}
      aria-expanded={isLocked ? undefined : isExpanded}
      id={`adventure-banner-${adventure.id}`}
    >
      {/* Wallpaper Scene — full height inside banner */}
      <AdventureCard
        title={adventure.title}
        theme={adventure.theme}
        status={adventure.status}
        progress={adventure.progress}
        hideTitle={true}
      />

      {/* Overlay gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-[55]" />

      {/* Bottom content row */}
      <div className="absolute bottom-0 left-0 right-0 z-[60] flex items-end justify-between px-5 pb-4">
        <div>
          <p className="text-white text-2xl font-black drop-shadow-md leading-tight">
            {adventure.title}
          </p>
          {!isLocked && (
            <p className="text-white/80 text-sm font-semibold mt-1">
              {t('learn.adventure.progress', {
                completed: adventure.completedLessons,
                total: adventure.totalLessons
              })}
            </p>
          )}
        </div>

        {/* Expand / Lock button */}
        {isLocked ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
            <Lock className="w-5 h-5 text-white/80" />
            <span className="text-white/80 text-sm font-bold">{t('locked')}</span>
          </div>
        ) : adventure.completedLessons === adventure.totalLessons && adventure.totalLessons > 0 ? (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-500/90 backdrop-blur-md border border-blue-300/20 shadow-lg">
            <span className="text-white text-sm font-black">🏆 {t('learn.adventure.completed_badge')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 hover:bg-white/30 transition-colors">
            {isExpanded
              ? <ChevronUp className="w-5 h-5 text-white" />
              : <ChevronDown className="w-5 h-5 text-white" />}
            <span className="text-white text-sm font-bold">
              {isExpanded ? t('learn.adventure.collapse') : t('learn.adventure.expand')}
            </span>
          </div>
        )}
      </div>

      {/* Lock overlay for locked adventures */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-[70]">
          <Lock className="w-12 h-12 text-white mb-2 drop-shadow-xl" />
          <p className="text-white text-sm font-bold text-center px-6 drop-shadow">
            {t('learn.adventure.locked_cta')}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const { t } = useTranslation(['lessons', 'adventures', 'common']);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Which adventures are expanded
  const [expandedAdventures, setExpandedAdventures] = useState<Set<number>>(new Set());
  // Which sagas are expanded: key = `${adventureId}-${sagaId}`
  const [openSagas, setOpenSagas] = useState<Set<string>>(new Set());
  // Selected adventure for desktop view (and mobile expansion sync)
  const [activeAdventureId, setActiveAdventureId] = useState<number | null>(null);

  const rawAdventures = useAdventuresAPI(userId || undefined);
  const { isLoading: adventuresLoading } = rawAdventures;

  // For guest users, unlock adventures up to the placement level
  const placementAdventure = !userId
    ? (getGuestProfile()?.placement_adventure ?? null)
    : null;

  const adventures: typeof rawAdventures.adventures = rawAdventures.adventures.map(adv => {
    if (placementAdventure && adv.id <= placementAdventure && adv.status === 'locked') {
      return { ...adv, status: 'available' };
    }
    return adv;
  });
  const { nextLessonCode, isFinished } = useResumeLesson(userId || undefined);
  const { adventure1Sagas, adventure6Sagas } = useSagaData();

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUserId(u.public_id || u.id || null);
      } catch { /* silent */ }
    }
    setIsUserLoading(false);
  }, []);

  // ── Parse current lesson location from code ────────────────────────────────
  const currentLocation = React.useMemo<{ advId: number; sagaId: number } | null>(() => {
    if (!nextLessonCode) return null;
    const parts = nextLessonCode.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { advId: parts[0], sagaId: parts[1] };
    }
    return null;
  }, [nextLessonCode]);

  // ── Auto-expand the adventure/saga that contains the current lesson ────────
  useEffect(() => {
    if (!currentLocation || adventuresLoading) return;

    const { advId, sagaId } = currentLocation;
    setExpandedAdventures(prev => new Set([...prev, advId]));
    setOpenSagas(prev => new Set([...prev, `${advId}-${sagaId}`]));
    setActiveAdventureId(advId);
  }, [currentLocation, adventuresLoading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleAdventure = useCallback((id: number) => {
    setExpandedAdventures(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // For desktop layout selection sync
    setActiveAdventureId(prev => prev === id ? null : id);
  }, []);

  const toggleSaga = useCallback((key: string) => {
    setOpenSagas(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const getSagasForAdventure = (advId: number): SagaData[] => {
    if (advId === 6) return adventure6Sagas;
    return adventure1Sagas;
  };

  // ── Focus the current lesson: expand its adventure/saga, scroll it to center,
  //    and flash it. Shared by the "Go to my lesson" button and the on-entry auto-focus. ──
  const autoFocusedRef = useRef(false);

  const focusCurrentLesson = useCallback(() => {
    if (!currentLocation) return;
    const { advId, sagaId } = currentLocation;

    // 1. Make sure the right adventure + saga are open (idempotent).
    setExpandedAdventures(prev => (prev.has(advId) ? prev : new Set([...prev, advId])));
    setOpenSagas(prev => {
      const key = `${advId}-${sagaId}`;
      return prev.has(key) ? prev : new Set([...prev, key]);
    });
    setActiveAdventureId(advId);

    // 2. The node mounts lazily (lessons are fetched on saga open), so poll for it.
    //    Pick the VISIBLE instance — the same saga can be mounted twice (mobile inline
    //    column is `lg:hidden` on desktop but still in the DOM), which would duplicate the id.
    let attempts = 0;
    const maxAttempts = 40; // ~6s at 150ms intervals

    const tryFocus = () => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>('#current-lesson-node')
      );
      const node = nodes.find(n => n.offsetParent !== null) ?? nodes[0];

      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief attention flash (restart animation if already applied).
        node.classList.remove('lf-lesson-flash');
        void node.offsetWidth;
        node.classList.add('lf-lesson-flash');
        window.setTimeout(() => node.classList.remove('lf-lesson-flash'), 1800);
        // Corrective re-center after layout settles (accordion/banner images).
        window.setTimeout(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
        return;
      }
      if (attempts++ < maxAttempts) {
        window.setTimeout(tryFocus, 150);
      }
    };

    window.setTimeout(tryFocus, 60);
  }, [currentLocation]);

  // ── Auto-focus the current lesson once per visit, after data is ready ──────
  useEffect(() => {
    if (autoFocusedRef.current) return;
    if (!currentLocation || adventuresLoading) return;
    autoFocusedRef.current = true;
    focusCurrentLesson();
  }, [currentLocation, adventuresLoading, focusCurrentLesson]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isUserLoading || adventuresLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <LessonsLoadingScreen minimal />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 pt-2 space-y-6">

        {/* ── Content Grid (Dynamic Layout: 7/5 Proportions) ──────────────── */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-stretch min-h-screen">
          
          {/* Left Column: Adventures List + Header (Sticky Sidebar - WIDER) */}
          <div className="lg:col-span-7 lg:sticky lg:top-10 lg:self-start space-y-8 lg:pr-10 lg:border-r lg:border-white/10 dark:lg:border-white/5 pb-20">
            
            {/* ── Page Header (Internal to Left Column) ────────────────────── */}
            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/10 dark:border-white/5 mb-2">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl shadow-xl shadow-indigo-500/20 shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 truncate">
                    {t('lessons:learn.page_title')}
                  </h1>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide leading-none truncate">
                    {t('common:app_name')}
                  </p>
                </div>
              </div>

              {/* "Go to my lesson" — jumps & highlights where the user left off.
                  Amber matches the highlighted lesson node, with a gentle attention pulse. */}
              {!isFinished && nextLessonCode && (
                <button
                  id="learn-continue-btn"
                  onClick={focusCurrentLesson}
                  title={t('lessons:learn.scroll_to_current_hint')}
                  aria-label={t('lessons:learn.scroll_to_current_hint')}
                  className={cn(
                    'lf-resume-pulse group relative shrink-0 inline-flex items-center gap-2 rounded-full',
                    'px-4 py-2.5 sm:px-5 sm:py-3',
                    'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950',
                    'text-xs sm:text-sm font-black uppercase tracking-wide',
                    'ring-2 ring-amber-300/70 shadow-lg shadow-amber-500/30',
                    'hover:from-amber-300 hover:to-amber-400 hover:scale-[1.04] active:scale-95',
                    'transition-all duration-200'
                  )}
                >
                  <LocateFixed className="w-4 h-4 shrink-0" />
                  <span>{t('lessons:learn.scroll_to_current')}</span>
                </button>
              )}

              {/* All-completed badge */}
              {isFinished && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-black shadow-lg shadow-indigo-500/30">
                  🏆 {t('lessons:learn.all_completed_title')}
                </div>
              )}
            </div>

            {/* ── Beta notice strip (Internal to Left Column) ───────────────── */}
            <div className="bg-indigo-400/10 dark:bg-indigo-400/5 border border-indigo-400/20 h-10 px-4 rounded-xl flex items-center gap-3 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <div className="relative flex-1 overflow-hidden whitespace-nowrap">
                <p className="inline-block text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 animate-marquee sm:animate-none">
                  {t('lessons:learn.beta_notice')}
                </p>
              </div>
              <style>{`
                @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
                .animate-marquee { display: inline-block; padding-left: 100%; animation: marquee 20s linear infinite; }
                @media (min-width: 640px) { .animate-marquee { animation: none; padding-left: 0; transform: none; white-space: normal; } }
                @keyframes lfLessonFlash { 0%, 100% { filter: none; } 25%, 65% { filter: drop-shadow(0 0 14px rgba(251, 191, 36, 0.95)); } }
                .lf-lesson-flash { animation: lfLessonFlash 1.6s ease-in-out; }
                @keyframes lfResumePulse { 0%, 100% { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.12)); } 50% { filter: drop-shadow(0 0 11px rgba(245, 158, 11, 0.9)); } }
                .lf-resume-pulse { animation: lfResumePulse 2.4s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) { .lf-lesson-flash, .lf-resume-pulse { animation: none; } }
              `}</style>
            </div>

            <div className="space-y-4">
              {adventures.map(adventure => {
                const isExpanded = expandedAdventures.has(adventure.id);
                const isLocked = adventure.status === 'locked';
                const isSelected = activeAdventureId === adventure.id;
                const sagas = getSagasForAdventure(adventure.id);

                return (
                  <div key={adventure.id} className="space-y-4">
                    <AdventureBanner
                      adventure={adventure}
                      isExpanded={isExpanded}
                      isSelected={isSelected}
                      onToggle={() => !isLocked && toggleAdventure(adventure.id)}
                      isLocked={isLocked}
                    />

                    {/* Mobile Inline Sagas (Accordion) */}
                    <div className={cn(
                      "lg:hidden space-y-3 pl-1 pr-1",
                      isExpanded ? "animate-in fade-in slide-in-from-top-2 duration-300" : "hidden"
                    )}>
                      {sagas.map(saga => {
                        const sagaKey = `${adventure.id}-${saga.id}`;
                        return (
                          <SagaSectionItem
                            key={sagaKey}
                            saga={saga}
                            adventureId={adventure.id}
                            userId={userId || undefined}
                            isOpen={openSagas.has(sagaKey)}
                            onToggle={() => toggleSaga(sagaKey)}
                            nextLessonCode={nextLessonCode}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sagas List (Narrower: 5/12 Proportions) */}
          <div className="hidden lg:block lg:col-span-5 pt-2">
            {activeAdventureId ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-2 px-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">
                    {adventures.find(a => a.id === activeAdventureId)?.title}
                  </h2>
                </div>
                
                <div className="space-y-3">
                  {getSagasForAdventure(activeAdventureId).map(saga => {
                    const sagaKey = `${activeAdventureId}-${saga.id}`;
                    return (
                      <SagaSectionItem
                        key={sagaKey}
                        saga={saga}
                        adventureId={activeAdventureId}
                        userId={userId || undefined}
                        isOpen={openSagas.has(sagaKey)}
                        onToggle={() => toggleSaga(sagaKey)}
                        nextLessonCode={nextLessonCode}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center liquid-glass-subtle border border-dashed border-white/20 rounded-[32px] p-12">
                <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-lg font-bold text-slate-400 dark:text-slate-500 max-w-xs">
                  {t('lessons:learn.adventure.expand')} para ver el camino de aprendizaje
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── All completed state ─────────────────────────────────────────── */}
        {isFinished && (
          <div className="text-center py-12 animate-in fade-in duration-700">
            <div className="inline-block p-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 mb-4 text-5xl shadow-lg">
              🏆
            </div>
            <p className="font-black text-3xl text-slate-800 dark:text-white mb-3">
              {t('lessons:learn.all_completed_title')}
            </p>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-base">
              {t('lessons:learn.all_completed_desc')}
            </p>
          </div>
        )}
      </div>
  );
}
