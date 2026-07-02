import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, ArrowRight, RotateCcw, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { Reorder } from 'framer-motion';

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
            <Reorder.Group 
                axis="y" 
                values={items} 
                onReorder={setItems} 
                className="space-y-3 mb-8"
            >
                {items.map((item, index) => {
                    return (
                        <Reorder.Item
                            key={item.id}
                            value={item}
                            dragListener={!isChecked}
                            className={cn(
                                "bg-white rounded-[2.5rem] shadow-sm flex items-center gap-3 p-4 transition-colors duration-300",
                                !isChecked && "cursor-grab active:cursor-grabbing",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                isChecked && feedback === 'success' && "border-[var(--lp-emerald)] bg-[var(--lp-emerald-soft)]",
                                isChecked && feedback === 'error' && "border-[var(--lp-coral)] bg-[var(--lp-coral-soft)]"
                            )}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                        >
                            {/* Grip Handle */}
                            {!isChecked && (
                                <div className="text-slate-300 hover:text-slate-400 touch-none shrink-0 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-6 h-6" />
                                </div>
                            )}

                            {/* Order Badge */}
                            <div
                                className="lp-badge lp-display w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                                style={{ background: "var(--lp-indigo)" }}
                            >
                                {index + 1}
                            </div>

                            {/* Content */}
                            <div className="lp-display flex-1 text-lg" style={{ color: "var(--lp-ink)" }}>
                                {item.text}
                            </div>

                            {/* Result Icon */}
                            {isChecked && feedback === 'success' && (
                                <Check className="w-6 h-6 shrink-0" strokeWidth={3.5} style={{ color: "var(--lp-emerald)" }} />
                            )}
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>

            {/* Action Button */}
            {!isChecked ? (
                <QuestButton variant="gold" onClick={handleCheck}>
                    {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton
                    variant={feedback === 'success' ? 'go' : 'retry'}
                    onClick={handleContinue}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </QuestButton>
            )}
        </div>
    );
};
