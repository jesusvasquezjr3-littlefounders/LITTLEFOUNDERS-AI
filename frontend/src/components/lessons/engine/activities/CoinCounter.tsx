import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

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
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 w-full mb-6 text-center">
                <span className="lp-display text-xs uppercase tracking-widest block mb-2" style={{ color: "var(--lp-muted)" }}>{t('actions.pay_exact')}</span>
                <div className="lp-display text-5xl flex items-center justify-center gap-2" style={{ color: "var(--lp-ink)" }}>
                    <DollarSign className="w-8 h-8 md:w-10 md:h-10" style={{ color: "var(--lp-emerald)" }} /> {targetAmount}
                </div>
            </div>

            {/* Coin/Bill Tray (Source) */}
            <div className="flex justify-center flex-wrap gap-4 sm:gap-5 mb-8 p-4 rounded-full w-full" style={{ background: "var(--lp-bg-2)" }}>
                {availableCoins.map((coin: any, idx: number) => (
                    <button
                        key={idx}
                        onClick={() => addCoin(coin.value)}
                        className="group lp-token relative w-20 h-20 sm:w-24 sm:h-24 !rounded-full flex flex-col items-center justify-center select-none"
                    >
                        <span className="text-3xl sm:text-4xl leading-none">
                            {coin.image || '🪙'}
                        </span>
                        <div className="lp-badge absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs px-2.5 py-0.5 !rounded-full">
                            {coin.value}
                        </div>
                    </button>
                ))}
            </div>

            {/* Counting Area (Target) */}
            <div
                className="w-full min-h-[160px] rounded-3xl p-6 flex flex-wrap content-start items-start justify-center gap-2 sm:gap-3 mb-8 relative"
                style={{ background: "var(--lp-bg-2)", border: "2px dashed var(--lp-line)" }}
            >
                {selectedCoins.length === 0 && (
                    <div className="lp-display absolute inset-0 flex items-center justify-center opacity-60" style={{ color: "var(--lp-muted)" }}>
                        {t('instructions.drag_coins_here')}
                    </div>
                )}

                {selectedCoins.map((val, idx) => (
                    <button
                        key={idx}
                        onClick={() => removeCoin(idx)}
                        className="lp-display w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg animate-in zoom-in transition-transform hover:scale-110"
                        style={{ background: "var(--lp-indigo-soft)", border: "2px solid var(--lp-indigo)", color: "var(--lp-indigo-ink)" }}
                    >
                        {val}
                    </button>
                ))}
            </div>

            {/* Current Total Indicator */}
            <div
                className="lp-display text-2xl mb-6 transition-colors"
                style={{ color: currentAmount > targetAmount ? "var(--lp-coral)" : "var(--lp-muted)" }}
            >
                {t('economy.total')}: {currentAmount}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <QuestButton variant="gold" className="max-w-sm" onClick={handleCheck}>
                    {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton
                    variant={feedback === 'success' ? 'go' : 'retry'}
                    className="max-w-sm"
                    onClick={handleContinue}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                </QuestButton>
            )}
        </div>
    );
};
