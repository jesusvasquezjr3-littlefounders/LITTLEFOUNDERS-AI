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

// Navigation states
type ViewState =
  | { type: 'adventures' }
  | { type: 'sagas'; adventureId: number }
  | { type: 'lessons'; adventureId: number; sagaId: number; sagaTitle: string };

const Lecciones = () => {
  const { t } = useTranslation('lessons');
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

  const handleBack = () => {
    if (viewState.type === 'lessons') {
      setViewState({ type: 'sagas', adventureId: viewState.adventureId });
    } else if (viewState.type === 'sagas') {
      setViewState({ type: 'adventures' });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LessonsLoadingScreen />
      </DashboardLayout>
    );
  }

  // Lessons View (deepest level)
  if (viewState.type === 'lessons') {
    return (
      <DashboardLayout>
        <div className="space-y-4 pb-20">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {viewState.sagaTitle}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {lessons.filter(l => l.completed).length}/{lessons.length} {t('completed', { defaultValue: 'completadas' })}
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
      </DashboardLayout>
    );
  }

  // Sagas View
  if (viewState.type === 'sagas') {
    return (
      <DashboardLayout>
        <SagaView
          adventureId={viewState.adventureId}
          onBack={handleBack}
          onSelectSaga={handleSagaSelect}
        />
      </DashboardLayout>
    );
  }

  // Adventures View (default)
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Adventures */}
        {!isLoading && (
          <Adventures
            onSelectAdventure={handleAdventureSelect}
            userId={userId || undefined}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Lecciones;
