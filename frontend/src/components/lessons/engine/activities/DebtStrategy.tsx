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
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};
    const debts = content.debts;
    const monthlyPayment = content.monthlyPayment || 500;

    const options = content.options;
    const scenario = content.scenario || '';
    const instruction = content.instruction || '';

    const isLegacy = Array.isArray(debts) && debts.length > 0;
    const isMultipleChoice = !isLegacy && Array.isArray(options) && options.length > 0;

    useEffect(() => {
        setSelectedStrategy('snowball');
        setSelectedOptionId(null);
        setIsSimulating(false);
        setFeedback('none');
    }, [exercise]);

    /* ─────────────── Legacy simulator helpers ─────────────── */

    const simulateStrategy = (strategy: 'snowball' | 'avalanche') => {
        const sortedDebts = [...debts].sort((a: any, b: any) => {
            if (strategy === 'snowball') {
                return a.balance - b.balance;
            } else {
                return b.rate - a.rate;
            }
        });

        let totalMonths = 0;
        let totalInterest = 0;
        let remaining = [...sortedDebts];

        while (remaining.length > 0) {
            totalMonths++;
            let payment = monthlyPayment;

            remaining = remaining.map((debt: any) => {
                const minPayment = Math.min(debt.minPayment, debt.balance);
                payment -= minPayment;
                const interest = (debt.balance * debt.rate) / 1200;
                totalInterest += interest;
                return {
                    ...debt,
                    balance: debt.balance - minPayment + interest
                };
            });

            if (remaining.length > 0 && payment > 0) {
                const extraPayment = Math.min(payment, remaining[0].balance);
                remaining[0].balance -= extraPayment;
            }

            remaining = remaining.filter((d: any) => d.balance > 0.01);
        }

        return { months: totalMonths, interest: totalInterest };
    };

    const snowballResult = isLegacy ? simulateStrategy('snowball') : { months: 0, interest: 0 };
    const avalancheResult = isLegacy ? simulateStrategy('avalanche') : { months: 0, interest: 0 };

    /* ─────────────── Handlers ─────────────── */

    const handleSimulate = () => {
        setIsSimulating(true);
        playSound('ui_tap');

        setTimeout(() => {
            const isCorrect = onSubmit(selectedStrategy);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
    };

    const handleOptionSubmit = () => {
        if (!selectedOptionId) return;
        setIsSimulating(true);
        playSound('ui_tap');

        setTimeout(() => {
            const isCorrect = onSubmit(selectedOptionId);
            setFeedback(isCorrect ? 'success' : 'error');
            setIsSimulating(false);
        }, 800);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedStrategy('snowball');
            setSelectedOptionId(null);
            setIsSimulating(false);
            setFeedback('none');
            onRetry();
        }
    };

    /* ─────────────── Fallback ─────────────── */

    if (!isLegacy && !isMultipleChoice) {
        return (
            <div className={cn(
                "w-full max-w-2xl mx-auto p-8 text-center",
                "animate-in fade-in slide-in-from-bottom-4 duration-500"
            )}>
                <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl">
                    <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 mb-2">
                        {t('debt_strategy.fallback_title', { defaultValue: 'Ejercicio no disponible' })}
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        {t('debt_strategy.fallback_text', { defaultValue: 'El contenido de este ejercicio no tiene el formato esperado. Contacta al administrador.' })}
                    </p>
                </div>
                <Button
                    onClick={onNext}
                    className="mt-6 w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                >
                    {t('actions.continue', { defaultValue: 'Continuar' })}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            </div>
        );
    }

    /* ─────────────── Multiple Choice Mode ─────────────── */

    if (isMultipleChoice) {
        return (
            <div className={cn(
                "w-full max-w-3xl mx-auto",
                "animate-in fade-in slide-in-from-bottom-4 duration-500"
            )}>
                {/* Context Card */}
                <div className="mb-6 p-6 bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-500 dark:border-yellow-700 rounded-2xl shadow-sm">
                    {scenario && (
                        <p className="text-sm text-yellow-900 dark:text-yellow-100 mb-3 leading-relaxed">
                            {scenario}
                        </p>
                    )}
                    {instruction && (
                        <p className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                            {instruction}
                        </p>
                    )}
                </div>

                {/* Options */}
                <div className="mb-6 grid grid-cols-1 gap-3">
                    {options.map((opt: any) => {
                        const id = opt?.id ?? opt?.text ?? '';
                        const text = opt?.text ?? '';
                        const isSelected = selectedOptionId === id;

                        return (
                            <button
                                key={id}
                                onClick={() => {
                                    setSelectedOptionId(id);
                                    playSound('ui_tap');
                                }}
                                disabled={feedback !== 'none'}
                                className={cn(
                                    "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 font-medium text-sm",
                                    isSelected
                                        ? "bg-blue-50 dark:bg-blue-950 border-blue-500 dark:border-blue-400 shadow-md scale-[1.02]"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
                                )}
                            >
                                <span className={cn(
                                    "inline-flex items-center justify-center w-6 h-6 rounded-full border-2 mr-3 text-xs font-bold transition-colors",
                                    isSelected
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "border-slate-300 dark:border-slate-600 text-transparent"
                                )}>
                                    ✓
                                </span>
                                {text}
                            </button>
                        );
                    })}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center">
                    {feedback === 'none' ? (
                        <Button
                            onClick={handleOptionSubmit}
                            disabled={!selectedOptionId || isSimulating}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                            {isSimulating
                                ? t('debt_strategy.submitting', { defaultValue: 'Enviando...' })
                                : t('debt_strategy.submit', { defaultValue: 'Responder' })}
                        </Button>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <p className={cn(
                                "font-bold text-lg mb-3",
                                feedback === 'success' ? "text-green-500" : "text-red-500"
                            )}>
                                {feedback === 'success'
                                    ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                    : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                            </p>
                            <Button
                                onClick={handleContinue}
                                className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                            >
                                {feedback === 'success'
                                    ? t('actions.continue', { defaultValue: 'Continuar' })
                                    : t('actions.retry', { defaultValue: 'Reintentar' })}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ─────────────── Legacy Simulator Mode ─────────────── */

    return (
        <div className={cn(
            "w-full max-w-5xl",
            "animate-in fade-in slide-in-from-bottom-4 duration-500"
        )}>
            {/* Explanation Card */}
            <div className="mb-6 p-6 bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-500 dark:border-yellow-700 rounded-2xl shadow-sm">
                <h3 className="text-lg font-black text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                    {t('debt_strategy.intro_title', { defaultValue: 'Estrategia de Pago de Deudas' })}
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    {t('debt_strategy.intro_text', {
                        defaultValue: 'Tienes deudas por ${{debt}} y puedes pagar ${{payment}} al mes.',
                        debt: debts.reduce((sum: number, d: any) => sum + d.balance, 0).toLocaleString(),
                        payment: monthlyPayment
                    })}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
                        <div className="font-bold text-blue-900 dark:text-blue-100 mb-1">
                            ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                            {t('debt_strategy.snowball_desc', { defaultValue: 'Pagas la deuda más pequeña primero.' })}
                        </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/50 p-3 rounded-lg">
                        <div className="font-bold text-purple-900 dark:text-purple-100 mb-1">
                            🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                        </div>
                        <div className="text-purple-800 dark:text-purple-200">
                            {t('debt_strategy.avalanche_desc', { defaultValue: 'Pagas la deuda con mayor interés primero.' })}
                        </div>
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
                    ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
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
                    🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                </Button>
            </div>

            {/* Comparison View */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Snowball */}
                <div className={cn(
                    "p-6 rounded-2xl border transition-all shadow-sm",
                    selectedStrategy === 'snowball'
                        ? "bg-blue-100 dark:bg-blue-950 border-blue-500"
                        : "bg-card border-border shadow-sm"
                )}>
                    <h3 className="text-lg font-black text-blue-600 mb-4 flex items-center gap-2">
                        ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.months', { defaultValue: 'Meses' })}
                            </span>
                            <span className="font-bold">{snowballResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.interest', { defaultValue: 'Intereses' })}
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
                    "p-6 rounded-2xl border transition-all shadow-sm",
                    selectedStrategy === 'avalanche'
                        ? "bg-purple-100 dark:bg-purple-950 border-purple-500"
                        : "bg-card border-border shadow-sm"
                )}>
                    <h3 className="text-lg font-black text-purple-600 mb-4 flex items-center gap-2">
                        🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.months', { defaultValue: 'Meses' })}
                            </span>
                            <span className="font-bold">{avalancheResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {t('debt_strategy.interest', { defaultValue: 'Intereses' })}
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
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                        {isSimulating
                            ? t('debt_strategy.simulating', { defaultValue: 'Simulando...' })
                            : t('debt_strategy.simulate', { defaultValue: 'Simular Estrategia' })}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn(
                            "font-bold text-lg mb-3",
                            feedback === 'success' ? "text-green-500" : "text-red-500"
                        )}>
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl max-w-2xl">
                            <p className="text-sm text-green-900 dark:text-green-100 text-center mb-2">
                                <strong>{t('debt_strategy.result_title', { defaultValue: 'Resultado' })}</strong>
                            </p>
                            {avalancheResult.interest < snowballResult.interest ? (
                                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                                    {t('debt_strategy.result_avalanche_win', {
                                        defaultValue: 'La Avalancha ahorra ${{savings}} en intereses.',
                                        savings: (snowballResult.interest - avalancheResult.interest).toFixed(0)
                                    })}
                                </p>
                            ) : (
                                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                                    {t('debt_strategy.result_tie', { defaultValue: 'Ambas estrategias cuestan lo mismo en intereses.' })}
                                </p>
                            )}
                        </div>
                        <Button
                            onClick={handleContinue}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        >
                            {t('actions.continue', { defaultValue: 'Continuar' })}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
