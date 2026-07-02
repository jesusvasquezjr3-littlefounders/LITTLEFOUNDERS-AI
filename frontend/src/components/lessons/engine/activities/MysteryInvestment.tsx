import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, Minus, Gift, Sparkles } from 'lucide-react';
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

    const totalCoins = exercise.content.totalCoins || 10;
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

    const allocatedCoins = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    const remainingCoins = totalCoins - allocatedCoins;

    const addCoin = (boxId: string) => {
        if (remainingCoins <= 0 || feedback !== 'none') return;
        playSound('ui_tap');
        setAllocation(prev => ({
            ...prev,
            [boxId]: (prev[boxId] || 0) + 1
        }));
    };

    const removeCoin = (boxId: string) => {
        if (allocation[boxId] <= 0 || feedback !== 'none') return;
        playSound('ui_tap');
        setAllocation(prev => ({
            ...prev,
            [boxId]: Math.max(0, (prev[boxId] || 0) - 1)
        }));
    };

    const handleInvest = () => {
        if (allocatedCoins === 0) return;

        // Simulate returns
        const newResults: Record<string, number> = {};
        boxes.forEach((box: any) => {
            const invested = allocation[box.id] || 0;
            if (invested > 0) {
                // Random return within min/max range
                const returnMultiplier = box.minReturn + Math.random() * (box.maxReturn - box.minReturn);
                newResults[box.id] = Math.floor(invested * returnMultiplier);
            }
        });

        setResults(newResults);
        setShowResults(true);

        timeoutRef.current = setTimeout(() => {
            const isCorrect = onSubmit(allocation);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
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

    const totalReturn = Object.values(results).reduce((sum, val) => sum + val, 0);

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">

            {/* Coin Bank */}
            <div className="mb-8 flex justify-center">
                <div
                    className="bg-white rounded-[2.5rem] shadow-sm rounded-3xl px-8 py-6"
                    style={{ background: 'var(--lp-amber-soft)', borderColor: 'var(--lp-amber)' }}
                >
                    <div className="text-center" style={{ color: 'var(--lp-amber-ink)' }}>
                        <span className="lp-display text-sm block mb-1 opacity-90">
                            {t('mystery_investment.your_coins')}
                        </span>
                        <div className="lp-display text-5xl sm:text-6xl flex items-center justify-center gap-2">
                            <span>🪙</span>
                            <span>{remainingCoins}</span>
                        </div>
                        <span className="text-xs opacity-80">
                            {t('mystery_investment.remaining')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Investment Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {boxes.map((box: any) => {
                    const invested = allocation[box.id] || 0;
                    const returned = results[box.id] || 0;
                    const canAdd = remainingCoins > 0;
                    const canRemove = invested > 0;

                    return (
                        <div
                            key={box.id}
                            className="bg-white rounded-[2.5rem] shadow-sm p-4 rounded-3xl transition-all duration-300"
                            style={{
                                borderColor: showResults
                                    ? 'var(--lp-emerald)'
                                    : invested > 0
                                        ? 'var(--lp-indigo)'
                                        : 'var(--lp-line)',
                                boxShadow: invested > 0 && !showResults
                                    ? '0 0 0 4px var(--lp-indigo-soft), var(--lp-shadow)'
                                    : undefined,
                            }}
                        >
                            {/* Box Header */}
                            <div className="text-center mb-3">
                                <div className="text-5xl sm:text-6xl mb-2">
                                    {box.type === 'safe' && '🏆'}
                                    {box.type === 'risky' && '🎲'}
                                    {box.type === 'shared' && '🤝'}
                                </div>
                                <h3 className="lp-display text-base mb-1" style={{ color: 'var(--lp-ink)' }}>
                                    {box.name}
                                </h3>
                                <p className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                    {box.description}
                                </p>
                            </div>

                            {/* Return Range */}
                            <div
                                className="rounded-lg p-2 mb-3 text-center"
                                style={{ background: 'var(--lp-bg-2)' }}
                            >
                                <span className="text-xs font-bold block mb-1" style={{ color: 'var(--lp-muted)' }}>
                                    {t('mystery_investment.return_range')}
                                </span>
                                <span className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                                    {box.minReturn}x - {box.maxReturn}x
                                </span>
                            </div>

                            {/* Allocation Controls */}
                            {!showResults && (
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <button
                                        onClick={() => removeCoin(box.id)}
                                        disabled={!canRemove}
                                        className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:translate-y-[2px]"
                                        style={{ background: 'var(--lp-coral)', boxShadow: '0 3px 0 var(--lp-coral-lip)' }}
                                    >
                                        <Minus className="w-4 h-4" strokeWidth={3} />
                                    </button>
                                    <div
                                        className="lp-display w-12 h-12 rounded-full flex items-center justify-center text-xl"
                                        style={{ background: 'var(--lp-indigo-soft)', color: 'var(--lp-indigo-ink)', border: '2px solid var(--lp-indigo)' }}
                                    >
                                        {invested}
                                    </div>
                                    <button
                                        onClick={() => addCoin(box.id)}
                                        disabled={!canAdd}
                                        className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:translate-y-[2px]"
                                        style={{ background: 'var(--lp-emerald)', boxShadow: '0 3px 0 var(--lp-emerald-lip)' }}
                                    >
                                        <Plus className="w-4 h-4" strokeWidth={3} />
                                    </button>
                                </div>
                            )}

                            {/* Results */}
                            {showResults && invested > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div
                                        className="rounded-full p-3"
                                        style={{ background: 'var(--lp-emerald-soft)', border: '2px solid var(--lp-emerald)' }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                {t('mystery_investment.invested')}
                                            </span>
                                            <span className="lp-display text-base" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                🪙 {invested}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                {t('mystery_investment.returned')}
                                            </span>
                                            <span className="lp-display text-xl flex items-center gap-1" style={{ color: 'var(--lp-emerald-ink)' }}>
                                                <Sparkles className="w-4 h-4" />
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
                        className="inline-flex flex-col items-center rounded-full px-8 py-6"
                        style={{ background: 'var(--lp-amber)', border: '2px solid var(--lp-amber-lip)', color: '#3a2606', boxShadow: '0 6px 0 var(--lp-amber-lip), var(--lp-shadow)' }}
                    >
                        <span className="lp-display text-base opacity-90 mb-1">
                            {t('mystery_investment.total_return')}
                        </span>
                        <div className="lp-display text-5xl sm:text-6xl flex items-center gap-2">
                            <span>🪙</span>
                            <span>{totalReturn}</span>
                        </div>
                        <span className="text-xs opacity-80 mt-1 font-bold">
                            {totalReturn > allocatedCoins ? t('mystery_investment.profit') : t('mystery_investment.loss')}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {!showResults ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={remainingCoins > 0} onClick={handleInvest}>
                            <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                            {t('mystery_investment.invest')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? (totalReturn >= totalCoins ? 'var(--lp-emerald)' : 'var(--lp-amber-ink)') : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? (totalReturn >= totalCoins ? t('mystery_investment.profit') : t('mystery_investment.loss')) : t('feedback.error')}
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={totalReturn >= totalCoins ? 'go' : 'gold'} onClick={handleContinue}>
                                {t('actions.continue')}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
