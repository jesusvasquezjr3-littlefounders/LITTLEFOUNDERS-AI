import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ChevronRight, BookOpen } from 'lucide-react';
import { AdventureCard } from './AdventureCard';
import { useAdventuresAPI, Adventure } from './hooks/useAdventures';
import { useResumeLesson } from './hooks/useResumeLesson';
import { useSagaData } from './hooks/useSagaData';
import { useTranslation } from 'react-i18next';
import { LessonsLoadingScreen } from '../ui/LoadingScreen';

interface AdventuresProps {
    onSelectAdventure?: (adventureId: number) => void;
    onResumeMap?: (adventureId: number, sagaId: number, sagaTitle: string) => void;
    userId?: string;
}

export const Adventures: React.FC<AdventuresProps> = ({ onSelectAdventure, onResumeMap, userId }) => {
    const navigate = useNavigate();
    const [selectedAdventure, setSelectedAdventure] = useState<number | null>(null);
    const { adventures, isLoading } = useAdventuresAPI(userId);
    const { nextLessonCode, isLoading: isNextLessonLoading, isFinished } = useResumeLesson(userId);
    const { adventure1Sagas, adventure6Sagas } = useSagaData();
    const { t } = useTranslation('adventures');

    const handleResumeClick = () => {
        if (!nextLessonCode || !onResumeMap) return;

        try {
            const parts = nextLessonCode.split('-').map(Number);
            if (parts.length >= 2) {
                const advId = parts[0];
                const sagId = parts[1];
                const sagas = advId === 6 ? adventure6Sagas : adventure1Sagas;
                const saga = sagas.find(s => s.id === sagId);
                const sagaTitle = saga ? saga.title : t('general.saga_default', { id: sagId });

                onResumeMap(advId, sagId, sagaTitle);
            }
        } catch (err) {
            console.error('Failed to parse next lesson code for map resume');
            // Fallback: just open the adventure
            const advId = parseInt(nextLessonCode.split('-')[0]) || 1;
            if (onSelectAdventure) onSelectAdventure(advId);
        }
    };

    const handleAdventureClick = (adventure: Adventure) => {
        if (adventure.status === 'locked') return;

        setSelectedAdventure(adventure.id);
        if (onSelectAdventure) {
            onSelectAdventure(adventure.id);
        }
    };

    if (isLoading) {
        return <LessonsLoadingScreen />;
    }

    return (
        <div className="adventures-container w-full py-8">
            {/* Premium Header Section */}
            <div className="corp-panel relative mb-6 md:mb-10 px-5 py-5 md:px-7 md:py-6 overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5 relative z-10 w-full">
                    <div className="flex flex-row items-center gap-4 md:gap-5 flex-1 w-full">
                        <div className="corp-icon-chip w-10 h-10 md:w-12 md:h-12 shrink-0">
                            <BookOpen className="w-5 h-5 md:w-7 md:h-7" />
                        </div>
                        <div className="text-left overflow-hidden">
                            <h1 className="corp-h2 mb-1">
                                {t('general.title')}
                            </h1>
                            <div className="relative overflow-hidden whitespace-nowrap">
                                <p className="inline-block text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-tight animate-marquee-slow sm:animate-none">
                                    {t('general.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Resume Button */}
                    <div className="shrink-0 w-full md:w-auto relative z-10">
                        {!isFinished && nextLessonCode && (
                            <button
                                onClick={handleResumeClick}
                                disabled={isNextLessonLoading}
                                className="corp-btn-primary w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 md:px-8 md:py-4 rounded-xl font-semibold disabled:opacity-70 text-xs md:text-base"
                            >
                                {isNextLessonLoading ? (
                                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <ChevronRight size={16} className="md:w-5 md:h-5" />
                                )}
                                {t('general.continue_learning')}
                            </button>
                        )}
                        {isFinished && (
                            <div className="corp-badge corp-badge--success inline-flex items-center gap-2 px-6 py-3 text-sm">
                                🏆 {t('general.all_completed')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Separator Decorative Line */}
            <div className="flex items-center gap-4 mb-6 md:mb-10">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>
                <span className="corp-eyebrow">
                    {t('general.explorer_label')}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>
            </div>

            {/* Lista de Aventuras */}
            <div className="flex flex-col gap-8 md:gap-12">
                {adventures.map((adventure) => (
                    <div
                        key={adventure.id}
                        className={`adventure-wrapper relative transition-[transform,opacity,filter] duration-300 ${adventure.status === 'locked'
                            ? 'opacity-70 grayscale cursor-not-allowed'
                            : 'cursor-pointer'
                            }`}
                        onClick={() => handleAdventureClick(adventure)}
                    >
                        <AdventureCard
                            title={adventure.title}
                            theme={adventure.theme}
                            status={adventure.status}
                            progress={adventure.progress}
                            ageRange={adventure.ageRange}
                        />

                        {/* Overlay para bloqueados */}
                        {adventure.status === 'locked' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[32px] backdrop-blur-sm z-[60]">
                                <div className="flex flex-col items-center text-white">
                                    <Lock size={48} className="mb-2" />
                                    <span className="font-bold text-lg">{t('general.locked')}</span>
                                    <span className="text-sm opacity-80">{t('general.locked_desc')}</span>
                                </div>
                            </div>
                        )}

                        {/* Botón de continuar para disponibles */}
                        {adventure.status === 'available' && (
                            <div className="absolute bottom-6 right-6 z-50">
                                <button className="flex items-center gap-2 px-6 py-3 bg-white/90 dark:bg-gray-900/90 rounded-full font-bold text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-[background-color,box-shadow]">
                                    {t('general.continue')}
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Estilos CSS embebidos */}
            <style>{`
        .adventures-container {
          font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes float-h {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.05); }
        }

        @keyframes marquee-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }

        .animate-marquee-slow {
          display: inline-block;
          padding-left: 100%;
          animation: marquee-slow 25s linear infinite;
        }

        @media (min-width: 640px) {
          .animate-marquee-slow {
            animation: none;
            padding-left: 0;
            transform: none;
            white-space: normal;
          }
        }
      `}</style>
        </div >
    );
};

export default Adventures;
