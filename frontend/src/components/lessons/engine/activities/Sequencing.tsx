import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Check, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface SequencingProps {
    exercise: any;
    onSubmit: (sequence: string[]) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const Sequencing = ({ exercise, onSubmit, onNext, onRetry }: SequencingProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [items, setItems] = useState<any[]>([]);
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setIsChecked(false);
        setFeedback('none');

        if (exercise?.content?.items) {
            // Shuffle initially
            const shuffled = [...exercise.content.items];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setItems(shuffled);
        }
    }, [exercise]);

    const handleSwap = (index: number, direction: 'up' | 'down') => {
        if (isChecked) return;
        playSound('ui_tap');

        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newItems.length) {
            [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
            setItems(newItems);
        }
    };

    const handleCheck = () => {
        const correctSequence = exercise.correct_answer?.sequence || [];
        // Check if current order matches correct sequence IDs
        const currentIds = items.map(i => i.id);

        const isCorrect =
            currentIds.length === correctSequence.length &&
            currentIds.every((id, idx) => id === correctSequence[idx]);

        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
        onSubmit(currentIds);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Shuffle again for retry
            const shuffled = [...items];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setItems(shuffled);

            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom">
            <div className="space-y-3 mb-8">
                {items.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === items.length - 1;

                    // Colors - Sequential or specific? Sequential gradient looks nice
                    // Or keep brand solid colors based on original index?
                    // Let's use a nice neutral card with vibrant accent
                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-center gap-3 p-4 bg-card border-2 rounded-2xl shadow-sm transition-all duration-300",
                                isChecked && feedback === 'success' ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-border",
                                isChecked && feedback === 'error' ? "border-red-300" : ""
                            )}
                        >
                            {/* Order Badge */}
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm shrink-0">
                                {index + 1}
                            </div>

                            {/* Content */}
                            <div className="flex-1 font-bold text-lg">
                                {item.text}
                            </div>

                            {/* Controls */}
                            {!isChecked && (
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => handleSwap(index, 'up')}
                                        disabled={isFirst}
                                        className={cn(
                                            "p-1 rounded-md hover:bg-muted transition-colors",
                                            isFirst ? "opacity-20 cursor-not-allowed" : "text-purple-600"
                                        )}
                                    >
                                        <ArrowUp className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleSwap(index, 'down')}
                                        disabled={isLast}
                                        className={cn(
                                            "p-1 rounded-md hover:bg-muted transition-colors",
                                            isLast ? "opacity-20 cursor-not-allowed" : "text-purple-600"
                                        )}
                                    >
                                        <ArrowDown className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {/* Result Icon */}
                            {isChecked && feedback === 'success' && (
                                <Check className="w-6 h-6 text-green-500" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                >
                    {t('actions.verify')}
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            )}
        </div>
    );
};
