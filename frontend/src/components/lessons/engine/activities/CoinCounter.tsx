import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface CoinCounterProps {
    exercise: any;
    onSubmit: (value: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const CoinCounter = ({ exercise, onSubmit, onNext, onRetry }: CoinCounterProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const targetAmount = exercise.content.targetAmount || 0;
    const availableCoins = exercise.content.coins_available || [
        { value: 1, image: '🪙' },
        { value: 5, image: '💵' },
        { value: 10, image: '💶' }
    ];

    const [currentAmount, setCurrentAmount] = useState(0);
    const [selectedCoins, setSelectedCoins] = useState<number[]>([]); // Array of coin values added
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setCurrentAmount(0);
        setSelectedCoins([]);
        setFeedback('none');
    }, [exercise]);

    const addCoin = (value: number) => {
        if (feedback !== 'none') return;
        playSound('ui_tap'); // Coin clink sound ideally

        setSelectedCoins(prev => [...prev, value]);
        setCurrentAmount(prev => prev + value);
    };

    const removeCoin = (index: number) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        const valueToRemove = selectedCoins[index];
        const newCoins = [...selectedCoins];
        newCoins.splice(index, 1);

        setSelectedCoins(newCoins);
        setCurrentAmount(prev => prev - valueToRemove);
    };

    const handleCheck = () => {
        const isCorrect = onSubmit(currentAmount);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setCurrentAmount(0);
            setSelectedCoins([]);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center">

            {/* Goal Display */}
            <div className="bg-card border-2 border-border shadow-sm p-6 rounded-3xl w-full mb-6 text-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">{t('actions.pay_exact')}</span>
                <div className="text-5xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
                    <DollarSign className="w-8 h-8 md:w-10 md:h-10 text-green-500" /> {targetAmount}
                </div>
            </div>

            {/* Coin/Bill Tray (Source) */}
            <div className="flex justify-center gap-4 mb-8 bg-black/5 dark:bg-white/5 p-4 rounded-2xl w-full">
                {availableCoins.map((coin: any, idx: number) => (
                    <button
                        key={idx}
                        onClick={() => addCoin(coin.value)}
                        className="group relative transition-transform hover:-translate-y-2 active:translate-y-0"
                    >
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-slate-700 shadow-md border-4 border-slate-200 flex items-center justify-center text-2xl md:text-3xl select-none group-hover:shadow-lg transition-all">
                            {coin.image || '🪙'}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {coin.value}
                        </div>
                    </button>
                ))}
            </div>

            {/* Counting Area (Target) */}
            <div className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 flex flex-wrap content-start items-start justify-center gap-2 mb-8 relative">
                {selectedCoins.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground opacity-50 font-medium">
                        {t('instructions.drag_coins_here')}
                    </div>
                )}

                {selectedCoins.map((val, idx) => (
                    <button
                        key={idx}
                        onClick={() => removeCoin(idx)}
                        className="w-12 h-12 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-sm flex items-center justify-center font-bold text-yellow-900 animate-in zoom-in hover:scale-110 transition-transform"
                    >
                        {val}
                    </button>
                ))}
            </div>

            {/* Current Total Indicator */}
            <div className={cn("text-2xl font-bold mb-6 transition-colors", currentAmount > targetAmount ? "text-red-500" : "text-slate-500")}>
                {t('economy.total')}: {currentAmount}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    className="w-full max-w-sm h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
                >
                    <span className="relative flex items-center justify-center">{t('actions.verify')}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full max-w-sm h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                        "hover:-translate-y-[2px]"
                    )}
                >
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
                    </span>
                </Button>
            )}
        </div>
    );
};
