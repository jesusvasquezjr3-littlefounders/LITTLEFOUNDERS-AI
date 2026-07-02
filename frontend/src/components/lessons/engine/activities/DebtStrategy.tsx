import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

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
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const content = exercise?.content || {};
    const debts = content.debts;
    const monthlyPayment = content.monthlyPayment || 500;

    const scenario = content.scenario || '';
    const instruction = content.instruction || '';

    const isLegacy = Array.isArray(debts) && debts.length > 0;
    // Real lessons also store the choices under strategyA/strategyB, choices, etc.
    const options = isLegacy ? [] : resolveOptions(content, ['options']);
    const isMultipleChoice = !isLegacy && options.length > 0;

    useEffect(() => {
        setSelectedStrategy('snowball');
        setSelectedOptionId(null);
        setIsSimulating(false);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    /* ─────────────── Legacy simulator helpers ─────────────── */

    const simulateStrategy = useMemo(() => {
        if (!isLegacy) return null;
        return (strategy: 'snowball' | 'avalanche') => {
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
            // Safety cap to prevent infinite loops if payment doesn't cover interest
            const MAX_MONTHS = 1200;

            while (remaining.length > 0 && totalMonths < MAX_MONTHS) {
                totalMonths++;
                let payment = monthlyPayment;

                remaining = remaining.map((debt: any) => {
                    const minPayment = Math.min(debt.minPayment || 0, debt.balance);
                    payment -= minPayment;
                    const interest = (debt.balance * (debt.rate || 0)) / 1200;
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
    }, [debts, monthlyPayment, isLegacy]);

    const snowballResult = simulateStrategy ? simulateStrategy('snowball') : { months: 0, interest: 0 };
    const avalancheResult = simulateStrategy ? simulateStrategy('avalanche') : { months: 0, interest: 0 };

    /* ─────────────── Handlers ─────────────── */

    const handleSimulate = () => {
        setIsSimulating(true);
        playSound('ui_tap');

        timeoutRef.current = setTimeout(() => {
            const isCorrect = onSubmit(selectedStrategy);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
    };

    const handleOptionSubmit = () => {
        if (!selectedOptionId) return;
        setIsSimulating(true);
        playSound('ui_tap');

        timeoutRef.current = setTimeout(() => {
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
                "w-full max-w-2xl mx-auto p-6 sm:p-8 text-center",
                "animate-in fade-in slide-in-from-bottom-4 duration-500"
            )}>
                <div className="bg-white rounded-[2.5rem] shadow-sm p-6">
                    <h3 className="lp-display text-lg mb-2" style={{ color: "var(--lp-ink)" }}>
                        {t('debt_strategy.fallback_title', { defaultValue: 'Ejercicio no disponible' })}
                    </h3>
                    <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
                        {t('debt_strategy.fallback_text', { defaultValue: 'El contenido de este ejercicio no tiene el formato esperado. Contacta al administrador.' })}
                    </p>
                </div>
                <QuestButton variant="go" onClick={onNext} className="mt-6 max-w-md mx-auto">
                    {t('actions.continue', { defaultValue: 'Continuar' })}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </QuestButton>
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
                <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-6">
                    {scenario && (
                        <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--lp-ink)" }}>
                            {scenario}
                        </p>
                    )}
                    {instruction && (
                        <p className="lp-display text-sm" style={{ color: "var(--lp-ink)" }}>
                            {instruction}
                        </p>
                    )}
                </div>

                {/* Options */}
                <div className="mb-6 grid grid-cols-1 gap-3">
                    {options.map((opt: any, index: number) => {
                        const id = opt?.id ?? opt?.text ?? '';
                        const text = opt?.text ?? '';
                        const isSelected = selectedOptionId === id;
                        const optState: OptionState = isSelected ? 'selected' : 'idle';

                        return (
                            <OptionCard
                                key={id}
                                index={index}
                                text={text}
                                state={optState}
                                onClick={() => {
                                    setSelectedOptionId(id);
                                    playSound('ui_tap');
                                }}
                                disabled={feedback !== 'none'}
                            />
                        );
                    })}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center">
                    {feedback === 'none' ? (
                        <QuestButton
                            variant="gold"
                            onClick={handleOptionSubmit}
                            disabled={!selectedOptionId || isSimulating}
                            className="max-w-md mx-auto"
                        >
                            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                            {isSimulating
                                ? t('debt_strategy.submitting', { defaultValue: 'Enviando...' })
                                : t('debt_strategy.submit', { defaultValue: 'Responder' })}
                        </QuestButton>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <p className="lp-display text-lg mb-3" style={{ color: feedback === 'success' ? "var(--lp-emerald)" : "var(--lp-coral)" }}>
                                {feedback === 'success'
                                    ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                    : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                            </p>
                            <QuestButton
                                variant={feedback === 'success' ? 'go' : 'retry'}
                                onClick={handleContinue}
                                className="max-w-md mx-auto"
                            >
                                {feedback === 'success'
                                    ? t('actions.continue', { defaultValue: 'Continuar' })
                                    : t('actions.retry', { defaultValue: 'Reintentar' })}
                                {feedback === 'success'
                                    ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                    : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </QuestButton>
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
            <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-6">
                <h3 className="lp-display text-lg mb-2 flex items-center gap-2" style={{ color: "var(--lp-ink)" }}>
                    {t('debt_strategy.intro_title', { defaultValue: 'Estrategia de Pago de Deudas' })}
                </h3>
                <p className="text-sm mb-3" style={{ color: "var(--lp-muted)" }}>
                    {t('debt_strategy.intro_text', {
                        defaultValue: 'Tienes deudas por ${{debt}} y puedes pagar ${{payment}} al mes.',
                        debt: debts.reduce((sum: number, d: any) => sum + d.balance, 0).toLocaleString(),
                        payment: monthlyPayment
                    })}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-[16px]" style={{ background: "var(--lp-indigo-soft)" }}>
                        <div className="lp-display mb-1" style={{ color: "var(--lp-indigo-ink)" }}>
                            ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
                        </div>
                        <div style={{ color: "var(--lp-ink)" }}>
                            {t('debt_strategy.snowball_desc', { defaultValue: 'Pagas la deuda más pequeña primero.' })}
                        </div>
                    </div>
                    <div className="p-3 rounded-[16px]" style={{ background: "var(--lp-emerald-soft)" }}>
                        <div className="lp-display mb-1" style={{ color: "var(--lp-emerald-ink)" }}>
                            🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                        </div>
                        <div style={{ color: "var(--lp-ink)" }}>
                            {t('debt_strategy.avalanche_desc', { defaultValue: 'Pagas la deuda con mayor interés primero.' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategy Selector */}
            <div className="mb-6 flex flex-col sm:flex-row justify-center gap-3">
                <button
                    type="button"
                    onClick={() => {
                        setSelectedStrategy('snowball');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "lp-token lp-option lp-option--indigo lp-display px-6 py-3 text-base",
                        selectedStrategy === 'snowball' && "is-selected"
                    )}
                    style={{ color: "var(--lp-ink)" }}
                >
                    ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setSelectedStrategy('avalanche');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "lp-token lp-option lp-option--emerald lp-display px-6 py-3 text-base",
                        selectedStrategy === 'avalanche' && "is-selected"
                    )}
                    style={{ color: "var(--lp-ink)" }}
                >
                    🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                </button>
            </div>

            {/* Comparison View */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Snowball */}
                <div
                    className="bg-white rounded-[2.5rem] shadow-sm p-6 transition-all"
                    style={selectedStrategy === 'snowball'
                        ? { background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }
                        : undefined}
                >
                    <h3 className="lp-display text-lg mb-4 flex items-center gap-2" style={{ color: "var(--lp-indigo-ink)" }}>
                        ❄️ {t('debt_strategy.snowball', { defaultValue: 'Bola de Nieve' })}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm" style={{ color: "var(--lp-muted)" }}>
                                {t('debt_strategy.months', { defaultValue: 'Meses' })}
                            </span>
                            <span className="lp-display" style={{ color: "var(--lp-ink)" }}>{snowballResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm" style={{ color: "var(--lp-muted)" }}>
                                {t('debt_strategy.interest', { defaultValue: 'Intereses' })}
                            </span>
                            <span className="lp-display" style={{ color: "var(--lp-coral)" }}>
                                ${snowballResult.interest.toFixed(0)}
                            </span>
                        </div>
                    </div>
                    <div className={cn(
                        "lp-track mt-4 h-2",
                        isSimulating && selectedStrategy === 'snowball' && "animate-pulse"
                    )}>
                        <div
                            className="h-full transition-all duration-2000"
                            style={{ width: isSimulating && selectedStrategy === 'snowball' ? '100%' : '0%', background: "var(--lp-indigo)" }}
                        ></div>
                    </div>
                </div>

                {/* Avalanche */}
                <div
                    className="bg-white rounded-[2.5rem] shadow-sm p-6 transition-all"
                    style={selectedStrategy === 'avalanche'
                        ? { background: "var(--lp-emerald-soft)", borderColor: "var(--lp-emerald)" }
                        : undefined}
                >
                    <h3 className="lp-display text-lg mb-4 flex items-center gap-2" style={{ color: "var(--lp-emerald-ink)" }}>
                        🏔️ {t('debt_strategy.avalanche', { defaultValue: 'Avalancha' })}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm" style={{ color: "var(--lp-muted)" }}>
                                {t('debt_strategy.months', { defaultValue: 'Meses' })}
                            </span>
                            <span className="lp-display" style={{ color: "var(--lp-ink)" }}>{avalancheResult.months}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm" style={{ color: "var(--lp-muted)" }}>
                                {t('debt_strategy.interest', { defaultValue: 'Intereses' })}
                            </span>
                            <span className="lp-display" style={{ color: "var(--lp-coral)" }}>
                                ${avalancheResult.interest.toFixed(0)}
                            </span>
                        </div>
                    </div>
                    <div className={cn(
                        "lp-track mt-4 h-2",
                        isSimulating && selectedStrategy === 'avalanche' && "animate-pulse"
                    )}>
                        <div
                            className="h-full transition-all duration-2000"
                            style={{ width: isSimulating && selectedStrategy === 'avalanche' ? '100%' : '0%', background: "var(--lp-emerald)" }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton
                        variant="gold"
                        onClick={handleSimulate}
                        disabled={isSimulating}
                        className="max-w-md mx-auto"
                    >
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                        {isSimulating
                            ? t('debt_strategy.simulating', { defaultValue: 'Simulando...' })
                            : t('debt_strategy.simulate', { defaultValue: 'Simular Estrategia' })}
                    </QuestButton>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className="lp-display text-lg mb-3" style={{ color: feedback === 'success' ? "var(--lp-emerald)" : "var(--lp-coral)" }}>
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div className="mb-4 p-4 rounded-[16px] max-w-2xl" style={{ background: "var(--lp-emerald-soft)", border: "2px solid var(--lp-emerald)" }}>
                            <p className="lp-display text-sm text-center mb-2" style={{ color: "var(--lp-emerald-ink)" }}>
                                {t('debt_strategy.result_title', { defaultValue: 'Resultado' })}
                            </p>
                            {avalancheResult.interest < snowballResult.interest ? (
                                <p className="text-sm text-center" style={{ color: "var(--lp-ink)" }}>
                                    {t('debt_strategy.result_avalanche_win', {
                                        defaultValue: 'La Avalancha ahorra ${{savings}} en intereses.',
                                        savings: (snowballResult.interest - avalancheResult.interest).toFixed(0)
                                    })}
                                </p>
                            ) : (
                                <p className="text-sm text-center" style={{ color: "var(--lp-ink)" }}>
                                    {t('debt_strategy.result_tie', { defaultValue: 'Ambas estrategias cuestan lo mismo en intereses.' })}
                                </p>
                            )}
                        </div>
                        <QuestButton
                            variant="go"
                            onClick={handleContinue}
                            className="max-w-md mx-auto"
                        >
                            {t('actions.continue', { defaultValue: 'Continuar' })}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
