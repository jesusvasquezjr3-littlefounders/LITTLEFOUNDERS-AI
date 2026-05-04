import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Trophy, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    useEffect(() => {
        setSelectedStrategy(null);
        setProgress(0);
        setIsRacing(false);
        setFeedback('none');
    }, [exercise]);

    const goal = exercise.content.goal || 1000;
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
        const interval = setInterval(() => {
            currentProgress += 1;
            setProgress(currentProgress);

            if (currentProgress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    const isCorrect = onSubmit(selectedStrategy);
                    setFeedback(isCorrect ? 'success' : 'error');
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
                <div className="inline-flex flex-col items-center bg-gradient-to-br from-yellow-500 to-amber-600 text-white rounded-2xl px-6 py-4 shadow-xl">
                    <Trophy className="w-8 h-8 mb-2" />
                    <span className="text-xs font-medium opacity-90 mb-1">{t('savings_race.goal')}</span>
                    <div className="text-3xl font-black">${goal}</div>
                </div>
            </div>

            {/* Progress Bar */}
            {isRacing && (
                <div className="mb-6">
                    <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-8 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-100 flex items-center justify-end pr-3"
                            style={{ width: `${progress}%` }}
                        >
                            <span className="text-white text-sm font-bold">{progress}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Strategies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {strategies.map((strategy: any) => {
                    const isSelected = selectedStrategy === strategy.id;

                    return (
                        <button
                            key={strategy.id}
                            onClick={() => handleSelectStrategy(strategy.id)}
                            disabled={feedback !== 'none' || isRacing}
                            className={cn(
                                "p-4 rounded-2xl border-2 transition-all duration-300 transform text-left",
                                "bg-white dark:bg-slate-800",
                                isSelected && !isRacing && "ring-4 ring-blue-400 dark:ring-blue-600 scale-105 shadow-xl border-blue-500",
                                !isSelected && !isRacing && "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:-translate-y-1",
                                isRacing && "opacity-50"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-3xl">{strategy.icon || '💰'}</div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                                        {strategy.name}
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                        {strategy.description}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
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
                    <Button
                        onClick={handleStartRace}
                        disabled={!selectedStrategy || isRacing}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {isRacing ? t('savings_race.racing') : t('savings_race.start_race')}
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success' ? t('savings_race.goal_reached') : t('feedback.error')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
