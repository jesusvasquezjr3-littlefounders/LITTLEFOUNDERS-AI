import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface TapActionProps {
    exercise: any;
    onSubmit: (items: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

// Playful DS v2 hues, cycled across the tappable tokens.
const HUES = ['indigo', 'amber', 'emerald', 'coral'] as const;

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
                        content = <img src={item.image} alt={item.text} className="w-20 h-20 sm:w-28 sm:h-28 object-contain pointer-events-none" />;
                    } else if (item.emoji) content = item.emoji;
                    else if (item.text) content = item.text;
                    else if (item.shape === 'circle') content = item.color === 'gold' ? '🪙' : '⭕';
                    else if (item.shape === 'rectangle') content = item.color === 'green' ? '💵' : '📄';

                    const hue = HUES[idx % HUES.length];

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleTapItem(item.id)}
                            disabled={isChecked}
                            style={{ animationDelay: `${0.04 + idx * 0.05}s` }}
                            className={cn(
                                "lp-token lp-option relative flex items-center justify-center p-3 overflow-hidden",
                                "min-w-20 min-h-20 sm:min-w-28 sm:min-h-28 max-w-28 sm:max-w-36",
                                "animate-in fade-in zoom-in-95 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                isChecked && "lp-token--locked",

                                // Selected (pre-check)
                                !showResult && isTapped && "is-selected",

                                // Success Result
                                showResult && feedback === 'success' && isTapped && itemIsTarget && "is-correct z-10",
                                showResult && feedback === 'success' && !isTapped && "is-dimmed grayscale",

                                // Error Result
                                showResult && feedback === 'error' && isTapped && !itemIsTarget && "is-wrong", // Wrongly tapped
                                showResult && feedback === 'error' && isTapped && itemIsTarget && "is-correct", // Correctly tapped
                                showResult && feedback === 'error' && !isTapped && "is-dimmed grayscale" // Ignored
                            )}
                        >
                            <span className="relative z-10 lp-display text-center break-words leading-tight text-sm sm:text-base" style={{ color: 'var(--lp-ink)' }}>{content}</span>

                            {/* Indicators */}
                            {showResult && feedback === 'success' && isTapped && itemIsTarget && (
                                <div className="absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center text-white" style={{ background: 'var(--lp-emerald)', boxShadow: '0 3px 0 var(--lp-emerald-lip)' }}>
                                    <Check className="w-4 h-4" strokeWidth={3.5} />
                                </div>
                            )}
                            {showResult && feedback === 'error' && isTapped && !itemIsTarget && (
                                <div className="absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center text-white" style={{ background: 'var(--lp-coral)', boxShadow: '0 3px 0 var(--lp-coral-lip)' }}>
                                    <X className="w-4 h-4" strokeWidth={3.5} />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <QuestButton variant="gold" disabled={tappedItems.size === 0} onClick={handleCheck}>
                    🎯 {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                    {feedback === 'success' ? '🎉 ' + t('actions.continue') : '🔄 ' + t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
                </QuestButton>
            )}
        </div>
    );
};
