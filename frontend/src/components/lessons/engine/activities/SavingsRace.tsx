import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Trophy, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface SavingsRaceProps {
    exercise: any;
    onSubmit: (strategy: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SavingsRace = ({ exercise, onSubmit, onNext, onRetry }: SavingsRaceProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [isRacing, setIsRacing] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSelectedStrategy(null);
        setProgress(0);
        setIsRacing(false);
        setFeedback('none');
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const goal = exercise?.content?.goal || 1000;
    const strategies = exercise.content.strategies || [];

    const handleSelectStrategy = (strategyId: string) => {
        if (feedback !== 'none' || isRacing) return;
        playSound('ui_tap');
        setSelectedStrategy(strategyId);
    };

    const handleStartRace = () => {
        if (!selectedStrategy) return;

        const strategy = strategies.find((s: any) => s.id === selectedStrategy);
        if (!strategy) return;

        setIsRacing(true);
        playSound('ui_tap');

        // Animate progress based on strategy speed
        const speed = strategy.speed || 1;
        const duration = 3000 / speed; // Faster strategies complete quicker
        const steps = 100;
        const stepDuration = duration / steps;

        let currentProgress = 0;
        intervalRef.current = setInterval(() => {
            currentProgress += 1;
            setProgress(currentProgress);

            if (currentProgress >= 100) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                timeoutRef.current = setTimeout(() => {
                    const isCorrect = onSubmit(selectedStrategy);
                    setFeedback(isCorrect ? 'success' : 'error');
                    setIsRacing(false);
                }, 500);
            }
        }, stepDuration);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedStrategy(null);
            setProgress(0);
            setIsRacing(false);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Goal Display */}
            <div className="mb-6 text-center">
                <div
                    className="inline-flex flex-col items-center rounded-full px-6 py-4 sm:px-8 sm:py-5"
                    style={{
                        background: 'var(--lp-indigo)',
                        boxShadow: '0 6px 0 var(--lp-indigo-lip), var(--lp-shadow)',
                        color: '#fff',
                    }}
                >
                    <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mb-2" style={{ color: 'var(--lp-amber)' }} />
                    <span className="text-xs font-bold opacity-90 mb-1 uppercase tracking-wide">{t('savings_race.goal')}</span>
                    <div className="lp-display text-4xl sm:text-5xl">${goal}</div>
                </div>
            </div>

            {/* Progress Bar */}
            {isRacing && (
                <div className="mb-6">
                    <div className="lp-track h-8">
                        <div
                            className="h-full transition-all duration-100 flex items-center justify-end pr-3"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--lp-emerald), #5fe3b0)',
                                boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)',
                            }}
                        >
                            <span className="lp-display text-white text-sm">{progress}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Strategies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {strategies.map((strategy: any, index: number) => {
                    const isSelected = selectedStrategy === strategy.id;
                    const hue = ['indigo', 'amber', 'emerald', 'coral'][index % 4];
                    const locked = feedback !== 'none' || isRacing;

                    return (
                        <button
                            key={strategy.id}
                            onClick={() => handleSelectStrategy(strategy.id)}
                            disabled={locked}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                            className={cn(
                                "lp-token lp-option text-left w-full p-4",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                isSelected && !isRacing && "is-selected",
                                isRacing && "lp-token--locked opacity-50"
                            )}
                        >
                            <div className="flex items-start gap-3.5">
                                <div className="text-3xl sm:text-4xl shrink-0">{strategy.icon || '💰'}</div>
                                <div className="flex-1">
                                    <h3 className="lp-display text-base sm:text-lg mb-1" style={{ color: 'var(--lp-ink)' }}>
                                        {pickText(strategy, ['name', 'label', 'text', 'title'])}
                                    </h3>
                                    <p className="text-xs sm:text-sm mb-2" style={{ color: 'var(--lp-muted)' }}>
                                        {pickText(strategy, ['description', 'detail', 'subtitle'])}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" style={{ color: 'var(--lp-emerald)' }} />
                                        <span className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-emerald-ink)' }}>
                                            {t('savings_race.speed')}: {strategy.speed}x
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton
                            variant="gold"
                            onClick={handleStartRace}
                            disabled={!selectedStrategy || isRacing}
                        >
                            {isRacing ? t('savings_race.racing') : t('savings_race.start_race')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg sm:text-xl mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('savings_race.goal_reached') : t('feedback.error')}
                        </p>
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {t('actions.continue')}
                            <ArrowRight className="w-5 h-5" />
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
