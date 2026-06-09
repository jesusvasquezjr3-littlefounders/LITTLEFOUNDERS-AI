import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

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
    const riskOptions = content.risk_options || content.options || [];
    const decisionText = content.decision || content.question || content.scenario || t('instructions.risk_reward', { defaultValue: 'Evalúa el riesgo' });

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            <h3 className="text-2xl font-bold text-center mb-10 text-slate-800 dark:text-slate-100">
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
                                "flex-1 min-h-[240px] rounded-[2rem] p-6 flex flex-col items-center justify-between border-4 shadow-[0_8px_0_hsl(var(--border))] transition-all duration-300 transform relative overflow-hidden group",
                                isOtherSelected && "opacity-50 scale-90 grayscale blur-[2px] shadow-none translate-y-[8px]",
                                isSelected && "scale-105 z-10 ring-4 ring-offset-4 ring-foreground shadow-none translate-y-[8px]",
                                !isSelected && !isOtherSelected && "hover:-translate-y-2 hover:shadow-[0_12px_0_hsl(var(--border))] active:translate-y-[8px] active:shadow-none",
                                isRisk
                                    ? "bg-violet-500 hover:bg-violet-400 border-violet-700 text-white"
                                    : "bg-blue-500 hover:bg-blue-400 border-blue-700 text-white"
                            )}
                        >
                            {/* Icon */}
                            <div className="mb-4 p-4 rounded-full bg-white/20 backdrop-blur-sm">
                                {isRisk ? <AlertTriangle className="w-12 h-12" /> : <ShieldCheck className="w-12 h-12" />}
                            </div>

                            {/* Title */}
                            <h4 className="text-2xl font-black uppercase tracking-wider mb-2 text-center drop-shadow-sm">
                                {option.text || option.label || ''}
                            </h4>

                            {/* Hidden Reward (Revealed on Select) */}
                            <div className={cn(
                                "mt-4 p-4 rounded-xl bg-black/20 backdrop-blur-md w-full text-center transition-all duration-500",
                                isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                            )}>
                                <p className="font-bold text-lg">
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
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                    <p className={cn("font-bold text-xl mb-4", feedback === 'success' ? "text-green-500" : "text-violet-500")}>
                        {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                    </p>
                    <Button
                        onClick={handleContinue}
                        className={cn(
                            "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                            feedback === 'success'
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                                : "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                            "hover:-translate-y-[2px]"
                        )}
                    >
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </Button>
                </div>
            )}
        </div>
    );
};
