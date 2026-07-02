import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface ClassificationProps {
    exercise: any;
    onSubmit: (classifications: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const Classification = ({ exercise, onSubmit, onNext, onRetry }: ClassificationProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedClassifications, setSelectedClassifications] = useState<Record<string, string>>({});
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [shuffledItems, setShuffledItems] = useState<any[]>([]);

    useEffect(() => {
        setSelectedClassifications({});
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

    const handleClassificationClick = (itemId: string, categoryId: string) => {
        if (isChecked) return;
        playSound('ui_tap');
        setSelectedClassifications(prev => ({
            ...prev,
            [itemId]: categoryId
        }));
    };

    const handleCheck = () => {
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(selectedClassifications);
        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedClassifications({});
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const categories = exercise.content.categories || [];
    // El corpus usa distintas claves para la etiqueta (name/label/text/title).
    // Leer solo name||label dejaba ~252 categorías en blanco en producción.
    const catLabel = (c: any): string => c?.name || c?.label || c?.text || c?.title || '';

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
            {/* Categories Header */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-6">
                {categories.map((category: any, idx: number) => {
                    const categoryColors = [
                        { fill: 'var(--lp-indigo)', lip: 'var(--lp-indigo-lip)', emoji: '🌟' },
                        { fill: 'var(--lp-amber)', lip: 'var(--lp-amber-lip)', emoji: '💎' },
                        { fill: 'var(--lp-emerald)', lip: 'var(--lp-emerald-lip)', emoji: '🌊' },
                    ];
                    const catColor = categoryColors[idx % categoryColors.length];

                    return (
                        <div
                            key={category.id}
                            className="lp-display rounded-full px-4 py-2.5 text-center min-w-[120px] text-white text-lg"
                            style={{ background: catColor.fill, boxShadow: `0 4px 0 ${catColor.lip}` }}
                        >
                            <span className="font-bold">
                                {catColor.emoji} {catLabel(category)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Items List */}
            <div className="space-y-3 mb-8 max-h-[45vh] overflow-y-auto p-2 custom-scrollbar">
                {shuffledItems.map((item) => {
                    const selectedCategory = selectedClassifications[item.id];

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "bg-white rounded-[2.5rem] shadow-sm p-4 transition-opacity duration-200",
                                selectedCategory ? "opacity-100" : "opacity-95"
                            )}
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span
                                    className="lp-display text-lg flex-1 text-center sm:text-left"
                                    style={{ color: "var(--lp-ink)" }}
                                >
                                    {item.text}
                                </span>

                                <div className="flex gap-2 flex-wrap justify-center">
                                    {categories.map((cat: any, catIdx: number) => {
                                        const isSelected = selectedCategory === cat.id;
                                        const hues = ['indigo', 'amber', 'emerald', 'coral'];
                                        const hue = hues[catIdx % hues.length];

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleClassificationClick(item.id, cat.id)}
                                                disabled={isChecked}
                                                className={cn(
                                                    "lp-token lp-option lp-display px-4 py-2 text-base",
                                                    `lp-option--${hue}`,
                                                    isSelected && "is-selected",
                                                    isChecked && "lp-token--locked"
                                                )}
                                                style={{ color: "var(--lp-ink)" }}
                                            >
                                                {catLabel(cat)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <QuestButton
                    variant="gold"
                    onClick={handleCheck}
                    disabled={Object.keys(selectedClassifications).length < (exercise.content.items?.length || 0)}
                >
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
