import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, Minus, Gift, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface MysteryInvestmentProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MysteryInvestment = ({ exercise, onSubmit, onNext, onRetry }: MysteryInvestmentProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    // Clamp totalCoins to max 15 to prevent 100-click exhaustion UX
    const rawCoins = exercise.content.totalCoins;
    const totalCoins = Math.min(Math.max(typeof rawCoins === 'number' && !isNaN(rawCoins) ? rawCoins : 10, 1), 15);
    const boxes = exercise.content.boxes || [];

    const [allocation, setAllocation] = useState<Record<string, number>>({});
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Initialize allocation
        const initial: Record<string, number> = {};
        boxes.forEach((box: any) => {
            initial[box.id] = 0;
        });
        setAllocation(initial);
        setShowResults(false);
        setResults({});
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const allocatedCoins = Object.values(allocation).reduce((sum, val) => sum + (val || 0), 0);
    const remainingCoins = totalCoins - allocatedCoins;

    // Helper functions to get safe min & max returns for each box
    const getMinReturn = (box: any): number => {
        if (typeof box.minReturn === 'number' && !isNaN(box.minReturn)) return box.minReturn;
        if (box.risk === 'low' || box.type === 'safe') return 1.1;
        if (box.risk === 'medium' || box.type === 'shared') return 0.8;
        if (box.risk === 'high' || box.type === 'risky') return 0.2;
        return 1.0;
    };

    const getMaxReturn = (box: any): number => {
        if (typeof box.maxReturn === 'number' && !isNaN(box.maxReturn)) return box.maxReturn;
        if (box.risk === 'low' || box.type === 'safe') return 1.3;
        if (box.risk === 'medium' || box.type === 'shared') return 1.8;
        if (box.risk === 'high' || box.type === 'risky') return 3.0;
        return 2.0;
    };

    const addCoin = (boxId: string, count: number = 1) => {
        if (remainingCoins <= 0 || feedback !== 'none') return;
        playSound('ui_tap');
        const toAdd = Math.min(count, remainingCoins);
        setAllocation(prev => ({
            ...prev,
            [boxId]: (prev[boxId] || 0) + toAdd
        }));
    };

    const removeCoin = (boxId: string) => {
        if ((allocation[boxId] || 0) <= 0 || feedback !== 'none') return;
        playSound('ui_tap');
        setAllocation(prev => ({
            ...prev,
            [boxId]: Math.max(0, (prev[boxId] || 0) - 1)
        }));
    };

    const handleInvest = () => {
        if (allocatedCoins === 0) return;

        // Simulate returns safely without NaN
        const newResults: Record<string, number> = {};
        boxes.forEach((box: any) => {
            const invested = allocation[box.id] || 0;
            if (invested > 0) {
                const minR = getMinReturn(box);
                const maxR = getMaxReturn(box);
                const returnMultiplier = minR + Math.random() * (maxR - minR);
                const calculated = Math.floor(invested * returnMultiplier);
                newResults[box.id] = isNaN(calculated) ? invested : calculated;
            } else {
                newResults[box.id] = 0;
            }
        });

        setResults(newResults);
        setShowResults(true);

        timeoutRef.current = setTimeout(() => {
            const isCorrect = onSubmit(allocation);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 1500);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            const initial: Record<string, number> = {};
            boxes.forEach((box: any) => {
                initial[box.id] = 0;
            });
            setAllocation(initial);
            setShowResults(false);
            setResults({});
            setFeedback('none');
            onRetry();
        }
    };

    const totalReturnRaw = Object.values(results).reduce((sum, val) => sum + (val || 0), 0);
    const totalReturn = isNaN(totalReturnRaw) ? allocatedCoins : totalReturnRaw;

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">

            {/* Coin Bank */}
            <div className="mb-6 flex justify-center">
                <div
                    className="bg-white rounded-[2rem] shadow-sm px-6 py-4 border text-center"
                    style={{ background: 'var(--lp-amber-soft)', borderColor: 'var(--lp-amber)' }}
                >
                    <div style={{ color: 'var(--lp-amber-ink)' }}>
                        <span className="lp-display text-xs block mb-1 opacity-90 uppercase tracking-wider">
                            {t('mystery_investment.your_coins', { defaultValue: 'Tus Monedas Disponibles' })}
                        </span>
                        <div className="lp-display text-4xl sm:text-5xl flex items-center justify-center gap-2">
                            <span>🪙</span>
                            <span>{remainingCoins}</span>
                        </div>
                        <span className="text-xs opacity-80 font-medium">
                            {t('mystery_investment.remaining', { defaultValue: 'Restantes por asignar' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Investment Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {boxes.map((box: any) => {
                    const invested = allocation[box.id] || 0;
                    const returned = results[box.id] || 0;
                    const canAdd = remainingCoins > 0;
                    const canRemove = invested > 0;
                    const minR = getMinReturn(box);
                    const maxR = getMaxReturn(box);

                    return (
                        <div
                            key={box.id}
                            className="bg-white rounded-[2rem] shadow-sm p-5 transition-all duration-300 border flex flex-col justify-between"
                            style={{
                                borderColor: showResults
                                    ? 'var(--lp-emerald)'
                                    : invested > 0
                                        ? 'var(--lp-indigo)'
                                        : 'var(--lp-line)',
                                boxShadow: invested > 0 && !showResults
                                    ? '0 0 0 3px var(--lp-indigo-soft), var(--lp-shadow)'
                                    : undefined,
                            }}
                        >
                            {/* Box Header */}
                            <div className="text-center mb-3">
                                <div className="text-4xl sm:text-5xl mb-2">
                                    {box.type === 'safe' || box.risk === 'low' ? '🔒' : ''}
                                    {box.type === 'risky' || box.risk === 'high' ? '🎲' : ''}
                                    {box.type === 'shared' || box.risk === 'medium' ? '⚖️' : ''}
                                    {!['safe', 'risky', 'shared', 'low', 'medium', 'high'].includes(box.type || box.risk) && '🎁'}
                                </div>
                                <h3 className="lp-display text-base font-bold mb-1" style={{ color: 'var(--lp-ink)' }}>
                                    {box.name || t('mystery_investment.box', { defaultValue: 'Caja Inversión' })}
                                </h3>
                                {box.description && (
                                    <p className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                        {box.description}
                                    </p>
                                )}
                            </div>

                            {/* Return Range */}
                            <div
                                className="rounded-xl p-2.5 mb-3 text-center border border-slate-100 dark:border-white/5"
                                style={{ background: 'color-mix(in srgb, var(--lp-ink) 4%, transparent)' }}
                            >
                                <span className="text-[11px] font-bold block mb-0.5 uppercase tracking-wider" style={{ color: 'var(--lp-muted)' }}>
                                    {t('mystery_investment.return_range', { defaultValue: 'Rendimiento Esperado' })}
                                </span>
                                <span className="lp-display text-sm font-semibold" style={{ color: 'var(--lp-ink)' }}>
                                    {minR}x - {maxR}x
                                </span>
                            </div>

                            {/* Allocation Controls */}
                            {!showResults && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => removeCoin(box.id)}
                                            disabled={!canRemove}
                                            aria-label={t('mystery_investment.remove_coin', { defaultValue: 'Quitar moneda' })}
                                            className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:translate-y-[2px]"
                                            style={{ background: 'var(--lp-coral)', boxShadow: '0 3px 0 var(--lp-coral-lip)' }}
                                        >
                                            <Minus className="w-4 h-4" strokeWidth={3} />
                                        </button>
                                        <div
                                            className="lp-display w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
                                            style={{ background: 'var(--lp-indigo-soft)', color: 'var(--lp-indigo-ink)', border: '2px solid var(--lp-indigo)' }}
                                        >
                                            {invested}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addCoin(box.id, 1)}
                                            disabled={!canAdd}
                                            aria-label={t('mystery_investment.add_coin', { defaultValue: 'Agregar moneda' })}
                                            className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:translate-y-[2px]"
                                            style={{ background: 'var(--lp-emerald)', boxShadow: '0 3px 0 var(--lp-emerald-lip)' }}
                                        >
                                            <Plus className="w-4 h-4" strokeWidth={3} />
                                        </button>
                                    </div>
                                    {/* Quick Fill All Button if remainingCoins > 1 */}
                                    {remainingCoins > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => addCoin(box.id, remainingCoins)}
                                            className="w-full text-[11px] font-semibold py-1 px-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Zap className="w-3 h-3" />
                                            {t('mystery_investment.assign_all', { defaultValue: 'Asignar restantes' })}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Results */}
                            {showResults && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div
                                        className="rounded-2xl p-3 border"
                                        style={{ background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                {t('mystery_investment.invested', { defaultValue: 'Invertido' })}
                                            </span>
                                            <span className="lp-display text-sm font-semibold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                🪙 {invested}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                {t('mystery_investment.returned', { defaultValue: 'Retorno' })}
                                            </span>
                                            <span className="lp-display text-base font-bold flex items-center gap-1" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                <Sparkles className="w-4 h-4 text-emerald-600" />
                                                🪙 {returned}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Total Results */}
            {showResults && (
                <div className="mb-6 text-center animate-in fade-in zoom-in duration-700">
                    <div
                        className="inline-flex flex-col items-center rounded-3xl px-8 py-5 border"
                        style={{ background: 'var(--lp-amber)', borderColor: 'var(--lp-amber-lip)', color: '#3a2606', boxShadow: '0 4px 0 var(--lp-amber-lip), var(--lp-shadow)' }}
                    >
                        <span className="lp-display text-xs uppercase tracking-wider opacity-90 mb-1 font-bold">
                            {t('mystery_investment.total_return', { defaultValue: 'Retorno Total' })}
                        </span>
                        <div className="lp-display text-4xl sm:text-5xl flex items-center gap-2 font-bold">
                            <span>🪙</span>
                            <span>{totalReturn}</span>
                        </div>
                        <span className="text-xs opacity-90 mt-1 font-bold">
                            {totalReturn >= allocatedCoins ? t('mystery_investment.gain_made', { defaultValue: '¡Ganancia Obtenida!' }) : t('mystery_investment.had_loss', { defaultValue: 'Tuviste Pérdida' })}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {!showResults ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={allocatedCoins === 0} onClick={handleInvest}>
                            <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                            {t('mystery_investment.invest', { defaultValue: 'INVERTIR' })}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-base sm:text-lg mb-3"
                            style={{ color: feedback === 'success' ? (totalReturn >= totalCoins ? 'var(--lp-emerald-ink)' : 'var(--lp-amber-ink)') : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? (totalReturn >= totalCoins ? t('mystery_investment.great_investment', { defaultValue: '¡Excelente Inversión!' }) : t('mystery_investment.investment_done', { defaultValue: 'Inversión Completada' })) : t('mystery_investment.try_again', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={totalReturn >= totalCoins ? 'go' : 'gold'} onClick={handleContinue}>
                                {t('actions.continue', { defaultValue: 'Continuar' })}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
