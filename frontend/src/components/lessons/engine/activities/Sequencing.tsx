import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SequencingProps {
    exercise: any;
    onSubmit: (sequence: string[]) => boolean;
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
        const currentIds = items.map(i => i.id);
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(currentIds);
        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
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
        <div className="w-full max-w-lg">
            <div role="list" className="space-y-3 mb-8">
                {items.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === items.length - 1;

                    return (
                        <div
                            role="listitem"
                            key={item.id}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                            className={cn(
                                "lp-card flex items-center gap-3 p-4 transition-all duration-300",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                isChecked && feedback === 'success' && "border-[var(--lp-emerald)] bg-[var(--lp-emerald-soft)]",
                                isChecked && feedback === 'error' && "border-[var(--lp-coral)] bg-[var(--lp-coral-soft)]"
                            )}
                        >
                            {/* Order Badge */}
                            <div
                                className="lp-badge lp-display w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                                style={{ background: "var(--lp-indigo)" }}
                            >
                                {index + 1}
                            </div>

                            {/* Content */}
                            <div className="lp-display flex-1 text-lg" style={{ color: "var(--lp-ink)" }}>
                                {item.text}
                            </div>

                            {/* Controls */}
                            {!isChecked && (
                                <div className="flex flex-col gap-1">
                                    <button
                                        aria-label="Mover arriba"
                                        onClick={() => handleSwap(index, 'up')}
                                        disabled={isFirst}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            isFirst ? "opacity-20 cursor-not-allowed" : "text-[var(--lp-indigo)] hover:bg-[var(--lp-indigo-soft)]"
                                        )}
                                    >
                                        <ArrowUp className="w-5 h-5" strokeWidth={2.75} />
                                    </button>
                                    <button
                                        aria-label="Mover abajo"
                                        onClick={() => handleSwap(index, 'down')}
                                        disabled={isLast}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            isLast ? "opacity-20 cursor-not-allowed" : "text-[var(--lp-indigo)] hover:bg-[var(--lp-indigo-soft)]"
                                        )}
                                    >
                                        <ArrowDown className="w-5 h-5" strokeWidth={2.75} />
                                    </button>
                                </div>
                            )}

                            {/* Result Icon */}
                            {isChecked && feedback === 'success' && (
                                <Check className="w-6 h-6 shrink-0" strokeWidth={3.5} style={{ color: "var(--lp-emerald)" }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <QuestButton variant="gold" onClick={handleCheck}>
                    {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </QuestButton>
            )}
        </div>
    );
};
