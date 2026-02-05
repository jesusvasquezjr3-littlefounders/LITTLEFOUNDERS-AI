import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus, Minus, Gift, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MysteryInvestmentProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => void;
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
    const [feedback, setFeedback] = useState<'none' | 'success'>('none');

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
        playSound('edu_success');

        // Check if diversified (invested in at least 2 boxes)
        const boxesUsed = Object.values(allocation).filter(v => v > 0).length;
        const minBoxes = exercise.correct_answer?.minBoxes || 2;

        setTimeout(() => {
            setFeedback('success');
            onSubmit(allocation);
        }, 2000);
    };

    const handleContinue = () => {
        onNext();
    };

    const totalReturn = Object.values(results).reduce((sum, val) => sum + val, 0);

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">

            {/* Coin Bank */}
            <div className="mb-8 flex justify-center">
                <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900 rounded-3xl px-8 py-6 shadow-xl border-4 border-yellow-600">
                    <div className="text-center">
                        <span className="text-sm font-bold opacity-80 block mb-1">
                            {t('mystery_investment.your_coins')}
                        </span>
                        <div className="text-5xl font-black flex items-center gap-2">
                            <span>🪙</span>
                            <span>{remainingCoins}</span>
                        </div>
                        <span className="text-xs opacity-70">
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
                            className={cn(
                                "p-4 rounded-2xl border-2 transition-all duration-300",
                                "bg-white dark:bg-slate-800",
                                invested > 0 && "ring-4 ring-purple-400 dark:ring-purple-600 shadow-xl",
                                invested === 0 && "border-slate-200 dark:border-slate-700",
                                showResults && "border-green-500"
                            )}
                        >
                            {/* Box Header */}
                            <div className="text-center mb-3">
                                <div className="text-3xl sm:text-4xl mb-2">
                                    {box.type === 'safe' && '🏆'}
                                    {box.type === 'risky' && '🎲'}
                                    {box.type === 'shared' && '🤝'}
                                </div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                                    {box.name}
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {box.description}
                                </p>
                            </div>

                            {/* Return Range */}
                            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-2 mb-3 text-center">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t('mystery_investment.return_range')}
                                </span>
                                <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                    {box.minReturn}x - {box.maxReturn}x
                                </span>
                            </div>

                            {/* Allocation Controls */}
                            {!showResults && (
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <button
                                        onClick={() => removeCoin(box.id)}
                                        disabled={!canRemove}
                                        className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-xl font-black text-slate-900 shadow-lg">
                                        {invested}
                                    </div>
                                    <button
                                        onClick={() => addCoin(box.id)}
                                        disabled={!canAdd}
                                        className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Results */}
                            {showResults && invested > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-400 dark:border-green-700 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-green-800 dark:text-green-200">
                                                {t('mystery_investment.invested')}
                                            </span>
                                            <span className="text-base font-black text-green-900 dark:text-green-100">
                                                🪙 {invested}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-green-800 dark:text-green-200">
                                                {t('mystery_investment.returned')}
                                            </span>
                                            <span className="text-xl font-black text-green-900 dark:text-green-100 flex items-center gap-1">
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
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl px-8 py-6 shadow-2xl">
                        <span className="text-base font-medium opacity-90 mb-1">
                            {t('mystery_investment.total_return')}
                        </span>
                        <div className="text-5xl font-black flex items-center gap-2">
                            <span>🪙</span>
                            <span>{totalReturn}</span>
                        </div>
                        <span className="text-xs opacity-80 mt-1">
                            {totalReturn > allocatedCoins ? t('mystery_investment.profit') : t('mystery_investment.loss')}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {!showResults ? (
                    <Button
                        onClick={handleInvest}
                        disabled={remainingCoins > 0}
                        className="w-full max-w-md h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <Gift className="w-5 h-5 mr-2" />
                        {t('mystery_investment.invest')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", totalReturn >= totalCoins ? "text-green-500" : "text-orange-500")}>
                            {totalReturn >= totalCoins ? t('mystery_investment.profit') : t('mystery_investment.loss')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                                totalReturn >= totalCoins
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                "hover:translate-y-[2px] active:translate-y-1 active:shadow-none")}
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
