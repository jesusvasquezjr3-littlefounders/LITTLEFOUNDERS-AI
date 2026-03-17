import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface EmergencyFundProps {
    exercise: any;
    onSubmit: (decisions: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const EmergencyFund = ({ exercise, onSubmit, onNext, onRetry }: EmergencyFundProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [fundBalance, setFundBalance] = useState(5000);
    const [currentEvent, setCurrentEvent] = useState(0);
    const [decisions, setDecisions] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setFundBalance(exercise.content.initialFund || 5000);
        setCurrentEvent(0);
        setDecisions({});
        setFeedback('none');
    }, [exercise]);

    const events = exercise.content.events || [];
    const event = events[currentEvent];

    const handleDecision = (decisionId: string) => {
        if (feedback !== 'none') return;

        const decision = event.options.find((opt: any) => opt.id === decisionId);
        if (!decision) return;

        playSound('ui_tap');
        const newDecisions = { ...decisions, [event.id]: decisionId };
        setDecisions(newDecisions);

        const newBalance = fundBalance - (decision.cost || 0);
        setFundBalance(newBalance);

        if (currentEvent < events.length - 1) {
            setTimeout(() => setCurrentEvent(currentEvent + 1), 1000);
        } else {
            setTimeout(() => {
                const isCorrect = onSubmit(newDecisions);
                setFeedback(isCorrect ? 'success' : 'error');
            }, 1000);
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setFundBalance(exercise.content.initialFund || 5000);
            setCurrentEvent(0);
            setDecisions({});
            setFeedback('none');
            onRetry();
        }
    };

    if (!event && feedback === 'none') return null;

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Fund Balance */}
            <div className="mb-6">
                <div className={cn(
                    "bg-gradient-to-r text-white rounded-2xl p-6 shadow-xl text-center",
                    fundBalance >= 3000 && "from-green-500 to-emerald-600",
                    fundBalance >= 1000 && fundBalance < 3000 && "from-yellow-500 to-amber-600",
                    fundBalance < 1000 && "from-red-500 to-rose-600"
                )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Wallet className="w-6 h-6" />
                        <span className="text-sm font-medium opacity-90">
                            {t('emergency_fund.balance')}
                        </span>
                    </div>
                    <div className="text-5xl font-black">${fundBalance.toLocaleString()}</div>
                </div>
            </div>

            {/* Event */}
            {event && feedback === 'none' && (
                <>
                    <div className="mb-6 bg-red-100 dark:bg-red-950/30 border-2 border-red-500 dark:border-red-700 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">
                                    {t('emergency_fund.emergency')} {currentEvent + 1}/{events.length}
                                </h3>
                                <p className="text-sm text-red-700 dark:text-red-300">
                                    {event.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        {event.options.map((option: any) => {
                            const canAfford = fundBalance >= (option.cost || 0);

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleDecision(option.id)}
                                    disabled={!canAfford}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                                        canAfford && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg",
                                        !canAfford && "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                            {option.text}
                                        </p>
                                        <span className={cn(
                                            "text-base font-black",
                                            canAfford ? "text-red-600 dark:text-red-400" : "text-slate-400"
                                        )}>
                                            ${option.cost?.toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        {option.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Result */}
            {feedback !== 'none' && (
                <div className="flex flex-col items-center">
                    <div className={cn(
                        "mb-6 p-6 rounded-2xl text-center w-full",
                        feedback === 'success' && "bg-green-100 dark:bg-green-950/30 border-2 border-green-500",
                        feedback === 'error' && "bg-red-100 dark:bg-red-950/30 border-2 border-red-500"
                    )}>
                        <p className={cn(
                            "font-bold text-lg mb-2",
                            feedback === 'success' ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                        )}>
                            {feedback === 'success' ? t('emergency_fund.survived') : t('emergency_fund.depleted')}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {feedback === 'success'
                                ? t('emergency_fund.success_message')
                                : t('emergency_fund.error_message')
                            }
                        </p>
                    </div>

                    <Button
                        onClick={handleContinue}
                        className={cn(
                            "relative overflow-hidden w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
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
