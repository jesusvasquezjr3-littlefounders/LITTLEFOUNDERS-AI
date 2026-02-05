import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface CreditScoreBuilderProps {
    exercise: any;
    onSubmit: (decisions: string[]) => void;
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

    useEffect(() => {
        setCurrentScenario(0);
        setDecisions([]);
        setScore(exercise.content.initialScore || 650);
        setFeedback('none');
    }, [exercise]);

    const scenarios = exercise.content.scenarios || [];
    const scenario = scenarios[currentScenario];

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
            setTimeout(() => setCurrentScenario(currentScenario + 1), 800);
        } else {
            setTimeout(() => {
                const isSuccess = newScore >= (exercise.correct_answer?.minScore || 700);
                setFeedback(isSuccess ? 'success' : 'error');
                onSubmit(newDecisions);
                if (isSuccess) playSound('edu_success');
                else playSound('edu_error');
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
        if (score >= 740) return 'from-green-500 to-emerald-600';
        if (score >= 670) return 'from-yellow-500 to-amber-600';
        if (score >= 580) return 'from-orange-500 to-red-500';
        return 'from-red-600 to-rose-700';
    };

    const getScoreLabel = () => {
        if (score >= 740) return t('credit_score.excellent');
        if (score >= 670) return t('credit_score.good');
        if (score >= 580) return t('credit_score.fair');
        return t('credit_score.poor');
    };

    if (!scenario && feedback === 'none') return null;

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Credit Score Meter */}
            <div className="mb-6">
                <div className={cn(
                    "bg-gradient-to-r text-white rounded-2xl p-6 shadow-xl text-center",
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
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
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
                    <div className="mb-6 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 border-2 border-slate-300 dark:border-slate-600">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                            {t('credit_score.scenario')} {currentScenario + 1}/{scenarios.length}
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            {scenario.description}
                        </p>
                    </div>

                    <div className="space-y-3 mb-6">
                        {scenario.options.map((option: any) => (
                            <button
                                key={option.id}
                                onClick={() => handleDecision(option.id)}
                                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1">
                                        {option.text}
                                    </p>
                                    <div className={cn(
                                        "text-sm font-bold ml-3",
                                        option.scoreChange > 0 && "text-green-600 dark:text-green-400",
                                        option.scoreChange < 0 && "text-red-600 dark:text-red-400",
                                        option.scoreChange === 0 && "text-slate-600 dark:text-slate-400"
                                    )}>
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
                        feedback === 'error' && "bg-orange-100 dark:bg-orange-950/30 border-2 border-orange-500"
                    )}>
                        <p className={cn(
                            "font-bold text-lg mb-2",
                            feedback === 'success' ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300"
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
                            "w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                            feedback === 'success'
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                            "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                        )}
                    >
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            )}
        </div>
    );
};
