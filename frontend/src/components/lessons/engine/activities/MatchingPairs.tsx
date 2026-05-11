import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MatchingPairsProps {
    exercise: any;
    onSubmit: (matchedPairs: string[][] | boolean) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MatchingPairs = ({ exercise, onSubmit, onNext, onRetry }: MatchingPairsProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [cards, setCards] = useState<any[]>([]);
    const [selectedCards, setSelectedCards] = useState<number[]>([]); // Indices
    const [matchedIndices, setMatchedIndices] = useState<Set<number>>(new Set());
    const [isChecking, setIsChecking] = useState(false); // Validating a pair
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Setup cards on load
    useEffect(() => {
        if (!exercise.content.pairs) return;

        const pairs: Array<{ id: string, text: string, pairId: string }> = [];
        exercise.content.pairs.forEach((pair: any) => {
            // Create two cards for each pair
            pairs.push({ id: `${pair.id}-a`, text: pair.left, pairId: pair.id });
            pairs.push({ id: `${pair.id}-b`, text: pair.right, pairId: pair.id });
        });

        // Shuffle
        for (let i = pairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
        }

        setCards(pairs);
        setMatchedIndices(new Set());
        setSelectedCards([]);
        setFeedback('none');
    }, [exercise]);

    const handleCardClick = (index: number) => {
        if (isChecking || matchedIndices.has(index) || selectedCards.includes(index)) return;

        playSound('ui_tap');
        const newSelected = [...selectedCards, index];
        setSelectedCards(newSelected);

        if (newSelected.length === 2) {
            setIsChecking(true);
            const card1 = cards[newSelected[0]];
            const card2 = cards[newSelected[1]];

            if (card1.pairId === card2.pairId) {
                // Match!
                playSound('ui_tap');
                setTimeout(() => {
                    setMatchedIndices(prev => {
                        const next = new Set([...prev, newSelected[0], newSelected[1]]);
                        // Check if all matched using the updated set
                        if (next.size === cards.length) {
                            const isCorrect = onSubmit(true);
                            setFeedback(isCorrect ? 'success' : 'error');
                        }
                        return next;
                    });
                    setSelectedCards([]);
                    setIsChecking(false);
                }, 500);
            } else {
                // No match
                playSound('ui_tap');
                setTimeout(() => {
                    setSelectedCards([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    };

    const gridCols = cards.length === 4 ? "grid-cols-2 sm:grid-cols-2 max-w-md mx-auto" : "grid-cols-2 sm:grid-cols-3";

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom">
            <div className={`grid ${gridCols} gap-3 sm:gap-4 mb-8`}>
                {cards.map((card, index) => {
                    const isSelected = selectedCards.includes(index);
                    const isMatched = matchedIndices.has(index);

                    return (
                        <button
                            key={card.id}
                            onClick={() => handleCardClick(index)}
                            disabled={isMatched || isChecking}
                            className={cn(
                                "h-20 sm:h-24 rounded-2xl border-2 p-2 flex items-center justify-center text-center font-bold text-sm sm:text-base transition-all transform duration-300 perspective-1000",
                                isMatched
                                    ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 opacity-50 scale-95"
                                    : isSelected
                                        ? "bg-purple-500 border-purple-700 text-white shadow-none translate-y-[4px] rotate-y-180"
                                        : "bg-card border-border shadow-[0_4px_0_hsl(var(--border))] hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none"
                            )}
                        >
                            <span className={cn("transition-opacity duration-300", isMatched ? "opacity-100" : isSelected ? "opacity-100" : "opacity-100")}>
                                {card.text} {/* Could be Image or Icon too */}
                            </span>
                            {isMatched && <Check className="absolute top-1 right-1 w-4 h-4 text-green-600" />}
                        </button>
                    );
                })}
            </div>

            {(feedback === 'success' || feedback === 'error') && (
                <Button
                    onClick={() => {
                        if (feedback === 'success') {
                            onNext();
                        } else {
                            setMatchedIndices(new Set());
                            setSelectedCards([]);
                            setIsChecking(false);
                            setFeedback('none');
                            onRetry();
                        }
                    }}
                    className={cn(
                        "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                        "hover:-translate-y-[2px]"
                    )}
                >
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-6 h-6" />
                    </span>
                </Button>
            )}
        </div>
    );
};
