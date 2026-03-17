import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface TapActionProps {
    exercise: any;
    onSubmit: (items: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TapAction = ({ exercise, onSubmit, onNext, onRetry }: TapActionProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [tappedItems, setTappedItems] = useState<Set<string>>(new Set());
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [shuffledItems, setShuffledItems] = useState<any[]>([]);

    useEffect(() => {
        setTappedItems(new Set());
        setIsChecked(false);
        setFeedback('none');

        if (exercise?.content?.items) {
            const items = [...exercise.content.items];
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            setShuffledItems(items);
        }
    }, [exercise]);

    const handleTapItem = (id: string) => {
        if (isChecked) return;
        playSound('ui_tap');
        setTappedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleCheck = () => {
        if (tappedItems.size === 0) return;

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit([...tappedItems]);
        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setTappedItems(new Set());
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const isCorrect = feedback === 'success';

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom flex flex-col items-center">
            {/* Items Grid - Using Flex Wrap for Symmetry */}
            <div className="flex flex-wrap justify-center gap-4 mb-8 w-full">
                {shuffledItems.map((item, idx) => {
                    const isTapped = tappedItems.has(item.id);
                    const showResult = isChecked;
                    const itemIsTarget = item.isTarget === true;

                    // Display Content
                    let content: React.ReactNode = '❓';
                    if (item.image && (item.image.startsWith('/') || item.image.startsWith('http'))) {
                        content = <img src={item.image} alt={item.text} className="w-16 h-16 object-contain pointer-events-none" />;
                    } else if (item.emoji) content = item.emoji;
                    else if (item.text) content = item.text;
                    else if (item.shape === 'circle') content = item.color === 'gold' ? '🪙' : '⭕';
                    else if (item.shape === 'rectangle') content = item.color === 'green' ? '💵' : '📄';

                    // Colors
                    const bgColors = [
                        { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', shadow: 'shadow-[0_4px_0_rgb(29,78,216)]' },
                        { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', shadow: 'shadow-[0_4px_0_rgb(190,24,93)]' },
                        { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', shadow: 'shadow-[0_4px_0_rgb(194,65,12)]' },
                        { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', shadow: 'shadow-[0_4px_0_rgb(16,185,129)]' },
                        { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', shadow: 'shadow-[0_4px_0_rgb(107,33,168)]' },
                        { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', shadow: 'shadow-[0_4px_0_rgb(202,138,4)]' },
                    ];
                    const color = bgColors[idx % bgColors.length];

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleTapItem(item.id)}
                            disabled={isChecked}
                            className={cn(
                                "min-w-24 min-h-24 sm:min-w-28 sm:min-h-28 max-w-32 sm:max-w-36 rounded-2xl flex items-center justify-center transition-all duration-200 transform text-white font-bold relative p-3",
                                // Default
                                !isTapped && !showResult && `${color.bg} ${color.hover} ${color.shadow} active:translate-y-[2px] active:shadow-none`,

                                // Selected
                                !showResult && isTapped && `${color.bg} translate-y-[4px] shadow-none ring-4 ring-white/60 scale-95 brightness-110`,

                                // Success Result
                                showResult && feedback === 'success' && isTapped && itemIsTarget && "bg-green-500 shadow-none ring-4 ring-white scale-105 z-10",
                                showResult && feedback === 'success' && !isTapped && "opacity-20 grayscale",

                                // Error Result
                                showResult && feedback === 'error' && isTapped && !itemIsTarget && "bg-red-500 shadow-none ring-4 ring-white", // Wrongly tapped
                                showResult && feedback === 'error' && isTapped && itemIsTarget && "bg-green-500 shadow-none", // Correctly tapped
                                showResult && feedback === 'error' && !isTapped && "opacity-50 grayscale" // Ignored
                            )}
                        >
                            <span className="relative z-10 drop-shadow-md text-center break-words leading-tight text-xs sm:text-sm">{content}</span>

                            {/* Indicators */}
                            {showResult && feedback === 'success' && isTapped && itemIsTarget && (
                                <div className="absolute -top-2 -right-2 bg-white text-green-600 rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-sm">
                                    <Check className="w-4 h-4" />
                                </div>
                            )}
                            {showResult && feedback === 'error' && isTapped && !itemIsTarget && (
                                <div className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-sm">
                                    <X className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={tappedItems.size === 0}
                    className="relative overflow-hidden w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:from-gray-400 disabled:to-gray-400"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">🎯 {t('actions.verify')}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "relative overflow-hidden w-full h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? '🎉 ' + t('actions.continue') : '🔄 ' + t('actions.retry')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </span>
                </Button>
            )}
        </div>
    );
};
