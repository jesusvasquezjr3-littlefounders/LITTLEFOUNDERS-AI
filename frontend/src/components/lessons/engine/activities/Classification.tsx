import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom">
            {/* Categories Header */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
                {categories.map((category: any, idx: number) => {
                    const categoryColors = [
                        { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white', emoji: '🌟' },
                        { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white', emoji: '💎' },
                        { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white', emoji: '🌊' },
                    ];
                    const catColor = categoryColors[idx % categoryColors.length];

                    return (
                        <div
                            key={category.id}
                            className={`${catColor.bg} ${catColor.border} border-2 border-b-4 px-4 py-2 rounded-2xl text-center min-w-[120px]`}
                        >
                            <span className={`font-bold ${catColor.text} text-lg`}>
                                {catColor.emoji} {category.name || category.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Items List */}
            <div className="space-y-4 mb-8 max-h-[45vh] overflow-y-auto p-2 custom-scrollbar">
                {shuffledItems.map((item, idx) => {
                    const selectedCategory = selectedClassifications[item.id];

                    // Card colors
                    const cardColors = [
                        'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700',
                        'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700',
                        'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700',
                        'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
                    ];
                    const cardColor = cardColors[idx % cardColors.length];

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "border-l-4 rounded-r-xl p-4 transition-all duration-200 shadow-sm",
                                cardColor,
                                selectedCategory ? "opacity-100" : "opacity-90"
                            )}
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span className="font-bold text-lg flex-1 text-center sm:text-left">{item.text}</span>

                                <div className="flex gap-2 flex-wrap justify-center">
                                    {categories.map((cat: any, catIdx: number) => {
                                        const isSelected = selectedCategory === cat.id;

                                        // Button Styles
                                        const btnColors = [
                                            { active: 'bg-indigo-500 text-white shadow-none translate-y-[4px] ring-4 ring-indigo-300', inactive: 'bg-card text-foreground shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] border-border' },
                                            { active: 'bg-pink-500 text-white shadow-none translate-y-[4px] ring-4 ring-pink-300', inactive: 'bg-card text-foreground shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] border-border' },
                                            { active: 'bg-blue-500 text-white shadow-none translate-y-[4px] ring-4 ring-blue-300', inactive: 'bg-card text-foreground shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] border-border' },
                                        ];
                                        const color = btnColors[catIdx % btnColors.length];

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleClassificationClick(item.id, cat.id)}
                                                disabled={isChecked}
                                                className={cn(
                                                    "px-4 py-2 rounded-xl font-bold transition-all duration-200 border-2",
                                                    isSelected
                                                        ? `${color.active} border-transparent`
                                                        : `${color.inactive}`
                                                )}
                                            >
                                                {cat.name || cat.label}
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
                <Button
                    onClick={handleCheck}
                    disabled={Object.keys(selectedClassifications).length < (exercise.content.items?.length || 0)}
                    className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px]"
                >
                    <span className="relative flex items-center justify-center">✨ {t('actions.verify')} ✨</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                            : "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
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
