import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Adventures } from "@/components/lessons/Adventures";
import { SagaView } from "@/components/lessons/SagaView";
import { LessonPath } from "@/components/lessons/LessonPath";
import { useLessonsList } from "@/components/lessons/hooks/useLessonsList";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonsLoadingScreen } from "@/components/ui/LoadingScreen";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { cn } from "@/lib/utils";

interface LessonsProps {
  isDemo?: boolean;
  Layout?: React.ComponentType<{ children: React.ReactNode }>;
}

// Navigation states
type ViewState =
  | { type: 'adventures' }
  | { type: 'sagas'; adventureId: number }
  | { type: 'lessons'; adventureId: number; sagaId: number; sagaTitle: string };

export default function Lessons({ isDemo = false, Layout = DashboardLayout }: LessonsProps) {
  const { t } = useTranslation(['lessons', 'common', 'demo']);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState<ViewState>({ type: 'adventures' });

  // Get current adventure theme for LessonPath
  const getCurrentTheme = () => {
    if (viewState.type === 'lessons') {
      const themes: Record<number, string> = {
        1: 'archipelago', 2: 'forest', 3: 'city',
        4: 'valley', 5: 'kingdom', 6: 'cosmos'
      };
      return themes[viewState.adventureId] || 'archipelago';
    }
    return 'archipelago';
  };

  // Fetch lessons when in lessons view
  const { lessons, isLoading: lessonsLoading, refetch: refetchLessons } = useLessonsList(
    viewState.type === 'lessons' ? viewState.adventureId : 0,
    viewState.type === 'lessons' ? viewState.sagaId : undefined,
    undefined,
    userId || undefined
  );

  // Re-fetch lessons every time the user enters the lessons view
  // (covers the case where they return from a LessonRunner session)
  useEffect(() => {
    if (viewState.type === 'lessons') {
      refetchLessons();
    }
  }, [viewState.type]);  // intentionally omit refetchLessons to avoid infinite loop

  // Get user ID from localStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setUserId(user.public_id || user.id);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUserData();
  }, []);

  // Navigation handlers
  const handleAdventureSelect = (adventureId: number) => {
    setViewState({ type: 'sagas', adventureId });
  };

  const handleSagaSelect = (sagaId: number, sagaTitle: string) => {
    if (viewState.type === 'sagas') {
      setViewState({
        type: 'lessons',
        adventureId: viewState.adventureId,
        sagaId,
        sagaTitle
      });
    }
  };

  const handleResumeMap = (adventureId: number, sagaId: number, sagaTitle: string) => {
    setViewState({
      type: 'lessons',
      adventureId,
      sagaId,
      sagaTitle
    });
  };

  const handleBack = () => {
    if (viewState.type === 'lessons') {
      setViewState({ type: 'sagas', adventureId: viewState.adventureId });
    } else if (viewState.type === 'sagas') {
      setViewState({ type: 'adventures' });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <LessonsLoadingScreen minimal={true} />
        </div>
      </Layout>
    );
  }

  // Common wrapper class for all views
  const contentWrapperClass = "space-y-6 pb-20 max-w-6xl mx-auto px-4";

  // Lessons View (deepest level)
  if (viewState.type === 'lessons') {
    return (
      <Layout>
        <div className={contentWrapperClass}>
          {isDemo && <DemoBanner message={t('demo:demo_banner.lessons')} />}
          {/* Premium Page Header */}
          <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex items-center gap-5 border border-white/10 shadow-2xl">
              {/* Ambient Glows */}
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="relative z-10 shrink-0 rounded-full bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/5"
              >
                  <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </Button>
              
              <div className="relative z-10 flex flex-col">
                  <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-0.5">{t('common:app_name')}</span>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight">
                      {viewState.sagaTitle}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-none mt-1">
                    {lessons.filter(l => l.completed).length}/{lessons.length} {t('lessons:completed')}
                  </p>
              </div>
          </div>

          {/* Lesson Path */}
          <LessonPath
            lessons={lessons}
            isLoading={lessonsLoading}
            themeColor={getCurrentTheme()}
          />
        </div>
      </Layout>
    );
  }

  // Sagas View
  if (viewState.type === 'sagas') {
    return (
      <Layout>
        <div className={cn(contentWrapperClass, "space-y-0")}>
          {isDemo && <DemoBanner message={t('demo:demo_banner.lessons')} />}
          <SagaView
            adventureId={viewState.adventureId}
            onBack={handleBack}
            onSelectSaga={handleSagaSelect}
          />
        </div>
      </Layout>
    );
  }

  // Adventures View (default)
  return (
    <Layout>
      <div className={contentWrapperClass}>
        {isDemo && <DemoBanner message={t('demo:demo_banner.lessons')} />}
        
        {/* Development Notice Bar */}
        <div className="bg-yellow-400/10 dark:bg-yellow-400/5 border border-yellow-400/20 h-10 px-4 rounded-xl flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-700 overflow-hidden">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
          <div className="relative flex-1 overflow-hidden whitespace-nowrap">
            <p className="inline-block text-[9px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-500/80 animate-marquee sm:animate-none">
              {t('lessons:notices.beta_improvement')}
            </p>
          </div>
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-100%); }
            }
            .animate-marquee {
              display: inline-block;
              padding-left: 100%;
              animation: marquee 20s linear infinite;
            }
            @media (min-width: 640px) {
              .animate-marquee {
                animation: none;
                padding-left: 0;
                transform: none;
                white-space: normal;
              }
            }
          `}</style>
        </div>

        {/* Adventures */}
        {!isLoading && (
          <Adventures
            onSelectAdventure={handleAdventureSelect}
            onResumeMap={handleResumeMap}
            userId={userId || undefined}
          />
        )}
      </div>
    </Layout>
  );
};
