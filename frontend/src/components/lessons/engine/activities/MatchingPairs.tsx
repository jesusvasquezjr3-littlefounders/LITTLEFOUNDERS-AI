import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

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
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Setup cards on load
    useEffect(() => {
        if (!exercise?.content?.pairs) return;

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
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
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
                timeoutRef.current = setTimeout(() => {
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
                timeoutRef.current = setTimeout(() => {
                    setSelectedCards([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    };

    const gridCols = cards.length === 4 ? "grid-cols-2 sm:grid-cols-2 max-w-md mx-auto" : "grid-cols-2 sm:grid-cols-3";

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
            <div className={`grid ${gridCols} gap-3 sm:gap-4 mb-8`}>
                {cards.map((card, index) => {
                    const isSelected = selectedCards.includes(index);
                    const isMatched = matchedIndices.has(index);

                    return (
                        <button
                            key={card.id}
                            onClick={() => handleCardClick(index)}
                            disabled={isMatched || isChecking}
                            style={{ animationDelay: `${0.04 + index * 0.05}s` }}
                            className={cn(
                                "lp-token lp-option relative h-20 sm:h-24 p-2 flex items-center justify-center text-center text-sm sm:text-base lp-display",
                                "animate-in fade-in zoom-in-95 duration-500 fill-mode-both",
                                isMatched
                                    ? "lp-option--emerald lp-token--locked is-correct opacity-60 scale-95"
                                    : isSelected
                                        ? "lp-option--indigo is-selected"
                                        : "lp-option--indigo"
                            )}
                        >
                            <span className="transition-opacity duration-300 opacity-100" style={{ color: "var(--lp-ink)" }}>
                                {card.text} {/* Could be Image or Icon too */}
                            </span>
                            {isMatched && <Check className="absolute top-1 right-1 w-4 h-4" style={{ color: "var(--lp-emerald)" }} strokeWidth={3.5} />}
                        </button>
                    );
                })}
            </div>

            {(feedback === 'success' || feedback === 'error') && (
                <QuestButton
                    variant={feedback === 'success' ? 'go' : 'retry'}
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
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </QuestButton>
            )}
        </div>
    );
};
