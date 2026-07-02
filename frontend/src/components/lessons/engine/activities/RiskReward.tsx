import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { ArrowRight, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';
import { pickText } from './fieldText';

interface RiskRewardProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const RiskReward = ({ exercise, onSubmit, onNext, onRetry }: RiskRewardProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'warning' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSelectedId(null);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const handleChoice = (option: any) => {
        if (selectedId) return;
        playSound('ui_tap');
        setSelectedId(option.id);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(option.id);

        // Reveal animation with delay
        timeoutRef.current = setTimeout(() => {
            setFeedback(isCorrect ? 'success' : 'error');
        }, 1000);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedId(null);
            setFeedback('none');
            onRetry();
        }
    };

    const content = exercise?.content || {};
    const riskOptions = resolveOptions(content, ['risk_options', 'options']);
    const decisionText = content.decision || content.question || content.scenario || t('instructions.risk_reward', { defaultValue: 'Evalúa el riesgo' });

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            <h3 className="lp-display text-2xl sm:text-3xl text-center mb-10" style={{ color: 'var(--lp-ink)' }}>
                {decisionText}
            </h3>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch mb-10">
                {riskOptions.map((option: any) => {
                    const isSelected = selectedId === option.id;
                    const isOtherSelected = selectedId !== null && !isSelected;
                    const isRisk = option.type === 'risk';

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleChoice(option)}
                            disabled={selectedId !== null}
                            aria-pressed={isSelected}
                            className={cn(
                                "lp-token lp-option flex-1 min-h-[240px] p-6 flex flex-col items-center justify-between relative overflow-hidden group",
                                "transition-all duration-300",
                                isRisk ? "lp-option--coral" : "lp-option--emerald",
                                isOtherSelected && "lp-token--locked opacity-50 scale-95 blur-[1px]",
                                isSelected && "is-selected scale-[1.03] z-10",
                                selectedId !== null && "lp-token--locked"
                            )}
                        >
                            {/* Icon */}
                            <div
                                className="mb-4 p-4 sm:p-5 rounded-full"
                                style={{ background: 'var(--soft)', color: 'var(--hueink)' }}
                            >
                                {isRisk
                                    ? <AlertTriangle className="w-16 h-16 sm:w-20 sm:h-20" strokeWidth={2.5} />
                                    : <ShieldCheck className="w-16 h-16 sm:w-20 sm:h-20" strokeWidth={2.5} />}
                            </div>

                            {/* Title */}
                            <h4 className="lp-display text-2xl uppercase tracking-wide mb-2 text-center" style={{ color: 'var(--lp-ink)' }}>
                                {pickText(option)}
                            </h4>

                            {/* Hidden Reward (Revealed on Select) */}
                            <div
                                className={cn(
                                    "mt-4 p-4 rounded-full w-full text-center transition-all duration-500",
                                    isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                                )}
                                style={{ background: 'var(--soft)' }}
                            >
                                <p className="lp-display text-lg" style={{ color: 'var(--hueink)' }}>
                                    {option.reward}
                                </p>
                                {/* If wrong, could show risk outcome */}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            {feedback !== 'none' && (
                <div className="flex flex-col items-center w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
                    <p
                        className="lp-display text-xl mb-4"
                        style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                    >
                        {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                    </p>
                    <QuestButton
                        variant={feedback === 'success' ? 'go' : 'retry'}
                        onClick={handleContinue}
                    >
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        {feedback === 'success'
                            ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </QuestButton>
                </div>
            )}
        </div>
    );
};
