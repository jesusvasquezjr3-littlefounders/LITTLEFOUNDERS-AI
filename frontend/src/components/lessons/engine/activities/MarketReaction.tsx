import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MarketReactionProps {
    exercise: any;
    onSubmit: (prediction: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MarketReaction = ({ exercise, onSubmit, onNext, onRetry }: MarketReactionProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setSelectedOption(null);
        setFeedback('none');
    }, [exercise]);

    const headline = exercise.content.headline || '';
    const question = exercise.content.question || '';
    const options = exercise.content.options || [];

    const handleSelectOption = (optionId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelectedOption(optionId);
    };

    const handleCheck = () => {
        if (!selectedOption) return;
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(selectedOption);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedOption(null);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Newspaper Headline */}
            <div className="mb-8 bg-card rounded-3xl p-6 sm:p-8 border-2 border-border shadow-sm">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-slate-400 dark:border-slate-600">
                    <Newspaper className="w-8 h-8 text-slate-700 dark:text-slate-300" />
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        {t('market_reaction.breaking_news')}
                    </h2>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 leading-tight mb-6">
                    {headline}
                </p>
                <div className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 dark:border-amber-600 p-4 rounded-r-xl">
                    <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                        {question}
                    </p>
                </div>
            </div>

            {/* Prediction Options */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {options.map((option: any) => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.id === exercise.correct_answer?.correctOptionId;
                    const isUp = option.id === 'up';

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelectOption(option.id)}
                            disabled={feedback !== 'none'}
                            className={cn(
                                "p-4 rounded-[2rem] border-2 transition-all duration-300 transform",
                                "flex flex-col items-center justify-center gap-4 min-h-[120px]",
                                "bg-card text-foreground",
                                isSelected && feedback === 'none' && "border-blue-500 shadow-none ring-4 ring-blue-300 translate-y-[4px]",
                                !isSelected && feedback === 'none' && "border-border shadow-[0_8px_0_hsl(var(--border))] hover:shadow-[0_4px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[8px]",
                                feedback === 'success' && isSelected && isCorrect && "bg-green-100 dark:bg-green-900/30 border-green-500 ring-4 ring-green-300 scale-105",
                                feedback === 'error' && isSelected && "bg-red-100 dark:bg-red-900/30 border-red-500 ring-4 ring-red-300",
                                feedback !== 'none' && !isSelected && "opacity-50 grayscale border-border shadow-none"
                            )}
                        >
                            <div className="text-center">
                                <div className="text-4xl sm:text-5xl mb-2">{option.icon || '📊'}</div>
                                <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                                    {option.text}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Explanation (shown after answer) */}
            {feedback !== 'none' && exercise.content.explanation && (
                <div className="mb-8 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-lg">💡</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
                                {t('market_reaction.why')}
                            </h4>
                            <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                                {exercise.content.explanation}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleCheck}
                        disabled={!selectedOption}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] flex items-center justify-center gap-2"
                    >
                        {t('actions.verify')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                                "hover:-translate-y-[2px]"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
