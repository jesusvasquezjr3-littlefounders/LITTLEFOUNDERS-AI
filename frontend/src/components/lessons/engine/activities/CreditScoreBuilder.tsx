import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface CreditScoreBuilderProps {
    exercise: any;
    onSubmit: (decisions: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const CreditScoreBuilder = ({ exercise, onSubmit, onNext, onRetry }: CreditScoreBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [currentScenario, setCurrentScenario] = useState(0);
    const [decisions, setDecisions] = useState<string[]>([]);
    const [score, setScore] = useState(650);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setCurrentScenario(0);
        setDecisions([]);
        setScore(exercise?.content?.initialScore || 650);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const content = exercise?.content || {};
    const scenarios = content.scenarios || [];
    const scenario = scenarios[currentScenario];

    if (scenarios.length === 0) {
        // Graceful degradation: no real data exists for this exercise type
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-4xl mb-4" aria-hidden="true">💳</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {t('credit_score.title', { defaultValue: 'Construye tu Score Crediticio' })}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-md">
                    {content.instruction || content.scenario || t('credit_score.no_data', { defaultValue: 'Ejercicio educativo sobre manejo del crédito.' })}
                </p>
                <Button onClick={onNext} className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(147,51,234)] hover:shadow-[0_2px_0_rgb(147,51,234)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2">
                    {t('actions.continue', { defaultValue: 'Continuar' })}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            </div>
        );
    }

    const handleDecision = (decisionId: string) => {
        if (feedback !== 'none') return;

        const decision = scenario.options.find((opt: any) => opt.id === decisionId);
        if (!decision) return;

        playSound('ui_tap');
        const newDecisions = [...decisions, decisionId];
        setDecisions(newDecisions);

        const newScore = Math.max(300, Math.min(850, score + (decision.scoreChange || 0)));
        setScore(newScore);

        if (currentScenario < scenarios.length - 1) {
            timeoutRef.current = setTimeout(() => setCurrentScenario(prev => prev + 1), 800);
        } else {
            timeoutRef.current = setTimeout(() => {
                const isCorrect = onSubmit(newDecisions);
                setFeedback(isCorrect ? 'success' : 'error');
            }, 800);
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setCurrentScenario(0);
            setDecisions([]);
            setScore(exercise.content.initialScore || 650);
            setFeedback('none');
            onRetry();
        }
    };

    const getScoreColor = () => {
        if (score >= 740) return 'bg-green-500 border-2 border-green-600 text-white';
        if (score >= 670) return 'bg-indigo-500 border-2 border-indigo-600 text-white';
        if (score >= 580) return 'bg-violet-500 border-2 border-violet-600 text-white';
        return 'bg-red-500 border-2 border-red-600 text-white';
    };

    const getScoreLabel = () => {
        if (score >= 740) return t('credit_score.excellent');
        if (score >= 670) return t('credit_score.good');
        if (score >= 580) return t('credit_score.fair');
        return t('credit_score.poor');
    };

    if (!scenario && feedback === 'none') {
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-4xl mb-4" aria-hidden="true">💳</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {t('credit_score.loading', { defaultValue: 'Cargando escenarios...' })}
                </h3>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Credit Score Meter */}
            <div className="mb-6">
                <div className={cn(
                    "rounded-2xl p-6 shadow-sm text-center",
                    getScoreColor()
                )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <CreditCard className="w-6 h-6" />
                        <span className="text-sm font-medium opacity-90">
                            {t('credit_score.your_score')}
                        </span>
                    </div>
                    <div className="text-6xl font-black mb-2">{score}</div>
                    <div className="text-lg font-bold opacity-90">{getScoreLabel()}</div>
                </div>

                {/* Score Range Indicator */}
                <div className="mt-4 bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-red-500 via-indigo-500 to-green-500 transition-all duration-500"
                        style={{ width: `${((score - 300) / 550) * 100}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <span>300</span>
                    <span>850</span>
                </div>
            </div>

            {/* Scenario */}
            {scenario && feedback === 'none' && (
                <>
                    <div className="mb-6 bg-card rounded-2xl p-4 border-2 border-border shadow-sm">
                        <h3 className="text-sm font-bold text-foreground mb-2">
                            {t('credit_score.scenario')} {currentScenario + 1}/{scenarios.length}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            {scenario.description}
                        </p>
                    </div>

                    <div className="space-y-3 mb-6">
                        {scenario.options.map((option: any) => (
                            <button
                                key={option.id}
                                onClick={() => handleDecision(option.id)}
                                className="w-full text-left p-4 rounded-2xl border-2 border-border hover:border-purple-400 dark:hover:border-purple-500 bg-card hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-sm sm:text-base font-bold text-foreground flex-1 leading-snug">
                                        {option.text}
                                    </p>
                                    {/* Score change hidden until after selection to avoid spoiling the challenge */}
                                    <div className={cn(
                                        "text-sm sm:text-base font-black shrink-0 px-3 py-1.5 rounded-xl border-2 shadow-sm bg-background transition-opacity duration-300",
                                        feedback !== 'none'
                                            ? option.scoreChange > 0 ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 opacity-100" :
                                                option.scoreChange < 0 ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 opacity-100" :
                                                    "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 opacity-100"
                                            : "opacity-0"
                                    )} aria-hidden={feedback === 'none'}>
                                        {option.scoreChange > 0 && '+'}
                                        {option.scoreChange}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Result */}
            {feedback !== 'none' && (
                <div className="flex flex-col items-center">
                    <div className={cn(
                        "mb-6 p-6 rounded-2xl text-center w-full",
                        feedback === 'success' && "bg-green-100 dark:bg-green-950/30 border-2 border-green-500",
                        feedback === 'error' && "bg-violet-100 dark:bg-violet-950/30 border-2 border-violet-500"
                    )}>
                        <p className={cn(
                            "font-bold text-lg mb-2",
                            feedback === 'success' ? "text-green-700 dark:text-green-300" : "text-violet-700 dark:text-violet-300"
                        )}>
                            {feedback === 'success' ? t('credit_score.great_job') : t('credit_score.needs_work')}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {feedback === 'success'
                                ? t('credit_score.success_message')
                                : t('credit_score.error_message')
                            }
                        </p>
                    </div>

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
