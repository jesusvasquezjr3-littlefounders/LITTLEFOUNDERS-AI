import React from 'react';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { TopicNode } from './TopicNode';
import { AdventureCard } from './AdventureCard';
import { useTranslation } from 'react-i18next';
import { useSagaData, SagaData } from './hooks/useSagaData';

// ============== COMPONENTS ==============

const SagaHeader: React.FC<{ saga: SagaData }> = ({ saga }) => {
    const getThemeColor = (theme: string) => {
        switch (theme) {
            case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
            case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            case 'emerald': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
            case 'rose': return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
            default: return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
        }
    };

    return (
        <div className={`p-6 mb-8 rounded-3xl border-2 ${getThemeColor(saga.theme)} flex items-center justify-between`}>
            <div>
                <h2 className="text-xl font-black uppercase tracking-wider opacity-80 mb-1">{saga.title}</h2>
                <p className="font-medium opacity-90">{saga.description}</p>
            </div>
            <div className="hidden sm:block p-3 bg-white/50 dark:bg-black/20 rounded-2xl">
                <BookOpen size={32} />
            </div>
        </div>
    );
};

interface SagaMapProps {
    saga: SagaData;
    startTopicIndex: number;
}

const SagaMap: React.FC<SagaMapProps> = ({ saga }) => {
    const topics = saga.topics;
    const ROW_HEIGHT = 100;

    // Calculate Node Positions
    const getPosition = (index: number) => {
        const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
        const amplitude = 90;
        const x = Math.sin(index * 1.5) * amplitude; // Simple ripple
        return { x: x + 200, y }; // +200 to center in 400px container
    };

    const pathD = topics.map((_, i) => {
        if (i === topics.length - 1) return '';
        const start = getPosition(i);
        const end = getPosition(i + 1);

        // Curved SVG path between nodes
        return `M ${start.x} ${start.y} C ${start.x} ${start.y + 50}, ${end.x} ${end.y - 50}, ${end.x} ${end.y}`;
    }).join(' ');

    return (
        <div className="relative w-full max-w-[400px] mx-auto mb-16 px-4">
            {/* Connector Line */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
                <path
                    d={pathD}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="text-slate-200 dark:text-slate-700"
                />
            </svg>

            {/* Topics */}
            <div className="relative z-10" style={{ height: topics.length * ROW_HEIGHT }}>
                {topics.map((topic, i) => {
                    const pos = getPosition(i);
                    return (
                        <TopicNode
                            key={topic.id}
                            topic={topic}
                            index={i}
                            totalInSaga={topics.length}
                            x={pos.x}
                            y={pos.y}
                            colorTheme={saga.theme}
                        />
                    );
                })}
            </div>
        </div>
    );
};

interface NextAdventurePreviewProps {
    currentAdventureId: number;
    isCurrentCompleted?: boolean;
}

const NextAdventurePreview: React.FC<NextAdventurePreviewProps> = ({
    currentAdventureId,
    isCurrentCompleted = false
}) => {
    const { nextAdventures } = useSagaData();
    const { t } = useTranslation('adventures');
    const nextAdventure = nextAdventures[currentAdventureId];

    // If no next adventure (final adventure completed)
    if (!nextAdventure) {
        return (
            <div className="text-center py-12">
                <div className="inline-block p-6 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800 mb-4 text-5xl shadow-lg">
                    🏆
                </div>
                <p className="font-bold text-2xl text-slate-800 dark:text-white mb-2">{t('general.completed_all_title')}</p>
                <p className="text-slate-500 dark:text-slate-400">{t('general.completed_all_desc')}</p>
            </div>
        );
    }

    return (
        <div className="mt-8 mb-4">
            {/* Section Header */}
            <div className="text-center mb-6">
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    {t('general.next_adventure')}
                </p>
                <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <div className="h-px w-12 bg-slate-300 dark:bg-slate-600"></div>
                    <Lock size={16} />
                    <div className="h-px w-12 bg-slate-300 dark:bg-slate-600"></div>
                </div>
            </div>

            {/* Next Adventure Card - Locked State */}
            <div className="relative transform scale-90 opacity-80 hover:opacity-95 transition-all duration-300">
                <AdventureCard
                    title={nextAdventure.title}
                    theme={nextAdventure.theme}
                    status={isCurrentCompleted ? "available" : "locked"}
                    progress={0}
                />

                {/* Lock Overlay */}
                {!isCurrentCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[32px] backdrop-blur-sm z-[60]">
                        <div className="flex flex-col items-center text-white text-center px-4">
                            <Lock size={48} className="mb-3" />
                            <span className="font-bold text-xl mb-1">{t('general.locked')}</span>
                            <span className="text-sm opacity-90">{t('general.locked_desc')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============== MAIN EXPORT ==============

interface SagaViewProps {
    adventureId?: number;
    onBack?: () => void;
}

export const SagaView: React.FC<SagaViewProps> = ({ adventureId = 1, onBack }) => {
    const { adventure1Sagas, adventure6Sagas } = useSagaData();
    const { t } = useTranslation('adventures');

    const sagas = adventureId === 6 ? adventure6Sagas : adventure1Sagas;
    const adventureTitle = adventureId === 6 ? t('list.6.title') : t('list.1.title');

    return (
        <div className="w-full h-full relative">

            {/* Simple Header Title - Static like "AVENTURAS" */}
            <div className="max-w-xl mx-auto px-4 py-8">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-500 hover:text-slate-900 dark:text-slate-400">
                        <ArrowLeft size={24} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-wide uppercase">
                        {adventureTitle}
                    </h1>
                </div>
                {sagas.map((saga) => (
                    <div key={saga.id} className="mb-8">
                        <SagaHeader saga={saga} />
                        <SagaMap saga={saga} startTopicIndex={0} />
                    </div>
                ))}

                {/* Next Adventure Preview */}
                <NextAdventurePreview currentAdventureId={adventureId} />

            </div>
        </div>
    );
};

export default SagaView;
