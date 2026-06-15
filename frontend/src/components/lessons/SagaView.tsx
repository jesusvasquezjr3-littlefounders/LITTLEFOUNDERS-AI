import React from 'react';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { TopicNode } from './TopicNode';
import { AdventureCard } from './AdventureCard';
import { useTranslation } from 'react-i18next';
import { useSagaData, SagaData } from './hooks/useSagaData';

// ============== COMPONENTS ==============

const SagaHeader: React.FC<{ saga: SagaData }> = ({ saga }) => {
    return (
        <div className="corp-panel p-6 mb-8 rounded-3xl flex items-center justify-between">
            <div>
                <span className="corp-eyebrow">{saga.title}</span>
                <p className="mt-2 font-medium text-slate-600 dark:text-slate-400">{saga.description}</p>
            </div>
            <div className="hidden sm:block corp-icon-chip w-14 h-14 rounded-2xl">
                <BookOpen size={28} />
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
                <div className="inline-block p-6 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-4 text-5xl">
                    🏆
                </div>
                <p className="font-bold text-2xl text-slate-900 dark:text-white mb-2">{t('general.completed_all_title')}</p>
                <p className="text-slate-500 dark:text-slate-400">{t('general.completed_all_desc')}</p>
            </div>
        );
    }

    return (
        <div className="mt-8 mb-4">
            {/* Section Header */}
            <div className="text-center mb-6">
                <span className="corp-eyebrow inline-block mb-1">
                    {t('general.next_adventure')}
                </span>
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
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-[32px] z-[60]">
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
    onSelectSaga?: (sagaId: number, sagaTitle: string) => void;
}

export const SagaView: React.FC<SagaViewProps> = ({ adventureId = 1, onBack, onSelectSaga }) => {
    const { adventure1Sagas, adventure6Sagas } = useSagaData();
    const { t } = useTranslation('adventures');

    const sagas = adventureId === 6 ? adventure6Sagas : adventure1Sagas;
    const adventureTitle = adventureId === 6 ? t('list.6.title') : t('list.1.title');

    return (
        <div className="w-full h-full relative">

            {/* Premium Header Title */}
            <div className="corp-panel relative rounded-3xl overflow-hidden px-5 py-5 md:px-7 md:py-6 flex items-center gap-5 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="relative z-10 w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </Button>

                <div className="relative z-10 flex flex-col">
                    <span className="corp-eyebrow">{t('common:app_name')}</span>
                    <h1 className="corp-display mt-1 text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                        {adventureTitle}
                    </h1>
                </div>
            </div>
                {sagas.map((saga) => (
                    <div
                        key={saga.id}
                        role="button"
                        tabIndex={onSelectSaga ? 0 : undefined}
                        className={`mb-8 ${onSelectSaga ? 'cursor-pointer' : ''}`}
                        onClick={() => onSelectSaga?.(saga.id, saga.title)}
                        onKeyDown={(e) => {
                            if (onSelectSaga && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onSelectSaga(saga.id, saga.title);
                            }
                        }}
                    >
                        <SagaHeader saga={saga} />
                        {!onSelectSaga && <SagaMap saga={saga} startTopicIndex={0} />}
                    </div>
                ))}

                {/* Next Adventure Preview */}
                <NextAdventurePreview currentAdventureId={adventureId} />


        </div>
    );
};

export default SagaView;
