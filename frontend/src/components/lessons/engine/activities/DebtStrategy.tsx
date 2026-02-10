import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface DebtStrategyProps {
    exercise: any;
    onSubmit: (strategy: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const DebtStrategy = ({ exercise, onSubmit, onNext, onRetry }: DebtStrategyProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedStrategy, setSelectedStrategy] = useState<'snowball' | 'avalanche'>('snowball');
    const [isSimulating, setIsSimulating] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const debts = exercise.content.debts || [];
    const monthlyPayment = exercise.content.monthlyPayment || 500;

    useEffect(() => {
        setSelectedStrategy('snowball');
        setIsSimulating(false);
        setFeedback('none');
    }, [exercise]);

    const simulateStrategy = (strategy: 'snowball' | 'avalanche') => {
        const sortedDebts = [...debts].sort((a, b) => {
            if (strategy === 'snowball') {
                return a.balance - b.balance; // Smallest first
            } else {
                return b.rate - a.rate; // Highest rate first
            }
        });

        let totalMonths = 0;
        let totalInterest = 0;
        let remaining = [...sortedDebts];

        while (remaining.length > 0) {
            totalMonths++;
            let payment = monthlyPayment;

            // Pay minimums on all debts
            remaining = remaining.map(debt => {
                const minPayment = Math.min(debt.minPayment, debt.balance);
                payment -= minPayment;
                const interest = (debt.balance * debt.rate) / 1200;
                totalInterest += interest;
                return {
                    ...debt,
                    balance: debt.balance - minPayment + interest
                };
            });

            // Apply extra payment to first debt
            if (remaining.length > 0 && payment > 0) {
                const extraPayment = Math.min(payment, remaining[0].balance);
                remaining[0].balance -= extraPayment;
            }

            // Remove paid-off debts
            remaining = remaining.filter(d => d.balance > 0.01);
        }

        return { months: totalMonths, interest: totalInterest };
    };

    const snowballResult = simulateStrategy('snowball');
    const avalancheResult = simulateStrategy('avalanche');

    const handleSimulate = () => {
        setIsSimulating(true);
        playSound('ui_tap');

        setTimeout(() => {
            const isCorrect = onSubmit(selectedStrategy);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
    };

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Explanation Card */}
            {/* Explanation Card */}
            <div className="mb-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-950/30 dark:to-orange-950/30 border-2 border-yellow-500 dark:border-yellow-700 rounded-2xl">
                <h3 className="text-lg font-black text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                    {t('debt_strategy.intro_title')}
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    {t('debt_strategy.intro_text', {
                        debt: debts.reduce((sum: number, d: any) => sum + d.balance, 0).toLocaleString(),
                        payment: monthlyPayment
                    })}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
                        <div className="font-bold text-blue-900 dark:text-blue-100 mb-1">❄️ {t('debt_strategy.snowball')}</div>
                        <div className="text-blue-800 dark:text-blue-200">{t('debt_strategy.snowball_desc')}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/50 p-3 rounded-lg">
                        <div className="font-bold text-purple-900 dark:text-purple-100 mb-1">🏔️ {t('debt_strategy.avalanche')}</div>
                        <div className="text-purple-800 dark:text-purple-200">{t('debt_strategy.avalanche_desc')}</div>
                    </div>
                </div>
            </div>

            {/* Strategy Selector */}
            <div className="mb-6 flex justify-center gap-3">
                <Button
                    onClick={() => {
                        setSelectedStrategy('snowball');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold transition-all",
                        selectedStrategy === 'snowball'
                            ? "bg-blue-600 text-white shadow-lg scale-105"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                >
                    ❄️ {t('debt_strategy.snowball')}
                </Button>
                <Button
                    onClick={() => {
                        setSelectedStrategy('avalanche');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold transition-all",
                        selectedStrategy === 'avalanche'
                            ? "bg-purple-600 text-white shadow-lg scale-105"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                >
                    🏔️ {t('debt_strategy.avalanche')}
                </Button>
            </div>

            {/* Comparison View */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Snowball */}
                <div className={cn(
                    "p-6 rounded-2xl border-2 transition-all",
                    selectedStrategy === 'snowball'
                        ? "bg-blue-100 dark:bg-blue-950 border-blue-500"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                )}>
                    <h3 className="text-lg font-black text-blue-600 mb-4 flex items-center gap-2">
                        ❄️ {t('debt_strategy.snowball')}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.months')}
                            </span>
                            <span className="font-bold">{snowballResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.interest')}
                            </span>
                            <span className="font-bold text-red-600">
                                ${snowballResult.interest.toFixed(0)}
                            </span>
                        </div>
                    </div>
                    <div className={cn(
                        "mt-4 h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden",
                        isSimulating && selectedStrategy === 'snowball' && "animate-pulse"
                    )}>
                        <div
                            className="h-full bg-blue-600 transition-all duration-2000"
                            style={{ width: isSimulating && selectedStrategy === 'snowball' ? '100%' : '0%' }}
                        ></div>
                    </div>
                </div>

                {/* Avalanche */}
                <div className={cn(
                    "p-6 rounded-2xl border-2 transition-all",
                    selectedStrategy === 'avalanche'
                        ? "bg-purple-100 dark:bg-purple-950 border-purple-500"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                )}>
                    <h3 className="text-lg font-black text-purple-600 mb-4 flex items-center gap-2">
                        🏔️ {t('debt_strategy.avalanche')}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.months')}
                            </span>
                            <span className="font-bold">{avalancheResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.interest')}
                            </span>
                            <span className="font-bold text-red-600">
                                ${avalancheResult.interest.toFixed(0)}
                            </span>
                        </div>
                    </div>
                    <div className={cn(
                        "mt-4 h-2 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden",
                        isSimulating && selectedStrategy === 'avalanche' && "animate-pulse"
                    )}>
                        <div
                            className="h-full bg-purple-600 transition-all duration-2000"
                            style={{ width: isSimulating && selectedStrategy === 'avalanche' ? '100%' : '0%' }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSimulate}
                        disabled={isSimulating}
                        className="w-full max-w-md h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <TrendingDown className="w-5 h-5 mr-2" />
                        {isSimulating ? t('debt_strategy.simulating') : t('debt_strategy.simulate')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl max-w-2xl">
                            <p className="text-sm text-green-900 dark:text-green-100 text-center mb-2">
                                <strong>{t('debt_strategy.result_title')}</strong>
                            </p>
                            {avalancheResult.interest < snowballResult.interest ? (
                                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                                    {t('debt_strategy.result_avalanche_win', { savings: (snowballResult.interest - avalancheResult.interest).toFixed(0) })}
                                </p>
                            ) : (
                                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                                    {t('debt_strategy.result_tie')}
                                </p>
                            )}
                        </div>
                        <Button
                            onClick={onNext}
                            className="w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            {t('actions.continue')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
