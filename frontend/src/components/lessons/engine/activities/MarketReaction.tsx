import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";
import { pickText } from './fieldText';

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
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* Newspaper Headline */}
            <div className="bg-white rounded-[2.5rem] shadow-sm mb-8 p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: "var(--lp-line)" }}>
                    <span className="lp-badge lp-option--indigo shrink-0 w-11 h-11 flex items-center justify-center">
                        <Newspaper className="w-6 h-6" />
                    </span>
                    <h2 className="lp-display text-xl sm:text-2xl uppercase tracking-tight" style={{ color: "var(--lp-ink)" }}>
                        {t('market_reaction.breaking_news')}
                    </h2>
                </div>
                <p className="lp-display text-2xl sm:text-3xl leading-tight mb-6" style={{ color: "var(--lp-ink)" }}>
                    {headline}
                </p>
                <div className="p-4 rounded-full border" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                    <p className="lp-display text-lg" style={{ color: "var(--lp-indigo-ink)" }}>
                        {question}
                    </p>
                </div>
            </div>

            {/* Prediction Options */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                {options.map((option: any, index: number) => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.id === exercise.correct_answer?.correctOptionId;
                    const isUp = option.id === 'up';
                    const hue = index % 2 === 0 ? 'indigo' : 'amber';
                    const locked = feedback !== 'none';

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelectOption(option.id)}
                            disabled={feedback !== 'none'}
                            style={{ animationDelay: `${0.06 + index * 0.07}s` }}
                            className={cn(
                                "lp-token lp-option p-5 sm:p-6 flex flex-col items-center justify-center gap-3 min-h-[140px] sm:min-h-[160px]",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                locked && "lp-token--locked",
                                isSelected && feedback === 'none' && "is-selected",
                                feedback === 'success' && isSelected && isCorrect && "is-correct",
                                feedback === 'error' && isSelected && "is-wrong",
                                feedback !== 'none' && !isSelected && "is-dimmed"
                            )}
                        >
                            <div className="text-center">
                                <div className="text-5xl sm:text-6xl mb-3">{option.icon || '📊'}</div>
                                <p className="lp-display text-base sm:text-lg" style={{ color: "var(--lp-ink)" }}>
                                    {pickText(option)}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Explanation (shown after answer) */}
            {feedback !== 'none' && exercise.content.explanation && (
                <div
                    className="mb-8 rounded-full p-6 border-2 animate-in fade-in slide-in-from-bottom-4"
                    style={{ background: "var(--lp-amber-soft)", borderColor: "var(--lp-amber)" }}
                >
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--lp-amber)" }}>
                            <span className="text-xl">💡</span>
                        </div>
                        <div>
                            <h4 className="lp-display mb-2" style={{ color: "var(--lp-amber-ink)" }}>
                                {t('market_reaction.why')}
                            </h4>
                            <p className="leading-relaxed" style={{ color: "var(--lp-ink)" }}>
                                {exercise.content.explanation}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                <div className="w-full max-w-md">
                    {feedback === 'none' ? (
                        <QuestButton variant="gold" disabled={!selectedOption} onClick={handleCheck}>
                            {t('actions.verify')}
                        </QuestButton>
                    ) : (
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    )}
                </div>
            </div>
        </div>
    );
};
