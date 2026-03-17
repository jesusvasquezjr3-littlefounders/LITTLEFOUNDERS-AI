import { useState, useEffect } from 'react';
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
    const [result, setResult] = useState<'win' | 'loss' | null>(null); // For risk outcomes
    const [feedback, setFeedback] = useState<'none' | 'success' | 'warning' | 'error'>('none');

    useEffect(() => {
        setSelectedId(null);
        setResult(null);
        setFeedback('none');
    }, [exercise]);

    const handleChoice = (option: any) => {
        if (selectedId) return;
        playSound('ui_tap');
        setSelectedId(option.id);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(option.id);

        // Reveal animation with delay
        setTimeout(() => {
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

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            <h3 className="text-2xl font-bold text-center mb-10 text-slate-800 dark:text-slate-100">
                {exercise.content.question || t('instructions.risk_reward')}
            </h3>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch mb-10">
                {(exercise.content.risk_options || []).map((option: any) => {
                    const isSelected = selectedId === option.id;
                    const isOtherSelected = selectedId !== null && !isSelected;
                    const isRisk = option.type === 'risk';

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleChoice(option)}
                            disabled={selectedId !== null}
                            className={cn(
                                "flex-1 min-h-[240px] rounded-3xl p-6 flex flex-col items-center justify-between border-4 transition-all duration-500 transform relative overflow-hidden group",
                                isOtherSelected && "opacity-50 scale-90 grayscale blur-[2px]",
                                isSelected && "scale-105 z-10 ring-8 ring-offset-4 ring-purple-300 dark:ring-purple-900 shadow-2xl skew-y-1",
                                !isSelected && !isOtherSelected && "hover:-translate-y-2 hover:shadow-xl",
                                isRisk
                                    ? "bg-gradient-to-br from-orange-500 to-red-600 border-red-700 text-white"
                                    : "bg-gradient-to-br from-blue-400 to-indigo-600 border-indigo-700 text-white"
                            )}
                        >
                            {/* Icon */}
                            <div className="mb-4 p-4 rounded-full bg-white/20 backdrop-blur-sm">
                                {isRisk ? <AlertTriangle className="w-12 h-12" /> : <ShieldCheck className="w-12 h-12" />}
                            </div>

                            {/* Title */}
                            <h4 className="text-2xl font-black uppercase tracking-wider mb-2 text-center text-shadow-sm">
                                {option.text}
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
                    <p className={cn("font-bold text-xl mb-4", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                        {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                    </p>
                    <Button
                        onClick={handleContinue}
                        className={cn(
                            "relative overflow-hidden w-full max-w-sm h-14 text-lg font-bold rounded-2xl transition-all",
                            feedback === 'success'
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                            "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
};
