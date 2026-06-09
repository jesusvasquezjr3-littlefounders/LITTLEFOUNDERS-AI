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
        const baseStyle = "border-2 shadow-sm";
        switch (theme) {
            case 'amber': return `${baseStyle} bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300`;
            case 'blue': return `${baseStyle} bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300`;
            case 'emerald': return `${baseStyle} bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300`;
            case 'rose': return `${baseStyle} bg-rose-100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300`;
            default: return `${baseStyle} bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-800 dark:text-purple-300`;
        }
    };

    return (
        <div className={`p-6 mb-8 rounded-3xl flex items-center justify-between ${getThemeColor(saga.theme)}`}>
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
                <div className="inline-block p-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 mb-4 text-5xl shadow-lg">
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
            <div className="relative rounded-3xl overflow-hidden bg-card border-2 border-border px-5 py-5 md:px-7 md:py-6 flex items-center gap-5 shadow-sm mb-8">
                {/* Ambient Glows */}
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-purple-500/15 to-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-indigo-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onBack} 
                    className="relative z-10 w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm border-2 border-slate-200 dark:border-slate-700 active:translate-y-1 active:shadow-none transition-all"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </Button>
                
                <div className="relative z-10 flex flex-col">
                    <span className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest leading-none mb-0.5">{t('common:app_name')}</span>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight">
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
